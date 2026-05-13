import SwiftUI

@main
struct SpotifyAlarmApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var container = AppContainer()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(container)
                .environmentObject(container.auth)
                .environmentObject(container.appRemote)
                .environmentObject(container.store)
                .environmentObject(container.engine)
                .modelContainer(container.modelContainer)
                .preferredColorScheme(.dark)
                .task {
                    appDelegate.container = container
                    await container.bootstrap()
                    AppDelegate.scheduleNextPrewarm()
                }
        }
    }
}
