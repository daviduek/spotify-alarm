# legacy/

Earlier prototypes, kept for reference only. They are **not** part of the workspace build.

| Folder | What | Why superseded |
|---|---|---|
| `expo-spotify-alarm/` | Single-file Expo app (App.tsx): PKCE auth, Web API playback, notifications + background fetch as the "alarm". | Spec §5/§6 forbids notification-based alarms; replaced by `apps/mobile` with a native AlarmKit/AlarmManager module. |
| `ios-native/` | SwiftUI app (XcodeGen) with Spotify App Remote, Keychain store, critical alerts. | Useful reference for the App Remote SDK spike and Keychain handling; alarm approach (notifications + BGTask) superseded. |
