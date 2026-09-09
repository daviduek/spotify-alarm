import Link from 'next/link';
import { Suspense } from 'react';

import type { Locale } from '../lib/i18n';
import { getLocale } from '../lib/i18n/server';
import { getCurrentUser } from '../lib/supabase/server';

type Copy = {
  pill: string;
  h1a: string;
  h1em: string;
  h1b: string;
  lead: string;
  ctaStart: string;
  ctaSignIn: string;
  ctaOpen: string;
  ctaClock: string;
  clockSub: string;
  check: { scheduled: string; scheduledSub: string; fallback: string; fallbackSub: string; fade: string; fadeSub: string; spotify: string; spotifySub: string };
  promiseH: string;
  promiseQuote: string;
  promiseBody: string;
  howH: string;
  steps: { title: string; body: string }[];
  sourcesH: string;
  sources: { title: string; tag: string; body: string }[];
  builtH: string;
  features: { strong: string; rest: string }[];
  clockH: string;
  clockBody: string;
  clockLimit: string;
  mobileH: string;
  mobileBody: string;
  mobileCards: { tag: string; title: string; body: string }[];
  mobileStatus: [string, string, string];
  faqH: string;
  faq: { q: string; a: string }[];
  privacyH: string;
  privacyBody: [string, string, string];
};

