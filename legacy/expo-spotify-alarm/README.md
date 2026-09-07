# Spotify Alarm

> 📱 Despertador inteligente que reproduce **tu música de Spotify** con
> volumen progresivo. iOS / Android. Cada usuario inicia sesión con su
> propia cuenta de Spotify (OAuth oficial — nunca tipea su contraseña en
> la app).

Dos implementaciones en el repo:

| Carpeta | Stack | Buildeable desde Windows | Estado |
|---|---|---|---|
| **`/` (raíz)** | Expo / React Native | ✅ Sí, con EAS Build | **Activa — esta es la que vas a usar** |
| `ios/` | Swift nativo + SwiftUI | ❌ Necesita Mac + Xcode | Reserva, para cuando tengas Mac |

---

## Guía completa: de cero a TestFlight (Windows)

Pre-requisitos:

- Apple Developer Program activo (USD 99/año) — necesario para TestFlight
- Cuenta Expo (gratis): https://expo.dev/signup
- Node.js 18+ instalado
- Git instalado

### Paso 1 · Registrar la app en Spotify Developer Dashboard

1. Andá a https://developer.spotify.com/dashboard e iniciá sesión con tu
   cuenta de Spotify.
2. Tocá **Create app**.
3. Completá:
   - **App name:** `Spotify Alarm`
   - **App description:** `Wake-up alarm with gradual volume fade`
   - **Website:** (opcional, podés dejar en blanco)
   - **Redirect URIs:** `spotifyalarm://callback`  ← **EXACTO, con dos slashes**
   - **Which API/SDKs are you planning to use:** marcá **Web API**
   - **App's bundle ID (iOS):** `com.daviduek.spotifyalarm`
   - Aceptá los terms y tocá **Save**.
4. En la pantalla de la app, copiá el **Client ID** (es una cadena tipo
   `abc123def456...`). Es público, podés compartirlo.
5. **Importante para multi-usuario:** en la pestaña **Users and Access**,
   por defecto la app está en *Development Mode*: solo los emails que vos
   agregues como "users" podrán iniciar sesión. Para que cualquiera pueda,
   tenés que pedir **Extended Quota Mode** (botón en Dashboard); Spotify
   revisa y aprueba en ~1 semana. Para vos solo y unos amigos, agregalos
   manualmente en Users and Access.

### Paso 2 · Clonar e instalar

En PowerShell o CMD:

```bash
git clone https://github.com/daviduek/spotify-alarm.git
cd spotify-alarm
npm install
```

### Paso 3 · Configurar el Client ID

```bash
copy .env.example .env
notepad .env
```

Reemplazá `your_client_id_here` por el Client ID que copiaste en el Paso 1.
Guardá. **Nunca subas `.env` al repo** (ya está en `.gitignore`).

### Paso 4 · Probar en Expo Go (instantáneo, sin builds)

Mientras esperás aprobaciones de Apple / Spotify, podés ya probarla:

```bash
npx expo start
```

Instalá **Expo Go** en tu iPhone desde el App Store, escaneá el QR del
terminal. La app abre adentro de Expo Go. Tocá **Conectar con Spotify** →
te lleva a la pantalla oficial de Spotify → autorizás → volvés a la app.

Limitación: en Expo Go las alarmas en background son menos confiables que
en un build nativo. Para uso real, hacé el build TestFlight (Paso 5).

### Paso 5 · Build TestFlight con EAS (desde Windows)

```bash
npm install -g eas-cli
eas login                # crear cuenta en expo.dev si no tenés
eas build:configure
```

