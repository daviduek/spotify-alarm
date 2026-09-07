package expo.modules.wakealarm

import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri

/** Intent actions, extras and event names shared by the receiver, service, activity and module. */
object WakeAlarmContract {
  const val TAG = "WakeAlarm"

  const val ACTION_FIRE = "expo.modules.wakealarm.ACTION_FIRE"
  /** Local (same package) broadcast that carries alarm lifecycle events to the JS module and the activity. */
  const val ACTION_EVENT = "expo.modules.wakealarm.ACTION_EVENT"

  const val EXTRA_ID = "alarmId"
  const val EXTRA_SNOOZE_COUNT = "snoozeCount"
  const val EXTRA_IS_SNOOZE = "isSnooze"
  const val EXTRA_EVENT_TYPE = "eventType"
  const val EXTRA_REASON = "reason"
  const val EXTRA_FIRED_AT = "firedAtEpochMs"
  const val EXTRA_UNTIL = "untilEpochMs"
  const val EXTRA_MINUTES = "minutes"
  const val EXTRA_VOLUME = "volume"

  const val EVENT_FIRED = "fired"
  const val EVENT_STOPPED = "stopped"
  const val EVENT_SNOOZED = "snoozed"

  const val JS_EVENT_FIRED = "onAlarmFired"
  const val JS_EVENT_STOPPED = "onAlarmStopped"
  const val JS_EVENT_SNOOZED = "onAlarmSnoozed"
  const val JS_EVENT_STATE = "onAlarmStateChanged"

  private const val META_SCHEME = "expo.modules.wakealarm.SCHEME"
  private const val DEFAULT_SCHEME = "wake"

  /** Deep link the React Native app handles for the firing screen: wake://alarm/<id>. */
  fun alarmDeepLink(context: Context, alarmId: String): Uri {
    val scheme = try {
      context.packageManager
        .getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
        .metaData?.getString(META_SCHEME)
    } catch (_: Exception) {
      null
    } ?: DEFAULT_SCHEME
    return Uri.parse("$scheme://alarm/$alarmId")
  }
}
