# ARCHITECTURE

Wake follows one principle from the product spec (§84/§85): **React Native is the application framework; the
operating system is the alarm engine.** Everything below exists to keep the fallback alarm independent of
JavaScript, Spotify, the network, and our own servers.

## 1. Layers

```
┌───────────────────────────────────────────────────────────────────────────┐
│ apps/mobile (React Native, expo-router)                                   │
│  screens ── hooks ── zustand runtime store                                │
│  services: alarms repo (SQLite) · recordings · settings · history          │
│            spotify (PKCE auth · Web API · SpotifyProvider)                 │
│            audio (JS AlarmAudioEngine: previews, fade tests, hand-off)     │
│  platform: NativeAlarmScheduler (domain Alarm → NativeAlarmSpec)          │
├───────────────────────────────────────────────────────────────────────────┤
│ packages/domain (@wake/domain, pure TS, unit-tested)                      │
│  Alarm · AudioPlan · FadeEngine · nextOccurrence · computeReadiness        │
│  interfaces: AlarmScheduler · AlarmAudioEngine · MusicProvider            │
│  zod schemas (DB rows + Spotify responses) · logger (redaction) · flags   │
├───────────────────────────────────────────────────────────────────────────┤
│ apps/mobile/modules/wake-alarm (local Expo module)                        │
│  TS contract ─┬─ iOS  Swift  WakeAlarmModule → AlarmKit                   │
│               └─ Android Kotlin WakeAlarmModule → AlarmManager + Service  │
└───────────────────────────────────────────────────────────────────────────┘
```

Screens never import Spotify SDK code or AlarmKit/AlarmManager details: they talk to the `AlarmScheduler`,
`MusicProvider` and `AlarmAudioEngine` interfaces from `@wake/domain`.

## 2. Native alarm module contract

`modules/wake-alarm/src/WakeAlarm.types.ts` — `NativeAlarmSpec` is what both platforms receive:

| Field | iOS (AlarmKit) | Android (AlarmManager) |
|---|---|---|
| `id` (UUID) | `AlarmManager.schedule(id:)` | PendingIntent request code + store key |
| `hour/minute/weekdays` | `Alarm.Schedule.relative(time, repeats: .weekly)` | `computeNextTrigger()` (wall clock) + re-arm on fire |
| `fireAtEpochMs` | `Alarm.Schedule.fixed(Date)` | exact trigger |
| `soundFile` | `AlertConfiguration.AlertSound.named("x.wav")` (bundle) | `res/raw/x` via `MediaPlayer` (USAGE_ALARM) |
| `soundUri` | ignored (AlarmKit cannot play arbitrary files) | preferred if the file exists (recordings) |
| `snoozeMinutes` | `CountdownDuration.postAlert` + secondary button `.countdown` | snooze PendingIntent (`id#snooze`) |
| `fadeIn*` | ignored (no volume API) | `Handler`-driven ramp inside `AlarmService` |
| `vibrate` | system | `Vibrator` waveform with alarm attributes |
| `openAppOnFire` | n/a | `AlarmActivity` auto-opens `wake://alarm/<id>` |

Events: `onAlarmFired`, `onAlarmStopped`, `onAlarmSnoozed`, `onAlarmStateChanged`.
iOS derives them from `AlarmManager.alarmUpdates`; Android from a same-package broadcast sent by the service.

### iOS specifics
- AlarmKit exists only on iOS 26+. The podspec weak-links the framework, every call is behind `#available(iOS 26, *)`,
  and `isSupported()` reports the truth so the app can explain itself on older devices.
- The system renders the alert (title, Stop, Snooze) and plays the bundled sound. **No app code runs when the alarm fires**;
  the app learns about state changes only while running (`alarmUpdates`). Consequences: no native fade, no automatic
  Spotify start while locked — recorded as hypotheses to validate in `TECHNICAL_VALIDATION.md`.
- Snooze is AlarmKit's countdown; the countdown Live Activity UI requires a widget extension (planned, `@bacons/apple-targets`).
- `NSAlarmKitUsageDescription` is set in `app.config.ts`.

### Android specifics
- `USE_EXACT_ALARM` (13+, auto-granted to alarm apps) + `SCHEDULE_EXACT_ALARM` (12) → `setAlarmClock()` (doze-exempt,
  shows the status-bar alarm icon and next-alarm time).
