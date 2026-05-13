import AuthenticationServices
import CryptoKit
import Foundation
import UIKit
import os.log

/// OAuth 2.0 PKCE flow for Spotify. No client secret is required — safe for
/// shipping in a mobile binary. Tokens are persisted in the Keychain.
@MainActor
final class SpotifyAuthService: NSObject, ObservableObject {
    enum AuthError: LocalizedError {
        case invalidResponse
        case userCancelled
        case missingCode
        case server(String)
        case unauthenticated

        var errorDescription: String? {
            switch self {
            case .invalidResponse: "Respuesta inválida del servidor."
            case .userCancelled: "Inicio de sesión cancelado."
            case .missingCode: "Spotify no devolvió un código de autorización."
            case .server(let m): m
            case .unauthenticated: "Tu sesión de Spotify expiró. Volvé a conectar."
            }
        }
    }

    @Published private(set) var isAuthenticated: Bool = false
    @Published private(set) var displayName: String?

    private let keychain: KeychainStore
    private var authSession: ASWebAuthenticationSession?
    private var pendingVerifier: String?
    private let log = AppLog.auth

    private struct TokenResponse: Decodable {
        let access_token: String
        let token_type: String
        let scope: String?
        let expires_in: Int
        let refresh_token: String?
    }

    private enum Key {
        static let access = "spotify.access_token"
        static let refresh = "spotify.refresh_token"
        static let expiry = "spotify.expires_at"
        static let displayName = "spotify.display_name"
    }

    init(keychain: KeychainStore = KeychainStore()) {
        self.keychain = keychain
        super.init()
        self.isAuthenticated = keychain.get(Key.refresh) != nil
        self.displayName = keychain.get(Key.displayName)
    }

    // MARK: - Sign in

