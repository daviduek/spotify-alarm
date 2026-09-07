package expo.modules.wakealarm

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONArray
import org.json.JSONObject

/** Persisted, JS-independent description of an alarm. Mirrors NativeAlarmSpec in WakeAlarm.types.ts. */
data class AlarmSpec(
  val id: String,
  val label: String,
  val hour: Int,
  val minute: Int,
  /** 0 = Sunday … 6 = Saturday. Empty = one-time. */
  val weekdays: List<Int>,
  val fireAtEpochMs: Long?,
  val soundFile: String,
  /** Optional absolute file URI (recording) preferred over soundFile. */
  val soundUri: String?,
  val vibrate: Boolean,
  val snoozeMinutes: Int,
  val fadeInSeconds: Int,
  val fadeStartVolume: Double,
  val fadeEndVolume: Double,
  val openAppOnFire: Boolean,
) {
  val isRepeating: Boolean get() = weekdays.isNotEmpty() && fireAtEpochMs == null

  fun toJson(): JSONObject = JSONObject().apply {
    put("id", id)
    put("label", label)
    put("hour", hour)
    put("minute", minute)
    put("weekdays", JSONArray(weekdays))
    if (fireAtEpochMs != null) put("fireAtEpochMs", fireAtEpochMs) else put("fireAtEpochMs", JSONObject.NULL)
    put("soundFile", soundFile)
    if (soundUri != null) put("soundUri", soundUri) else put("soundUri", JSONObject.NULL)
    put("vibrate", vibrate)
    put("snoozeMinutes", snoozeMinutes)
    put("fadeInSeconds", fadeInSeconds)
    put("fadeStartVolume", fadeStartVolume)
    put("fadeEndVolume", fadeEndVolume)
    put("openAppOnFire", openAppOnFire)
  }

  companion object {
    fun fromJson(o: JSONObject): AlarmSpec {
      val days = mutableListOf<Int>()
      val arr = o.optJSONArray("weekdays") ?: JSONArray()
      for (i in 0 until arr.length()) days.add(arr.getInt(i))
      return AlarmSpec(
        id = o.getString("id"),
        label = o.optString("label", "Alarm"),
        hour = o.optInt("hour", 7),
        minute = o.optInt("minute", 0),
        weekdays = days,
        fireAtEpochMs = if (o.isNull("fireAtEpochMs")) null else o.optLong("fireAtEpochMs"),
        soundFile = o.optString("soundFile", "wake_classic"),
        soundUri = if (o.isNull("soundUri")) null else o.optString("soundUri"),
        vibrate = o.optBoolean("vibrate", true),
        snoozeMinutes = o.optInt("snoozeMinutes", 10),
        fadeInSeconds = o.optInt("fadeInSeconds", 0),
        fadeStartVolume = o.optDouble("fadeStartVolume", 1.0),
        fadeEndVolume = o.optDouble("fadeEndVolume", 1.0),
        openAppOnFire = o.optBoolean("openAppOnFire", false),
      )
    }
  }
}

/** Expo Modules record — what JS passes to scheduleAlarm(). */
class AlarmSpecRecord : Record {
  @Field val id: String = ""
  @Field val label: String = "Alarm"
  @Field val hour: Int = 7
  @Field val minute: Int = 0
  @Field val weekdays: List<Int> = emptyList()
  @Field val fireAtEpochMs: Double? = null
  @Field val soundFile: String = "wake_classic"
  @Field val soundUri: String? = null
  @Field val vibrate: Boolean = true
  @Field val snoozeMinutes: Int = 10
  @Field val fadeInSeconds: Int = 0
  @Field val fadeStartVolume: Double = 1.0
  @Field val fadeEndVolume: Double = 1.0
  @Field val openAppOnFire: Boolean = false

  fun toSpec(): AlarmSpec = AlarmSpec(
    id = id,
    label = label,
    hour = hour,
    minute = minute,
    weekdays = weekdays,
    fireAtEpochMs = fireAtEpochMs?.toLong(),
    soundFile = soundFile,
    soundUri = soundUri?.takeIf { it.isNotBlank() },
    vibrate = vibrate,
    snoozeMinutes = snoozeMinutes,
    fadeInSeconds = fadeInSeconds,
    fadeStartVolume = fadeStartVolume.coerceIn(0.0, 1.0),
    fadeEndVolume = fadeEndVolume.coerceIn(0.0, 1.0),
    openAppOnFire = openAppOnFire,
  )
}
