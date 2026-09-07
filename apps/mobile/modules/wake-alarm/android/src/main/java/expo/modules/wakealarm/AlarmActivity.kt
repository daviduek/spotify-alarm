package expo.modules.wakealarm

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Native full-screen alarm UI (spec §24, §47). Shown over the lock screen via the
 * service's full-screen intent, so it works even if React Native never loads.
 * STOP requires a ~1 s hold; SNOOZE is a single tap; "Open Wake" hands off to JS.
 */
class AlarmActivity : Activity() {

  private val handler = Handler(Looper.getMainLooper())
  private var alarmId: String = ""
  private var spec: AlarmSpec? = null
  private lateinit var clock: TextView
  private lateinit var stopButton: TextView
  private var holdRunnable: Runnable? = null
  private var receiverRegistered = false

  private val eventReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val type = intent.getStringExtra(WakeAlarmContract.EXTRA_EVENT_TYPE)
      val id = intent.getStringExtra(WakeAlarmContract.EXTRA_ID)
      if (id == alarmId && (type == WakeAlarmContract.EVENT_STOPPED || type == WakeAlarmContract.EVENT_SNOOZED)) {
        finishScreen()
      }
    }
  }

  private val tick = object : Runnable {
    override fun run() {
      clock.text = timeNow()
      handler.postDelayed(this, 1000L)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    alarmId = intent.getStringExtra(WakeAlarmContract.EXTRA_ID) ?: ""
    spec = AlarmStore(this).get(alarmId)
    showOverLockScreen()
    setContentView(buildUi())
    ContextCompat.registerReceiver(this, eventReceiver, IntentFilter(WakeAlarmContract.ACTION_EVENT), ContextCompat.RECEIVER_NOT_EXPORTED)
    receiverRegistered = true
    if (spec?.openAppOnFire == true) handler.postDelayed({ openApp() }, 400L)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    alarmId = intent.getStringExtra(WakeAlarmContract.EXTRA_ID) ?: alarmId
    spec = AlarmStore(this).get(alarmId)
  }

  override fun onResume() {
    super.onResume()
    handler.post(tick)
    // If the service already finished (e.g. stopped from the notification) don't linger.
    if (AlarmService.activeAlarmId == null && AlarmStore(this).getActive() == null) finishScreen()
  }

  override fun onPause() {
    super.onPause()
    handler.removeCallbacks(tick)
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    if (receiverRegistered) {
      try { unregisterReceiver(eventReceiver) } catch (_: Exception) {}
      receiverRegistered = false
    }
    super.onDestroy()
  }

  @Deprecated("Back is intentionally disabled while an alarm rings")
  override fun onBackPressed() {
    // Spec §24: dismissing must be deliberate. Ignore back.
  }

  // ---------------------------------------------------------------------------

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    @Suppress("DEPRECATION")
    window.statusBarColor = Color.BLACK
    @Suppress("DEPRECATION")
    window.navigationBarColor = Color.BLACK
  }

  private fun dp(value: Float): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, resources.displayMetrics).toInt()

  private fun buildUi(): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setBackgroundColor(Color.BLACK)
      setPadding(dp(24f), dp(64f), dp(24f), dp(48f))
    }

    clock = TextView(this).apply {
      text = timeNow()
      setTextColor(Color.WHITE)
      textSize = 72f
      typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
      gravity = Gravity.CENTER
      contentDescription = "Current time"
    }
    val label = TextView(this).apply {
      text = spec?.label ?: "Alarm"
      setTextColor(Color.WHITE)
      textSize = 22f
      gravity = Gravity.CENTER
      setPadding(0, dp(8f), 0, 0)
    }
    val source = TextView(this).apply {
      text = "Wake sound · ${prettySound(spec?.soundFile)}"
      setTextColor(Color.parseColor("#9A9A9A"))
      textSize = 15f
      gravity = Gravity.CENTER
      setPadding(0, dp(6f), 0, 0)
    }

    val spacer = View(this).apply {
      layoutParams = LinearLayout.LayoutParams(0, 0, 1f)
    }

    stopButton = pill("HOLD TO STOP", Color.WHITE, Color.BLACK).apply {
      contentDescription = "Stop alarm. Press and hold for one second."
      setOnTouchListener { v, event ->
        when (event.actionMasked) {
          MotionEvent.ACTION_DOWN -> {
            text = "KEEP HOLDING…"
            alpha = 0.7f
            val r = Runnable { stopAlarm() }
            holdRunnable = r
            handler.postDelayed(r, HOLD_MS)
            v.isPressed = true
            true
          }
          MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
            holdRunnable?.let { handler.removeCallbacks(it) }
            holdRunnable = null
            text = "HOLD TO STOP"
            alpha = 1f
            v.isPressed = false
            if (event.actionMasked == MotionEvent.ACTION_UP) v.performClick()
            true
          }
          else -> false
        }
      }
      setOnClickListener { /* handled by hold gesture; click is for accessibility services */ }
    }

    val snoozeMinutes = spec?.snoozeMinutes ?: 0
    val snoozeButton = pill(if (snoozeMinutes > 0) "SNOOZE $snoozeMinutes MIN" else "SNOOZE OFF", Color.parseColor("#1F1F1F"), Color.WHITE).apply {
      contentDescription = if (snoozeMinutes > 0) "Snooze for $snoozeMinutes minutes" else "Snooze disabled"
      isEnabled = snoozeMinutes > 0
      alpha = if (snoozeMinutes > 0) 1f else 0.4f
      setOnClickListener { sendServiceAction(AlarmService.ACTION_SNOOZE) }
    }

    val openApp = TextView(this).apply {
      text = "Open Wake"
      setTextColor(Color.parseColor("#FFA033"))
      textSize = 16f
      gravity = Gravity.CENTER
      setPadding(dp(16f), dp(20f), dp(16f), dp(8f))
      contentDescription = "Open the Wake app"
      setOnClickListener { openApp() }
    }

    root.addView(clock)
    root.addView(label)
    root.addView(source)
    root.addView(spacer)
    root.addView(stopButton, pillParams(dp(72f)))
    root.addView(snoozeButton, pillParams(dp(56f)).apply { topMargin = dp(16f) })
    root.addView(openApp)
    return root
  }

  private fun pill(text: String, background: Int, textColor: Int): TextView = TextView(this).apply {
    this.text = text
    setTextColor(textColor)
    textSize = 18f
    typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    gravity = Gravity.CENTER
    letterSpacing = 0.08f
    isClickable = true
    isFocusable = true
    this.background = GradientDrawable().apply {
      cornerRadius = dp(36f).toFloat()
      setColor(background)
    }
  }

  private fun pillParams(height: Int) = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, height)

  private fun timeNow(): String = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())

  private fun prettySound(file: String?): String = when (file) {
    null -> "Classic"
    else -> file.removePrefix("wake_").replaceFirstChar { it.uppercase() }
  }

  // ---------------------------------------------------------------------------

  private fun stopAlarm() {
    stopButton.text = "STOPPED"
    sendServiceAction(AlarmService.ACTION_STOP)
    handler.postDelayed({ finishScreen() }, 250L)
  }

  private fun sendServiceAction(action: String) {
    try {
      startService(Intent(this, AlarmService::class.java).setAction(action).putExtra(WakeAlarmContract.EXTRA_ID, alarmId))
    } catch (e: Exception) {
      // Service already gone → nothing rings; just close.
      finishScreen()
    }
  }

  private fun openApp() {
    val deepLink = Intent(Intent.ACTION_VIEW, WakeAlarmContract.alarmDeepLink(this, alarmId))
      .setPackage(packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    try {
      if (deepLink.resolveActivity(packageManager) != null) {
        startActivity(deepLink)
        return
      }
    } catch (_: Exception) {}
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      it.data = Uri.parse(WakeAlarmContract.alarmDeepLink(this, alarmId).toString())
      startActivity(it)
    }
  }

  private fun finishScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) finishAndRemoveTask() else finish()
  }

  companion object {
    const val HOLD_MS = 1000L
  }
}
