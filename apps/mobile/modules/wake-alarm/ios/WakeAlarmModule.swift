import ExpoModulesCore
import UIKit

#if canImport(AlarmKit)
import AlarmKit
import ActivityKit
import SwiftUI
#endif

// MARK: - Records & exceptions

struct WakeAlarmSpecRecord: Record {
  @Field var id: String = ""
  @Field var label: String = "Alarm"
  @Field var hour: Int = 7
  @Field var minute: Int = 0
  @Field var weekdays: [Int] = []
  @Field var fireAtEpochMs: Double? = nil
  @Field var soundFile: String = "wake_classic"
  @Field var soundUri: String? = nil
  @Field var vibrate: Bool = true
  @Field var snoozeMinutes: Int = 10
  @Field var fadeInSeconds: Int = 0
  @Field var fadeStartVolume: Double = 1.0
  @Field var fadeEndVolume: Double = 1.0
  @Field var openAppOnFire: Bool = false
}

final class AlarmKitUnavailableException: Exception {
  override var reason: String {
    "AlarmKit requires iOS 26 or later. Wake cannot schedule system alarms on this device."
  }
}

final class AlarmNotAuthorizedException: Exception {
  override var reason: String {
    "Alarm authorization was not granted"
  }
}

final class InvalidAlarmIdException: GenericException<String> {
  override var reason: String {
    "Alarm id must be a UUID string, got \"\(param)\""
  }
}

final class AlarmSchedulingException: GenericException<String> {
  override var reason: String {
    "AlarmKit could not schedule the alarm: \(param)"
  }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct WakeAlarmMetadata: AlarmMetadata {
  let alarmId: String
  let label: String
  let soundFile: String
}
#endif

// MARK: - Module

public class WakeAlarmModule: Module {
  private var updatesTask: Task<Void, Never>?
  private var lastKnownStates: [String: String] = [:]

  public func definition() -> ModuleDefinition {
    Name("WakeAlarm")

    Events("onAlarmFired", "onAlarmStopped", "onAlarmSnoozed", "onAlarmStateChanged")

    Function("isSupported") { () -> Bool in
      return Self.alarmKitAvailable
    }

    // Android-only capabilities; always true on iOS so shared code can stay simple.
    Function("canScheduleExactAlarms") { () -> Bool in true }
    Function("canUseFullScreenIntent") { () -> Bool in true }

    AsyncFunction("getAuthorizationStatus") { () -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        return Self.describe(AlarmManager.shared.authorizationState)
      }
      #endif
      return "unsupported"
    }

    AsyncFunction("requestAuthorization") { () async throws -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let state = try await AlarmManager.shared.requestAuthorization()
        return Self.describe(state)
      }
      #endif
      return "unsupported"
    }

