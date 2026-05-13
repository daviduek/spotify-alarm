import SwiftUI

// MARK: - Buttons

struct PrimaryButton: View {
    let title: String
    var icon: String?
    var isLoading: Bool = false
    var isEnabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if isLoading {
                    ProgressView().tint(.black)
                } else if let icon = icon {
                    Image(systemName: icon)
                }
                Text(title)
                    .font(.bodyEmphasized)
            }
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(Theme.Color.accent.opacity(isEnabled ? 1 : 0.4))
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.xl, style: .continuous))
        }
        .disabled(!isEnabled || isLoading)
        .sensoryFeedback(.impact(weight: .medium), trigger: isLoading)
    }
}

struct SecondaryButton: View {
    let title: String
    var icon: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon = icon { Image(systemName: icon) }
                Text(title).font(.bodyEmphasized)
            }
            .foregroundStyle(Theme.Color.textPrimary)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(Theme.Color.surfaceElevated)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        }
    }
}

// MARK: - Cards & layout

struct Card<Content: View>: View {
    var padding: CGFloat = Theme.Spacing.m
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.surface)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
    }
}

struct SectionHeader: View {
    let title: String
    var trailing: String?

    var body: some View {
        HStack {
            Text(title)
                .font(.caption.uppercaseSmallCaps())
                .foregroundStyle(Theme.Color.textTertiary)
                .tracking(0.8)
            Spacer()
            if let t = trailing {
                Text(t)
                    .font(.caption)
                    .foregroundStyle(Theme.Color.textSecondary)
            }
        }
        .padding(.horizontal, Theme.Spacing.xs)
        .padding(.bottom, Theme.Spacing.s)
    }
}

struct LabeledRow<Content: View>: View {
    let label: String
    var icon: String?
    @ViewBuilder var content: () -> Content

    var body: some View {
        HStack(spacing: Theme.Spacing.m) {
            if let icon = icon {
                Image(systemName: icon)
                    .foregroundStyle(Theme.Color.textSecondary)
                    .frame(width: 22)
            }
            Text(label)
                .font(.body)
                .foregroundStyle(Theme.Color.textPrimary)
            Spacer()
            content()
                .foregroundStyle(Theme.Color.textSecondary)
        }
        .padding(.vertical, Theme.Spacing.s)
    }
}

// MARK: - Cover art

struct CoverArtView: View {
    let url: String?
    var size: CGFloat = 56
    var corner: CGFloat = 8

    var body: some View {
        ZStack {
            Theme.Color.surfaceElevated
            if let urlString = url, let u = URL(string: urlString) {
                AsyncImage(url: u) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        Image(systemName: "music.note")
                            .font(.system(size: size * 0.4))
                            .foregroundStyle(Theme.Color.textTertiary)
                    }
                }
            } else {
                Image(systemName: "music.note")
                    .font(.system(size: size * 0.4))
                    .foregroundStyle(Theme.Color.textTertiary)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
    }
}

// MARK: - Volume bar

struct VolumeBar: View {
    var value: Int            // 0 - 100
    var maxValue: Int = 100
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Color.divider)
                Capsule()
                    .fill(LinearGradient(
                        colors: [Theme.Color.accent.opacity(0.6), Theme.Color.accent],
                        startPoint: .leading,
                        endPoint: .trailing
                    ))
                    .frame(width: geo.size.width * CGFloat(value) / CGFloat(max(1, maxValue)))
                    .animation(Theme.Motion.snappy, value: value)
            }
        }
        .frame(height: height)
    }
}

// MARK: - Background

struct AppBackground: View {
    var body: some View {
        ZStack {
            Theme.Color.background.ignoresSafeArea()
            RadialGradient(
                colors: [Theme.Color.accent.opacity(0.18), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 400
            )
            .ignoresSafeArea()
        }
    }
}
