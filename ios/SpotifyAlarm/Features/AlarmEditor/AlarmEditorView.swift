import SwiftUI

struct AlarmEditorView: View {
    enum Mode {
        case create
        case edit(Alarm)
    }

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var store: AlarmStore
    @EnvironmentObject var auth: SpotifyAuthService

    let mode: Mode

    @State private var time: Date = .now
    @State private var label: String = "Alarma"
    @State private var content: SpotifyContent = .placeholder
    @State private var ramp: VolumeRamp = .default
    @State private var repeatDays: Set<Weekday> = []
    @State private var isEnabled: Bool = true
    @State private var showingPicker = false
    @State private var showingPreview = false

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()

                ScrollView {
                    VStack(spacing: Theme.Spacing.l) {
                        timeSection
                        soundSection
                        rampSection
                        previewSection
                        repeatSection
                        labelSection

                        if case .edit = mode {
                            deleteButton
                        }
                    }
                    .padding(.horizontal, Theme.Spacing.m)
                    .padding(.vertical, Theme.Spacing.m)
                }
            }
            .navigationTitle(navTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancelar") { dismiss() }
                        .foregroundStyle(Theme.Color.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Guardar", action: save)
                        .foregroundStyle(Theme.Color.accent)
                        .disabled(content.uri.isEmpty)
                }
            }
            .sheet(isPresented: $showingPicker) {
                ContentPickerView(onSelect: { picked in
                    content = picked
                    showingPicker = false
                })
                .environmentObject(auth)
            }
            .sheet(isPresented: $showingPreview) {
                PreviewSimulatorView(ramp: ramp, content: content)
            }
            .onAppear(perform: load)
        }
    }

    private var navTitle: String {
        switch mode {
        case .create: "Nueva alarma"
        case .edit:   "Editar alarma"
        }
    }

    private func load() {
        if case .edit(let alarm) = mode {
            var comps = DateComponents()
            comps.hour = alarm.hour
            comps.minute = alarm.minute
            self.time = Calendar.current.date(from: comps) ?? .now
            self.label = alarm.label
            self.content = alarm.content
            self.ramp = alarm.ramp
            self.repeatDays = alarm.repeatDays
            self.isEnabled = alarm.isEnabled
        }
    }

    // MARK: - Sections

    private var timeSection: some View {
        Card(padding: Theme.Spacing.s) {
            DatePicker("", selection: $time, displayedComponents: .hourAndMinute)
                .datePickerStyle(.wheel)
                .labelsHidden()
                .frame(maxWidth: .infinity)
        }
    }

    private var soundSection: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                SectionHeader(title: "Sonido")
                Button {
                    showingPicker = true
                } label: {
                    HStack(spacing: Theme.Spacing.m) {
                        CoverArtView(url: content.artworkURL, size: 56, corner: 8)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(content.title)
                                .font(.bodyEmphasized)
                                .foregroundStyle(Theme.Color.textPrimary)
                                .lineLimit(1)
                            Text(content.subtitle)
                                .font(.caption)
                                .foregroundStyle(Theme.Color.textSecondary)
                                .lineLimit(1)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(Theme.Color.textTertiary)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var rampSection: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.m) {
                SectionHeader(title: "Volumen progresivo",
                              trailing: "≈ \(formatDuration(ramp.totalDurationSeconds))")

                VolumeRampCurveView(ramp: ramp)
                    .frame(height: 110)

                rampSlider(title: "Volumen inicial", value: $ramp.startVolume, range: 0...100, unit: "%")
                rampSlider(title: "Volumen final", value: $ramp.endVolume, range: 0...100, unit: "%")

                HStack(spacing: Theme.Spacing.m) {
                    intStepper(title: "Cada", value: $ramp.stepSeconds, range: 1...600, unit: "s")
                    intStepper(title: "Sube", value: $ramp.stepDelta, range: 1...100, unit: "pts")
                }
            }
        }
    }

    private var previewSection: some View {
        SecondaryButton(title: "Previsualizar alarma", icon: "play.fill") {
            showingPreview = true
        }
    }

    private var repeatSection: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                SectionHeader(title: "Repetir")
                HStack(spacing: 6) {
                    ForEach(Weekday.allCases, id: \.rawValue) { day in
                        let on = repeatDays.contains(day)
                        Button {
                            withAnimation(Theme.Motion.snappy) {
                                if on { repeatDays.remove(day) } else { repeatDays.insert(day) }
                            }
                        } label: {
                            Text(day.shortName)
                                .font(.bodyEmphasized)
                                .frame(maxWidth: .infinity, minHeight: 40)
                                .foregroundStyle(on ? .black : Theme.Color.textPrimary)
                                .background(on ? Theme.Color.accent : Theme.Color.surfaceElevated)
                                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.s, style: .continuous))
                        }
                    }
                }
            }
        }
    }

    private var labelSection: some View {
        Card {
            VStack(alignment: .leading, spacing: Theme.Spacing.s) {
                SectionHeader(title: "Etiqueta")
                TextField("Despertador", text: $label)
                    .font(.body)
                    .foregroundStyle(Theme.Color.textPrimary)
                    .padding(.vertical, 6)
            }
        }
    }

    private var deleteButton: some View {
        Button(role: .destructive) {
            if case .edit(let alarm) = mode {
                store.delete(alarm)
                dismiss()
            }
        } label: {
            Text("Eliminar alarma")
                .font(.bodyEmphasized)
                .foregroundStyle(Theme.Color.danger)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(Theme.Color.danger.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        }
    }

    // MARK: - Subcomponents

    private func rampSlider(title: String, value: Binding<Int>, range: ClosedRange<Int>, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(Theme.Color.textSecondary)
                Spacer()
                Text("\(value.wrappedValue)\(unit)")
                    .font(.tabular)
                    .foregroundStyle(Theme.Color.textPrimary)
            }
            Slider(
                value: Binding(
                    get: { Double(value.wrappedValue) },
                    set: { value.wrappedValue = Int($0) }
                ),
                in: Double(range.lowerBound)...Double(range.upperBound),
                step: 1
            )
            .tint(Theme.Color.accent)
        }
    }

    private func intStepper(title: String, value: Binding<Int>, range: ClosedRange<Int>, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(Theme.Color.textSecondary)
            HStack {
                Button {
                    value.wrappedValue = max(range.lowerBound, value.wrappedValue - 1)
                } label: {
                    Image(systemName: "minus")
                        .frame(width: 32, height: 32)
                        .background(Theme.Color.surfaceElevated)
                        .clipShape(Circle())
                }
                Spacer()
                Text("\(value.wrappedValue) \(unit)")
                    .font(.tabular)
                    .foregroundStyle(Theme.Color.textPrimary)
                Spacer()
                Button {
                    value.wrappedValue = min(range.upperBound, value.wrappedValue + 1)
                } label: {
                    Image(systemName: "plus")
                        .frame(width: 32, height: 32)
                        .background(Theme.Color.surfaceElevated)
                        .clipShape(Circle())
                }
            }
            .foregroundStyle(Theme.Color.textPrimary)
        }
    }

    // MARK: - Save

    private func save() {
        let comps = Calendar.current.dateComponents([.hour, .minute], from: time)
        let validatedRamp = ramp.validated()

        Task {
            switch mode {
            case .create:
                let alarm = Alarm(
                    label: label,
                    hour: comps.hour ?? 7,
                    minute: comps.minute ?? 0,
                    isEnabled: true,
                    repeatDays: repeatDays,
                    content: content,
                    ramp: validatedRamp
                )
                await store.save(alarm)
            case .edit(let alarm):
                alarm.label = label
                alarm.hour = comps.hour ?? alarm.hour
                alarm.minute = comps.minute ?? alarm.minute
                alarm.repeatDays = repeatDays
                alarm.contentURI = content.uri
                alarm.contentTitle = content.title
                alarm.contentSubtitle = content.subtitle
                alarm.contentArtworkURL = content.artworkURL
                alarm.contentKindRaw = content.kind.rawValue
                alarm.startVolume = validatedRamp.startVolume
                alarm.endVolume = validatedRamp.endVolume
                alarm.rampStepSeconds = validatedRamp.stepSeconds
                alarm.rampStepDelta = validatedRamp.stepDelta
                await store.save(alarm)
            }
            dismiss()
        }
    }

    private func formatDuration(_ seconds: Int) -> String {
        if seconds < 60 { return "\(seconds) s" }
        let m = seconds / 60
        let s = seconds % 60
        return s == 0 ? "\(m) min" : "\(m) min \(s) s"
    }
}
