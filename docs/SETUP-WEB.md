# SETUP-WEB — poner online la app web de Wake (David)

La app web (`apps/web`, Next.js 16) es **login + alarmas + grabaciones + Spotify**, usable desde el navegador
sin publicar en tiendas. Esto es lo único que necesito de tu lado. ~10 minutos.

Yo ya puedo: crear el proyecto Supabase, aplicar el schema y (con el conector) ver deploys. Lo que **no** puedo
hacer solo: apretar botones en tu cuenta de Vercel y crear la app en el Spotify Dashboard.

## 1. Base de datos (Supabase) — puedo hacerlo yo

Tenés la org **Eluter** en Supabase conectada. Puedo crear un proyecto nuevo `wake` (**cuesta USD 10/mes**,
por eso necesito tu OK explícito) o reusar uno existente, y correr `supabase/migrations/0001_wake_init.sql`.
Decime "creá el proyecto wake" o "usá el proyecto X" y lo dejo listo con tablas, RLS y el bucket de grabaciones.

Después, en el dashboard de Supabase → Authentication:
- **URL Configuration → Site URL** = la URL de Vercel (paso 2).
- **Redirect URLs**: agregá `https://<tu-dominio>/auth/callback`.
- **Providers → Email**: para probar rápido, desactivá "Confirm email" (te logueás al instante). Para producción, dejalo activo.

## 2. Vercel — lo hacés vos (2 min)

1. <https://vercel.com/new> → importá `daviduek/spotify-alarm`.
2. **Root Directory: `apps/web`** (importante).
3. Environment Variables (de `apps/web/.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase → Settings → API.
   - `NEXT_PUBLIC_APP_URL` → la URL que te da Vercel (ej. `https://wake-xxx.vercel.app`).
   - `SPOTIFY_CLIENT_ID` + `SUPABASE_SERVICE_ROLE_KEY` → paso 3 (opcional; sin esto todo funciona menos Spotify).
4. **Deploy**. Listo: te registrás en `/signup`, entrás en `/app`.

> Cada push a la rama `claude/wake-alarm-setup-acb0nb` genera un preview; `master` es producción.

## 3. Spotify Dashboard — lo hacés vos (3 min)

1. <https://developer.spotify.com/dashboard> → Create app.
   - Redirect URI: `https://<tu-dominio>/api/spotify/callback` (exacto).
   - APIs: **Web API** y **Web Playback SDK**.
2. Copiá el **Client ID** → cargalo como `SPOTIFY_CLIENT_ID` en Vercel y redeploy.
3. En *User Management* agregá los emails de prueba (modo Development). La reproducción necesita **Premium**.

En la app, Settings → **Connect Spotify** hace todo el OAuth con un solo botón (server-side, PKCE, sin secret en el browser).

## Qué funciona sin cada cosa

| Falta | Qué pasa |
|---|---|
| Nada configurado | Landing pública anda; `/app` redirige a `/login` con aviso. |
| Solo Supabase | Login, alarmas, grabaciones, sonidos, Clock mode: todo. Spotify muestra "no configurado". |
| + Spotify | Botón "Connect Spotify" y reproducción con Premium. |

## Límite honesto del navegador

El navegador no puede sonar con la pestaña cerrada. **Clock mode** mantiene la pestaña abierta y la pantalla encendida
(Wake Lock) y suena a la hora exacta con pantalla completa y "mantené para apagar". Para alarma con el teléfono
bloqueado, es la app nativa (en validación técnica). La web lo dice claramente, nunca promete lo que no puede.


---

## ✅ Ya hecho por mí (backend listo)

Creé el proyecto Supabase **wake** en la org Eluter y apliqué el schema (6 tablas con RLS,
bucket privado de grabaciones, triggers, hardening de seguridad — 0 advisories). Solo falta
el deploy en Vercel + el paso de Auth URLs.

### Variables para pegar en Vercel (Project → Settings → Environment Variables)

Estas dos alcanzan para que login + alarmas + grabaciones funcionen. El anon key es **público**
por diseño (va al bundle del browser), no es un secreto:

```
NEXT_PUBLIC_SUPABASE_URL=https://ojuhtqqymfczzlsakdyu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Sz3-XXTkMf3HNAe55GZHWQ_Ua4JSY_3
NEXT_PUBLIC_APP_URL=https://wakealarm.vercel.app
```

> Ya cargadas en el proyecto Vercel `wake` (production + preview). Deploy: <https://wakealarm.vercel.app>.

Para Spotify (paso 3) hacen falta además `SPOTIFY_CLIENT_ID` y `SUPABASE_SERVICE_ROLE_KEY` (server-only; Supabase → Project Settings → API keys). Los tokens de Spotify se leen/escriben solo con esa key: aplicar antes `supabase/migrations/0002_hardening.sql`.

### Después del primer deploy — configurar Auth URLs en Supabase

Andá a Supabase → proyecto **wake** → Authentication → URL Configuration:
- **Site URL** = tu URL de Vercel (la misma de `NEXT_PUBLIC_APP_URL`).
- **Redirect URLs** → agregá `https://TU-URL-DE-VERCEL/auth/callback`.
- Para probar al instante sin mail de confirmación: Authentication → Providers → Email → desactivá "Confirm email".

Dashboard del proyecto: <https://supabase.com/dashboard/project/ojuhtqqymfczzlsakdyu>
