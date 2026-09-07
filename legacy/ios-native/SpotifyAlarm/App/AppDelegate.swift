import UIKit
import UserNotifications
import BackgroundTasks

/// We use UIApplicationDelegateAdaptor to bridge SwiftUI with legacy delegate
/// callbacks needed by the Spotify SDK (URL handling) and background tasks.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    static let prewarmTaskID = "com.daviduek.spotifyalarm.prewarm"
    weak var container: AppContainer?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        registerBackgroundTasks()
        return true
    }

    // MARK: - URL handling (Spotify auth callback)

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        if url.scheme == SpotifyConfig.redirectScheme {
            return container?.appRemote.handleURLCallback(url) ?? false
        }
        return false
    }

    // MARK: - Notifications

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        // Even in foreground, present banner + sound (alarms must be obvious)
        return [.banner, .sound, .list]
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard
            let alarmIDString = response.notification.request.content.userInfo["alarmID"] as? String,
            let alarmID = UUID(uuidString: alarmIDString),
            let alarm = container?.store.alarm(with: alarmID),
            let engine = container?.engine
        else { return }
        await engine.fire(alarm: alarm)
    }

    // MARK: - Background tasks

    private func registerBackgroundTasks() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.prewarmTaskID,
            using: nil
        ) { [weak self] task in
            self?.handlePrewarm(task: task as! BGProcessingTask)
        }
    }

    private func handlePrewarm(task: BGProcessingTask) {
        // Opportunistic: refresh tokens, re-arm audio session, re-schedule.
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        Task { @MainActor in
            guard let container = container else {
                task.setTaskCompleted(success: false); return
            }
            _ = try? await container.auth.validAccessToken()
            try? container.audio.activate(forBackgroundHold: true)
            for alarm in container.store.alarms where alarm.isEnabled {
                await container.notifications.reschedule(for: alarm)
            }
            scheduleNextPrewarm()
            task.setTaskCompleted(success: true)
        }
    }

    static func scheduleNextPrewarm() {
        let req = BGProcessingTaskRequest(identifier: prewarmTaskID)
        req.requiresNetworkConnectivity = true
        req.requiresExternalPower = false
        req.earliestBeginDate = Date().addingTimeInterval(60 * 60) // ~1h
        try? BGTaskScheduler.shared.submit(req)
    }
}
