# Plantillas de email de Supabase (Wake)

Estas plantillas usan links con `token_hash`, que **funcionan aunque el email se abra en otro
dispositivo o navegador** (el formato PKCE por defecto falla en ese caso). El callback de Wake
(`/auth/callback`) ya soporta ambos formatos.

Dónde pegarlas: Supabase → proyecto **wake** → Authentication → Email Templates.
Al terminar: Authentication → Sign In / Providers → Email → **reactivar "Confirm email"**.

Nota: el asunto y el cuerpo van en español neutro; Supabase no soporta plantillas por idioma,
y la mayoría de los usuarios iniciales son hispanohablantes.

---

## Confirm signup — asunto: `Confirma tu cuenta de Wake`

```html
<h2>Bienvenido a Wake</h2>
<p>Toca el botón para confirmar tu cuenta y empezar a crear alarmas.</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/app"
      style="display:inline-block;padding:12px 22px;background:#ffa033;color:#000;border-radius:999px;text-decoration:none;font-weight:600">
   Confirmar mi cuenta</a></p>
<p style="color:#888;font-size:13px">Si no creaste una cuenta en Wake, ignora este mensaje.</p>
```

## Magic Link — asunto: `Tu enlace para entrar a Wake`

```html
<h2>Entrar a Wake</h2>
<p>Toca el botón para iniciar sesión. El enlace vence en una hora.</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/app"
      style="display:inline-block;padding:12px 22px;background:#ffa033;color:#000;border-radius:999px;text-decoration:none;font-weight:600">
   Iniciar sesión</a></p>
<p style="color:#888;font-size:13px">Si no pediste este enlace, ignora este mensaje.</p>
```

## Reset Password — asunto: `Restablece tu contraseña de Wake`

```html
<h2>Nueva contraseña</h2>
<p>Toca el botón para elegir una contraseña nueva.</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password"
      style="display:inline-block;padding:12px 22px;background:#ffa033;color:#000;border-radius:999px;text-decoration:none;font-weight:600">
   Elegir contraseña nueva</a></p>
<p style="color:#888;font-size:13px">Si no pediste el cambio, ignora este mensaje: tu contraseña sigue igual.</p>
```

## Change Email Address — asunto: `Confirma tu nuevo email de Wake`

```html
<h2>Confirmar cambio de email</h2>
<p>Toca el botón para confirmar tu nueva dirección.</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email_change&next=/app/settings"
      style="display:inline-block;padding:12px 22px;background:#ffa033;color:#000;border-radius:999px;text-decoration:none;font-weight:600">
   Confirmar nuevo email</a></p>
```

---

## Prompt para Cowork

```
Abrí https://supabase.com/dashboard/project/ojuhtqqymfczzlsakdyu → Authentication → Email Templates.
En el repo local C:\Users\david\spotify-alarm\docs\SUPABASE-EMAILS.md están las 4 plantillas
(Confirm signup, Magic Link, Reset Password, Change Email Address) con su asunto cada una:
reemplazá el Subject y el Message body de cada template con ese contenido HTML, tal cual.
Al terminar, andá a Authentication → Sign In / Providers → Email y REACTIVÁ "Confirm email".
Verificá todo recargando y contame qué quedó.
```
