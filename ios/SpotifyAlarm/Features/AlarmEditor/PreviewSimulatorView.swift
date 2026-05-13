import SwiftUI
import AVFoundation

/// Compresses the ramp duration into a configurable preview time (default 20s)
/// and animates the volume bar accordingly. If a fallback local tone is
/// available, plays it at the simulated volume.
struct PreviewSimulatorView: View {
    @Environment(\.dismiss) private var dismiss
    let ramp: VolumeRamp
    let content: SpotifyContent

    @State private var isRunning = false
    @State private var elapsedReal: TimeInterval = 0
    @State private var compression: Double = 1
    @State private var task: Task<Void, Never>?
    @State private var player: AVAudioPlayer?

    private let previewDuration: TimeInterval = 20

    private var realDuration: TimeInterval {
        max(1, TimeInterval(ramp.totalDurationSeconds))
    }

    private var simulatedElapsed: TimeInterval {
        elapsedReal * compression
    }

    private var currentVolume: Int {
        ramp.volume(at: simulatedElapsed)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()

                VStack(spacing: Theme.Spacing.l) {
                    Card {
                        HStack(spacing: Theme.Spacing.m) {
                            CoverArtView(url: content.artworkURL, size: 64, corner: 10)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(content.title).font(.bodyEmphasized)
                                Text(content.subtitle).font(.caption).foregroundStyle(Theme.Color.textSecondary)
                            }
                            Spacer()
                        }
                    }

                    Card {
                        VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                            SectionHeader(title: "Volumen simulado")

                            Text("\(currentVolume)%")
                                .font(.displayMedium)
                                .foregroundStyle(Theme.Color.accent)
                                .frame(maxWidth: .infinity, alignment: .center)

                            VolumeBar(value: currentVolume)
                                .frame(height: 10)

                            HStack {
                                Text("0 s")
                                Spacer()
                                Text(formatTime(realDuration))
                            }
                            .font(.caption)
                            .foregroundStyle(Theme.Color.textTertiary)

                            ProgressView(value: min(1, elapsedReal / previewDuration))
                                .tint(Theme.Color.accent)
                        }
                    }

                    Card {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                            Text("Compresión de tiempo")
                                .font(.caption)
                                .foregroundStyle(Theme.Color.textSecondary)
                            Text("La rampa real dura \(formatTime(realDuration)). La simulación la condensa en ~\(Int(previewDuration)) s.")
                                .font(.body)
                                .foregroundStyle(Theme.Color.textPrimary)
                        }
                    }

                    Spacer()

                    PrimaryButton(title: isRunning ? "Detener" : "Reproducir simulación",
                                  icon: isRunning ? "stop.fill" : "play.fill",
                                  action: toggle)
                }
                .padding(.horizontal, Theme.Spacing.m)
                .padding(.vertical, Theme.Spacing.m)
            }
            .navigationTitle("Preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Listo") { stop(); dismiss() }
                        .foregroundStyle(Theme.Color.accent)
                }
            }
        }
        .onAppear { compression = realDuration / previewDuration }
        .onDisappear { stop() }
    }

    private func toggle() {
        if isRunning { stop() } else { start() }
    }

    private func start() {
        isRunning = true
        elapsedReal = 0
        startTone()
        task = Task { @MainActor in
            let startTime = Date()
            while !Task.isCancelled, elapsedReal < previewDuration {
                elapsedReal = Date().timeIntervalSince(startTime)
                player?.volume = Float(currentVolume) / 100
                try? await Task.sleep(nanoseconds: 100_000_000) // 100 ms
            }
            stop()
        }
    }

    private func stop() {
        task?.cancel()
        task = nil
        player?.stop()
        player = nil
        isRunning = false
        elapsedReal = 0
    }

    private func startTone() {
        // Use the local fallback tone to give the user audible feedback
        // during the simulation (works without Spotify).
        guard let url = Bundle.main.url(forResource: "FallbackTone", withExtension: "m4a")
            ?? Bundle.main.url(forResource: "SilentLoop", withExtension: "m4a")
        else { return }
        do {
            let p = try AVAudioPlayer(contentsOf: url)
            p.numberOfLoops = -1
            p.volume = Float(ramp.startVolume) / 100
            p.prepareToPlay()
            p.play()
            self.player = p
        } catch { }
    }

    private func formatTime(_ seconds: TimeInterval) -> String {
        let total = Int(seconds)
        if total < 60 { return "\(total) s" }
        return "\(total / 60) min \(total % 60) s"
    }
}
