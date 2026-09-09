import type { Metadata } from 'next';

import type { Locale } from '../../lib/i18n';
import { getLocale } from '../../lib/i18n/server';

const TITLE: Record<Locale, string> = { en: 'Privacy Policy', es: 'Política de Privacidad' };

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: TITLE[locale] };
}

function PrivacyEn() {
  return (
    <article className="legal">
      <h1>Privacy Policy</h1>
      <p>Last updated: September 2026 · Applies to the Wake mobile application (working title) and this website.</p>

      <h2>Summary</h2>
      <ul>
        <li>Wake works without an account. Your alarms, settings and recordings are stored only on your device.</li>
        <li>Voice recordings never leave your phone. We do not upload, analyse or back them up.</li>
        <li>If you connect Spotify, authentication happens on Spotify&apos;s own pages. Wake never sees your Spotify password.</li>
        <li>Spotify access tokens are stored in the device&apos;s secure storage (iOS Keychain / Android Keystore) and are never logged or transmitted to us.</li>
        <li>Wake currently has no servers of its own and collects no analytics.</li>
      </ul>

      <h2>Data we process on your device</h2>
      <ul>
        <li>Alarm configuration (time, days, sound, volume, snooze, vibration).</li>
        <li>Audio recordings you create, stored in the app&apos;s private storage.</li>
        <li>A local alarm history (when an alarm was scheduled, fired, stopped or snoozed) used only to help you and us understand reliability. It contains no audio.</li>
        <li>Diagnostic information shown in the in-app Diagnostics screen (OS version, permission states). It is displayed to you and not sent anywhere automatically.</li>
      </ul>

      <h2>Spotify</h2>
      <p>
        When you choose to connect Spotify, Wake requests the minimum permissions needed to list your playlists, search, and start or pause playback on your
        device. Spotify&apos;s own privacy policy governs data processed by Spotify. You can disconnect at any time from the app; this deletes the stored tokens.
        You can also revoke access at <a href="https://www.spotify.com/account/apps/">spotify.com/account/apps</a>.
      </p>

      <h2>Permissions</h2>
      <ul>
        <li>Alarms &amp; reminders / AlarmKit: required so alarms ring while the phone is locked.</li>
        <li>Microphone: only while you record a wake-up message.</li>
        <li>Notifications and full-screen alarm display (Android): to show STOP / SNOOZE while the phone is locked.</li>
      </ul>

      <h2>Children</h2>
      <p>Wake is not directed at children under 13 and does not knowingly collect personal information from them.</p>

      <h2>Changes</h2>
      <p>If Wake gains optional accounts, sync or analytics in the future, this policy will be updated before those features ship, and they will be opt-in.</p>

      <h2>Contact</h2>
      <p>Questions: open an issue at <a href="https://github.com/daviduek/spotify-alarm">github.com/daviduek/spotify-alarm</a>.</p>
    </article>
  );
}

function PrivacyEs() {
  return (
    <article className="legal">
      <h1>Política de Privacidad</h1>
      <p>Última actualización: septiembre de 2026 · Aplica a la aplicación móvil Wake (nombre provisorio) y a este sitio web.</p>

      <h2>Resumen</h2>
      <ul>
        <li>Wake funciona sin cuenta. Tus alarmas, ajustes y grabaciones se guardan solo en tu dispositivo.</li>
        <li>Las grabaciones de voz nunca salen de tu teléfono. No las subimos, analizamos ni respaldamos.</li>
        <li>Si conectas Spotify, la autenticación ocurre en las páginas propias de Spotify. Wake nunca ve tu contraseña de Spotify.</li>
        <li>Los tokens de acceso de Spotify se guardan en el almacenamiento seguro del dispositivo (iOS Keychain / Android Keystore) y nunca se registran ni se nos transmiten.</li>
        <li>Wake actualmente no tiene servidores propios y no recopila analíticas.</li>
      </ul>

      <h2>Datos que procesamos en tu dispositivo</h2>
      <ul>
        <li>Configuración de alarmas (hora, días, sonido, volumen, snooze, vibración).</li>
        <li>Grabaciones de audio que creas, guardadas en el almacenamiento privado de la app.</li>
        <li>Un historial local de alarmas (cuándo una alarma fue programada, sonó, se detuvo o se pospuso con snooze) usado solo para ayudarte a ti y a nosotros a entender la confiabilidad. No contiene audio.</li>
        <li>Información de diagnóstico mostrada en la pantalla de Diagnósticos dentro de la app (versión del sistema operativo, estado de permisos). Se te muestra a ti y no se envía a ningún lado automáticamente.</li>
      </ul>

      <h2>Spotify</h2>
      <p>
        Cuando eliges conectar Spotify, Wake solicita los permisos mínimos necesarios para listar tus playlists, buscar, e iniciar o pausar la reproducción en tu
        dispositivo. La política de privacidad propia de Spotify rige los datos procesados por Spotify. Puedes desconectarla en cualquier momento desde la app; esto elimina los tokens guardados.
        También puedes revocar el acceso en <a href="https://www.spotify.com/account/apps/">spotify.com/account/apps</a>.
      </p>

      <h2>Permisos</h2>
      <ul>
        <li>Alarmas y recordatorios / AlarmKit: requerido para que las alarmas suenen con el teléfono bloqueado.</li>
        <li>Micrófono: solo mientras grabas un mensaje para despertarte.</li>
        <li>Notificaciones y alarma en pantalla completa (Android): para mostrar DETENER / SNOOZE con el teléfono bloqueado.</li>
      </ul>

      <h2>Menores</h2>
      <p>Wake no está dirigida a menores de 13 años y no recopila a sabiendas información personal de ellos.</p>

      <h2>Cambios</h2>
      <p>Si Wake incorpora en el futuro cuentas opcionales, sincronización o analíticas, esta política se actualizará antes de que esas funciones se publiquen, y serán opcionales (opt-in).</p>

      <h2>Contacto</h2>
      <p>Preguntas: abre un issue en <a href="https://github.com/daviduek/spotify-alarm">github.com/daviduek/spotify-alarm</a>.</p>
    </article>
  );
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  return locale === 'es' ? <PrivacyEs /> : <PrivacyEn />;
}
