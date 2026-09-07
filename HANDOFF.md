# Wake — Handoff

Estado al 2026-09-07 (tarde). Rama `claude/wake-alarm-setup-acb0nb` (repo `daviduek/spotify-alarm`).

Producto: despertador confiable con fuentes de audio inteligentes (Spotify, tu voz, sonidos locales).
**Principio rector:** la alarma siempre suena; Spotify la mejora pero nunca la hace menos confiable.

---

## 1. Qué está online

- **Web en producción:** <https://wakealarm.vercel.app> (proyecto Vercel `wake`, root `apps/web`, repo GitHub
  conectado; producción se despliega por CLI `vercel --prod` desde la raíz del repo o al pushear a `master`).
- **Backend:** Supabase `wake` (org Eluter, ref `ojuhtqqymfczzlsakdyu`), schema `0001` aplicado.
- Variables ya cargadas en Vercel (production + preview): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL=https://wakealarm.vercel.app`.

## 2. Lo que te queda a vos (orden de prioridad)

1. **Supabase → Authentication → URL Configuration** (2 min):
   - Site URL: `https://wakealarm.vercel.app`
   - Redirect URLs: `https://wakealarm.vercel.app/auth/callback` y `https://wakealarm.vercel.app/**`
   - Para probar sin mail de confirmación: Providers → Email → desactivar "Confirm email".
   - (Recomendado) Email Templates: usar links con `{{ .TokenHash }}`
     (`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email|recovery|magiclink`) para que el link
     funcione aunque lo abras en otro dispositivo. El callback ya soporta ambos formatos.
2. **Aplicar `supabase/migrations/0002_hardening.sql`** (SQL Editor → pegar → Run). Oculta los tokens de Spotify
   al browser, endurece policies y agrega checks. No se pudo aplicar desde acá (el conector bloqueó el DDL).
3. **Spotify (opcional):**
   - Supabase → Project Settings → API keys → copiá la **service_role** (o creá una secret key `sb_secret_…`)
     → Vercel env `SUPABASE_SERVICE_ROLE_KEY` (solo server; nunca `NEXT_PUBLIC_`).
   - <https://developer.spotify.com/dashboard> → Create app → Redirect URI exacta
     `https://wakealarm.vercel.app/api/spotify/callback` → APIs: Web API + Web Playback SDK → Client ID → Vercel
     env `SPOTIFY_CLIENT_ID` → redeploy. User Management: agregá tus emails. Reproducción requiere Premium.
4. **Móvil (ver §5).**

## 3. Qué cambió hoy (auditoría + mejoras)

Detalle hallazgo por hallazgo en `docs/AUDIT-2026-09-07.md`. Resumen:

- **Bug crítico corregido:** Clock mode nunca disparaba la alarma (recalculaba "próxima" al vencer el timer).
  Ahora captura la ocurrencia, chequea cada segundo, tolera hasta 10 min de suspensión de la pestaña y
  re-chequea al volver a primer plano.
- Fallback nunca se apaga si la grabación/Spotify no suena de verdad (confirmación de reproducción).
- Audio desbloqueado dentro del gesto (iOS Safari); pool de elementos reutilizables.
- Alarmas "once" se consumen; hold-to-stop con pointer events; snooze con cleanup.
- Auth: reset de contraseña, `safeNext` (open redirect), callback con `token_hash`, mensajes amigables.
- Spotify server: refresh concurrente seguro, `code_verifier` siempre, tokens solo vía service role.
- API sin sesión → JSON 401. Errores logueados. MIME de grabaciones normalizado; sin huérfanos.
- Landing nueva (hero, promesa, cómo funciona, 3 fuentes, clock mode, móvil, FAQ), metadata/OG/iconos,
  PWA manifest (instalable, `standalone`), robots/sitemap, páginas de error/404.
- Dominio: readiness honesto, fade robusto (sin NaN → mudo), guards de horario, weekdays únicos, +11 tests (40).
- Móvil: conflicto de manifest que rompía el build Android, `POST_NOTIFICATIONS` en runtime, `<queries>` para
  Spotify, receiver en `OnStartObserving`, iOS `deploymentTarget` 26.0, limpieza de eas.json.

## 4. Estructura

```
wake/
├── apps/web        Next.js 16 — landing + auth + app (prod: wakealarm.vercel.app)
├── apps/mobile     Expo SDK 57 + módulo nativo modules/wake-alarm (AlarmKit iOS 26 / AlarmManager Android)
├── packages/domain @wake/domain — lógica pura compartida, 40 tests
├── supabase/       migrations 0001 (aplicada) y 0002 (pendiente)
└── docs/           ARCHITECTURE, DECISIONS, SETUP, SETUP-WEB, TECHNICAL_VALIDATION, TEST_MATRIX, AUDIT-2026-09-07
```

Comandos: `npm ci` · `npm run check` (typecheck + tests) · `npm run web` · `npm run web:build` ·
`vercel --prod` (desde la raíz; el proyecto está linkeado en `.vercel/`).

## 5. iOS y Android — camino más corto a un teléfono real

Expo Go **no sirve** (módulo nativo). Se necesita un *development build* con EAS (nube; no hace falta
Xcode/Android Studio local).

**Android primero (solo cuenta Expo, gratis):**
```bash
npm i -g eas-cli && eas login
cd apps/mobile && cp .env.example .env
eas build -p android --profile development
```
Instalá el APK del link en un Android 13+. Correr filas A1–A6 de `docs/TECHNICAL_VALIDATION.md`
(alarma con pantalla bloqueada, reboot, DND, snooze, Spotify si hay Premium).

**iOS (requiere Apple Developer Program, USD 99/año, y un iPhone con iOS 26+):**
```bash
eas device:create              # registra el UDID del iPhone (abrís el link en el teléfono)
eas build -p ios --profile development   # la primera vez interactivo: crea cert + provisioning
```
Instalás desde el link de EAS. AlarmKit no existe en iOS ≤ 25: por eso el `deploymentTarget` es 26.0.

**Después:** perfil `preview` para testers sin Metro; `production` + TestFlight / Play internal testing cuando
haya validación en dispositivos. Play exige declaraciones (alarm clock, FGS media playback) recién al subir.
Alternativa sin terminal: GitHub → Actions → "EAS Build" (necesita secret `EXPO_TOKEN`).

## 6. Límite honesto del navegador

El navegador no puede sonar con la pestaña cerrada ni con el teléfono bloqueado. **Clock mode** mantiene la
pestaña abierta y la pantalla encendida (Wake Lock) y suena a la hora exacta; instalado como PWA se abre a
pantalla completa. La alarma con teléfono bloqueado es la app nativa (§5). La web lo dice claramente.

## 7. Pendientes sugeridos

- [ ] Vos: Auth URLs (§2.1), migración 0002 (§2.2), Spotify (§2.3).
- [ ] Vos: primer `eas build` Android; luego iOS.
- [ ] Dominio propio (ej. `wake.eluter.com`) → actualizar `NEXT_PUBLIC_APP_URL` y redirect URIs.
- [ ] CSP en modo report-only; persistir time zone en `profiles`; reconciliación offline (IndexedDB).
- [ ] Onboarding + "before-sleep check" en web (spec §28/§29).
- [ ] Móvil Fase 1: fallback iOS < 26 (critical alerts + background audio), Live Activity para countdown.
