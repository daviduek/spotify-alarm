# TECHNICAL VALIDATION — Phase 0 (spec §66, §83)

Status: **template ready, physical-device results pending.** Nothing below is confirmed until a tester
fills the *Actual* columns on real hardware. Do not claim a scenario works until it is recorded here.

How to test: install a development build (`docs/SETUP.md`), open **Wake (dev)** → the first screen is the
Phase 0 lab. Before each test open **Diagnostics** and note the *Native alarm engine* block.
Record OS version, device model and app build number from Diagnostics in the header of each session.

| Field | Value |
|---|---|
| iOS device / version | ☐ |
| Android device / version | ☐ |
| App build (Diagnostics → App version) | ☐ |
| Spotify app version / account type | ☐ |
| Tester / date | ☐ |

Legend: ✅ works · ⚠ works with limitation · ❌ fails · ☐ untested

## A. Core alarm (native)

| # | Test | Steps (lab) | Expected | Actual | iOS | Android | Known limitation / hypothesis | Workaround |
|---|---|---|---|---|---|---|---|---|
| A1 | Permission | Readiness → *Alarm permission* | iOS: AlarmKit prompt, `authorized`. Android 14+: `authorized` without prompt (USE_EXACT_ALARM). | | ☐ | ☐ | Android 12–13 need the "Alarms & reminders" toggle. | Row opens system settings. |
| A2 | Ring while locked, app in background | *Schedule in 60 s* → press power → wait | Full-screen alarm UI + fallback sound at 60 s. | | ☐ | ☐ | Android 14+ may hide the full-screen UI if `canUseFullScreenIntent` = false (only heads-up notification + sound). | Diagnostics → *Open full-screen intent settings*. |
| A3 | Ring with app force-closed | Schedule 60 s → swipe app away → lock | Same as A2. | | ☐ | ☐ | iOS: AlarmKit is system-owned, should ring. Android: receiver + FGS start without the app process. | — |
| A4 | Ring with app in foreground | Schedule 15 s, stay on lab | Sound + JS alarm screen opens (`onAlarmFired`). | | ☐ | ☐ | iOS: JS screen depends on `alarmUpdates` delivery timing. | — |
| A5 | STOP (hold) | Hold STOP ≥1 s on native UI and on JS screen | Sound stops, history shows `stopped/user`. | | ☐ | ☐ | iOS system alert has a tap Stop (no hold) — AlarmKit controls its own buttons. | Accept system behaviour on iOS. |
| A6 | SNOOZE | Tap Snooze | Sound stops; alarm re-rings after N min; status bar shows alarm icon (Android). | | ☐ | ☐ | iOS: snooze = AlarmKit countdown, duration fixed at schedule time; countdown Live Activity UI needs a widget extension (not yet added). | Add `@bacons/apple-targets` widget in Phase 1 if countdown UI is missing. |
| A7 | Silent mode / DND | Ringer silent, DND on → A2 | Alarm still audible. | | ☐ | ☐ | Android: STREAM_ALARM respects "alarms" DND exception; app raises stream to ≥50 % if lower and restores it after. iOS: AlarmKit bypasses silent switch by design. | — |
| A8 | Alarm volume 0 (Android) | Set alarm stream to 0 → A2 | Rings at ≥50 %, volume restored on stop. | | — | ☐ | Some OEMs block programmatic stream changes under DND (SecurityException, logged). | Readiness warning (Phase 1). |
| A9 | Low power / battery saver | Enable → A2 | Rings on time. | | ☐ | ☐ | Doze: `setAlarmClock` is exempt. OEM (Samsung/Xiaomi) "deep sleep" lists may still kill the process; alarm should still fire. | Battery optimisation exemption prompt (Phase 6). |
| A10 | Reboot before alarm | Schedule 5 min → reboot → wait | Rings after boot (Android BootReceiver). iOS: AlarmKit persistence. | | ☐ | ☐ | Android: `BOOT_COMPLETED` arrives after unlock on some devices. | Document per device. |
| A11 | Time zone / DST change | Schedule → change TZ in settings | Fires at the wall-clock time in the new zone (spec §38). | | ☐ | ☐ | Android `TIMEZONE_CHANGED` triggers reschedule. iOS relative schedules are wall-clock by design. | — |
| A12 | Concurrent alarms | Schedule 15 s twice | Second alarm replaces first (spec §40). Two sounds never overlap. | | ☐ | ☐ | iOS: two AlarmKit alerts may stack (system behaviour). | Record. |
| A13 | Progressive volume (native) | Options → *Gentle* → A2 | Android: fallback fades 5 %→50 % over 5 min without the app. iOS: no fade (system plays the file). | | ☐ | ☐ | iOS AlarmKit has no volume API. | iOS fade only after the app opens (JS engine) — a product limitation to communicate. |
| A14 | Auto-silence | Let it ring 15 min | Stops, history `stopped/timeout`. | | ☐ | ☐ | iOS duration is system-defined. | — |
| A15 | Headphones (BT) connected | Pair headphones → A2 | Record where sound routes (speaker vs headphones). | | ☐ | ☐ | Spec §50: never assume headphones. | Document; consider forcing speaker on Android (Phase 6). |
| A16 | App update | Install build N → schedule → install N+1 | Alarms survive (`MY_PACKAGE_REPLACED` reschedules on Android). | | ☐ | ☐ | — | — |

