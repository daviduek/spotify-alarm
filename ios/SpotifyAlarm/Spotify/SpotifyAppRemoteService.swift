import Foundation
import SpotifyiOS
import UIKit
import os.log

/// Wraps the Spotify iOS SDK App Remote, which provides high-fidelity IPC
/// with the installed Spotify app: play, pause, queue, subscribe to player
/// state. App Remote does NOT control system volume — for volume ramping we
/// use the Web API (`/me/player/volume`).
@MainActor
final class SpotifyAppRemoteService: NSObject, ObservableObject {
    enum RemoteError: LocalizedError {
        case spotifyNotInstalled
        case connectionFailed(String)
        case notConnected

        var errorDescription: String? {
            switch self {
            case .spotifyNotInstalled: "Instalá la app de Spotify para usar esta función."
            case .connectionFailed(let m): "No pude conectarme con Spotify: \(m)"
            case .notConnected: "Spotify App Remote no está conectado."
            }
        }
    }

    @Published private(set) var isConnected: Bool = false
    @Published private(set) var lastError: String?

    let appRemote: SPTAppRemote
    private let auth: SpotifyAuthService
    private let log = AppLog.appRemote

    init(auth: SpotifyAuthService) {
        self.auth = auth
        let config = SPTConfiguration(clientID: SpotifyConfig.clientID, redirectURL: SpotifyConfig.redirectURI)
        config.playURI = ""
        if let swap = SpotifyConfig.tokenSwapURL { config.tokenSwapURL = swap }
        if let refresh = SpotifyConfig.tokenRefreshURL { config.tokenRefreshURL = refresh }
        self.appRemote = SPTAppRemote(configuration: config, logLevel: .info)
        super.init()
        self.appRemote.delegate = self
    }

    var isSpotifyInstalled: Bool {
        guard let url = URL(string: "spotify:") else { return false }
        return UIApplication.shared.canOpenURL(url)
    }

    /// Authorizes (deep-links into Spotify app), and starts playback of `uri`
    /// once connected. Used at alarm fire time.
    func authorizeAndPlay(uri: String) {
        guard isSpotifyInstalled else {
            lastError = RemoteError.spotifyNotInstalled.localizedDescription
            return
        }
        appRemote.authorizeAndPlayURI(uri)
    }

    func connect(withToken token: String) {
        appRemote.connectionParameters.accessToken = token
        appRemote.connect()
    }

    func disconnect() {
        if appRemote.isConnected { appRemote.disconnect() }
        isConnected = false
    }

    func handleURLCallback(_ url: URL) -> Bool {
        let parameters = appRemote.authorizationParameters(from: url)
        if let token = parameters?[SPTAppRemoteAccessTokenKey] {
            appRemote.connectionParameters.accessToken = token
            appRemote.connect()
            return true
        }
        if let error = parameters?[SPTAppRemoteErrorDescriptionKey] {
            lastError = error
            log.error("App Remote error: \(error)")
            return true
        }
        return false
    }

    // MARK: - Playback

    func play(uri: String) async throws {
        guard appRemote.isConnected, let player = appRemote.playerAPI else {
            throw RemoteError.notConnected
        }
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            player.play(uri) { _, error in
                if let error = error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }
    }

    func pause() async throws {
        guard appRemote.isConnected, let player = appRemote.playerAPI else {
            throw RemoteError.notConnected
        }
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            player.pause { _, error in
                if let error = error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }
    }
}

// MARK: - Delegates

extension SpotifyAppRemoteService: SPTAppRemoteDelegate {
    nonisolated func appRemoteDidEstablishConnection(_ appRemote: SPTAppRemote) {
        Task { @MainActor in
            self.isConnected = true
            self.log.info("App Remote connected")
        }
    }

    nonisolated func appRemote(_ appRemote: SPTAppRemote, didFailConnectionAttemptWithError error: Error?) {
        Task { @MainActor in
            self.isConnected = false
            self.lastError = error?.localizedDescription
            self.log.error("App Remote failed: \(error?.localizedDescription ?? "—")")
        }
    }

    nonisolated func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: Error?) {
        Task { @MainActor in
            self.isConnected = false
            if let error = error {
                self.log.error("App Remote disconnected: \(error.localizedDescription)")
            }
        }
    }
}
