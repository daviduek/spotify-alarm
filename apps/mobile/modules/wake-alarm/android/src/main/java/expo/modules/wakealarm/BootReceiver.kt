package expo.modules.wakealarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** Restores alarms after reboot, app update, and clock/time-zone changes (spec §38, §53, §54). */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED -> {
        val count = WakeAlarmScheduler.rescheduleAll(context)
        Log.i(WakeAlarmContract.TAG, "${intent.action}: rescheduled $count alarms")
        // A stale "active" marker after a reboot means the ringing alarm never got stopped.
        AlarmStore(context).apply {
          getActive()?.let { active ->
            appendHistory(org.json.JSONObject().put("type", "lost_on_reboot").put("alarmId", active.id))
            clearActive()
          }
          setSavedStreamVolume(null)
        }
      }
    }
  }
}
