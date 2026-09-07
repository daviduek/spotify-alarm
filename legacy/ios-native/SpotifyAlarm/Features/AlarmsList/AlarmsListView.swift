import SwiftUI
import SwiftData

struct AlarmsListView: View {
    @EnvironmentObject var store: AlarmStore
    @EnvironmentObject var auth: SpotifyAuthService
    @State private var editingAlarm: Alarm?
    @State private var showingNewAlarm = false

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()

                ScrollView {
                    LazyVStack(spacing: Theme.Spacing.s) {
                        if store.alarms.isEmpty {
                            emptyState
                        } else {
                            ForEach(store.alarms, id: \.id) { alarm in
                                AlarmRow(alarm: alarm)
                                    .onTapGesture { editingAlarm = alarm }
                                    .contextMenu {
                                        Button(role: .destructive) {
                                            store.delete(alarm)
                                        } label: {
                                            Label("Eliminar", systemImage: "trash")
                                        }
                                    }
                            }
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.m)
                    .padding(.top, Theme.Spacing.s)
                }
            }
            .navigationTitle("Alarmas")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingNewAlarm = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                            .foregroundStyle(Theme.Color.accent)
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        if let name = auth.displayName {
                            Text("Conectado como \(name)")
                        }
                        Button(role: .destructive) {
                            auth.signOut()
                        } label: {
                            Label("Cerrar sesión", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    } label: {
                        Image(systemName: "person.circle")
                            .font(.title2)
                            .foregroundStyle(Theme.Color.textSecondary)
                    }
                }
            }
            .sheet(isPresented: $showingNewAlarm) {
                AlarmEditorView(mode: .create)
            }
            .sheet(item: $editingAlarm) { alarm in
                AlarmEditorView(mode: .edit(alarm))
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: Theme.Spacing.m) {
            Image(systemName: "alarm")
                .font(.system(size: 56))
                .foregroundStyle(Theme.Color.textTertiary)
                .padding(.top, 80)
            Text("Sin alarmas todavía")
                .font(.titleMedium)
                .foregroundStyle(Theme.Color.textPrimary)
            Text("Tocá + para crear tu primera alarma con Spotify.")
                .multilineTextAlignment(.center)
                .font(.body)
                .foregroundStyle(Theme.Color.textSecondary)
        }
        .padding(.horizontal, Theme.Spacing.l)
    }
}

private struct AlarmRow: View {
    @EnvironmentObject var store: AlarmStore
    let alarm: Alarm

    var body: some View {
        HStack(spacing: Theme.Spacing.m) {
            CoverArtView(url: alarm.contentArtworkURL, size: 64, corner: 10)

            VStack(alignment: .leading, spacing: 4) {
                Text(timeString)
                    .font(.system(size: 36, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(alarm.isEnabled ? Theme.Color.textPrimary : Theme.Color.textSecondary)

                Text(alarm.label)
                    .font(.caption)
                    .foregroundStyle(Theme.Color.textTertiary)

                Text(alarm.contentTitle)
                    .font(.body)
                    .foregroundStyle(Theme.Color.textSecondary)
                    .lineLimit(1)
            }

            Spacer()

            Toggle("", isOn: Binding(
                get: { alarm.isEnabled },
                set: { newValue in
                    Task { await store.setEnabled(newValue, on: alarm) }
                }
            ))
            .labelsHidden()
            .tint(Theme.Color.accent)
        }
        .padding(Theme.Spacing.m)
        .background(Theme.Color.surface)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
    }

    private var timeString: String {
        String(format: "%02d:%02d", alarm.hour, alarm.minute)
    }
}
