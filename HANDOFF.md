# Wake — Handoff

Estado del proyecto al 2026-09-07. Rama de trabajo: `claude/wake-alarm-setup-acb0nb`
(repo `daviduek/spotify-alarm`). Todo lo de abajo está pusheado.

Producto: despertador confiable con fuentes de audio inteligentes (Spotify, tu voz, sonidos
locales). **Principio rector:** la alarma siempre suena; Spotify la mejora pero nunca la hace
menos confiable.

---

## 1. TL;DR — qué falta para usarla (2 minutos, lo hacés vos)

El **backend ya está online** (Supabase creado y con schema aplicado). Solo falta el deploy web:

1. **Vercel** → https://vercel.com/new → importá `daviduek/spotify-alarm` →
   **Root Directory: `apps/web`**.
2. Environment Variables (pegá tal cual; el anon key es público por diseño):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://ojuhtqqymfczzlsakdyu.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Sz3-XXTkMf3HNAe55GZHWQ_Ua4JSY_3
   NEXT_PUBLIC_APP_URL=https://TU-URL-DE-VERCEL
   ```
3. **Deploy**.
4. En Supabase → proyecto **wake** → Authentication → URL Configuration:
   - Site URL = tu URL de Vercel.
   - Redirect URLs → agregá `https://TU-URL-DE-VERCEL/auth/callback`.
   - Para probar sin mail de confirmación: Providers → Email → desactivá "Confirm email".

Con eso ya te registrás en `/signup` y usás las alarmas. **Spotify es opcional** (ver §4).

> Nota honesta sobre Vercel: en esta sesión NO tengo el conector de Vercel instalado, por eso
> el import lo hacés vos. Si preferís, pasame un token de Vercel y lo dejo deployado por CLI.

---

## 2. Qué construí

### Monorepo (npm workspaces, Node 22)
```
wake/
├── apps/
│   ├── web/        Next.js 16 — LANDING + LOGIN + APP (esto es lo usable hoy)
│   └── mobile/     Expo SDK 57 — app nativa iOS/Android (Fase 0, ver §6)
├── packages/
│   └── domain/     @wake/domain — lógica pura compartida (types, FadeEngine,
│                   scheduling, readiness, validación zod). 29 tests en verde.
├── supabase/       migrations/0001_wake_init.sql (ya aplicada al proyecto wake)
├── docs/           ARCHITECTURE, DECISIONS, SETUP-WEB, SETUP, TECHNICAL_VALIDATION, TEST_MATRIX
└── legacy/         prototipos previos (Expo single-file + app SwiftUI), solo referencia
```

### App web (`apps/web`) — lo que podés usar hoy
- **Auth (Supabase):** registro, login con contraseña y magic link por email.
  Sesión refrescada en `src/proxy.ts` (middleware de Next 16); `/app` y `/api/spotify` protegidos.
- **Alarmas:** dashboard con próxima alarma, alta/edición (hora, días, fuente de sonido,
  sonido de respaldo, volumen progresivo, snooze, vibración, etiqueta), enable/disable, borrar.
- **Grabaciones:** grabás tu voz en el navegador (MediaRecorder), se guardan en tu cuenta
  (Supabase Storage, bucket privado), reproducir/renombrar/borrar.
- **Clock mode (mesita de luz):** mantenés la pestaña abierta y suena a la hora exacta con
  pantalla completa, "mantener para apagar", fade y transición a Spotify/grabación.
- **Spotify con un botón** (§4).
- **Settings** (cuenta, Spotify) y **Diagnostics**.

### packages/domain
Modelo `Alarm` + `AudioPlan` (preparado para secuencias sin migración), `FadeEngine`
(curvas linear/ease-in/log + presets Gentle/Normal/Strong), cálculo de próxima ocurrencia
con DST, `computeReadiness`, interfaces `AlarmScheduler`/`MusicProvider`/`AlarmAudioEngine`,
schemas zod (filas de DB + respuestas de Spotify), logger con redacción de tokens, feature flags.

---

## 3. Backend (Supabase) — YA HECHO

- Proyecto **wake** creado en la org **Eluter** (region us-east-1, USD 10/mes).
  - Project ref: `ojuhtqqymfczzlsakdyu`
  - Dashboard: https://supabase.com/dashboard/project/ojuhtqqymfczzlsakdyu
  - API URL: `https://ojuhtqqymfczzlsakdyu.supabase.co`
