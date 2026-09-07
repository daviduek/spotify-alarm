package expo.modules.wakealarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import java.util.Calendar

/**
 * Thin wrapper around AlarmManager.setAlarmClock() — the OS is the alarm engine (spec §6, §84).
 * Every alarm has two PendingIntents: the main one (keyed by id) and an optional snooze one
 * (keyed by "id#snooze") so a snooze never clobbers the next weekly occurrence.
 */
object WakeAlarmScheduler {

  fun canScheduleExact(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val am = context.getSystemService(AlarmManager::class.java) ?: return false
    return am.canScheduleExactAlarms()
  }

  /** Next local wall-clock trigger, mirroring packages/domain nextOccurrence(). */
  fun computeNextTrigger(spec: AlarmSpec, nowMs: Long = System.currentTimeMillis()): Long? {
    spec.fireAtEpochMs?.let { return if (it > nowMs) it else null }
    val now = Calendar.getInstance().apply { timeInMillis = nowMs }
    for (offset in 0..7) {
      val c = (now.clone() as Calendar).apply {
        add(Calendar.DAY_OF_YEAR, offset)
        set(Calendar.HOUR_OF_DAY, spec.hour)
        set(Calendar.MINUTE, spec.minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      if (c.timeInMillis <= nowMs) continue
      val weekday = c.get(Calendar.DAY_OF_WEEK) - 1 // Calendar.SUNDAY == 1
      if (spec.weekdays.isEmpty() || spec.weekdays.contains(weekday)) return c.timeInMillis
    }
    return null
  }

  /**
   * Schedules (or re-schedules) the alarm. Returns the trigger time.
   * @throws SecurityException when exact alarms are not permitted (Android 12–13 without SCHEDULE_EXACT_ALARM).
   * @throws IllegalStateException when no future occurrence exists.
   */
  fun schedule(
    context: Context,
    spec: AlarmSpec,
    triggerAtMs: Long? = null,
    isSnooze: Boolean = false,
    snoozeCount: Int = 0,
  ): Long {
    val at = triggerAtMs ?: computeNextTrigger(spec) ?: throw IllegalStateException("Alarm ${spec.id} has no future occurrence")
    val am = context.getSystemService(AlarmManager::class.java) ?: throw IllegalStateException("AlarmManager unavailable")
    val fire = firePendingIntent(context, spec.id, isSnooze, snoozeCount)
    val show = showPendingIntent(context)
    am.setAlarmClock(AlarmManager.AlarmClockInfo(at, show), fire)
    Log.i(WakeAlarmContract.TAG, "scheduled ${spec.id} snooze=$isSnooze at=$at")
    return at
  }

  fun cancel(context: Context, id: String) {
    val am = context.getSystemService(AlarmManager::class.java) ?: return
    am.cancel(firePendingIntent(context, id, isSnooze = false, snoozeCount = 0))
    am.cancel(firePendingIntent(context, id, isSnooze = true, snoozeCount = 0))
  }

  fun cancelSnooze(context: Context, id: String) {
    val am = context.getSystemService(AlarmManager::class.java) ?: return
    am.cancel(firePendingIntent(context, id, isSnooze = true, snoozeCount = 0))
  }

  /** Boot / package-replaced / time-changed: re-arm everything from the store. Idempotent by id. */
  fun rescheduleAll(context: Context): Int {
    val store = AlarmStore(context)
    var count = 0
    val now = System.currentTimeMillis()
    for (spec in store.all()) {
      try {
        if (spec.isRepeating || (computeNextTrigger(spec, now) != null)) {
          schedule(context, spec)
          count++
        } else {
          // Expired one-time alarm (e.g. the phone was off when it should have rung).
          store.remove(spec.id)
        }
      } catch (e: Exception) {
        Log.w(WakeAlarmContract.TAG, "reschedule failed for ${spec.id}", e)
        store.setLastError("reschedule ${spec.id}: ${e.message}")
      }
    }
    for ((id, until) in store.allSnoozes()) {
      val spec = store.get(id) ?: continue
      if (until > now) {
        try { schedule(context, spec, until, isSnooze = true, snoozeCount = 1); count++ } catch (_: Exception) {}
      } else {
        store.clearSnooze(id)
      }
    }
    return count
  }

  fun nextAlarmClockMs(context: Context): Long? {
    val am = context.getSystemService(AlarmManager::class.java) ?: return null
    return am.nextAlarmClock?.triggerTime
  }

  private fun firePendingIntent(context: Context, id: String, isSnooze: Boolean, snoozeCount: Int): PendingIntent {
    val suffix = if (isSnooze) "/snooze" else ""
    val intent = Intent(context, AlarmReceiver::class.java)
      .setAction(WakeAlarmContract.ACTION_FIRE)
      // Distinct data URIs keep the two PendingIntents distinguishable (extras are not compared).
      .setData(Uri.parse("wake-alarm://fire/$id$suffix"))
      .putExtra(WakeAlarmContract.EXTRA_ID, id)
      .putExtra(WakeAlarmContract.EXTRA_IS_SNOOZE, isSnooze)
      .putExtra(WakeAlarmContract.EXTRA_SNOOZE_COUNT, snoozeCount)
    val requestCode = (if (isSnooze) "$id#snooze" else id).hashCode()
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** Shown by the system when the user taps the status-bar alarm icon. */
  private fun showPendingIntent(context: Context): PendingIntent {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(context.packageName)
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
