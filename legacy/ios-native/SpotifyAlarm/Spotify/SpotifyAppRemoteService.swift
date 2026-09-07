import Foundation
import UIKit
import os.log

#if canImport(SpotifyiOS)
import SpotifyiOS
#endif

/// Wraps the Spotify iOS SDK App Remote, which provides high-fidelity IPC
/// with the installed Spotify app. App Remote does NOT control system volume
/// — for volume ramping we use the Web API (`/me/player/volume`).
///
/// The Spotify iOS SDK ships as a binary `.xcframework` (no SwiftPM); see
/// `ios/Scripts/install-spotify-sdk.sh`. Without the framework, this service
/// compiles but the App Remote APIs are no-ops — the AlarmEngine will fall
/// back to the Web API path.
@MainActor
final class SpotifyAppRemoteService: NSObject, ObservableObject {
    enum RemoteError: LocalizedError {
        case spotifyNotInstalled
        case sdkUnavailable
        case connectionFailed(String)
        case notConnected

        var errorDescription: String? {
            switch self {
            case .spotifyNotInstalled: "Instalá la app de Spotify para usar esta función."
            case .sdkUnavailable: "El SDK de Spotify iOS no está integrado en este build."
            case .connectionFailed(let m): "No pude conectarme con Spotify: \(m)"
            case .notConnected: "Spotify App Remote no está conectado."
            }
        }
    }

    @Published private(set) var isConnected: Bool = false
    @Published private(set) var lastError: String?

    private let auth: SpotifyAuthService
    private let log = AppLog.appRemote

    #if canImport(SpotifyiOS)
    let appRemote: SPTAppRemote
    #endif

    init(auth: SpotifyAuthService) {
        self.auth = auth
        #if canImport(SpotifyiOS)
        let config = SPTConfiguration(clientID: SpotifyConfig.clientID, redirectURL: SpotifyConfig.redirectURI)
        config.playURI = ""
        if let swap = SpotifyConfig.tokenSwapURL { config.tokenSwapURL = swap }
        if let refresh = SpotifyConfig.tokenRefreshURL { config.tokenRefreshURL = refresh }
        self.appRemote = SPTAppRemote(configuration: config, logLevel: .info)
        #endif
        super.init()
        #if canImport(SpotifyiOS)
        self.appRemote.delegate = self
        #endif
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
        #if canImport(SpotifyiOS)
        appRemote.authorizeAndPlayURI(uri)
        #else
        lastError = RemoteError.sdkUnavailable.localizedDescription
        #endif
    }

    func connect(withToken token: String) {
        #if canImport(SpotifyiOS)
        appRemote.connectionParameters.accessToken = token
        appRemote.connect()
        #endif
    }

    func disconnect() {
        #if canImport(SpotifyiOS)
        if appRemote.isConnected { appRemote.disconnect() }
        #endif
        isConnected = false
    }

    func handleURLCallback(_ url: URL) -> Bool {
        #if canImport(SpotifyiOS)
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
        #endif
        return false
    }

    // MARK: - Playback

    func play(uri: String) async throws {
        #if canImport(SpotifyiOS)
        guard appRemote.isConnected, let player = appRemote.playerAPI else {
            throw RemoteError.notConnected
        }
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            player.play(uri) { _, error in
                if let error = error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }
        #else
        throw RemoteError.sdkUnavailable
        #endif
    }

    func pause() async throws {
        #if canImport(SpotifyiOS)
        guard appRemote.isConnected, let player = appRemote.playerAPI else {
            throw RemoteError.notConnected
        }
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            player.pause { _, error in
                if let error = error { cont.resume(throwing: error) } else { cont.resume() }
            }
        }
        #else
        throw RemoteError.sdkUnavailable
        #endif
    }
}

#if canImport(SpotifyiOS)
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
#endif
