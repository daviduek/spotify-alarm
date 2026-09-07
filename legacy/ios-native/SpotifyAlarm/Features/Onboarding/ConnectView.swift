import SwiftUI

struct ConnectView: View {
    @EnvironmentObject var auth: SpotifyAuthService
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            AppBackground()

            VStack(spacing: Theme.Spacing.xl) {
                Spacer()

                ZStack {
                    Circle()
                        .fill(Theme.Color.accent.opacity(0.2))
                        .frame(width: 240, height: 240)
                        .blur(radius: 40)

                    Image(systemName: "alarm.waves.left.and.right.fill")
                        .font(.system(size: 90, weight: .semibold))
                        .foregroundStyle(Theme.Color.accent)
                        .shadow(color: Theme.Color.accent.opacity(0.5), radius: 20)
                }

                VStack(spacing: 14) {
                    Text("Spotify Alarm")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(Theme.Color.textPrimary)

                    Text("Despertate con tu música.\nVolumen progresivo. Hora exacta.")
                        .multilineTextAlignment(.center)
                        .font(.system(size: 17))
                        .foregroundStyle(Theme.Color.textSecondary)
                }
                .padding(.horizontal, Theme.Spacing.l)

                Spacer()

                VStack(spacing: Theme.Spacing.m) {
                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(Theme.Color.danger)
                            .multilineTextAlignment(.center)
                            .transition(.opacity)
                    }

                    PrimaryButton(
                        title: "Conectar con Spotify",
                        icon: "music.note",
                        isLoading: isLoading,
                        action: connect
                    )

                    Text("Necesitás Spotify Premium para controlar la reproducción.")
                        .font(.caption)
                        .foregroundStyle(Theme.Color.textTertiary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, Theme.Spacing.l)
                .padding(.bottom, Theme.Spacing.l)
            }
        }
    }

    private func connect() {
        Task {
            errorMessage = nil
            isLoading = true
            defer { isLoading = false }
            do {
                try await auth.signIn()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
