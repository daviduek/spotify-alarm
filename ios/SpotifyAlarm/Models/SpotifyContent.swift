import Foundation

struct SpotifyContent: Equatable, Hashable, Codable, Identifiable {
    enum Kind: String, Codable, CaseIterable {
        case track, playlist, album, artist
    }

    var id: String { uri }
    var uri: String
    var title: String
    var subtitle: String
    var artworkURL: String?
    var kind: Kind

    static let placeholder = SpotifyContent(
        uri: "",
        title: "Elegí un sonido",
        subtitle: "Canción, playlist o álbum",
        artworkURL: nil,
        kind: .track
    )
}
