import Foundation
import UserNotifications
import os.log

/// Schedules notifications for an alarm. We schedule three:
///   • A "pre-warmer" 2 minutes before — silent, used to wake background runtime
///   • A "pre-warmer" 30 seconds before — silent
///   • The main alarm — uses a critical sound to bypass Silent Mode
///     (requires `com.apple.developer.usernotifications.critical-alerts` entitlement)
@MainActor
final class NotificationScheduler {
    private let log = Logger(subsystem: "com.daviduek.spotifyalarm", category: "notifications")
    private let center = UNUserNotificationCenter.current()

    func requestAuthorization() async throws -> Bool {
        try await center.requestAuthorization(options: [.alert, .sound, .badge, .criticalAlert])
    }

    func currentAuthorization() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    func reschedule(for alarm: Alarm) async {
        cancel(for: alarm)
        guard alarm.isEnabled,
              let fireDate = alarm.nextFireDate()
        else { return }

        let mainID = "alarm.\(alarm.id.uuidString).main"
        let prewarm2mID = "alarm.\(alarm.id.uuidString).prewarm2m"
        let prewarm30sID = "alarm.\(alarm.id.uuidString).prewarm30s"

        await schedule(
            id: prewarm2mID,
            at: fireDate.addingTimeInterval(-120),
            title: "Despertador en 2 min",
            body: alarm.label,
            criticalSound: false,
            silent: true
        )
        await schedule(
            id: prewarm30sID,
            at: fireDate.addingTimeInterval(-30),
            title: "Preparando alarma",
            body: alarm.label,
            criticalSound: false,
            silent: true
        )
        await schedule(
            id: mainID,
            at: fireDate,
            title: "⏰ \(alarm.label)",
            body: "Sonando: \(alarm.contentTitle)",
            criticalSound: true,
            silent: false,
            userInfo: ["alarmID": alarm.id.uuidString]
        )

        log.info("Scheduled alarm \(alarm.id.uuidString) for \(fireDate.description)")
    }

    func cancel(for alarm: Alarm) {
        let ids = [
            "alarm.\(alarm.id.uuidString).main",
            "alarm.\(alarm.id.uuidString).prewarm2m",
            "alarm.\(alarm.id.uuidString).prewarm30s",
            "alarm.\(alarm.id.uuidString).snooze"
        ]
        center.removePendingNotificationRequests(withIdentifiers: ids)
        center.removeDeliveredNotifications(withIdentifiers: ids)
    }

    /// Schedules a one-shot snooze notification at `fireDate`.
    func scheduleSnooze(for alarm: Alarm, fireDate: Date) async {
        let id = "alarm.\(alarm.id.uuidString).snooze"
        center.removePendingNotificationRequests(withIdentifiers: [id])
        await schedule(
            id: id,
            at: fireDate,
            title: "⏰ \(alarm.label)",
            body: "Snooze finalizado",
            criticalSound: true,
            silent: false,
            userInfo: ["alarmID": alarm.id.uuidString]
        )
    }

    private func schedule(
        id: String,
        at date: Date,
        title: String,
        body: String,
        criticalSound: Bool,
        silent: Bool,
        userInfo: [String: Any] = [:]
    ) async {
        guard date > .now else { return }
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.userInfo = userInfo
        content.interruptionLevel = criticalSound ? .critical : .timeSensitive
        if silent {
            content.sound = nil
        } else if criticalSound {
            content.sound = .defaultCriticalSound(withAudioVolume: 1.0)
        } else {
            content.sound = .default
        }

        let comps = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute, .second],
            from: date
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let req = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        do {
            try await center.add(req)
        } catch {
            log.error("Failed to schedule notification \(id): \(error.localizedDescription)")
        }
    }
}
