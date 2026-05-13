import Foundation
import os.log

/// Thin Spotify Web API client. We only implement the endpoints the app needs.
@MainActor
final class SpotifyWebAPI {
    enum APIError: LocalizedError {
        case notAuthenticated
        case http(Int, String?)
        case decoding(Error)
        case noActiveDevice
        case premiumRequired

        var errorDescription: String? {
            switch self {
            case .notAuthenticated: "Necesitás iniciar sesión con Spotify."
            case .http(let code, let body): "Error \(code): \(body ?? "—")"
            case .decoding(let e): "No pude leer la respuesta de Spotify (\(e.localizedDescription))."
            case .noActiveDevice: "Spotify no tiene un dispositivo activo. Abrí la app y reproducí algo."
            case .premiumRequired: "Esta función requiere Spotify Premium."
            }
        }
    }

    private let auth: SpotifyAuthService
    private let session: URLSession
    private let log = AppLog.api

    init(auth: SpotifyAuthService, session: URLSession = .shared) {
        self.auth = auth
        self.session = session
    }

    // MARK: - Public endpoints

    func currentUser() async throws -> User {
        try await get("me")
    }

    func search(query: String, types: [SpotifyContent.Kind] = [.track, .playlist, .album], limit: Int = 20) async throws -> SearchResults {
        let typeString = types.map { $0.rawValue }.joined(separator: ",")
        let items: [URLQueryItem] = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "type", value: typeString),
            URLQueryItem(name: "limit", value: String(limit))
        ]
        return try await get("search", query: items)
    }

    func userPlaylists(limit: Int = 50) async throws -> Paged<PlaylistDTO> {
        try await get("me/playlists", query: [URLQueryItem(name: "limit", value: String(limit))])
    }

    func recentlyPlayed(limit: Int = 20) async throws -> Paged<PlayHistoryDTO> {
        try await get("me/player/recently-played", query: [URLQueryItem(name: "limit", value: String(limit))])
    }

    func devices() async throws -> DevicesResponse {
        try await get("me/player/devices")
    }

    // MARK: - Playback control

    func play(uri: String, deviceID: String? = nil) async throws {
        var path = "me/player/play"
        if let d = deviceID { path += "?device_id=\(d)" }
        let body: [String: Any]
        if uri.contains(":track:") {
            body = ["uris": [uri]]
        } else {
            body = ["context_uri": uri]
        }
        try await mutate(path: path, method: "PUT", json: body, expect: 204)
    }

    func pause(deviceID: String? = nil) async throws {
        var path = "me/player/pause"
        if let d = deviceID { path += "?device_id=\(d)" }
        try await mutate(path: path, method: "PUT", json: nil, expect: 204)
    }

    func setVolume(_ percent: Int, deviceID: String? = nil) async throws {
        let v = max(0, min(percent, 100))
        var items = [URLQueryItem(name: "volume_percent", value: String(v))]
        if let d = deviceID { items.append(URLQueryItem(name: "device_id", value: d)) }
        try await mutate(path: "me/player/volume", method: "PUT", query: items, json: nil, expect: 204)
    }

    func transferPlayback(to deviceID: String, play: Bool = true) async throws {
        try await mutate(
            path: "me/player",
            method: "PUT",
            json: ["device_ids": [deviceID], "play": play],
            expect: 204
        )
    }

    // MARK: - Plumbing

    private func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        let req = try await authorizedRequest(path: path, method: "GET", query: query)
        let (data, response) = try await session.data(for: req)
        try ensureOK(response, data: data)
        do {
            return try JSONDecoder.spotify.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    private func mutate(
        path: String,
        method: String,
        query: [URLQueryItem] = [],
        json: Any?,
        expect: Int
    ) async throws {
        var req = try await authorizedRequest(path: path, method: method, query: query)
        if let json = json {
            req.httpBody = try JSONSerialization.data(withJSONObject: json)
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.data(for: req)
        try ensureOK(response, data: data)
    }

    private func authorizedRequest(path: String, method: String, query: [URLQueryItem]) async throws -> URLRequest {
        var comps = URLComponents(
            url: SpotifyConfig.apiBaseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty { comps.queryItems = query }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        let token = try await auth.validAccessToken()
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return req
    }

    private func ensureOK(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw APIError.http(-1, nil) }
        let body = String(data: data, encoding: .utf8)
        switch http.statusCode {
        case 200..<300:
            return
        case 401:
            throw APIError.notAuthenticated
        case 403:
            if body?.contains("PREMIUM_REQUIRED") == true {
                throw APIError.premiumRequired
            }
            throw APIError.http(403, body)
        case 404:
            throw APIError.noActiveDevice
        default:
            throw APIError.http(http.statusCode, body)
        }
    }
}

// MARK: - DTOs

extension SpotifyWebAPI {
    struct User: Decodable {
        let id: String
        let displayName: String?
        let product: String?

        enum CodingKeys: String, CodingKey {
            case id
            case displayName = "display_name"
            case product
        }
    }

    struct Paged<T: Decodable>: Decodable {
        let items: [T]
        let total: Int?
        let next: String?
    }

    struct ImageDTO: Decodable {
        let url: String
        let height: Int?
        let width: Int?
    }

    struct TrackDTO: Decodable, Identifiable {
        let id: String
        let uri: String
        let name: String
        let artists: [ArtistDTO]
        let album: AlbumDTO?

        var content: SpotifyContent {
            SpotifyContent(
                uri: uri,
                title: name,
                subtitle: artists.map(\.name).joined(separator: ", "),
                artworkURL: album?.images.first?.url,
                kind: .track
            )
        }
    }

    struct ArtistDTO: Decodable, Identifiable {
        let id: String
        let uri: String
        let name: String
        let images: [ImageDTO]?

        var content: SpotifyContent {
            SpotifyContent(uri: uri, title: name, subtitle: "Artista", artworkURL: images?.first?.url, kind: .artist)
        }
    }

    struct AlbumDTO: Decodable, Identifiable {
        let id: String
        let uri: String
        let name: String
        let images: [ImageDTO]
        let artists: [ArtistDTO]?

        var content: SpotifyContent {
            SpotifyContent(
                uri: uri,
                title: name,
                subtitle: artists?.map(\.name).joined(separator: ", ") ?? "Álbum",
                artworkURL: images.first?.url,
                kind: .album
            )
        }
    }

    struct PlaylistDTO: Decodable, Identifiable {
        let id: String
        let uri: String
        let name: String
        let images: [ImageDTO]?
        let owner: OwnerDTO?
        let tracks: TracksMetaDTO?

        struct OwnerDTO: Decodable { let displayName: String?
            enum CodingKeys: String, CodingKey { case displayName = "display_name" }
        }
        struct TracksMetaDTO: Decodable { let total: Int? }

        var content: SpotifyContent {
            SpotifyContent(
                uri: uri,
                title: name,
                subtitle: tracks?.total.map { "\($0) canciones" } ?? owner?.displayName ?? "Playlist",
                artworkURL: images?.first?.url,
                kind: .playlist
            )
        }
    }

    struct PlayHistoryDTO: Decodable {
        let track: TrackDTO
        let playedAt: String
        enum CodingKeys: String, CodingKey {
            case track
            case playedAt = "played_at"
        }
    }

    struct DevicesResponse: Decodable {
        let devices: [Device]
    }

    struct Device: Decodable, Identifiable {
        let id: String?
        let isActive: Bool
        let name: String
        let type: String
        let volumePercent: Int?

        enum CodingKeys: String, CodingKey {
            case id
            case isActive = "is_active"
            case name, type
            case volumePercent = "volume_percent"
        }
    }

    struct SearchResults: Decodable {
        let tracks: Paged<TrackDTO>?
        let playlists: Paged<PlaylistDTO>?
        let albums: Paged<AlbumDTO>?
    }
}

private extension JSONDecoder {
    static let spotify: JSONDecoder = {
        let d = JSONDecoder()
        return d
    }()
}