const COPY: Record<Locale, Copy> = {
  en: {
    pill: 'Web app live · iOS & Android in technical validation',
    h1a: 'The alarm that ',
    h1em: 'always',
    h1b: ' rings.',
    lead: 'Wake up to Spotify, to your own voice, or to a simple sound — on a schedule that never depends on the internet being up, your account working, or Spotify feeling like it.',
    ctaStart: "Get started — it's free",
    ctaSignIn: 'Sign in',
    ctaOpen: 'Open your alarms',
    ctaClock: 'Clock mode',
    clockSub: 'Next alarm · Tomorrow · Morning',
    check: {
      scheduled: 'Alarm scheduled', scheduledSub: 'rings while this tab stays open',
      fallback: 'Fallback sound ready', fallbackSub: 'Sunrise · plays no matter what',
      fade: 'Progressive wake-up', fadeSub: 'Gentle · 5% → 50% over 5 min',
      spotify: 'Spotify unavailable', spotifySub: 'your fallback alarm still rings',
    },
    promiseH: 'One promise',
    promiseQuote: 'Your alarm must always wake you up.',
    promiseBody: 'Most “music alarm” apps make the alarm depend on the music. Wake does the opposite: a guaranteed sound starts first, at the exact second, and your playlist or recording is layered on top only once it’s actually playing. If anything fails — Spotify, Wi-Fi, an expired login — you still wake up.',
    howH: 'How it works',
    steps: [
      { title: 'Set the time', body: 'Pick the days, a label, snooze and how gently it should wake you. Takes ten seconds.' },
      { title: 'Choose what you hear', body: 'A Spotify playlist, a message in your own voice, or one of five built-in wake sounds.' },
      { title: 'Sleep', body: 'Wake starts a guaranteed sound first, then layers your music or recording on top when it can.' },
    ],
    sourcesH: 'Three ways to wake',
    sources: [
      { title: 'Spotify', tag: 'Optional · Premium', body: 'One button connects your account on Spotify’s own page. Pick a playlist, album or track; Wake tries to start it and falls back cleanly if it can’t.' },
      { title: 'Your own voice', tag: 'Private', body: 'Record a wake-up message right in the browser. It lives in your account, encrypted at rest, and plays the moment your alarm fires.' },
      { title: 'Wake sounds', tag: 'Always on', body: 'Sunrise, Soft, Piano, Birds, Classic. Bundled with the app, so they ring with no internet, no account issues, no excuses.' },
    ],
    builtH: 'Built for sleeping people',
    features: [
      { strong: 'Progressive volume.', rest: 'Gentle, Normal or Strong presets ramp the sound over minutes instead of blasting you awake.' },
      { strong: 'Hold to stop.', rest: 'A one-second hold, not a tap you can dismiss half-asleep. Snooze is a deliberate, separate button.' },
      { strong: 'Readiness check.', rest: 'Before you sleep, Wake tells you exactly what will ring and what might not — no surprises at 7 am.' },
      { strong: 'Syncs across devices.', rest: 'Alarms and recordings live in your account. Sign in anywhere and they’re there.' },
    ],
    clockH: 'Clock mode',
    clockBody: 'Turn any laptop, tablet or phone into a nightstand clock: sign in, arm the clock, keep the tab open. Wake keeps the screen awake, rings at the exact time with a full-screen alarm, and fades in your music or recording. Add it to your home screen and it opens like an app.',
    clockLimit: 'Honest limit: a browser can’t ring a closed tab or a locked phone. Clock mode is for a device that stays on. For the locked-phone case, read on.',
    mobileH: 'iPhone & Android — the native app',
    mobileBody: 'The mobile app hands your alarm to the operating system itself, so it rings with the phone locked, in Do Not Disturb, or after a reboot — the same way the built-in clock does.',
    mobileCards: [
      { tag: 'iOS 26+', title: 'AlarmKit', body: 'Apple’s alarm framework: full-screen alerts over the lock screen, protected from Focus modes and silent switch. Requires iOS 26 or newer.' },
      { tag: 'Android 13+', title: 'Exact alarms', body: 'System alarm clock scheduling, a full-screen alarm over the lock screen, restored after reboot, doze-proof.' },
    ],
    mobileStatus: ['Status: in technical validation on real devices. Not on the App Store or Google Play yet. Follow progress on the ', 'status page', '.'],
    faqH: 'Questions',
    faq: [
      { q: 'Will it really ring if Spotify is down?', a: 'Yes. Every alarm starts with a built-in sound before Wake even asks Spotify to play. Spotify only ever adds to the alarm — it can never subtract from it.' },
      { q: 'Does the web version work with my phone locked?', a: 'No, and we won’t pretend otherwise. Browsers can’t ring a closed tab. Clock mode keeps the tab open and the screen awake — great for a laptop or tablet on the nightstand. For a locked phone, that’s what the native app is for.' },
      { q: 'Do I need Spotify Premium?', a: 'Only to wake up to Spotify. Spotify limits remote playback to Premium accounts. Recordings and Wake sounds work with any account — or no Spotify at all.' },
      { q: 'What does Wake see when I connect Spotify?', a: 'Nothing you type. Sign-in happens on Spotify’s page; Wake receives an access token that stays on the server, never in your browser. Disconnect at any time from Settings.' },
      { q: 'Is it free?', a: 'Yes, while we build it in the open. The source is public.' },
    ],
    privacyH: 'Private by default',
    privacyBody: ['Your alarms and recordings are yours: row-level security in the database, a private storage bucket, and Spotify tokens that never leave the server. Read the ', 'privacy policy', ' — it’s short.'],
  },
  es: {
    pill: 'Web app en línea · iOS y Android en validación técnica',
    h1a: 'La alarma que suena ',
    h1em: 'siempre',
    h1b: '.',
    lead: 'Despierta con Spotify, con tu propia voz o con un sonido simple — en un horario que nunca depende de que haya internet, de que tu cuenta funcione o de que Spotify tenga ganas.',
    ctaStart: 'Empieza gratis',
    ctaSignIn: 'Iniciar sesión',
    ctaOpen: 'Abrir tus alarmas',
    ctaClock: 'Modo reloj',
    clockSub: 'Próxima alarma · Mañana · Morning',
    check: {
      scheduled: 'Alarma programada', scheduledSub: 'suena mientras esta pestaña siga abierta',
      fallback: 'Sonido de respaldo listo', fallbackSub: 'Amanecer · suena pase lo que pase',
      fade: 'Despertar progresivo', fadeSub: 'Suave · 5% → 50% en 5 min',
      spotify: 'Spotify no disponible', spotifySub: 'tu alarma de respaldo suena igual',
    },
    promiseH: 'Una promesa',
    promiseQuote: 'Tu alarma tiene que despertarte siempre.',
    promiseBody: 'La mayoría de las apps de “alarma con música” hacen que la alarma dependa de la música. Wake hace lo contrario: primero arranca un sonido garantizado, en el segundo exacto, y tu playlist o grabación se suma encima solo cuando realmente está sonando. Si algo falla — Spotify, el Wi-Fi, una sesión vencida — te despiertas igual.',
    howH: 'Cómo funciona',
    steps: [
      { title: 'Elige la hora', body: 'Días, etiqueta, snooze y qué tan suave quieres despertar. Diez segundos.' },
      { title: 'Elige qué escuchar', body: 'Una playlist de Spotify, un mensaje con tu propia voz o uno de los cinco sonidos incluidos.' },
      { title: 'A dormir', body: 'Wake arranca primero un sonido garantizado y suma tu música o grabación encima cuando puede.' },
    ],
    sourcesH: 'Tres formas de despertar',
    sources: [
      { title: 'Spotify', tag: 'Opcional · Premium', body: 'Un solo botón conecta tu cuenta en la página de Spotify. Elige playlist, álbum o canción; Wake intenta reproducirla y, si no puede, cae limpiamente al respaldo.' },
      { title: 'Tu propia voz', tag: 'Privado', body: 'Graba un mensaje para despertarte directo en el navegador. Queda en tu cuenta, cifrado en reposo, y suena en el momento en que dispara la alarma.' },
      { title: 'Sonidos Wake', tag: 'Siempre disponibles', body: 'Amanecer, Suave, Piano, Pájaros, Clásico. Vienen con la app: suenan sin internet, sin problemas de cuenta, sin excusas.' },
    ],
    builtH: 'Pensada para gente dormida',
    features: [
      { strong: 'Volumen progresivo.', rest: 'Los presets Suave, Normal y Fuerte suben el sonido a lo largo de minutos en vez de despertarte de un golpe.' },
      { strong: 'Mantener para apagar.', rest: 'Un segundo sostenido, no un tap que descartas medio dormido. El snooze es un botón aparte y deliberado.' },
      { strong: 'Chequeo de preparación.', rest: 'Antes de dormir, Wake te dice exactamente qué va a sonar y qué podría no sonar — sin sorpresas a las 7.' },
      { strong: 'Sincroniza entre dispositivos.', rest: 'Alarmas y grabaciones viven en tu cuenta. Inicia sesión donde sea y ahí están.' },
    ],
    clockH: 'Modo reloj',
    clockBody: 'Convierte cualquier laptop, tablet o teléfono en un reloj de mesita: inicia sesión, arma el reloj y deja la pestaña abierta. Wake mantiene la pantalla encendida, suena a la hora exacta con una alarma a pantalla completa y hace fade a tu música o grabación. Agrégalo a tu pantalla de inicio y se abre como una app.',
    clockLimit: 'Límite honesto: un navegador no puede sonar con la pestaña cerrada ni con el teléfono bloqueado. El modo reloj es para un dispositivo que queda encendido. Para el teléfono bloqueado, sigue leyendo.',
    mobileH: 'iPhone y Android — la app nativa',
    mobileBody: 'La app móvil le entrega tu alarma al sistema operativo, así que suena con el teléfono bloqueado, en No molestar o después de un reinicio — igual que el reloj integrado.',
    mobileCards: [
      { tag: 'iOS 26+', title: 'AlarmKit', body: 'El framework de alarmas de Apple: alertas a pantalla completa sobre la pantalla de bloqueo, protegidas de los modos de concentración y del switch de silencio. Requiere iOS 26 o más nuevo.' },
      { tag: 'Android 13+', title: 'Alarmas exactas', body: 'Programación como reloj despertador del sistema, alarma a pantalla completa sobre el bloqueo, restaurada tras el reinicio, a prueba de ahorro de batería.' },
    ],
    mobileStatus: ['Estado: en validación técnica en dispositivos reales. Todavía no está en App Store ni Google Play. Sigue el avance en la ', 'página de estado', '.'],
    faqH: 'Preguntas',
    faq: [
      { q: '¿De verdad suena si Spotify está caído?', a: 'Sí. Cada alarma arranca con un sonido incluido antes de que Wake siquiera le pida a Spotify que reproduzca. Spotify solo puede sumarle a la alarma — nunca restarle.' },
      { q: '¿La versión web funciona con el teléfono bloqueado?', a: 'No, y no vamos a fingir lo contrario. Los navegadores no pueden hacer sonar una pestaña cerrada. El modo reloj mantiene la pestaña abierta y la pantalla encendida — ideal para una laptop o tablet en la mesita. Para el teléfono bloqueado está la app nativa.' },
      { q: '¿Necesito Spotify Premium?', a: 'Solo para despertar con Spotify: Spotify limita la reproducción remota a cuentas Premium. Las grabaciones y los sonidos Wake funcionan con cualquier cuenta — o sin Spotify.' },
      { q: '¿Qué ve Wake cuando conecto Spotify?', a: 'Nada de lo que escribes. El inicio de sesión pasa en la página de Spotify; Wake recibe un token de acceso que se queda en el servidor, nunca en tu navegador. Puedes desconectarlo cuando quieras desde Ajustes.' },
      { q: '¿Es gratis?', a: 'Sí, mientras lo construimos en abierto. El código es público.' },
    ],
    privacyH: 'Privado por defecto',
    privacyBody: ['Tus alarmas y grabaciones son tuyas: seguridad a nivel de fila en la base de datos, un bucket de almacenamiento privado y tokens de Spotify que nunca salen del servidor. Lee la ', 'política de privacidad', ' — es corta.'],
  },
};

