package expo.modules.wakealarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * Foreground service that owns the ringing alarm: fallback audio (USAGE_ALARM), vibration,
 * native fade, the full-screen notification and the auto-silence timer. It never depends on
 * JavaScript being alive (spec §2, §52). JS may later lower the fallback volume to crossfade
 * into Spotify (setAlarmVolume) or stop/snooze through the module.
 */
class AlarmService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var focusRequest: AudioFocusRequest? = null
  private var currentSpec: AlarmSpec? = null
  private var snoozeCount = 0
  private var firedAt = 0L
  private var originalAlarmStreamVolume: Int? = null
  private var fadeRunnable: Runnable? = null
  private val autoSilence = Runnable { stopAlarm("timeout") }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        val id = intent.getStringExtra(WakeAlarmContract.EXTRA_ID)
        val count = intent.getIntExtra(WakeAlarmContract.EXTRA_SNOOZE_COUNT, 0)
        if (id != null) startAlarm(id, count) else finishService()
      }
      ACTION_STOP -> stopAlarm("user")
      ACTION_SNOOZE -> snooze(intent.getIntExtra(WakeAlarmContract.EXTRA_MINUTES, -1))
      ACTION_SET_VOLUME -> setPlayerVolume(intent.getDoubleExtra(WakeAlarmContract.EXTRA_VOLUME, 1.0).toFloat())
      else -> if (currentSpec == null) finishService()
    }
    return START_NOT_STICKY
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  private fun startAlarm(id: String, count: Int) {
    val store = AlarmStore(this)
    val spec = store.get(id)
    if (spec == null) {
      Log.w(WakeAlarmContract.TAG, "service start for unknown alarm $id")
      finishService()
      return
    }

    // Concurrent alarms (spec §40): stop the previous one, show the latest.
    currentSpec?.let { previous ->
      if (previous.id != id) {
        teardownPlayback()
        store.appendHistory(JSONObject().put("type", "stopped").put("alarmId", previous.id).put("reason", "replaced"))
        broadcast(WakeAlarmContract.EVENT_STOPPED, previous.id) { putExtra(WakeAlarmContract.EXTRA_REASON, "replaced") }
      }
    }

    currentSpec = spec
    snoozeCount = count
    firedAt = System.currentTimeMillis()
    activeAlarmId = id
    store.setActive(id, firedAt, count)

    createChannel()
    val notification = buildNotification(spec)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    acquireWakeLock()
    try {
      startAudio(spec)
    } catch (e: Exception) {
      Log.e(WakeAlarmContract.TAG, "audio start failed", e)
      store.setLastError("audio: ${e.message}")
    }
    if (spec.vibrate) startVibration()

    handler.removeCallbacks(autoSilence)
    handler.postDelayed(autoSilence, AUTO_SILENCE_MS)

    store.appendHistory(
      JSONObject().put("type", "fired").put("alarmId", id).put("snoozeCount", count).put("sound", spec.soundFile),
    )
    broadcast(WakeAlarmContract.EVENT_FIRED, id) {
      putExtra(WakeAlarmContract.EXTRA_FIRED_AT, firedAt)
      putExtra(WakeAlarmContract.EXTRA_SNOOZE_COUNT, count)
    }
  }

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------

  private fun alarmAttributes(): AudioAttributes = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_ALARM)
    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
    .build()

  private fun startAudio(spec: AlarmSpec) {
    val am = getSystemService(AudioManager::class.java)
    ensureAlarmStreamAudible(am)
    requestFocus(am)

    val target = if (spec.fadeInSeconds > 0) spec.fadeEndVolume.toFloat() else 1f
    val start = if (spec.fadeInSeconds > 0) spec.fadeStartVolume.toFloat() else target

    val mp = MediaPlayer()
    mp.setAudioAttributes(alarmAttributes())
    mp.isLooping = true
    mp.setOnErrorListener { _, what, extra ->
      Log.e(WakeAlarmContract.TAG, "MediaPlayer error $what/$extra — switching to system alarm sound")
      AlarmStore(this).setLastError("MediaPlayer error $what/$extra")
      handler.post { restartWithSystemSound(start) }
      true
    }
    try {
      mp.setDataSource(this, primarySoundUri(spec))
      mp.setVolume(start, start)
      mp.prepare()
      mp.start()
    } catch (e: Exception) {
      Log.e(WakeAlarmContract.TAG, "bundled sound failed, using system alarm sound", e)
      mp.reset()
      mp.setAudioAttributes(alarmAttributes())
      mp.isLooping = true
      mp.setDataSource(this, systemAlarmUri())
      mp.setVolume(start, start)
      mp.prepare()
      mp.start()
    }
    player = mp

    if (spec.fadeInSeconds > 0) startFade(start, target, spec.fadeInSeconds)
  }

  private fun restartWithSystemSound(volume: Float) {
    try {
      player?.release()
      val mp = MediaPlayer()
      mp.setAudioAttributes(alarmAttributes())
      mp.isLooping = true
      mp.setDataSource(this, systemAlarmUri())
      mp.setVolume(volume, volume)
      mp.prepare()
      mp.start()
      player = mp
    } catch (e: Exception) {
      Log.e(WakeAlarmContract.TAG, "system sound also failed", e)
    }
  }

  /** Recording file first (Android can play it without JS), then the bundled sound, then the system alarm. */
  private fun primarySoundUri(spec: AlarmSpec): Uri {
    spec.soundUri?.let { raw ->
      try {
        val uri = Uri.parse(raw)
        val path = uri.path
        if (uri.scheme == "file" && path != null && java.io.File(path).exists()) return uri
      } catch (_: Exception) {}
      Log.w(WakeAlarmContract.TAG, "soundUri missing, using bundled sound")
    }
    return soundUri(spec.soundFile)
  }

  private fun soundUri(name: String): Uri {
    val resId = resources.getIdentifier(name, "raw", packageName)
    return if (resId != 0) Uri.parse("android.resource://$packageName/$resId") else systemAlarmUri()
  }

  private fun systemAlarmUri(): Uri =
    RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM) ?: Settings.System.DEFAULT_ALARM_ALERT_URI

  /** Spec §16: capture → raise if silent → restore on stop. Never leaves the phone louder than before. */
  private fun ensureAlarmStreamAudible(am: AudioManager?) {
    if (am == null) return
    try {
      val max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
      val current = am.getStreamVolume(AudioManager.STREAM_ALARM)
      val floor = (max * MIN_ALARM_STREAM_FRACTION).roundToInt().coerceAtLeast(1)
      if (current < floor) {
        originalAlarmStreamVolume = current
        AlarmStore(this).setSavedStreamVolume(current)
        am.setStreamVolume(AudioManager.STREAM_ALARM, floor, 0)
      }
    } catch (e: SecurityException) {
      // Do Not Disturb can block volume changes; the alarm stream is usually still allowed to ring.
      Log.w(WakeAlarmContract.TAG, "cannot adjust STREAM_ALARM", e)
    }
  }

  private fun restoreAlarmStreamVolume() {
    val original = originalAlarmStreamVolume ?: return
    try {
      getSystemService(AudioManager::class.java)?.setStreamVolume(AudioManager.STREAM_ALARM, original, 0)
    } catch (_: Exception) {}
    originalAlarmStreamVolume = null
    AlarmStore(this).setSavedStreamVolume(null)
  }

  private fun requestFocus(am: AudioManager?) {
    if (am == null) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(alarmAttributes())
        .build()
      focusRequest = req
      am.requestAudioFocus(req)
    } else {
      @Suppress("DEPRECATION")
      am.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    }
  }

  private fun abandonFocus() {
    val am = getSystemService(AudioManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest?.let { am.abandonAudioFocusRequest(it) }
    } else {
      @Suppress("DEPRECATION")
      am.abandonAudioFocus(null)
    }
    focusRequest = null
  }

  private fun startFade(from: Float, to: Float, seconds: Int) {
    fadeRunnable?.let { handler.removeCallbacks(it) }
    val startedAt = System.currentTimeMillis()
    val durationMs = seconds * 1000L
    val r = object : Runnable {
      override fun run() {
        val elapsed = System.currentTimeMillis() - startedAt
        val t = (elapsed.toFloat() / durationMs).coerceIn(0f, 1f)
        val v = from + (to - from) * t
        setPlayerVolume(v)
        if (t < 1f) handler.postDelayed(this, FADE_STEP_MS)
      }
    }
    fadeRunnable = r
    handler.post(r)
  }

  private fun setPlayerVolume(volume: Float) {
    val v = volume.coerceIn(0f, 1f)
    try { player?.setVolume(v, v) } catch (_: Exception) {}
  }

  // ---------------------------------------------------------------------------
  // Vibration
  // ---------------------------------------------------------------------------

  private fun startVibration() {
    val v: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      getSystemService(VibratorManager::class.java)?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      getSystemService(VIBRATOR_SERVICE) as? Vibrator
    }
    if (v == null || !v.hasVibrator()) return
    vibrator = v
    val pattern = longArrayOf(0, 700, 700)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        v.vibrate(VibrationEffect.createWaveform(pattern, 0), VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM))
      } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        @Suppress("DEPRECATION")
        v.vibrate(VibrationEffect.createWaveform(pattern, 0), alarmAttributes())
      } else {
        @Suppress("DEPRECATION")
        v.vibrate(pattern, 0)
      }
    } catch (e: Exception) {
      Log.w(WakeAlarmContract.TAG, "vibration failed", e)
    }
  }

  // ---------------------------------------------------------------------------
  // Snooze / stop
  // ---------------------------------------------------------------------------

  private fun snooze(minutesOverride: Int) {
    val spec = currentSpec ?: run { finishService(); return }
    val minutes = if (minutesOverride > 0) minutesOverride else spec.snoozeMinutes
    if (minutes <= 0) {
      stopAlarm("user")
      return
    }
    teardownPlayback()
    val until = System.currentTimeMillis() + minutes * 60_000L
    val store = AlarmStore(this)
    try {
      WakeAlarmScheduler.schedule(this, spec, until, isSnooze = true, snoozeCount = snoozeCount + 1)
      store.setSnoozeUntil(spec.id, until)
    } catch (e: Exception) {
      Log.e(WakeAlarmContract.TAG, "snooze scheduling failed", e)
      store.setLastError("snooze: ${e.message}")
    }
    store.clearActive()
    store.appendHistory(JSONObject().put("type", "snoozed").put("alarmId", spec.id).put("until", until).put("snoozeCount", snoozeCount + 1))
    broadcast(WakeAlarmContract.EVENT_SNOOZED, spec.id) { putExtra(WakeAlarmContract.EXTRA_UNTIL, until) }
    finishService()
  }

  private fun stopAlarm(reason: String) {
    val spec = currentSpec
    teardownPlayback()
    val store = AlarmStore(this)
    if (spec != null) {
      store.clearActive()
      store.clearSnooze(spec.id)
      WakeAlarmScheduler.cancelSnooze(this, spec.id)
      if (!spec.isRepeating) {
        // One-time alarms are consumed once they ring; nothing to restore on boot.
        store.remove(spec.id)
      }
      store.appendHistory(
        JSONObject().put("type", "stopped").put("alarmId", spec.id).put("reason", reason)
          .put("ringDurationMs", System.currentTimeMillis() - firedAt).put("snoozeCount", snoozeCount),
      )
      broadcast(WakeAlarmContract.EVENT_STOPPED, spec.id) { putExtra(WakeAlarmContract.EXTRA_REASON, reason) }
    }
    finishService()
  }

  private fun teardownPlayback() {
    handler.removeCallbacks(autoSilence)
    fadeRunnable?.let { handler.removeCallbacks(it) }
    fadeRunnable = null
    try { player?.stop() } catch (_: Exception) {}
    try { player?.release() } catch (_: Exception) {}
    player = null
    try { vibrator?.cancel() } catch (_: Exception) {}
    vibrator = null
    abandonFocus()
    restoreAlarmStreamVolume()
  }

  private fun finishService() {
    currentSpec = null
    activeAlarmId = null
    releaseWakeLock()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    stopSelf()
  }

  override fun onDestroy() {
    teardownPlayback()
    releaseWakeLock()
    activeAlarmId = null
    super.onDestroy()
  }

  // ---------------------------------------------------------------------------
  // Wake lock / notification / events
  // ---------------------------------------------------------------------------

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    try {
      val pm = getSystemService(PowerManager::class.java)
      wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "wake:alarm-service")?.apply {
        acquire(AUTO_SILENCE_MS + 60_000L)
      }
    } catch (e: Exception) {
      Log.w(WakeAlarmContract.TAG, "service wake lock failed", e)
    }
  }

  private fun releaseWakeLock() {
    try { if (wakeLock?.isHeld == true) wakeLock?.release() } catch (_: Exception) {}
    wakeLock = null
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java) ?: return
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Alarms", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Ringing alarms"
      setSound(null, null) // the service plays audio itself on the alarm stream
      enableVibration(false)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setBypassDnd(true)
    }
    nm.createNotificationChannel(channel)
  }

  private fun buildNotification(spec: AlarmSpec): Notification {
    val fullScreen = Intent(this, AlarmActivity::class.java)
      .putExtra(WakeAlarmContract.EXTRA_ID, spec.id)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val fullScreenPi = PendingIntent.getActivity(this, 1, fullScreen, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    val stopPi = PendingIntent.getService(
      this, 2,
      Intent(this, AlarmService::class.java).setAction(ACTION_STOP).putExtra(WakeAlarmContract.EXTRA_ID, spec.id),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val snoozePi = PendingIntent.getService(
      this, 3,
      Intent(this, AlarmService::class.java).setAction(ACTION_SNOOZE).putExtra(WakeAlarmContract.EXTRA_ID, spec.id),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(spec.label)
      .setContentText("Alarm · hold STOP to dismiss")
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(false)
      .setSilent(true)
      .setContentIntent(fullScreenPi)
      .setFullScreenIntent(fullScreenPi, true)
      .addAction(0, "Stop", stopPi)
    if (spec.snoozeMinutes > 0) builder.addAction(0, "Snooze ${spec.snoozeMinutes} min", snoozePi)
    return builder.build()
  }

  private fun broadcast(type: String, id: String, configure: Intent.() -> Unit = {}) {
    val intent = Intent(WakeAlarmContract.ACTION_EVENT)
      .setPackage(packageName)
      .putExtra(WakeAlarmContract.EXTRA_EVENT_TYPE, type)
      .putExtra(WakeAlarmContract.EXTRA_ID, id)
    intent.configure()
    sendBroadcast(intent)
  }

  companion object {
    const val ACTION_START = "expo.modules.wakealarm.service.START"
    const val ACTION_STOP = "expo.modules.wakealarm.service.STOP"
    const val ACTION_SNOOZE = "expo.modules.wakealarm.service.SNOOZE"
    const val ACTION_SET_VOLUME = "expo.modules.wakealarm.service.SET_VOLUME"
    const val CHANNEL_ID = "wake_alarm_ringing"
    const val NOTIFICATION_ID = 0x57A4E
    /** After this the alarm auto-silences and is logged as a timeout (typical alarm-clock behaviour). */
    const val AUTO_SILENCE_MS = 15 * 60 * 1000L
    const val FADE_STEP_MS = 500L
    /** If STREAM_ALARM is below this fraction of max we raise it for the alarm and restore afterwards. */
    const val MIN_ALARM_STREAM_FRACTION = 0.5

    @Volatile var activeAlarmId: String? = null
  }
}
