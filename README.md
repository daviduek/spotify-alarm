# Spotify Alarm

A smart alarm clock for iOS and Android built with Expo. Wake up to your Spotify playlists with a gradual volume fade — music starts quietly and grows louder over a configurable period.

---

## Features

- **Spotify OAuth (PKCE)** — no client secret needed, safe for mobile
- **Gradual volume fade** — music rises from a low start volume to a target volume over 1–30 minutes
- **Background task** — alarm fires even with the screen locked via `expo-task-manager`
- **Daily repeat** — notification re-schedules itself each day
- **Persisted settings** — all config survives app restarts via AsyncStorage
- **Dark theme** — `#080c10` background, Spotify green (`#1db954`) accents, Orbitron font

> ⚠️ **Spotify Premium is required.** The Spotify Web API's playback control endpoints (`/me/player/play`, `/me/player/volume`) are only available to Premium subscribers.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18 or later |
| Expo CLI | bundled via `npx` |
| Expo Go app | Latest (iOS / Android) |
| Spotify account | **Premium required** |

---

## Getting your Spotify Client ID

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and log in.
2. Click **Create app** (or open an existing one).
3. Fill in a name and description, then click **Save**.
4. In the app's settings, click **Edit Settings**.
5. Under **Redirect URIs**, add exactly:
   ```
   spotifyalarm://callback
   ```
6. Click **Save**.
7. Copy the **Client ID** from the app overview page.

---

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/daviduek/spotify-alarm.git
cd spotify-alarm

# 2. Install dependencies
npm install

# 3. Start the development server
npx expo start
```

---

## Running with Expo Go (iPhone / Android)

1. Install **Expo Go** from the App Store or Google Play.
2. Run `npx expo start` in the project directory.
3. Scan the QR code shown in the terminal with your phone camera (iOS) or the Expo Go app (Android).
4. On the **Setup** screen, paste your Spotify Client ID and tap **Connect Spotify**.
5. Authorise the app in the browser that opens — you'll be redirected back to the app.
6. Set your alarm time, pick a playlist, configure the fade, and tap **Activate Alarm**.

### Deep link redirect on Expo Go

When using Expo Go, the redirect URI handled by `expo-auth-session` is automatically proxied. The custom scheme `spotifyalarm://callback` is handled at the native level when the app is built standalone. During development with Expo Go the library manages the redirect internally — no extra configuration needed.

---

## Building a standalone app (EAS Build)

```bash
npm install -g eas-cli
eas login
eas build --platform ios     # or android
```

After building, install the `.ipa` / `.apk` on your device. The custom scheme `spotifyalarm://callback` will work correctly in the standalone build.

---

## Architecture

```
App.tsx
├── Setup screen    — Client ID input, Spotify OAuth (PKCE)
├── Alarm screen    — Time picker, playlist selector, volume sliders, activate/test
└── Background task (SPOTIFY_ALARM_TASK)
    ├── Called by expo-background-fetch at the alarm time
    ├── Calls PUT /me/player/play with the selected playlist URI
    └── Fade loop: PUT /me/player/volume every 30 s until endVolume is reached
```

### Token refresh

Before every Spotify API call, `getValidToken()` checks whether the stored access token is within 60 seconds of expiry. If so it automatically refreshes using the stored refresh token and updates AsyncStorage. No manual re-login required.

### No active device

If Spotify reports no active device (HTTP 404), the background task logs the error and returns `Failed`, which schedules a retry on the next background fetch interval (~60 seconds). Open the Spotify app and start playing anything to activate a device before the alarm fires.

---

## Project structure

```
spotify-alarm/
├── App.tsx              # All screens + background task definition
├── app.json             # Expo config (bundleId, scheme, permissions)
├── assets/
│   ├── Orbitron-Regular.ttf
│   └── Orbitron-Bold.ttf
└── package.json
```

---

## Environment

No `.env` file needed. The Spotify Client ID is entered by the user at runtime and stored in AsyncStorage.

---

## License

MIT
