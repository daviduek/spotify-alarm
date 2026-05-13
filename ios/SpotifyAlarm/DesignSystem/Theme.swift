import SwiftUI

enum Theme {
    enum Color {
        static let background = SwiftUI.Color(red: 0.039, green: 0.039, blue: 0.043)
        static let surface = SwiftUI.Color(red: 0.078, green: 0.078, blue: 0.086)
        static let surfaceElevated = SwiftUI.Color(red: 0.117, green: 0.117, blue: 0.129)
        static let accent = SwiftUI.Color(red: 0.114, green: 0.725, blue: 0.329)
        static let accentMuted = SwiftUI.Color(red: 0.114, green: 0.725, blue: 0.329).opacity(0.15)
        static let textPrimary = SwiftUI.Color.white
        static let textSecondary = SwiftUI.Color.white.opacity(0.65)
        static let textTertiary = SwiftUI.Color.white.opacity(0.35)
        static let divider = SwiftUI.Color.white.opacity(0.08)
        static let danger = SwiftUI.Color(red: 1.0, green: 0.231, blue: 0.188)
    }

    enum Spacing {
        static let xs: CGFloat = 4
        static let s: CGFloat = 8
        static let m: CGFloat = 16
        static let l: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
    }

    enum Radius {
        static let s: CGFloat = 8
        static let m: CGFloat = 12
        static let l: CGFloat = 18
        static let xl: CGFloat = 28
    }

    enum Motion {
        static let snappy = Animation.spring(response: 0.35, dampingFraction: 0.82)
        static let gentle = Animation.spring(response: 0.55, dampingFraction: 0.85)
    }
}

extension Font {
    static let displayLarge = Font.system(size: 64, weight: .bold, design: .rounded).monospacedDigit()
    static let displayMedium = Font.system(size: 48, weight: .semibold, design: .rounded).monospacedDigit()
    static let titleLarge = Font.system(size: 28, weight: .bold, design: .default)
    static let titleMedium = Font.system(size: 22, weight: .semibold, design: .default)
    static let body = Font.system(size: 16, weight: .regular, design: .default)
    static let bodyEmphasized = Font.system(size: 16, weight: .semibold, design: .default)
    static let caption = Font.system(size: 13, weight: .medium, design: .default)
    static let tabular = Font.system(size: 16, weight: .medium, design: .monospaced).monospacedDigit()
}
