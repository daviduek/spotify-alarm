package expo.modules.wakealarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Fired by AlarmManager at the exact trigger time. Does the minimum: wake the CPU, start the
 * foreground AlarmService (which owns audio + UI) and re-arm the next weekly occurrence.
 */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != WakeAlarmContract.ACTION_FIRE) return
    val id = intent.getStringExtra(WakeAlarmContract.EXTRA_ID) ?: return
    val isSnooze = intent.getBooleanExtra(WakeAlarmContract.EXTRA_IS_SNOOZE, false)
    val snoozeCount = intent.getIntExtra(WakeAlarmContract.EXTRA_SNOOZE_COUNT, 0)
    val store = AlarmStore(context)
    val spec = store.get(id)
    if (spec == null) {
      Log.w(WakeAlarmContract.TAG, "fire for unknown alarm $id — ignored")
      return
    }

    // Keep the CPU on until the service has taken its own wake lock.
    try {
      val pm = context.getSystemService(PowerManager::class.java)
      pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "wake:receiver")?.acquire(30_000L)
    } catch (e: Exception) {
      Log.w(WakeAlarmContract.TAG, "wake lock failed", e)
    }

    if (isSnooze) store.clearSnooze(id)

    val serviceIntent = Intent(context, AlarmService::class.java)
      .setAction(AlarmService.ACTION_START)
      .putExtra(WakeAlarmContract.EXTRA_ID, id)
      .putExtra(WakeAlarmContract.EXTRA_SNOOZE_COUNT, snoozeCount)
    try {
      ContextCompat.startForegroundService(context, serviceIntent)
    } catch (e: Exception) {
      Log.e(WakeAlarmContract.TAG, "startForegroundService failed", e)
      store.setLastError("startForegroundService: ${e.message}")
    }

    // Re-arm the next weekly occurrence immediately so a crash later cannot lose it.
    if (!isSnooze && spec.isRepeating) {
      try {
        WakeAlarmScheduler.schedule(context, spec, WakeAlarmScheduler.computeNextTrigger(spec, System.currentTimeMillis() + 60_000L))
      } catch (e: Exception) {
        Log.e(WakeAlarmContract.TAG, "re-arm failed for $id", e)
        store.setLastError("re-arm ${id}: ${e.message}")
      }
    }
  }
}