    AsyncFunction("scheduleAlarm") { (spec: WakeAlarmSpecRecord) async throws -> [String: Any?] in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        return try await self.schedule(spec)
      }
      #endif
      throw AlarmKitUnavailableException()
    }

    AsyncFunction("cancelAlarm") { (id: String) throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let uuid = try Self.uuid(from: id)
        // Cancelling an alarm that no longer exists is not an error for callers.
        try? AlarmManager.shared.cancel(id: uuid)
        return
      }
      #endif
      throw AlarmKitUnavailableException()
    }

    AsyncFunction("stopAlarm") { (id: String) throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let uuid = try Self.uuid(from: id)
        try AlarmManager.shared.stop(id: uuid)
        self.sendEvent("onAlarmStopped", ["id": id, "reason": "user"])
        return
      }
      #endif
      throw AlarmKitUnavailableException()
    }

    // AlarmKit snooze = the countdown configured at schedule time (postAlert duration).
    // `minutes` is accepted for API symmetry but cannot be changed after scheduling.
    AsyncFunction("snoozeAlarm") { (id: String, minutes: Int) throws in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let uuid = try Self.uuid(from: id)
        try AlarmManager.shared.countdown(id: uuid)
        let until = Date().addingTimeInterval(TimeInterval(max(1, minutes) * 60))
        self.sendEvent("onAlarmSnoozed", ["id": id, "untilEpochMs": until.timeIntervalSince1970 * 1000])
        return
      }
      #endif
      throw AlarmKitUnavailableException()
    }

    // The system owns alert audio on iOS; there is no per-alarm player to adjust.
    AsyncFunction("setAlarmVolume") { (_: String, _: Double) in }

    AsyncFunction("getScheduledAlarms") { () throws -> [[String: Any?]] in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        return try AlarmManager.shared.alarms.map { Self.describe(alarm: $0) }
      }
      #endif
      return []
    }

    AsyncFunction("getActiveAlarm") { () -> [String: Any?]? in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        guard let alerting = (try? AlarmManager.shared.alarms)?.first(where: { alarm in
          if case .alerting = alarm.state { return true }
          return false
        }) else { return nil }
        return [
          "id": alerting.id.uuidString.lowercased(),
          "firedAtEpochMs": Date().timeIntervalSince1970 * 1000,
          "snoozeCount": 0
        ]
      }
      #endif
      return nil
    }

    AsyncFunction("getDiagnostics") { () -> [String: Any?] in
      var info: [String: Any?] = [
        "platform": "ios",
        "osVersion": UIDevice.current.systemVersion,
        "alarmKitAvailable": Self.alarmKitAvailable,
        "authorization": "unsupported",
        "scheduledCount": 0
      ]
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        info["authorization"] = Self.describe(AlarmManager.shared.authorizationState)
        let alarms = (try? AlarmManager.shared.alarms) ?? []
        info["scheduledCount"] = alarms.count
        info["alertingCount"] = alarms.filter { if case .alerting = $0.state { return true } else { return false } }.count
      }
      #endif
      info["bundledSounds"] = Self.bundledSoundNames().joined(separator: ",")
      return info
    }

    Function("openAlarmSettings") {
      Self.openAppSettings()
    }.runOnQueue(.main)

    Function("openFullScreenIntentSettings") {
      Self.openAppSettings()
    }.runOnQueue(.main)

    Function("openNotificationSettings") {
      Self.openAppSettings()
    }.runOnQueue(.main)

    OnStartObserving {
      self.startObservingAlarmUpdates()
    }

    OnStopObserving {
      self.updatesTask?.cancel()
      self.updatesTask = nil
    }

    OnDestroy {
      self.updatesTask?.cancel()
      self.updatesTask = nil
    }
  }

  // MARK: - Helpers

  private static var alarmKitAvailable: Bool {
    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) { return true }
    #endif
    return false
  }

  private static func uuid(from id: String) throws -> UUID {
    guard let uuid = UUID(uuidString: id) else { throw InvalidAlarmIdException(id) }
    return uuid
  }

  private static func openAppSettings() {
    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
    UIApplication.shared.open(url)
  }

  private static func bundledSoundNames() -> [String] {
    let urls = Bundle.main.urls(forResourcesWithExtension: "wav", subdirectory: nil) ?? []
    return urls.map { $0.deletingPathExtension().lastPathComponent }.filter { $0.hasPrefix("wake_") }.sorted()
  }

  /// Next local wall-clock occurrence — mirrors packages/domain nextOccurrence().
  private static func nextOccurrence(hour: Int, minute: Int, weekdays: [Int], now: Date = Date()) -> Date? {
    let calendar = Calendar.current
    for dayOffset in 0...7 {
      guard let day = calendar.date(byAdding: .day, value: dayOffset, to: now),
            let candidate = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) else { continue }
      if candidate <= now { continue }
      let weekday = calendar.component(.weekday, from: candidate) - 1 // Calendar: 1 = Sunday
      if weekdays.isEmpty || weekdays.contains(weekday) { return candidate }
    }
    return nil
  }

  #if canImport(AlarmKit)
  @available(iOS 26.0, *)
  private static func describe(_ state: AlarmManager.AuthorizationState) -> String {
    switch state {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }

  @available(iOS 26.0, *)
  private static func describe(state: Alarm.State) -> String {
    switch state {
    case .scheduled: return "scheduled"
    case .countdown: return "countdown"
    case .paused: return "paused"
    case .alerting: return "alerting"
    @unknown default: return "unknown"
    }
  }

  @available(iOS 26.0, *)
  private static func describe(alarm: Alarm) -> [String: Any?] {
    var next: Double? = nil
    if let schedule = alarm.schedule {
      switch schedule {
      case .fixed(let date):
        next = date.timeIntervalSince1970 * 1000
      case .relative(let relative):
        var days: [Int] = []
        if case .weekly(let weekdays) = relative.repeats {
          days = weekdays.map { localeWeekdayIndex($0) }
        }
        next = nextOccurrence(hour: relative.time.hour, minute: relative.time.minute, weekdays: days)
          .map { $0.timeIntervalSince1970 * 1000 }
      @unknown default:
        break
      }
    }
    return [
      "id": alarm.id.uuidString.lowercased(),
      "nextFireAtEpochMs": next,
      "state": describe(state: alarm.state)
    ]
  }

  @available(iOS 26.0, *)
  private static func localeWeekday(_ index: Int) -> Locale.Weekday {
    switch index {
    case 0: return .sunday
    case 1: return .monday
    case 2: return .tuesday
    case 3: return .wednesday
    case 4: return .thursday
    case 5: return .friday
    default: return .saturday
    }
  }

  @available(iOS 26.0, *)
  private static func localeWeekdayIndex(_ weekday: Locale.Weekday) -> Int {
    switch weekday {
    case .sunday: return 0
    case .monday: return 1
    case .tuesday: return 2
    case .wednesday: return 3
    case .thursday: return 4
    case .friday: return 5
    case .saturday: return 6
    default: return 0
    }
  }

  @available(iOS 26.0, *)
  private func schedule(_ spec: WakeAlarmSpecRecord) async throws -> [String: Any?] {
    let manager = AlarmManager.shared
    if manager.authorizationState != .authorized {
      let state = try await manager.requestAuthorization()
      if state != .authorized { throw AlarmNotAuthorizedException() }
    }

    let uuid = try Self.uuid(from: spec.id)

    // Idempotent re-schedule: AlarmKit rejects duplicate ids, so drop the previous one.
    try? manager.cancel(id: uuid)

    // --- Presentation -----------------------------------------------------
    let stopButton = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.fill")
    let alert: AlarmPresentation.Alert
    var countdownDuration: Alarm.CountdownDuration? = nil
    var countdownPresentation: AlarmPresentation.Countdown? = nil
    if spec.snoozeMinutes > 0 {
      let snoozeButton = AlarmButton(
        text: LocalizedStringResource(stringLiteral: "Snooze \(spec.snoozeMinutes) min"),
        textColor: .white,
        systemImageName: "zzz"
      )
      alert = AlarmPresentation.Alert(
        title: LocalizedStringResource(stringLiteral: spec.label),
        stopButton: stopButton,
        secondaryButton: snoozeButton,
        secondaryButtonBehavior: .countdown
      )
      countdownDuration = Alarm.CountdownDuration(preAlert: nil, postAlert: TimeInterval(spec.snoozeMinutes * 60))
      countdownPresentation = AlarmPresentation.Countdown(
        title: LocalizedStringResource(stringLiteral: "Snoozed · \(spec.label)"),
        pauseButton: nil
      )
    } else {
      alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: spec.label), stopButton: stopButton)
    }
    let presentation = AlarmPresentation(alert: alert, countdown: countdownPresentation)
    let metadata = WakeAlarmMetadata(alarmId: spec.id, label: spec.label, soundFile: spec.soundFile)
    let attributes = AlarmAttributes<WakeAlarmMetadata>(
      presentation: presentation,
      metadata: metadata,
      tintColor: Color(red: 1.0, green: 0.62, blue: 0.2)
    )

    // --- Schedule ---------------------------------------------------------
    let schedule: Alarm.Schedule
    var nextFire: Date?
    if let fireAt = spec.fireAtEpochMs {
      let date = Date(timeIntervalSince1970: fireAt / 1000)
      schedule = .fixed(date)
      nextFire = date
    } else if spec.weekdays.isEmpty {
      guard let date = Self.nextOccurrence(hour: spec.hour, minute: spec.minute, weekdays: []) else {
        throw AlarmSchedulingException("could not compute next occurrence")
      }
      schedule = .fixed(date)
      nextFire = date
    } else {
      let time = Alarm.Schedule.Relative.Time(hour: spec.hour, minute: spec.minute)
      let days = spec.weekdays.map { Self.localeWeekday($0) }
      schedule = .relative(Alarm.Schedule.Relative(time: time, repeats: .weekly(days)))
      nextFire = Self.nextOccurrence(hour: spec.hour, minute: spec.minute, weekdays: spec.weekdays)
    }

    // --- Sound ------------------------------------------------------------
    // Bundled by the podspec (`Sounds/*.wav`). Fall back to the system alarm sound
    // if the file is missing so the alarm ALWAYS makes noise.
    let soundName = "\(spec.soundFile).wav"
    let sound: AlertConfiguration.AlertSound = Bundle.main.url(forResource: spec.soundFile, withExtension: "wav") != nil
      ? .named(soundName)
      : .default

    let configuration = AlarmManager.AlarmConfiguration<WakeAlarmMetadata>(
      countdownDuration: countdownDuration,
      schedule: schedule,
      attributes: attributes,
      stopIntent: nil,
      secondaryIntent: nil,
      sound: sound
    )

    do {
      _ = try await manager.schedule(id: uuid, configuration: configuration)
    } catch {
      throw AlarmSchedulingException(error.localizedDescription)
    }

    startObservingAlarmUpdates()

    return [
      "nativeId": uuid.uuidString.lowercased(),
      "nextFireAtEpochMs": nextFire.map { $0.timeIntervalSince1970 * 1000 }
    ]
  }
  #endif

  private func startObservingAlarmUpdates() {
    #if canImport(AlarmKit)
    guard updatesTask == nil else { return }
    if #available(iOS 26.0, *) {
      updatesTask = Task { [weak self] in
        for await alarms in AlarmManager.shared.alarmUpdates {
          guard let self, !Task.isCancelled else { return }
          var seen = Set<String>()
          for alarm in alarms {
            let id = alarm.id.uuidString.lowercased()
            let state = Self.describe(state: alarm.state)
            seen.insert(id)
            let previous = self.lastKnownStates[id]
            if previous != state {
              self.lastKnownStates[id] = state
              self.sendEvent("onAlarmStateChanged", ["id": id, "state": state])
              if state == "alerting" {
                self.sendEvent("onAlarmFired", [
                  "id": id,
                  "firedAtEpochMs": Date().timeIntervalSince1970 * 1000,
                  "snoozeCount": 0
                ])
              }
              if previous == "alerting" && state == "countdown" {
                self.sendEvent("onAlarmSnoozed", ["id": id, "untilEpochMs": nil])
              }
            }
          }
          // Alarms that vanished were stopped/cancelled (one-time alarms are removed by the system).
          for (id, previous) in self.lastKnownStates where !seen.contains(id) {
            self.lastKnownStates.removeValue(forKey: id)
            if previous == "alerting" {
              self.sendEvent("onAlarmStopped", ["id": id, "reason": "system"])
            }
          }
        }
      }
    }
    #endif
  }
}