Subí el Client ID a EAS Secrets (así no queda en el repo y queda inyectado
en cada build):

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SPOTIFY_CLIENT_ID --value "TU_CLIENT_ID_DE_SPOTIFY"
```

Build para iOS:

```bash
eas build --platform ios --profile production
```

Te va a pedir:
- Tus credenciales de Apple Developer (Apple ID + app-specific password)
- Crear/usar un Distribution Certificate y Provisioning Profile (EAS lo
  hace automático, decí "yes" a todo)

El build corre en los servers de Expo (15-20 minutos). Cuando termina te
da una URL del `.ipa`.

Submit a TestFlight:

```bash
eas submit --platform ios --latest
```

EAS te pide credenciales de App Store Connect (las mismas de Apple) y
sube el `.ipa` directamente a TestFlight. En 5-30 minutos aparece en
App Store Connect → Apps → Spotify Alarm → TestFlight para procesar.

### Paso 6 · Instalar TestFlight en cualquier iPhone

1. Vos y cada usuario instalan **TestFlight** del App Store.
2. En App Store Connect → tu app → TestFlight → **Internal Testing** (o
   External Testing si querés hasta 10k usuarios — requiere review breve
   de Apple).
3. Agregás emails como testers → cada uno recibe un email con un link.
4. El usuario toca el link en su iPhone → se abre TestFlight → tap
   **Install** → listo.

### Cada usuario inicia sesión con su Spotify

Cuando un tester abre la app:

1. Toca **Conectar con Spotify**.
2. Se abre la pantalla **oficial** de Spotify en un navegador in-app.
3. Si **ya está logueado** en la app de Spotify en su iPhone, solo tiene
   que tocar **Aceptar** — no escribe nada.
4. Si no está logueado, hace login una sola vez en la pantalla oficial
   de Spotify (no en la nuestra). Nuestra app **jamás ve la contraseña**.
5. Spotify devuelve un token, lo guardamos en su iPhone. La próxima vez
   que abre la app, ya está autenticado.

---

## Features

- ⏰ Alarma a horario configurable
- 🎵 Elegí cualquier playlist tuya como sonido
- 🔊 Volumen progresivo: empieza bajo, sube gradualmente
- 🔁 Refresh automático de tokens (no hay que re-loguear)
- 🌙 Funciona con pantalla bloqueada (vía background task)
- 🌐 OAuth 2.0 PKCE oficial — multi-usuario, sin contraseñas en la app

## Limitaciones honestas

- **Spotify Premium requerido**: el endpoint `/me/player/play` solo
  funciona con Premium (limitación de Spotify, no nuestra).
- **Active device**: Spotify necesita un "device activo". Solución:
  abrí Spotify y reproducí algo (podés pausarlo) antes de dormir.
- **Background en iOS**: iOS no permite alarmas perfectas a apps de
  terceros. Esta app usa background-fetch + notifications, suficiente
  para uso casual. Para máxima confiabilidad, dejá Spotify abierto y el
  iPhone enchufado al cargador durante la noche.
- **Multi-usuario en Spotify Dashboard**: hasta que Spotify apruebe tu
  pedido de Extended Quota Mode (ver Paso 1), solo los emails que vos
  agregues a Users and Access podrán autenticarse.

## Solución de problemas

| Error | Causa probable | Fix |
|---|---|---|
| "Invalid redirect URI" | El Redirect URI en Spotify Dashboard no es exactamente `spotifyalarm://callback` | Corregí en el Dashboard, esperá 30s |
| "User not registered in developer app" | Tu cuenta no está en Users and Access | Agregala en el Dashboard, o pedí Extended Quota |
| OAuth se cierra inmediatamente | Build sin Client ID | Verificá `.env` y rebuild |
| "No active device" en la alarma | Spotify no tiene un device reproduciendo | Abrí Spotify y reproducí algo antes |
| Alarma no suena en background | iOS suspendió la app | Dejá Spotify abierto + cargador conectado |

## Estructura del proyecto

```
spotify-alarm/
├── App.tsx              # Toda la lógica + UI (single-file Expo app)
├── app.config.js        # Config dinámica de Expo (lee env vars)
├── .env.example         # Plantilla para Client ID
├── eas.json             # Profiles de EAS Build
├── assets/              # Iconos, splash, fonts
└── ios/                 # App nativa Swift (para cuando tengas Mac)
```

## Comandos útiles

```bash
# Dev en Expo Go
npx expo start

# Build de preview (.ipa instalable en TestFlight Internal)
eas build --platform ios --profile preview

# Build de producción
eas build --platform ios --profile production

# Subir a TestFlight
eas submit --platform ios --latest

# Ver builds
eas build:list

# Secrets (Client ID)
eas secret:list
eas secret:create --name EXPO_PUBLIC_SPOTIFY_CLIENT_ID --value xxx
```

## License

MIT
