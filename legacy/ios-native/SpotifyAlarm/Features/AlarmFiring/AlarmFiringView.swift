import SwiftUI

/// Fullscreen view shown while an alarm is firing. Receives the engine state
/// reactively and offers Snooze / Stop actions.
struct AlarmFiringView: View {
    @EnvironmentObject var engine: AlarmEngine
    @Environment(\.dismiss) private var dismiss
    let alarm: Alarm

    @State private var now: Date = .now
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            // Blurred cover art as backdrop
            if let url = alarm.contentArtworkURL, let u = URL(string: url) {
                AsyncImage(url: u) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                            .blur(radius: 50)
                            .opacity(0.55)
                    } else {
                        Color.black
                    }
                }
                .ignoresSafeArea()
                Color.black.opacity(0.35).ignoresSafeArea()
            } else {
                Theme.Color.background.ignoresSafeArea()
            }

            VStack(spacing: Theme.Spacing.l) {
                Spacer()

                Text(timeString)
                    .font(.system(size: 96, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(.white)
                    .shadow(radius: 20)

                Text(alarm.label)
                    .font(.titleMedium)
                    .foregroundStyle(.white.opacity(0.8))

                Spacer()

                Card {
                    HStack(spacing: Theme.Spacing.m) {
                        CoverArtView(url: alarm.contentArtworkURL, size: 64, corner: 10)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(alarm.contentTitle).font(.bodyEmphasized).foregroundStyle(.white)
                            Text(alarm.contentSubtitle).font(.caption).foregroundStyle(.white.opacity(0.7))
                            VolumeBar(value: currentVolume).frame(height: 6).padding(.top, 6)
                        }
                    }
                }
                .padding(.horizontal, Theme.Spacing.m)

                HStack(spacing: Theme.Spacing.m) {
                    SecondaryButton(title: "Snooze 9'", icon: "moon.zzz") {
                        engine.snooze(minutes: 9)
                        dismiss()
                    }
                    PrimaryButton(title: "Detener", icon: "stop.fill") {
                        engine.stop()
                        dismiss()
                    }
                }
                .padding(.horizontal, Theme.Spacing.m)
                .padding(.bottom, Theme.Spacing.l)
            }
        }
        .onReceive(timer) { now = $0 }
    }

    private var currentVolume: Int {
        switch engine.state {
        case .playing(_, let v), .fallbackTone(let v): v
        default: alarm.startVolume
        }
    }

    private var timeString: String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: now)
    }
}
