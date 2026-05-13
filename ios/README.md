# Spotify Alarm — iOS (Swift / SwiftUI)

App **nativa iOS** que despierta al usuario con cualquier canción, playlist o
álbum de Spotify, con volumen progresivo configurable y manejo realista de las
limitaciones de iOS para alarmas en background.

> Esta es la implementación canónica de la app. La carpeta raíz contiene una
> versión anterior en Expo / React Native que se mantiene como referencia.

---

## Stack

| Capa | Tech |
|---|---|
| UI | SwiftUI · iOS 17+ |
| Concurrencia | Swift Concurrency (`async/await`, `@MainActor`) |
| OAuth | `ASWebAuthenticationSession` + PKCE (sin client secret) |
| Spotify catálogo / control | Spotify Web API (URLSession) |
| Spotify IPC | Spotify iOS SDK (`SpotifyiOS` SwiftPM) |
| Persistencia | SwiftData |
| Tokens | Keychain (`Security` framework) |
| Audio | `AVAudioSession.playback` + silent loop |
| Notificaciones | `UNUserNotificationCenter` + Critical Alerts |
| Background | `BGTaskScheduler` (BGProcessingTask) + `audio` mode |
| Gen proyecto | [XcodeGen](https://github.com/yonaskolb/XcodeGen) |

## Estructura

```
ios/
├── project.yml              # XcodeGen — la fuente de verdad del proyecto
├── SpotifyAlarm/
│   ├── App/                 # Entry point, AppDelegate, DI container, RootView
│   ├── Core/                # Audio, Notifications, Keychain, AlarmStore, AlarmEngine, Logger
│   ├── Spotify/             # Auth (PKCE), WebAPI, AppRemote, Config, Models
│   ├── Models/              # Alarm (SwiftData), VolumeRamp, SpotifyContent
│   ├── DesignSystem/        # Theme, tipografía, componentes reutilizables
│   ├── Features/
│   │   ├── Onboarding/
│   │   ├── AlarmsList/
│   │   ├── AlarmEditor/     # + Volume curve + Preview simulator
│   │   ├── ContentPicker/
│   │   └── AlarmFiring/
│   ├── Resources/           # Info.plist, Assets.xcassets, audio (.m4a)
│   └── SpotifyAlarm.entitlements
└── README.md
```

## Setup

### 1. Requisitos

- macOS 14 (Sonoma) o superior
- Xcode 15.3+
- Cuenta de Apple Developer (paid) para Critical Alerts y push entitlements
- Cuenta de Spotify Premium para probar control de reproducción
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) instalado:
  ```bash
  brew install xcodegen
  ```

### 2. Configurar Spotify

1. Andá a [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) y creá una app.
2. **Redirect URI**: `spotifyalarm://callback`
3. **iOS Bundle ID** (Settings → Edit Settings): `com.daviduek.spotifyalarm`
4. Copiá el **Client ID**.
5. En `SpotifyAlarm/Spotify/SpotifyConfig.swift` reemplazá `REPLACE_WITH_YOUR_CLIENT_ID`, o (mejor) agregá `SpotifyClientID` al `Info.plist` con xcconfig:

   `Configs/Local.xcconfig`:
   ```
   SPOTIFY_CLIENT_ID = abc123...
   ```
   y referencialo desde Info.plist con `$(SPOTIFY_CLIENT_ID)`.

### 3. Solicitar Critical Alerts a Apple

Las alarmas necesitan saltar Silent Mode y Do Not Disturb. Esto requiere un
entitlement aprobado:

1. En Apple Developer Portal → Identifiers → tu App ID → habilitá
   "Critical Alerts" (botón "Edit").
2. Apple revisa el pedido y aprueba. Suele tardar 1–7 días.
3. Hasta que esté aprobado, podés correr la app sin esa funcionalidad
   (`UNAuthorizationOptions.criticalAlert` simplemente se ignorará).

### 4. Activos de audio

`SpotifyAlarm/Resources/AUDIO_PLACEHOLDERS.md` explica cómo generar
`SilentLoop.m4a` y `FallbackTone.m4a`. Son `.gitignore`-d a propósito.

```bash
cd ios/SpotifyAlarm/Resources
ffmpeg -f lavfi -i "anullsrc=channel_layout=mono:sample_rate=44100" \
       -t 10 -c:a aac -b:a 64k SilentLoop.m4a
# y un tono pleasant para FallbackTone.m4a
```

