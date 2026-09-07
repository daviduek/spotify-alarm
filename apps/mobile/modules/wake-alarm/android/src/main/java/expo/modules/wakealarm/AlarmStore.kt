package expo.modules.wakealarm

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class ActiveAlarm(val id: String, val firedAtEpochMs: Long, val snoozeCount: Int) {
  fun toMap(): Map<String, Any?> = mapOf("id" to id, "firedAtEpochMs" to firedAtEpochMs, "snoozeCount" to snoozeCount)
}

/**
 * Native source of truth for what Android must ring — survives process death and reboots
 * (SharedPreferences, credential-encrypted storage). JS keeps its own SQLite DB and
 * reconciles against this on launch (spec §32, §53, §54).
 */
class AlarmStore(context: Context) {
  private val prefs: SharedPreferences =
    context.applicationContext.getSharedPreferences("wake_alarm_store", Context.MODE_PRIVATE)

  // ---- alarms ------------------------------------------------------------

  private fun alarmsJson(): JSONObject = try {
    JSONObject(prefs.getString(KEY_ALARMS, "{}") ?: "{}")
  } catch (_: Exception) {
    JSONObject()
  }

  fun put(spec: AlarmSpec) {
    val all = alarmsJson()
    all.put(spec.id, spec.toJson())
    prefs.edit().putString(KEY_ALARMS, all.toString()).commit()
  }

  fun remove(id: String) {
    val all = alarmsJson()
    all.remove(id)
    prefs.edit().putString(KEY_ALARMS, all.toString()).commit()
  }

  fun get(id: String): AlarmSpec? {
    val o = alarmsJson().optJSONObject(id) ?: return null
    return try { AlarmSpec.fromJson(o) } catch (_: Exception) { null }
  }

  fun all(): List<AlarmSpec> {
    val all = alarmsJson()
    val out = mutableListOf<AlarmSpec>()
    val keys = all.keys()
    while (keys.hasNext()) {
      val k = keys.next()
      all.optJSONObject(k)?.let { o -> try { out.add(AlarmSpec.fromJson(o)) } catch (_: Exception) {} }
    }
    return out
  }

  // ---- active (ringing) alarm --------------------------------------------

  fun setActive(id: String, firedAtEpochMs: Long, snoozeCount: Int) {
    val o = JSONObject().put("id", id).put("firedAtEpochMs", firedAtEpochMs).put("snoozeCount", snoozeCount)
    prefs.edit().putString(KEY_ACTIVE, o.toString()).commit()
  }

  fun getActive(): ActiveAlarm? {
    val raw = prefs.getString(KEY_ACTIVE, null) ?: return null
    return try {
      val o = JSONObject(raw)
      ActiveAlarm(o.getString("id"), o.getLong("firedAtEpochMs"), o.optInt("snoozeCount", 0))
    } catch (_: Exception) {
      null
    }
  }

  fun clearActive() {
    prefs.edit().remove(KEY_ACTIVE).commit()
  }

  // ---- snoozes -----------------------------------------------------------

  private fun snoozesJson(): JSONObject = try {
    JSONObject(prefs.getString(KEY_SNOOZES, "{}") ?: "{}")
  } catch (_: Exception) {
    JSONObject()
  }

  fun setSnoozeUntil(id: String, untilEpochMs: Long) {
    val s = snoozesJson()
    s.put(id, untilEpochMs)
    prefs.edit().putString(KEY_SNOOZES, s.toString()).commit()
  }

  fun getSnoozeUntil(id: String): Long? {
    val s = snoozesJson()
    return if (s.has(id)) s.optLong(id) else null
  }

  fun clearSnooze(id: String) {
    val s = snoozesJson()
    s.remove(id)
    prefs.edit().putString(KEY_SNOOZES, s.toString()).commit()
  }

  fun allSnoozes(): Map<String, Long> {
    val s = snoozesJson()
    val out = mutableMapOf<String, Long>()
    val keys = s.keys()
    while (keys.hasNext()) { val k = keys.next(); out[k] = s.optLong(k) }
    return out
  }

  // ---- history / diagnostics --------------------------------------------

  fun appendHistory(entry: JSONObject) {
    val arr = try { JSONArray(prefs.getString(KEY_HISTORY, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }
    entry.put("at", System.currentTimeMillis())
    arr.put(entry)
    val trimmed = JSONArray()
    val start = maxOf(0, arr.length() - MAX_HISTORY)
    for (i in start until arr.length()) trimmed.put(arr.get(i))
    prefs.edit().putString(KEY_HISTORY, trimmed.toString()).apply()
  }

  fun history(): JSONArray = try { JSONArray(prefs.getString(KEY_HISTORY, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }

  fun setLastError(message: String) {
    prefs.edit().putString(KEY_LAST_ERROR, message).apply()
  }

  fun lastError(): String? = prefs.getString(KEY_LAST_ERROR, null)

  /** Original STREAM_ALARM volume saved before we raised it, so a crash never leaves the phone louder. */
  fun setSavedStreamVolume(volume: Int?) {
    val e = prefs.edit()
    if (volume == null) e.remove(KEY_SAVED_VOLUME) else e.putInt(KEY_SAVED_VOLUME, volume)
    e.commit()
  }

  fun savedStreamVolume(): Int? = if (prefs.contains(KEY_SAVED_VOLUME)) prefs.getInt(KEY_SAVED_VOLUME, -1).takeIf { it >= 0 } else null

  companion object {
    private const val KEY_ALARMS = "alarms"
    private const val KEY_ACTIVE = "active"
    private const val KEY_SNOOZES = "snoozes"
    private const val KEY_HISTORY = "history"
    private const val KEY_LAST_ERROR = "last_error"
    private const val KEY_SAVED_VOLUME = "saved_stream_volume"
    private const val MAX_HISTORY = 50
  }
}
