import Foundation
import AVFoundation
import Combine
import os.log

/// Orchestrates what happens when an alarm fires:
///   1. Activate audio session
///   2. Try Spotify App Remote (instant play, best UX)
///   3. Fallback to Web API (`/me/player/play` on the active device)
///   4. Fallback to local tone if Spotify can't be reached
///   5. Run the volume ramp via Web API every `stepSeconds`
///   6. Surface progress to the UI via @Published state
@MainActor
final class AlarmEngine: ObservableObject {
    enum State: Equatable {
        case idle
        case starting
        case playing(via: Source, currentVolume: Int)
        case fallbackTone(currentVolume: Int)
        case failed(String)
        case stopped

        enum Source: String { case appRemote, webAPI }
    }

    @Published private(set) var state: State = .idle
    @Published private(set) var activeAlarm: Alarm?

    private let auth: SpotifyAuthService
    private let webAPI: SpotifyWebAPI
    private let appRemote: SpotifyAppRemoteService
    private let audio: AudioSessionManager
    private let notifications: NotificationScheduler
    private var rampTask: Task<Void, Never>?
    private var fallbackPlayer: AVAudioPlayer?
    private let log = AppLog.engine

    init(
        auth: SpotifyAuthService,
        webAPI: SpotifyWebAPI,
        appRemote: SpotifyAppRemoteService,
        audio: AudioSessionManager,
        notifications: NotificationScheduler
    ) {
        self.auth = auth
        self.webAPI = webAPI
        self.appRemote = appRemote
        self.audio = audio
        self.notifications = notifications
    }

    // MARK: - Fire

    func fire(alarm: Alarm) async {
        log.info("Firing alarm \(alarm.id.uuidString)")
        activeAlarm = alarm
        state = .starting

        try? audio.activate(forBackgroundHold: false)

        // 1. Try App Remote (fast, IPC with Spotify app)
        if appRemote.isSpotifyInstalled, appRemote.isConnected {
            do {
                try await appRemote.play(uri: alarm.contentURI)
                await ramp(volumeFrom: alarm.ramp, via: .appRemote)
                return
            } catch {
                log.error("App Remote play failed: \(error.localizedDescription); falling back to Web API")
            }
        }

        // 2. Web API fallback
        do {
            let activeDeviceID = try await ensureActiveDevice()
            try await webAPI.setVolume(alarm.startVolume, deviceID: activeDeviceID)
            try await webAPI.play(uri: alarm.contentURI, deviceID: activeDeviceID)
            await ramp(volumeFrom: alarm.ramp, via: .webAPI, deviceID: activeDeviceID)
            return
        } catch {
            log.error("Web API play failed: \(error.localizedDescription); falling back to local tone")
            await playLocalFallback(alarm: alarm)
        }
    }

    func stop() {
        rampTask?.cancel()
        rampTask = nil
        fallbackPlayer?.stop()
        fallbackPlayer = nil
        Task {
            try? await appRemote.pause()
            try? await webAPI.pause()
        }
        audio.deactivate()
        state = .stopped
        activeAlarm = nil
    }

    func snooze(minutes: Int = 9) {
        guard let alarm = activeAlarm else { return }
        stop()
        let fireDate = Date().addingTimeInterval(TimeInterval(minutes * 60))
        Task {
            await notifications.scheduleSnooze(for: alarm, fireDate: fireDate)
        }
    }

    // MARK: - Helpers

    private func ensureActiveDevice() async throws -> String? {
        let response = try await webAPI.devices()
        if let active = response.devices.first(where: { $0.isActive })?.id {
            return active
        }
        if let any = response.devices.first?.id {
            try await webAPI.transferPlayback(to: any, play: false)
            return any
        }
        throw SpotifyWebAPI.APIError.noActiveDevice
    }

    private func ramp(volumeFrom ramp: VolumeRamp, via source: State.Source, deviceID: String? = nil) async {
        rampTask?.cancel()
        let steps = ramp.schedule()
        state = .playing(via: source, currentVolume: ramp.startVolume)

        rampTask = Task { [weak self] in
            guard let self else { return }
            for step in steps {
                if Task.isCancelled { return }
                if step.delay > 0 {
                    let nanos = UInt64(step.delay * 1_000_000_000)
                    try? await Task.sleep(nanoseconds: nanos)
                    if Task.isCancelled { return }
                }
                do {
                    try await self.webAPI.setVolume(step.volume, deviceID: deviceID)
                    await MainActor.run {
                        self.state = .playing(via: source, currentVolume: step.volume)
                    }
                } catch {
                    self.log.error("Volume step \(step.volume) failed: \(error.localizedDescription)")
                }
            }
        }
    }

    private func playLocalFallback(alarm: Alarm) async {
        do {
            try audio.activate(forBackgroundHold: false)
            fallbackPlayer = try audio.playFallbackTone(at: Float(alarm.startVolume) / 100)
            state = .fallbackTone(currentVolume: alarm.startVolume)

            rampTask?.cancel()
            let player = fallbackPlayer
            let schedule = alarm.ramp.schedule()
            rampTask = Task { [weak self] in
                guard let self else { return }
                for step in schedule {
                    if Task.isCancelled { return }
                    if step.delay > 0 {
                        try? await Task.sleep(nanoseconds: UInt64(step.delay * 1_000_000_000))
                        if Task.isCancelled { return }
                    }
                    await MainActor.run {
                        player?.volume = Float(step.volume) / 100
                        self.state = .fallbackTone(currentVolume: step.volume)
                    }
                }
            }
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}
