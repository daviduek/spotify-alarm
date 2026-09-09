# Wake — Handoff

Estado al 2026-09-07 (tarde). Rama `claude/wake-alarm-setup-acb0nb` (repo `daviduek/spotify-alarm`).

Producto: despertador confiable con fuentes de audio inteligentes (Spotify, tu voz, sonidos locales).
**Principio rector:** la alarma siempre suena; Spotify la mejora pero nunca la hace menos confiable.

---

## 1. Qué está online

> `master` ya apunta al producto (fast-forward 2026-09-09): push a `master` = deploy automático de producción en Vercel.

- **Web en producción:** <https://alarma.dondavid.xyz> (dominio canónico desde 2026-09-09; https://wakealarm.vercel.app sigue sirviendo) (proyecto Vercel `wake`, root `apps/web`, repo GitHub
  conectado; producción se despliega por CLI `vercel --prod` desde la raíz del repo o al pushear a `master`).
- **Backend:** Supabase `wake` (org Eluter, ref `ojuhtqqymfczzlsakdyu`), schema `0001` aplicado.
- Variables ya cargadas en Vercel (production + preview): `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL=https://wakealarm.vercel.app`.

## 2. Lo que te queda a vos (orden de prioridad)

1. ~~Auth URL Configuration~~ **HECHO (2026-09-09, vía Cowork)**: Site URL y Redirect URLs configuradas; "Confirm email" desactivado para pruebas — **reactivarlo antes de abrir la app a usuarios reales**. (Recomendado pendiente: Email Templates con {{ .TokenHash }} para links que funcionen en otro dispositivo.)
2. ~~Aplicar `supabase/migrations/0002_hardening.sql`~~ **HECHO (2026-09-09)**: aplicada al proyecto wake, 0 advisories de seguridad.
3. **Spotify (opcional):**
   - Supabase → Project Settings → API keys → copiá la **service_role** (o creá una secret key `sb_secret_…`)
     → Vercel env `SUPABASE_SERVICE_ROLE_KEY` (solo server; nunca `NEXT_PUBLIC_`).
   - <https://developer.spotify.com/dashboard> → Create app → Redirect URI exacta
     `https://alarma.dondavid.xyz/api/spotify/callback` → APIs: Web API + Web Playback SDK → Client ID → Vercel
     env `SPOTIFY_CLIENT_ID` → redeploy. User Management: agregá tus emails. Reproducción requiere Premium.
4. **Móvil:** el primer build de Android YA está corriendo en EAS (lanzado 2026-09-09): https://expo.dev/accounts/daviduek/projects/spotify-alarm/builds/f01d6e6d-cfaf-4569-843d-9de8558a9408 — cuando termine, instalá el APK desde ese link en un Android 13+. iOS sigue en §5 (requiere Apple Developer + iPhone iOS 26+).

## 3. Qué cambió (auditoría + mejoras + i18n)

Detalle hallazgo por hallazgo en `docs/AUDIT-2026-09-07.md`. Resumen:

- **Bilingüe (2026-09-08):** toda la web EN/ES según Accept-Language del navegador, con switch EN|ES en el footer (cookie `wake_lang`). Español neutro (tú). Formatters del dominio aceptan locale.

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

- [ ] Vos: Spotify (§2.3). Auth URLs y migración 0002: hechas. Reactivar "Confirm email" antes de usuarios reales.
- [ ] Vos: instalar el APK de Android (build ya lanzado) y validar docs/TECHNICAL_VALIDATION.md; luego iOS.
- [ ] Dominio propio (ej. `wake.eluter.com`) → actualizar `NEXT_PUBLIC_APP_URL` y redirect URIs.
- [ ] Reconciliación offline completa (hoy: cache localStorage de alarmas en Clock mode). CSP report-only y time zone: hechos.
- [ ] Onboarding + "before-sleep check" en web (spec §28/§29).
- [ ] Móvil Fase 1: fallback iOS < 26 (critical alerts + background audio), Live Activity para countdown.