- Schema aplicado (`supabase/migrations/0001_wake_init.sql`): 6 tablas con **Row Level
  Security** por usuario — `profiles`, `alarms`, `recordings`, `spotify_connections`,
  `music_sources`, `alarm_history` — más bucket privado `recordings`, triggers de
  `updated_at`, y auto-creación de perfil al registrarse.
- Seguridad: **0 advisories** (search_path fijado y EXECUTE revocado en funciones de trigger).
- Los tokens de Spotify quedan en `spotify_connections` (RLS); el browser solo ve una vista
  sin secretos (`spotify_connection_status`) y nunca el refresh token.

---

## 4. Spotify (opcional) — "un solo botón"

En Settings → **Connect Spotify** dispara todo el OAuth (Authorization Code + PKCE) del lado
del servidor. Wake nunca ve la contraseña; los tokens no llegan al browser y se refrescan solos.
La reproducción usa el Web Playback SDK (Wake se registra como device) con fallback al Web API.

Para activarlo:
1. https://developer.spotify.com/dashboard → Create app.
   - Redirect URI: `https://TU-URL-DE-VERCEL/api/spotify/callback` (exacto).
   - APIs: **Web API** y **Web Playback SDK**.
2. Copiá el **Client ID** → agregalo en Vercel como `SPOTIFY_CLIENT_ID` → redeploy.
3. En *User Management* agregá los emails de prueba. La reproducción remota requiere **Premium**.

Sin Client ID, todo lo demás funciona; el botón avisa que Spotify no está configurado.

---

## 5. Cómo correr y verificar (local)

```bash
npm ci
npm run check       # typecheck de los 3 paquetes + tests del dominio (todo verde)
npm run web         # dev server de apps/web
npm run web:build   # build de producción (pasa; 22 rutas)
```
CI en GitHub Actions (`.github/workflows/ci.yml`) corre typecheck + tests + build web en cada push.

---

## 6. App móvil nativa (Fase 0 — no bloquea la web)

En `apps/mobile` (Expo 57). Módulo nativo `modules/wake-alarm`: iOS con **AlarmKit** (iOS 26+),
Android con **AlarmManager** + servicio foreground + pantalla de alarma + restauración tras
reboot. Es la única vía para alarma con el teléfono bloqueado. Requiere build con EAS y prueba
en dispositivos reales — pasos en `docs/SETUP.md` y matriz en `docs/TECHNICAL_VALIDATION.md`.
No la compilé acá (falta Xcode/Android SDK); el primer `eas build` puede pedir ajustes menores.

---

## 7. Límite honesto del navegador

El navegador no puede sonar con la pestaña cerrada. **Clock mode** mantiene la pestaña abierta
y la pantalla encendida (Wake Lock) y suena a la hora exacta. Para alarma con teléfono bloqueado,
es la app nativa. La web lo dice claramente y nunca promete lo que no puede cumplir.

---

## 8. Decisiones y arquitectura

Detalle técnico en `docs/ARCHITECTURE.md`; registro de decisiones (ADRs) en `docs/DECISIONS.md`.
Puntos clave: OS como motor de alarma; local-first; provider-agnostic (Spotify hoy, Apple/YouTube
Music después); Spotify detrás de feature flag; sin backend propio salvo lo imprescindible.

---

## 9. Commits de esta entrega (rama claude/wake-alarm-setup-acb0nb)

- `feat: Wake monorepo — Phase 0 technical validation app, native alarm module, domain, web`
- `feat(web): Wake web app — login, alarms, recordings, one-button Spotify, clock mode`
- `chore(supabase): provision wake project schema + security hardening; document env vars`

## 10. Pendientes / próximos pasos sugeridos

- [ ] Vos: deploy en Vercel (§1) y configurar Auth URLs.
- [ ] Vos (opcional): app de Spotify + `SPOTIFY_CLIENT_ID` (§4).
- [ ] Reconciliación local-first offline en la web (IndexedDB) — hoy lee/escribe directo a Supabase.
- [ ] Onboarding y "before-sleep check" en la web (spec §28/§29).
- [ ] Fase 1+ móvil tras validación en dispositivos (spec §67 en adelante).
- [ ] Dominio propio en Vercel (ej. wake.eluter.com) y ajustar `NEXT_PUBLIC_APP_URL`.
