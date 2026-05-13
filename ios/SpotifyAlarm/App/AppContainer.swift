import Foundation
import SwiftData
import UserNotifications

/// Single source of truth for app-wide services. Constructed once at launch.
@MainActor
final class AppContainer: ObservableObject {
    let auth: SpotifyAuthService
    let webAPI: SpotifyWebAPI
    let appRemote: SpotifyAppRemoteService
    let audio: AudioSessionManager
    let notifications: NotificationScheduler
    let engine: AlarmEngine
    let store: AlarmStore
    let modelContainer: ModelContainer

    init() {
        let auth = SpotifyAuthService()
        let api = SpotifyWebAPI(auth: auth)
        let appRemote = SpotifyAppRemoteService(auth: auth)
        let audio = AudioSessionManager()
        let notifications = NotificationScheduler()

        let schema = Schema([Alarm.self])
        let config = ModelConfiguration("Alarms", schema: schema, isStoredInMemoryOnly: false)
        let container: ModelContainer
        do {
            container = try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }

        let store = AlarmStore(container: container, scheduler: notifications)
        let engine = AlarmEngine(
            auth: auth,
            webAPI: api,
            appRemote: appRemote,
            audio: audio,
            notifications: notifications
        )

        self.auth = auth
        self.webAPI = api
        self.appRemote = appRemote
        self.audio = audio
        self.notifications = notifications
        self.engine = engine
        self.store = store
        self.modelContainer = container
    }

    func bootstrap() async {
        // 1. Ask for notifications (alarms need them)
        _ = try? await notifications.requestAuthorization()

        // 2. Activate audio session and start the silent loop if we have any
        //    enabled alarms — keeps the app alive in background.
        if store.alarms.contains(where: { $0.isEnabled }) {
            try? audio.activate(forBackgroundHold: true)
        }

        // 3. Connect App Remote opportunistically if we have a token.
        if let token = auth.currentAccessToken() {
            appRemote.connect(withToken: token)
        }

        // 4. Re-schedule all enabled alarms (handles boot / timezone changes).
        for alarm in store.alarms where alarm.isEnabled {
            await notifications.reschedule(for: alarm)
        }
    }
}
