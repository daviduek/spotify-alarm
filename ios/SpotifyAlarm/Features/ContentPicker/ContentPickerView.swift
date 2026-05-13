import SwiftUI

struct ContentPickerView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var auth: SpotifyAuthService

    let onSelect: (SpotifyContent) -> Void

    @State private var query = ""
    @State private var searching = false
    @State private var searchTask: Task<Void, Never>?

    @State private var searchResults: [SpotifyContent] = []
    @State private var playlists: [SpotifyContent] = []
    @State private var recent: [SpotifyContent] = []
    @State private var errorMessage: String?

    private var api: SpotifyWebAPI { SpotifyWebAPI(auth: auth) }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()

                ScrollView {
                    VStack(spacing: Theme.Spacing.l) {
                        searchField

                        if !query.isEmpty {
                            section(title: "Resultados", items: searchResults)
                        } else {
                            if !recent.isEmpty {
                                section(title: "Reproducido recientemente", items: recent)
                            }
                            if !playlists.isEmpty {
                                section(title: "Tus playlists", items: playlists)
                            }
                        }

                        if let error = errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(Theme.Color.danger)
                                .padding(.horizontal, Theme.Spacing.m)
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.m)
                    .padding(.vertical, Theme.Spacing.m)
                }
            }
            .navigationTitle("Elegir sonido")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cerrar") { dismiss() }
                        .foregroundStyle(Theme.Color.textSecondary)
                }
            }
            .task { await loadInitial() }
            .onChange(of: query) { _, newValue in
                searchTask?.cancel()
                searchTask = Task { await debouncedSearch(newValue) }
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: Theme.Spacing.s) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Theme.Color.textTertiary)
            TextField("Buscar canciones, playlists, álbumes…", text: $query)
                .textInputAutocapitalization(.never)
                .foregroundStyle(Theme.Color.textPrimary)
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Theme.Color.textTertiary)
                }
            }
            if searching { ProgressView().tint(Theme.Color.accent) }
        }
        .padding(.horizontal, Theme.Spacing.m)
        .frame(height: 48)
        .background(Theme.Color.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
    }

    private func section(title: String, items: [SpotifyContent]) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s) {
            SectionHeader(title: title, trailing: "\(items.count)")
            VStack(spacing: 0) {
                ForEach(items) { item in
                    Button {
                        onSelect(item)
                    } label: {
                        HStack(spacing: Theme.Spacing.m) {
                            CoverArtView(url: item.artworkURL, size: 48, corner: 6)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.title)
                                    .font(.bodyEmphasized)
                                    .foregroundStyle(Theme.Color.textPrimary)
                                    .lineLimit(1)
                                Text(item.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(Theme.Color.textSecondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            Image(systemName: kindIcon(item.kind))
                                .foregroundStyle(Theme.Color.textTertiary)
                        }
                        .padding(.vertical, Theme.Spacing.s)
                        .padding(.horizontal, Theme.Spacing.m)
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(Theme.Color.divider).padding(.leading, Theme.Spacing.m + 48 + Theme.Spacing.m)
                }
            }
            .background(Theme.Color.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        }
    }

    private func kindIcon(_ kind: SpotifyContent.Kind) -> String {
        switch kind {
        case .track:    "music.note"
        case .playlist: "music.note.list"
        case .album:    "square.stack"
        case .artist:   "person.fill"
        }
    }

    // MARK: - Loading

    private func loadInitial() async {
        await loadPlaylists()
        await loadRecent()
    }

    private func loadPlaylists() async {
        do {
            let result = try await api.userPlaylists(limit: 30)
            self.playlists = result.items.map { $0.content }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadRecent() async {
        do {
            let result = try await api.recentlyPlayed(limit: 20)
            self.recent = result.items.map { $0.track.content }
        } catch {
            // Recently played requires recent activity; non-fatal.
        }
    }

    private func debouncedSearch(_ text: String) async {
        try? await Task.sleep(nanoseconds: 300_000_000)
        if Task.isCancelled { return }
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else {
            searchResults = []
            return
        }
        searching = true
        defer { searching = false }
        do {
            let results = try await api.search(query: text)
            var combined: [SpotifyContent] = []
            if let tracks = results.tracks?.items { combined += tracks.map(\.content) }
            if let playlists = results.playlists?.items { combined += playlists.map(\.content) }
            if let albums = results.albums?.items { combined += albums.map(\.content) }
            searchResults = combined
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