async function HeroActions({ t }: { t: Copy }) {
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    return (
      <div className="cta-row">
        <Link href="/app" className="btn btn-primary btn-lg">{t.ctaOpen}</Link>
        <Link href="/app/clock" className="btn btn-ghost btn-lg">{t.ctaClock}</Link>
      </div>
    );
  }
  return (
    <div className="cta-row">
      <Link href="/signup" className="btn btn-primary btn-lg">{t.ctaStart}</Link>
      <Link href="/login" className="btn btn-ghost btn-lg">{t.ctaSignIn}</Link>
    </div>
  );
}

export default async function HomePage() {
  const locale = await getLocale();
  const t = COPY[locale];

  return (
    <main className="landing">
      {/* Hero */}
      <section className="hero">
        <span className="pill">{t.pill}</span>
        <h1>{t.h1a}<em>{t.h1em}</em>{t.h1b}</h1>
        <p className="lead">{t.lead}</p>
        <Suspense fallback={<div className="cta-row"><Link href="/signup" className="btn btn-primary btn-lg">{t.ctaStart}</Link><Link href="/login" className="btn btn-ghost btn-lg">{t.ctaSignIn}</Link></div>}>
          <HeroActions t={t} />
        </Suspense>

        <div className="hero-clock" aria-hidden="true">
          <div className="hero-clock-time">07:00</div>
          <div className="hero-clock-sub">{t.clockSub}</div>
        </div>

        <div className="check" role="list" aria-label={t.check.scheduled}>
          <div role="listitem"><span className="ok">✓</span> <span>{t.check.scheduled}</span> <span className="dim">{t.check.scheduledSub}</span></div>
          <div role="listitem"><span className="ok">✓</span> <span>{t.check.fallback}</span> <span className="dim">{t.check.fallbackSub}</span></div>
          <div role="listitem"><span className="ok">✓</span> <span>{t.check.fade}</span> <span className="dim">{t.check.fadeSub}</span></div>
          <div role="listitem"><span className="warn">⚠</span> <span>{t.check.spotify}</span> <span className="dim">{t.check.spotifySub}</span></div>
        </div>
      </section>

      {/* Promise */}
      <section className="block promise">
        <h2>{t.promiseH}</h2>
        <p className="big-quote">{t.promiseQuote}</p>
        <p>{t.promiseBody}</p>
      </section>

      {/* How it works */}
      <section className="block" id="how">
        <h2>{t.howH}</h2>
        <ol className="steps">
          {t.steps.map((s, i) => (
            <li key={s.title} className="step">
              <span className="step-n">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Sources */}
      <section className="block">
        <h2>{t.sourcesH}</h2>
        <div className="grid">
          {t.sources.map((s) => (
            <div key={s.title} className="card">
              <span className="card-tag">{s.tag}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Progressive + features */}
      <section className="block">
        <h2>{t.builtH}</h2>
        <div className="feature-list">
          {t.features.map((f) => (
            <div key={f.strong}><strong>{f.strong}</strong> {f.rest}</div>
          ))}
        </div>
      </section>

      {/* Clock mode */}
      <section className="block">
        <h2>{t.clockH}</h2>
        <p>{t.clockBody}</p>
        <p className="dim small">{t.clockLimit}</p>
      </section>

      {/* Mobile */}
      <section className="block" id="mobile">
        <h2>{t.mobileH}</h2>
        <p>{t.mobileBody}</p>
        <div className="grid two">
          {t.mobileCards.map((c) => (
            <div key={c.title} className="card">
              <span className="card-tag">{c.tag}</span>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
        <p className="dim small">
          {t.mobileStatus[0]}<Link href="/status">{t.mobileStatus[1]}</Link>{t.mobileStatus[2]}
        </p>
      </section>

      {/* FAQ */}
      <section className="block" id="faq">
        <h2>{t.faqH}</h2>
        <div className="faq">
          {t.faq.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Privacy + CTA */}
      <section className="block final">
        <h2>{t.privacyH}</h2>
        <p>
          {t.privacyBody[0]}<Link href="/privacy">{t.privacyBody[1]}</Link>{t.privacyBody[2]}
        </p>
        <Suspense fallback={null}>
          <HeroActions t={t} />
        </Suspense>
      </section>
    </main>
  );
}
