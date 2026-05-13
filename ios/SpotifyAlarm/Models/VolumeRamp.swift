import Foundation

struct VolumeRamp: Equatable, Hashable, Codable {
    var startVolume: Int   // 0-100
    var endVolume: Int     // 0-100
    var stepSeconds: Int   // cada cuántos segundos sube
    var stepDelta: Int     // cuánto sube (puntos porcentuales)

    static let `default` = VolumeRamp(
        startVolume: 10,
        endVolume: 80,
        stepSeconds: 15,
        stepDelta: 5
    )

    /// Total duration in seconds for the ramp to reach `endVolume`.
    var totalDurationSeconds: Int {
        guard stepDelta > 0, endVolume > startVolume else { return 0 }
        let steps = Int(ceil(Double(endVolume - startVolume) / Double(stepDelta)))
        return steps * stepSeconds
    }

    /// Volume at a given elapsed time since fire (in seconds).
    func volume(at elapsedSeconds: TimeInterval) -> Int {
        guard elapsedSeconds >= 0 else { return startVolume }
        guard stepSeconds > 0 else { return endVolume }
        let stepIndex = Int(elapsedSeconds) / stepSeconds
        let v = startVolume + stepIndex * stepDelta
        return min(max(v, startVolume), endVolume)
    }

    /// Sequence of (delay, volume) pairs ready to be scheduled.
    func schedule() -> [(delay: TimeInterval, volume: Int)] {
        var result: [(TimeInterval, Int)] = [(0, startVolume)]
        var current = startVolume
        var t: TimeInterval = 0
        while current < endVolume {
            t += TimeInterval(stepSeconds)
            current = min(current + stepDelta, endVolume)
            result.append((t, current))
        }
        return result
    }

    func validated() -> VolumeRamp {
        VolumeRamp(
            startVolume: max(0, min(startVolume, 100)),
            endVolume: max(0, min(endVolume, 100)),
            stepSeconds: max(1, stepSeconds),
            stepDelta: max(1, min(stepDelta, 100))
        )
    }
}
