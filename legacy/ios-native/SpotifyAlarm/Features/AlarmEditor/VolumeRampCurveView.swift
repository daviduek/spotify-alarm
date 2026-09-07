import SwiftUI

/// Visualizes the volume ramp as a stepped curve.
struct VolumeRampCurveView: View {
    let ramp: VolumeRamp

    var body: some View {
        GeometryReader { geo in
            let schedule = ramp.schedule()
            let lastTime = max(1, schedule.last?.delay ?? 1)
            let maxVolume = max(1, ramp.endVolume)

            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Theme.Color.surfaceElevated.opacity(0.5))

                gridLines(width: geo.size.width, height: geo.size.height)

                Path { path in
                    for (i, point) in schedule.enumerated() {
                        let x = geo.size.width * point.delay / lastTime
                        let y = geo.size.height * (1 - CGFloat(point.volume) / CGFloat(maxVolume))
                        if i == 0 {
                            path.move(to: CGPoint(x: x, y: y))
                        } else {
                            // Step shape
                            let prevY = geo.size.height * (1 - CGFloat(schedule[i - 1].volume) / CGFloat(maxVolume))
                            path.addLine(to: CGPoint(x: x, y: prevY))
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                }
                .stroke(
                    LinearGradient(
                        colors: [Theme.Color.accent.opacity(0.6), Theme.Color.accent],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round)
                )

                // Filled area
                Path { path in
                    var first = true
                    for (i, point) in schedule.enumerated() {
                        let x = geo.size.width * point.delay / lastTime
                        let y = geo.size.height * (1 - CGFloat(point.volume) / CGFloat(maxVolume))
                        if first {
                            path.move(to: CGPoint(x: x, y: geo.size.height))
                            path.addLine(to: CGPoint(x: x, y: y))
                            first = false
                        } else {
                            let prevY = geo.size.height * (1 - CGFloat(schedule[i - 1].volume) / CGFloat(maxVolume))
                            path.addLine(to: CGPoint(x: x, y: prevY))
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                    path.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height))
                    path.closeSubpath()
                }
                .fill(
                    LinearGradient(
                        colors: [Theme.Color.accent.opacity(0.4), Theme.Color.accent.opacity(0.05)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
        }
    }

    private func gridLines(width: CGFloat, height: CGFloat) -> some View {
        Path { path in
            for i in 1..<4 {
                let y = height * CGFloat(i) / 4
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: width, y: y))
            }
        }
        .stroke(Theme.Color.divider, lineWidth: 1)
    }
}