    func signIn() async throws {
        let verifier = Self.generateCodeVerifier()
        let challenge = Self.codeChallenge(for: verifier)
        pendingVerifier = verifier

        var comps = URLComponents(
            url: SpotifyConfig.accountsBaseURL.appendingPathComponent("authorize"),
            resolvingAgainstBaseURL: false
        )!
        comps.queryItems = [
            URLQueryItem(name: "client_id", value: SpotifyConfig.clientID),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "redirect_uri", value: SpotifyConfig.redirectURI.absoluteString),
            URLQueryItem(name: "scope", value: SpotifyConfig.scopeString),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "show_dialog", value: "false")
        ]

        let url = comps.url!
        let callback = try await startAuthSession(url: url)
        guard
            let queryItems = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems,
            let code = queryItems.first(where: { $0.name == "code" })?.value
        else {
            if URLComponents(url: callback, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "error" }) != nil {
                throw AuthError.userCancelled
            }
            throw AuthError.missingCode
        }

        let token = try await exchangeCode(code, verifier: verifier)
        try persist(token: token)
        try await fetchAndStoreProfile()
    }

    func signOut() {
        keychain.delete(Key.access)
        keychain.delete(Key.refresh)
        keychain.delete(Key.expiry)
        keychain.delete(Key.displayName)
        isAuthenticated = false
        displayName = nil
    }

    // MARK: - Token use

    /// Returns a valid access token, refreshing transparently if needed.
    func validAccessToken() async throws -> String {
        if let token = currentAccessToken(), !isExpiringSoon() {
            return token
        }
        guard let refresh = keychain.get(Key.refresh) else {
            isAuthenticated = false
            throw AuthError.unauthenticated
        }
        let token = try await refreshToken(refresh)
        try persist(token: token, fallbackRefresh: refresh)
        return token.access_token
    }

    func currentAccessToken() -> String? {
        keychain.get(Key.access)
    }

    func currentRefreshToken() -> String? {
        keychain.get(Key.refresh)
    }

    // MARK: - Networking

    private func exchangeCode(_ code: String, verifier: String) async throws -> TokenResponse {
        var req = URLRequest(url: SpotifyConfig.accountsBaseURL.appendingPathComponent("api/token"))
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let body = [
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": SpotifyConfig.redirectURI.absoluteString,
            "client_id": SpotifyConfig.clientID,
            "code_verifier": verifier
        ]
        req.httpBody = Self.formEncode(body)
        let (data, response) = try await URLSession.shared.data(for: req)
        try Self.ensureOK(response: response, data: data)
        return try JSONDecoder().decode(TokenResponse.self, from: data)
    }

    private func refreshToken(_ refreshToken: String) async throws -> TokenResponse {
        var req = URLRequest(url: SpotifyConfig.accountsBaseURL.appendingPathComponent("api/token"))
        req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        let body = [
            "grant_type": "refresh_token",
            "refresh_token": refreshToken,
            "client_id": SpotifyConfig.clientID
        ]
        req.httpBody = Self.formEncode(body)
        let (data, response) = try await URLSession.shared.data(for: req)
        try Self.ensureOK(response: response, data: data)
        return try JSONDecoder().decode(TokenResponse.self, from: data)
    }

    private func fetchAndStoreProfile() async throws {
        guard let token = currentAccessToken() else { return }
        var req = URLRequest(url: SpotifyConfig.apiBaseURL.appendingPathComponent("me"))
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, _) = try await URLSession.shared.data(for: req)
        struct Me: Decodable { let display_name: String? }
        if let me = try? JSONDecoder().decode(Me.self, from: data), let name = me.display_name {
            try? keychain.set(name, for: Key.displayName)
            self.displayName = name
        }
    }

    // MARK: - Persistence

    private func persist(token: TokenResponse, fallbackRefresh: String? = nil) throws {
        try keychain.set(token.access_token, for: Key.access)
        let refresh = token.refresh_token ?? fallbackRefresh
        if let r = refresh {
            try keychain.set(r, for: Key.refresh)
        }
        let expiry = Date().addingTimeInterval(TimeInterval(token.expires_in))
        try keychain.set(String(expiry.timeIntervalSince1970), for: Key.expiry)
        isAuthenticated = true
    }

    private func isExpiringSoon() -> Bool {
        guard let raw = keychain.get(Key.expiry), let ts = Double(raw) else { return true }
        let expiry = Date(timeIntervalSince1970: ts)
        return expiry.timeIntervalSinceNow < 60
    }

    // MARK: - PKCE helpers

    private static func generateCodeVerifier() -> String {
        var bytes = [UInt8](repeating: 0, count: 64)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64URLEncodedString()
    }

    private static func codeChallenge(for verifier: String) -> String {
        let hashed = SHA256.hash(data: Data(verifier.utf8))
        return Data(hashed).base64URLEncodedString()
    }

    private static func formEncode(_ params: [String: String]) -> Data {
        var comps = URLComponents()
        comps.queryItems = params.map { URLQueryItem(name: $0.key, value: $0.value) }
        return Data((comps.percentEncodedQuery ?? "").utf8)
    }

    private static func ensureOK(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw AuthError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw AuthError.server(msg)
        }
    }

    // MARK: - ASWebAuthenticationSession

    private func startAuthSession(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { cont in
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: SpotifyConfig.redirectScheme
            ) { callback, error in
                if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    cont.resume(throwing: AuthError.userCancelled); return
                }
                if let error = error {
                    cont.resume(throwing: error); return
                }
                guard let callback = callback else {
                    cont.resume(throwing: AuthError.invalidResponse); return
                }
                cont.resume(returning: callback)
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.authSession = session
            if !session.start() {
                cont.resume(throwing: AuthError.invalidResponse)
            }
        }
    }
}

extension SpotifyAuthService: ASWebAuthenticationPresentationContextProviding {
    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            if let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState == .foregroundActive }),
               let window = scene.windows.first(where: { $0.isKeyWindow }) ?? scene.windows.first {
                return window
            }
            return ASPresentationAnchor()
        }
    }
}

private extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