### 5. Generar el proyecto

```bash
cd ios
xcodegen
open SpotifyAlarm.xcodeproj
```

### 6. Compilar

- Seleccioná un device físico (las APIs de notificaciones + App Remote no
  funcionan bien en simulador).
- Asegurate de tener tu Apple Team configurado en Signing & Capabilities.
- Cmd + R.

## Cómo funciona la alarma

iOS **no permite** a apps de terceros ser true wake-up clocks. La estrategia:

1. **Silent audio loop** (`AVAudioPlayer` con `numberOfLoops = -1` a volumen
   0.001) inicia cuando hay alarmas activas → mantiene la app viva en
   background gracias al modo `audio` en Info.plist.
2. **Pre-warmer notifications** en T-2min y T-30s — silenciosas, sólo para
   despertar el runtime de la app.
3. **Main notification** en T-0 con `UNNotificationSound.defaultCriticalSound`
   y `interruptionLevel = .critical` → suena incluso en Silent / DND.
4. Al tap (o callback en foreground), el `AlarmEngine`:
   - Si Spotify App Remote está conectado → `playerAPI.play(uri:)` (IPC directo).
   - Si no → Web API: `PUT /me/player/play` apuntando al device activo.
   - Si no hay device activo → fallback a tono local del bundle.
5. **Volume ramp** vía Web API `PUT /me/player/volume?volume_percent=X`,
   programada en una `Task` con `Task.sleep` para cada step.

### Mejores prácticas comunicadas al usuario

- Dejá Spotify abierto reproduciendo algo antes de dormir → mantiene un
  active device del lado de Spotify Connect.
- Conectá el iPhone al cargador → iOS no entra en low-power mode agresivo.
- Aceptá Critical Alerts cuando te lo pidamos.

## Manejo de errores

| Error | UX |
|---|---|
| Token expirado | Refresh transparente vía refresh_token. Si refresh falla → vuelve a `ConnectView`. |
| Spotify no instalada | App Remote desactivado; usa Web API directo. Mostrar tip "instalá Spotify". |
| No active device | Intentamos `transferPlayback`; si falla, fallback a tono local. |
| Premium required | Banner explicando que ramp + control requieren Premium. |
| Offline | Notificación + tono local de respaldo (funciona sin red). |
| Notificaciones denegadas | Pantalla explicando por qué las necesitamos, deep-link a Settings. |

## App Store — checklist de cumplimiento

- [ ] No usar la palabra **"Alarm Clock"** como categoría primaria — Apple
      es estricto con eso. Categorizar como **Music** o **Lifestyle**.
- [ ] Disclosure en App Store description: "Requiere cuenta de Spotify
      Premium para control de reproducción".
- [ ] Privacy nutrition labels: declarar que recolectamos OAuth token (no
      personal info) y se almacena local en Keychain.
- [ ] Privacy Policy URL obligatoria (Spotify lo exige también).
- [ ] Justificación de Critical Alerts en App Review Notes: "Alarmas de
      wake-up requieren bypass de Silent Mode para cumplir el caso de uso".
- [ ] Justificación de modos background `audio`/`fetch`/`processing` en
      App Review Notes.
- [ ] Spotify branding compliance: usar el logo oficial, copy "Powered by
      Spotify" en footer del Connect screen, no abreviar "Spotify".
- [ ] No mostrar el artwork de un track sin un control de play visible —
      Spotify exige esto en su SDK ToS.

## Testing

```bash
xcodebuild test -scheme SpotifyAlarm -destination 'platform=iOS Simulator,name=iPhone 16 Pro'
```

Las áreas más fáciles de testear sin device real:
- `VolumeRamp.schedule()` y `.volume(at:)` — pura matemática.
- `Alarm.nextFireDate(after:)` — date math.
- `AlarmEngine` con fakes de `SpotifyWebAPI` y `SpotifyAppRemoteService`.

## Roadmap

- [ ] Live Activity con la cuenta regresiva a la próxima alarma
- [ ] Widget de Home/Lock screen con la próxima alarma
- [ ] Curvas de volumen no lineales (ease-in, ease-out)
- [ ] Smart wake con HealthKit (despertar dentro de una ventana en sueño ligero)
- [ ] Shortcuts / Siri intents para crear alarmas por voz
- [ ] Sync con CloudKit
