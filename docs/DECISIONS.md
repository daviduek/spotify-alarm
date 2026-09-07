# DECISIONS (ADR log)

Format: context → decision → consequences. Newest last.

## ADR-001 · Expo (CNG + local Expo module) instead of bare React Native
Spec §4 allows Expo only if it does not restrict AlarmKit / AlarmManager. A local Expo module is arbitrary Swift/Kotlin
compiled into the app, and `expo prebuild` regenerates `ios/`/`android/` from `app.config.ts`. We keep full native power
and gain EAS Build (no Mac required for Android; cloud Xcode 26 for iOS). Consequence: Expo Go is unusable — development
builds only.

## ADR-002 · npm workspaces monorepo
`apps/mobile`, `apps/web`, `packages/domain`. npm (not pnpm) avoids Metro hoisting quirks and is auto-detected by Vercel.
`@wake/domain` is consumed from TypeScript source (`main: src/index.ts`) by Metro and Next — no build step.

## ADR-003 · Legacy prototypes moved to `legacy/`
The previous single-file Expo app and the SwiftUI app were built around notifications + background tasks, which the spec
explicitly rejects (§5). They stay in the repo for reference (Spotify App Remote wrapper, Keychain store).

## ADR-004 · `MusicSource { type:'music', provider, uri }` instead of `SpotifySource { type:'spotify' }`
Spec §9 sketches a Spotify-specific type; §14 asks not to hardcode Spotify. We store the provider as data and export
`SpotifySource` as a narrowed alias. Zod schema enforces known providers.

## ADR-005 · Android foreground service type `mediaPlayback`
Android 14 requires a type. `systemExempted` is also allowed for apps holding `USE_EXACT_ALARM`, but `mediaPlayback` is
the widely used, least-surprising choice for alarm apps. Revisit if Play review objects.

## ADR-006 · Recordings play natively on Android, via JS on iOS
Android `MediaPlayer` accepts a `file://` URI (`soundUri`), so a recording rings without JavaScript. AlarmKit only plays
sounds from the app bundle, so on iOS the fallback rings and the recording plays once the app is open. This asymmetry is
surfaced in the Recordings screen copy and must be validated (TECHNICAL_VALIDATION B5).

## ADR-007 · Bundled sounds are synthesised and duplicated into the module
No copyrighted audio (spec §9). `scripts/generate-sounds.mjs` produces deterministic WAVs; `sync-sounds.mjs` copies
them into `ios/Sounds` (podspec `resources`) and `android/res/raw` so native code can play them without Metro.
~1.6 MB × 3 in git is acceptable for Phase 0; a config plugin could dedupe later.

## ADR-008 · Keep the existing EAS project id / slug
`slug: spotify-alarm`, project `706db67f-…` already belongs to the owner's Expo account. Renaming would force `eas init`
and re-linking. App display name is "Wake"; bundle ids are `com.daviduek.wake(.dev)`.

## ADR-009 · Spotify via Web API first, App Remote SDK as a spike
Web API + PKCE is cross-platform, needs no secret and no native binary. It cannot wake the Spotify app on iOS (only an
app-switch deep link) and needs an active device — exactly what Phase 0 measures. The App Remote SDK (`SpotifyiOS`
xcframework / `spotify-app-remote` AAR) is the next spike if C5/C6 fail; the `MusicProvider` interface isolates the change.

## ADR-010 · iOS snooze = AlarmKit countdown, fixed at schedule time
AlarmKit's secondary button with `.countdown` behaviour re-alerts after `postAlert`. The duration cannot change after
scheduling, so `snoozeAlarm(id, minutes)` ignores `minutes` on iOS and the JS layer falls back to cancel + reschedule.

## ADR-011 · TypeScript 6, vitest 3, zod 4
Expo SDK 57's template ships TS ~6.0; the domain package uses explicit compiler options (no `baseUrl`) so it compiles on
TS 5.9 and 6.x. vitest 3 (not the brand-new 5) for stability. zod 4 for schemas shared by DB rows and API responses.

## ADR-012 · No backend, no accounts (spec §30, §58)
Nothing in the app requires a server. The website is static. Introduce a backend only for OAuth flows that cannot be
client-side, sync, or billing — and never for alarm execution.
