import SwiftUI

struct RootView: View {
    @EnvironmentObject var auth: SpotifyAuthService
    @EnvironmentObject var engine: AlarmEngine

    var body: some View {
        ZStack {
            if auth.isAuthenticated {
                AlarmsListView()
            } else {
                ConnectView()
            }

            if let firing = engine.activeAlarm, engine.state != .idle, engine.state != .stopped {
                AlarmFiringView(alarm: firing)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .zIndex(10)
            }
        }
        .animation(Theme.Motion.gentle, value: auth.isAuthenticated)
        .animation(Theme.Motion.gentle, value: engine.activeAlarm?.id)
    }
}