## B. Local audio & recordings

| # | Test | Steps | Expected | Actual | iOS | Android | Limitation | Workaround |
|---|---|---|---|---|---|---|---|---|
| B1 | Play bundled sound | *Play local sound* per sound | Plays in foreground; silent switch ignored (`playsInSilentMode`). | | ☐ | ☐ | — | — |
| B2 | JS fade | *Test progressive volume (30 s)* | 10 %→70 % over 30 s. | | ☐ | ☐ | Foreground only by design. | Native fade for alarms. |
| B3 | Record | Recordings → record 5 s → save | File saved under `Documents/recordings`, listed with duration. | | ☐ | ☐ | — | — |
| B4 | Play recording | ▶ on a recording | Plays. | | ☐ | ☐ | — | — |
| B5 | Alarm with recording, locked | *Use for alarm* → schedule 60 s → lock | Android: recording plays natively (soundUri). iOS: fallback sound rings; recording plays when the app is opened from the alert. | | ☐ | ☐ | iOS AlarmKit only plays bundle sounds. | Communicate in product UI. |
| B6 | Rename / delete | — | Works; file removed from disk. | | ☐ | ☐ | — | — |

## C. Spotify

| # | Test | Precondition | Expected | Actual | iOS | Android | Limitation | Workaround |
|---|---|---|---|---|---|---|---|---|
| C1 | Connect (PKCE) | Client ID configured, tester allow-listed | Spotify consent page → back to app → `Spotify connected`. | | ☐ | ☐ | Dev mode: only allow-listed users; Premium needed for playback. | — |
| C2 | List playlists / search | Connected | Picker shows playlists; search works. | | ☐ | ☐ | — | — |
| C3 | Playback, Spotify foreground | Spotify open & playing something | *Test Spotify playback* starts the chosen source. | | ☐ | ☐ | — | — |
| C4 | Playback, Spotify background | Spotify recently used, backgrounded | Starts (device still registered). | | ☐ | ☐ | — | — |
| C5 | Playback, Spotify killed | Force-close Spotify | Wake deep-links `spotify:` then polls devices ×5. Record whether Android registers the device without user action; iOS likely app-switches. | | ☐ | ☐ | Web API needs an active Connect device; the Spotify app decides. | App Remote SDK spike (Phase 5) if this fails. |
| C6 | Playback, phone locked | Alarm with Spotify source → lock | Android: fallback rings natively, JS opens via full-screen activity *Open Wake* (auto when "Open app when it rings" is on) and attempts Spotify; iOS: fallback rings; Spotify only after the user opens the app. | | ☐ | ☐ | iOS does not run app code when an AlarmKit alarm fires. | Product copy: "Tap to start Spotify"; explore `secondaryButtonBehavior: .custom` intent to open the app. |
| C7 | Offline | Airplane mode | Fallback rings; status shows offline message; no raw errors. | | ☐ | ☐ | — | — |
| C8 | Logged out / token revoked | Revoke at spotify.com/account/apps | Readiness `not_authenticated`; fallback rings. | | ☐ | ☐ | — | — |
| C9 | Free account | Non-Premium tester | Readiness `premium_required`; play fails with friendly message. | | ☐ | ☐ | Spotify policy. | — |
| C10 | Crossfade | C3 during a ringing alarm | Fallback fades to 0 in ~1 s while Spotify plays (Android `setAlarmVolume`). iOS: system alert dismissed once Spotify plays. | | ☐ | ☐ | iOS cannot lower the alert volume. | — |

## D. Reliability metrics (spec §75)

Record separately: native alarm fired / scheduled (target > 99.99 %), fallback audio started, Spotify attempts,
Spotify successes, Spotify failure reasons. Source: Diagnostics → *Alarm history*.

## Exit criteria for Phase 0

- A2, A3, A5, A6 ✅ on both platforms with the fallback sound.
- B5 ✅ on Android; iOS limitation documented.
- C1–C4 ✅; C5/C6 recorded honestly, whatever the outcome.
- Every ❌ has an owner and a ticket before Phase 1 UI work starts.
