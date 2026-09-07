# SETUP — qué necesito de tu lado (David)

Todo lo que está en este repo lo puedo construir y verificar yo (TypeScript, tests, build web).
Lo que sigue **requiere tus cuentas o tus dispositivos**, así que sin esto no se puede usar la app.
Está ordenado por prioridad. Tiempo estimado total: ~30 minutos + esperas de builds.

> Regla del proyecto (spec §84): la alarma la ejecuta el sistema operativo. Por eso la app mobile
> **no** corre en Expo Go ni en la web: necesita un *development build* nativo (EAS o Xcode/Android Studio).

---

## 1. Vercel (web: landing + privacidad + términos + estado) — 3 minutos

La web está en `apps/web` (Next.js 16). Vercel no se puede conectar desde acá sin tu cuenta.

1. Entrá a <https://vercel.com/new> → **Import Git Repository** → elegí `daviduek/spotify-alarm`.
2. En la pantalla de configuración:
   - **Root Directory:** `apps/web` ← *obligatorio* (Vercel detecta solo el workspace de npm y instala desde la raíz).
   - Framework: Next.js (auto-detectado). Node.js: 22.x.
   - No hace falta ninguna variable de entorno.
3. **Deploy**. Cada push a cualquier branch genera un *preview*; la rama de producción es `master`.
   Mientras el trabajo esté en `claude/wake-alarm-setup-acb0nb`, vas a tener la URL de preview de esa rama.
   Cuando mergees a `master`, sale a producción.
4. (Opcional) Dominio propio en *Settings → Domains* (ej. `wake.eluter.com`; si usás otro, avisame y cambio
   `metadataBase` en `apps/web/src/app/layout.tsx`).

Vercel va a necesitar la **URL de privacidad** para el Spotify Dashboard (paso 3) y para las tiendas más adelante.

---

## 2. Expo / EAS (builds de la app mobile) — 10 minutos + ~20 min de build

Ya existe el proyecto EAS `706db67f-6b89-452c-b45b-f9c0214ebfca` (slug `spotify-alarm`) en tu cuenta de Expo;
lo reutilizo para no tener que re-vincular nada.

```bash
npm install -g eas-cli
eas login                      # tu cuenta de expo.dev
cd apps/mobile
eas build --platform android --profile development
```

- Android: al terminar te da un link para instalar el **APK** en cualquier teléfono (Android 14+ recomendado).
- iOS: `eas build --platform ios --profile development` te pide tu Apple ID del **Apple Developer Program (USD 99/año)**
  y registra tu iPhone (`eas device:create` → abrís el link en el iPhone). **AlarmKit requiere iOS 26** en el dispositivo;
  EAS compila con la imagen `latest` (Xcode 26+), ya configurado en `eas.json`.

Alternativa sin tu terminal: en GitHub → *Settings → Secrets and variables → Actions* creá el secret
`EXPO_TOKEN` (expo.dev → *Account settings → Access tokens*). Después *Actions → EAS Build → Run workflow*
elige plataforma/perfil y dispara el build en EAS.

> No puedo correr `eas build` desde esta sesión porque necesita tu login de Expo.

---

## 3. Spotify Developer Dashboard — 5 minutos

1. <https://developer.spotify.com/dashboard> → **Create app**:
   - Name: `Wake` · Description: `Alarm clock that can wake you with your Spotify music`
   - Website: la URL de Vercel del paso 1
   - **Redirect URI:** `wake://spotify-callback` (exacto)
   - APIs: **Web API**
   - iOS bundle IDs: `com.daviduek.wake.dev` y `com.daviduek.wake`
   - Android package: `com.daviduek.wake.dev` / `com.daviduek.wake` (la huella SHA1 solo hace falta si más adelante usamos el SDK nativo de Spotify)
2. Copiá el **Client ID** (es público) y pasámelo o cargalo vos:
   - local: `apps/mobile/.env` → `EXPO_PUBLIC_SPOTIFY_CLIENT_ID=...` (copiá `apps/mobile/.env.example`)
   - EAS: `eas env:create --name EXPO_PUBLIC_SPOTIFY_CLIENT_ID --value TU_CLIENT_ID --environment development --environment preview --environment production --visibility plaintext`
   - GitHub Actions (si usás el workflow): secret `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`
3. *User Management*: agregá el email de cada persona que va a probar (modo Development, hasta 25 usuarios).
   La reproducción remota exige **Spotify Premium** en esa cuenta (limitación de Spotify).

> Sin Client ID la app funciona igual (alarmas, sonidos, grabaciones): el botón "Connect Spotify" avisa que falta configurarlo.

---

## 4. Dispositivos físicos para la Fase 0 — lo más importante

La spec (§66, §83) exige validar en hardware real antes de construir la UI completa. Yo no tengo dispositivos.

| Necesito | Para qué |
|---|---|
| iPhone con **iOS 26+** | AlarmKit: alarma con pantalla bloqueada, stop, snooze, sonido bundled |
| Pixel o Samsung con **Android 14+** | `setAlarmClock`, doze, full-screen activity, servicio foreground, reboot |
| Cuenta Spotify **Premium** + app instalada | Matriz Spotify (foreground / background / cerrada / sin internet) |
| Auriculares Bluetooth | Ruteo de audio (spec §50) |

Flujo: instalás el build → abrís **Wake (dev)** → seguís `docs/TECHNICAL_VALIDATION.md` y completás las columnas
"Actual / iOS / Android". Los datos de la pantalla **Diagnostics** van en el reporte.

---

## 5. Después (no bloqueante)

- **Apple Developer**: cuenta paga para TestFlight; después `eas submit --platform ios`.
- **Google Play Console** (USD 25 una vez): para distribución interna. La política de Play exige justificar
  `USE_EXACT_ALARM` (alarm clock app) y `USE_FULL_SCREEN_INTENT`; la app califica.
- **Spotify Extended Quota Mode**: cuando quieras que cualquiera pueda loguearse, se pide desde el Dashboard
  (Spotify revisa la app). Hasta entonces, sólo los usuarios agregados a mano.
- Revisar los **Developer Terms de Spotify** antes de cobrar por la función (spec §81).

---

## Resumen de una línea

**Vercel:** importá el repo con Root Directory `apps/web`. **EAS:** `eas login` + `eas build`. **Spotify:** creá la app y pasame el Client ID.
**Dispositivos:** iPhone iOS 26 + Android 14, y completá `docs/TECHNICAL_VALIDATION.md`.
