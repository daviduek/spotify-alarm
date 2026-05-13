import AVFoundation
import Foundation
import os.log

/// Manages the AVAudioSession and a background "silent loop" that keeps the
/// app non-suspended in the minutes leading up to an alarm. iOS allows
/// indefinite background audio when `UIBackgroundModes` includes `audio` and
/// an active playback session exists.
@MainActor
final class AudioSessionManager {
    private let log = Logger(subsystem: "com.daviduek.spotifyalarm", category: "audio")
    private var silentPlayer: AVAudioPlayer?
    private(set) var isHoldingActive = false

    func activate(forBackgroundHold: Bool = false) throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playback,
            mode: .default,
            options: [.mixWithOthers, .allowAirPlay, .allowBluetooth]
        )
        try session.setActive(true, options: [])
        if forBackgroundHold {
            try startSilentLoop()
            isHoldingActive = true
        }
    }

    func deactivate() {
        silentPlayer?.stop()
        silentPlayer = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        isHoldingActive = false
    }

    /// Plays a small silent .m4a loop at near-zero volume to keep the audio
    /// session — and the app — alive in background.
    private func startSilentLoop() throws {
        guard silentPlayer == nil else { return }
        guard let url = Bundle.main.url(forResource: "SilentLoop", withExtension: "m4a") else {
            log.error("SilentLoop.m4a not found in bundle")
            return
        }
        let player = try AVAudioPlayer(contentsOf: url)
        player.numberOfLoops = -1   // infinite
        player.volume = 0.001       // inaudible but non-zero
        player.prepareToPlay()
        player.play()
        silentPlayer = player
        log.debug("Silent loop started")
    }

    /// Plays a local fallback tone if Spotify cannot be reached at fire time.
    func playFallbackTone(at volume: Float) throws -> AVAudioPlayer? {
        guard let url = Bundle.main.url(forResource: "FallbackTone", withExtension: "m4a")
            ?? Bundle.main.url(forResource: "SilentLoop", withExtension: "m4a")
        else { return nil }
        let player = try AVAudioPlayer(contentsOf: url)
        player.numberOfLoops = -1
        player.volume = max(0, min(volume, 1))
        player.prepareToPlay()
        player.play()
        return player
    }
}
