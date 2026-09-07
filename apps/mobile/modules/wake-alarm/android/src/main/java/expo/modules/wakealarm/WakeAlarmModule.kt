package expo.modules.wakealarm

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExactAlarmPermissionException :
  CodedException("ERR_EXACT_ALARM_PERMISSION", "Exact alarms are not permitted. Ask the user to allow 'Alarms & reminders' for Wake.", null)

class AlarmSchedulingException(message: String?) :
  CodedException("ERR_ALARM_SCHEDULING", message ?: "Could not schedule alarm", null)

/**
 * Expo module surface for Android. All heavy lifting lives in WakeAlarmScheduler / AlarmService so
 * it keeps working without a React instance.
 */
class WakeAlarmModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  private var eventReceiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("WakeAlarm")

    Events(
      WakeAlarmContract.JS_EVENT_FIRED,
      WakeAlarmContract.JS_EVENT_STOPPED,
      WakeAlarmContract.JS_EVENT_SNOOZED,
      WakeAlarmContract.JS_EVENT_STATE,
    )

    OnCreate {
      registerEventReceiver()
    }

    // reactContext can still be null in OnCreate; JS subscribing is a second, reliable chance.
    OnStartObserving {
      registerEventReceiver()
    }

    OnDestroy {
      unregisterEventReceiver()
    }

    Function("isSupported") { true }

    Function("canScheduleExactAlarms") { WakeAlarmScheduler.canScheduleExact(context) }

    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        context.getSystemService(NotificationManager::class.java)?.canUseFullScreenIntent() ?: false
      } else {
        true
      }
    }

    AsyncFunction("getAuthorizationStatus") {
      if (WakeAlarmScheduler.canScheduleExact(context)) "authorized" else "denied"
    }

    AsyncFunction("requestAuthorization") {
      // Android 12–13 need the user to flip "Alarms & reminders"; 13+ with USE_EXACT_ALARM is automatic.
      if (!WakeAlarmScheduler.canScheduleExact(context)) openExactAlarmSettings()
      if (WakeAlarmScheduler.canScheduleExact(context)) "authorized" else "denied"
    }

    AsyncFunction("scheduleAlarm") { record: AlarmSpecRecord ->
      val spec = record.toSpec()
      if (spec.id.isBlank()) throw AlarmSchedulingException("Alarm id is required")
      if (!WakeAlarmScheduler.canScheduleExact(context)) throw ExactAlarmPermissionException()
      val store = AlarmStore(context)
      store.put(spec)
      // A re-schedule replaces any pending snooze for this alarm.
      WakeAlarmScheduler.cancelSnooze(context, spec.id)
      store.clearSnooze(spec.id)
      val at = try {
        WakeAlarmScheduler.schedule(context, spec)
      } catch (e: SecurityException) {
        throw ExactAlarmPermissionException()
      } catch (e: Exception) {
        store.setLastError("schedule: ${e.message}")
        throw AlarmSchedulingException(e.message)
      }
      mapOf("nativeId" to spec.id, "nextFireAtEpochMs" to at)
    }

    AsyncFunction("cancelAlarm") { id: String ->
      WakeAlarmScheduler.cancel(context, id)
      val store = AlarmStore(context)
      store.remove(id)
      store.clearSnooze(id)
      if (store.getActive()?.id == id) sendServiceAction(AlarmService.ACTION_STOP, id)
    }

    AsyncFunction("stopAlarm") { id: String ->
      sendServiceAction(AlarmService.ACTION_STOP, id)
    }

    AsyncFunction("snoozeAlarm") { id: String, minutes: Int ->
      sendServiceAction(AlarmService.ACTION_SNOOZE, id) { putExtra(WakeAlarmContract.EXTRA_MINUTES, minutes) }
    }

    AsyncFunction("setAlarmVolume") { id: String, volume: Double ->
      sendServiceAction(AlarmService.ACTION_SET_VOLUME, id) { putExtra(WakeAlarmContract.EXTRA_VOLUME, volume) }
    }

    AsyncFunction("getScheduledAlarms") {
      val store = AlarmStore(context)
      val active = store.getActive()?.id
      store.all().map { spec ->
        val snooze = store.getSnoozeUntil(spec.id)
        val next = snooze ?: WakeAlarmScheduler.computeNextTrigger(spec)
        mapOf(
          "id" to spec.id,
          "nextFireAtEpochMs" to next,
          "state" to when {
            active == spec.id -> "alerting"
            snooze != null -> "countdown"
            else -> "scheduled"
          },
        )
      }
    }

    AsyncFunction("getActiveAlarm") {
      AlarmStore(context).getActive()?.toMap()
    }

    AsyncFunction("getDiagnostics") {
      val store = AlarmStore(context)
      val am = context.getSystemService(AudioManager::class.java)
      val nm = context.getSystemService(NotificationManager::class.java)
      val pm = context.getSystemService(PowerManager::class.java)
      val alarmVolume = am?.getStreamVolume(AudioManager.STREAM_ALARM) ?: -1
      val alarmMax = am?.getStreamMaxVolume(AudioManager.STREAM_ALARM) ?: -1
      mapOf(
        "platform" to "android",
        "sdkInt" to Build.VERSION.SDK_INT,
        "manufacturer" to Build.MANUFACTURER,
        "model" to Build.MODEL,
        "canScheduleExactAlarms" to WakeAlarmScheduler.canScheduleExact(context),
        "canUseFullScreenIntent" to (
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) nm?.canUseFullScreenIntent() ?: false else true
          ),
        "notificationsEnabled" to NotificationManagerCompat.from(context).areNotificationsEnabled(),
        "ignoringBatteryOptimizations" to (pm?.isIgnoringBatteryOptimizations(context.packageName) ?: false),
        "alarmStreamVolume" to "$alarmVolume/$alarmMax",
        "interruptionFilter" to (nm?.currentInterruptionFilter ?: -1),
        "scheduledCount" to store.all().size,
        "nextAlarmClockEpochMs" to WakeAlarmScheduler.nextAlarmClockMs(context),
        "activeAlarmId" to store.getActive()?.id,
        "lastError" to store.lastError(),
        "historyTail" to store.history().let { h ->
          val start = maxOf(0, h.length() - 5)
          (start until h.length()).joinToString(" | ") { h.optJSONObject(it)?.toString() ?: "" }
        },
        "bundledSounds" to listOf("wake_classic", "wake_soft", "wake_sunrise", "wake_piano", "wake_birds")
          .filter { context.resources.getIdentifier(it, "raw", context.packageName) != 0 }
          .joinToString(","),
      )
    }

    Function("openAlarmSettings") { openExactAlarmSettings() }

    Function("openFullScreenIntentSettings") {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
      } else {
        appDetailsIntent()
      }
      startSettings(intent)
    }

    Function("openNotificationSettings") {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      } else {
        appDetailsIntent()
      }
      startSettings(intent)
    }
  }

  // ---------------------------------------------------------------------------

  private fun openExactAlarmSettings() {
    val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}"))
    } else {
      appDetailsIntent()
    }
    startSettings(intent)
  }

  private fun appDetailsIntent(): Intent =
    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))

  private fun startSettings(intent: Intent) {
    val activity = appContext.currentActivity
    if (activity != null) {
      activity.startActivity(intent)
    } else {
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  private fun sendServiceAction(action: String, id: String, configure: Intent.() -> Unit = {}) {
    val intent = Intent(context, AlarmService::class.java).setAction(action).putExtra(WakeAlarmContract.EXTRA_ID, id)
    intent.configure()
    try {
      context.startService(intent)
    } catch (e: IllegalStateException) {
      // App in background and service not running: nothing is ringing, so there is nothing to do.
      AlarmStore(context).setLastError("startService($action): ${e.message}")
    }
  }

  private fun registerEventReceiver() {
    if (eventReceiver != null) return
    val ctx = appContext.reactContext ?: return
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(c: Context, intent: Intent) {
        val id = intent.getStringExtra(WakeAlarmContract.EXTRA_ID) ?: return
        when (intent.getStringExtra(WakeAlarmContract.EXTRA_EVENT_TYPE)) {
          WakeAlarmContract.EVENT_FIRED -> {
            sendEvent(
              WakeAlarmContract.JS_EVENT_FIRED,
              mapOf(
                "id" to id,
                "firedAtEpochMs" to intent.getLongExtra(WakeAlarmContract.EXTRA_FIRED_AT, System.currentTimeMillis()),
                "snoozeCount" to intent.getIntExtra(WakeAlarmContract.EXTRA_SNOOZE_COUNT, 0),
              ),
            )
            sendEvent(WakeAlarmContract.JS_EVENT_STATE, mapOf("id" to id, "state" to "alerting"))
          }
          WakeAlarmContract.EVENT_STOPPED -> {
            sendEvent(WakeAlarmContract.JS_EVENT_STOPPED, mapOf("id" to id, "reason" to (intent.getStringExtra(WakeAlarmContract.EXTRA_REASON) ?: "unknown")))
            sendEvent(WakeAlarmContract.JS_EVENT_STATE, mapOf("id" to id, "state" to "scheduled"))
          }
          WakeAlarmContract.EVENT_SNOOZED -> {
            sendEvent(WakeAlarmContract.JS_EVENT_SNOOZED, mapOf("id" to id, "untilEpochMs" to intent.getLongExtra(WakeAlarmContract.EXTRA_UNTIL, 0L)))
            sendEvent(WakeAlarmContract.JS_EVENT_STATE, mapOf("id" to id, "state" to "countdown"))
          }
        }
      }
    }
    ContextCompat.registerReceiver(ctx, receiver, IntentFilter(WakeAlarmContract.ACTION_EVENT), ContextCompat.RECEIVER_NOT_EXPORTED)
    eventReceiver = receiver
  }

  private fun unregisterEventReceiver() {
    val receiver = eventReceiver ?: return
    try { appContext.reactContext?.unregisterReceiver(receiver) } catch (_: Exception) {}
    eventReceiver = null
  }
}
