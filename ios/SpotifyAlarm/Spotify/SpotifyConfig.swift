import Foundation

/// Public Spotify app credentials. The client ID is safe to ship in the app
/// when using PKCE — no client secret is ever embedded.
///
/// Configure in Spotify Developer Dashboard:
///   • Redirect URI: spotifyalarm://callback
///   • iOS Bundle ID: com.daviduek.spotifyalarm
enum SpotifyConfig {
    /// Read from Info.plist key `SpotifyClientID`, falling back to the
    /// compile-time default. Override per-build with an .xcconfig.
    static var clientID: String {
        if let value = Bundle.main.object(forInfoDictionaryKey: "SpotifyClientID") as? String,
           !value.isEmpty {
            return value
        }
        return "REPLACE_WITH_YOUR_CLIENT_ID"
    }

    static let redirectURI = URL(string: "spotifyalarm://callback")!
    static let redirectScheme = "spotifyalarm"

    static let tokenSwapURL: URL? = nil  // optional backend swap; nil = direct PKCE
    static let tokenRefreshURL: URL? = nil

    static let scopes: [String] = [
        "user-read-private",
        "user-read-email",
        "user-read-playback-state",
        "user-modify-playback-state",
        "user-read-currently-playing",
        "streaming",
        "playlist-read-private",
        "playlist-read-collaborative",
        "user-library-read",
        "user-read-recently-played",
        "app-remote-control"
    ]

    static var scopeString: String { scopes.joined(separator: " ") }

    static let accountsBaseURL = URL(string: "https://accounts.spotify.com")!
    static let apiBaseURL = URL(string: "https://api.spotify.com/v1")!
}