- `AlarmReceiver` (wake lock ≤30 s) → `ContextCompat.startForegroundService(AlarmService)` → `startForeground(mediaPlayback)`.
  The service owns: `MediaPlayer` on `USAGE_ALARM`, audio focus, STREAM_ALARM floor (raised to ≥50 % if lower, restored
  after), vibration, fade, 15-minute auto-silence, notification with `fullScreenIntent` → `AlarmActivity`.
- `AlarmActivity`: `showWhenLocked`/`turnScreenOn`, black UI, **hold 1 s to stop**, snooze tap, "Open Wake" deep link.
  Back button disabled while ringing.
- `AlarmStore` (SharedPreferences) is the native source of truth; `BootReceiver` re-arms everything on
  `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIME_SET`, `TIMEZONE_CHANGED`. One-time alarms are removed once they ring.
- Concurrent alarms: the service stops the previous alarm (`reason=replaced`) and rings the latest (spec §40).

## 3. Fire sequence (spec §35)

```
T0  OS fires the alarm
    iOS: system alert + bundled sound                Android: AlarmService → fallback sound + vibration (+ native fade)
T0+ user opens the app (iOS) / AlarmActivity auto-opens JS (Android, optional)
    app/alarm/[id].tsx mounts:
      plan has Spotify?   → SpotifyProvider.play(uri) with 25 s timeout
          success         → Android: setAlarmVolume 1→0 over 1 s (crossfade) · iOS: dismiss system alert
          failure         → friendly message (playbackFailureMessage), fallback keeps ringing, history records reason
      plan has recording? → Android already plays it natively · iOS: JS crossfades to the file, then dismisses alert
    STOP (hold 1 s) → scheduler.stop → native stop, Spotify pause, history stoppedAt
    SNOOZE          → scheduler.snooze (native) — iOS fallback: cancel + reschedule one-time alarm with same id
```

## 4. Volume model (spec §16)

- `systemVolume` — STREAM_ALARM (Android) / system (iOS). Android raises it to a floor only while ringing and restores it.
- `playerVolume` — per-player 0..1 (native MediaPlayer fade, expo-audio players, Spotify `volume_percent`).
- `effectiveAlarmVolume` — what the user hears; the FadeEngine only ever drives `playerVolume`.

`FadeEngine` is pure (`volumeAt`, `fadeSchedule`, presets Gentle/Normal/Strong, curves linear/ease_in/logarithmic).
Native Android fades independently of JS; the JS engine fades only in the foreground.

## 5. Data (spec §31)

SQLite (`expo-sqlite`, WAL, `PRAGMA user_version` migrations) with JSON columns for nested objects:
`alarms`, `recordings`, `music_sources`, `settings`, `alarm_history`. Rows are validated with zod on read.
Spotify tokens live in `expo-secure-store` (Keychain / Keystore) only. Recordings live in `Documents/recordings/`.

`AudioPlan { version, mode: single|sequence, steps[] }` is stored today with a single step; sequences (spec §76) need
no migration. Sources are `local | recording | music(provider, uri)` — provider-agnostic on purpose (spec §14).

## 6. Spotify (spec §10–§14)

- OAuth 2.0 Authorization Code + PKCE via `expo-auth-session`; redirect `wake://spotify-callback`; no client secret.
- Web API remote control (`/me/player/*`). Needs Premium and an *active device*; `SpotifyProvider.play` deep-links
  `spotify:` and polls devices before giving up with a typed `PlaybackResult`.
- Readiness enum (`ready | not_authenticated | app_missing | premium_required | connection_problem | unknown`) feeds
  `computeReadiness()`; provider problems are always *warnings*, never *blocking* (the fallback exists).
- `MusicProvider` interface keeps the door open for Apple Music / YouTube Music; `spotify_enabled` flag can turn it off.
- Follow-up spike: Spotify App Remote SDK (native), which can wake the Spotify app on Android — see DECISIONS.md.

## 7. Cross-cutting

- **Logging**: structured `logger.info(event, data)` with key-based redaction (tokens, secrets) — spec §62.
- **Feature flags**: build-time via `app.config.ts extra.featureFlags` / `EXPO_PUBLIC_FLAG_*` — spec §63.
- **Diagnostics screen**: device, permissions, native engine JSON, scheduled alarms, Spotify, history, logs — spec §42.
- **History**: `alarm_history` rows keyed `${alarmId}:${firedAt}` so fired/stopped land on the same row — spec §41.

## 8. Not built yet (by design, spec §65/§83)

Product UI (alarm list/editor, onboarding, settings), sequence editor, accounts/sync, analytics, Apple Music,
watch apps, missions, billing. Phase 1 starts only after `TECHNICAL_VALIDATION.md` passes on devices.
