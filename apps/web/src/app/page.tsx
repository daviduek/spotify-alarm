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
  check: { scheduled: string; scheduledSub: string; fallback: string; fallbackSub: string; spotify: string; spotifySub: string };
  promiseQuote: string;
  promiseBody: string;
  sourcesH: string;
  sources: { title: string; body: string }[];
  clockH: string;
  clockBody: string;
  mobileH: string;
  mobileBody: string;
  mobileNote: [string, string, string];
  faqH: string;
  faq: { q: string; a: string }[];
  finalH: string;
  finalBody: [string, string, string];
};

const COPY: Record<Locale, Copy> = {
  en: {
    pill: 'Web app live · iOS & Android soon',
    h1a: 'The alarm that ',
    h1em: 'always',
    h1b: ' rings.',
    lead: 'Spotify, your own voice, or a simple sound — and it rings even if all of that fails.',
    ctaStart: "Start free",
    ctaSignIn: 'Sign in',
    ctaOpen: 'Open your alarms',
    ctaClock: 'Clock mode',
    clockSub: 'Next alarm · Tomorrow',
    check: {
      scheduled: 'Alarm scheduled', scheduledSub: 'rings while this tab stays open',
      fallback: 'Fallback sound ready', fallbackSub: 'plays no matter what',
      spotify: 'Spotify unavailable', spotifySub: 'your fallback alarm still rings',
    },
    promiseQuote: 'Your alarm must always wake you up.',
    promiseBody: 'A guaranteed sound starts first, at the exact second. Your music or recording is layered on top only once it’s actually playing. If anything fails, you still wake up.',
    sourcesH: 'Three ways to wake',
    sources: [
      { title: 'Spotify', body: 'One button, your playlists. Premium, optional.' },
      { title: 'Your own voice', body: 'Record a message in the browser. Private to your account.' },
      { title: 'Wake sounds', body: 'Five built-in sounds. No internet needed, ever.' },
    ],
    clockH: 'Clock mode',
    clockBody: 'Sign in, arm the clock, keep the tab open: any phone, tablet or laptop becomes a nightstand alarm with progressive volume and hold-to-stop. Add it to your home screen and it opens like an app.',
    mobileH: 'iPhone & Android',
    mobileBody: 'The native app hands your alarm to the operating system — it rings with the phone locked, in Do Not Disturb, or after a reboot. AlarmKit on iOS 26+, exact alarms on Android 13+.',
    mobileNote: ['In technical validation, not in stores yet — ', 'status', '.'],
    faqH: 'Questions',
    faq: [
      { q: 'Will it ring if Spotify is down?', a: 'Yes. Every alarm starts with a built-in sound before Wake even asks Spotify to play. Spotify only adds — it can never subtract.' },
      { q: 'Does the web version ring with my phone locked?', a: 'No, and we won’t pretend otherwise: browsers can’t ring a closed tab. Clock mode needs the tab open and the screen on. The locked phone is what the native app is for.' },
      { q: 'Do I need Spotify Premium?', a: 'Only to wake up to Spotify. Recordings and Wake sounds work with any account — or no Spotify at all.' },
      { q: 'What does Wake see when I connect Spotify?', a: 'Nothing you type. Sign-in happens on Spotify’s page and tokens stay on the server, never in your browser.' },
      { q: 'Is it free?', a: 'Yes, while we build it in the open. The source is public.' },
    ],
    finalH: 'Private by default',
    finalBody: ['Alarms and recordings live in your account, protected per user. Read the ', 'privacy policy', ' — it’s short.'],
  },
  es: {
    pill: 'Web app en línea · iOS y Android pronto',
    h1a: 'La alarma que suena ',
    h1em: 'siempre',
    h1b: '.',
    lead: 'Spotify, tu propia voz o un sonido simple — y suena aunque todo eso falle.',
    ctaStart: 'Empieza gratis',
    ctaSignIn: 'Iniciar sesión',
    ctaOpen: 'Abrir tus alarmas',
    ctaClock: 'Modo reloj',
    clockSub: 'Próxima alarma · Mañana',
    check: {
      scheduled: 'Alarma programada', scheduledSub: 'suena mientras esta pestaña siga abierta',
      fallback: 'Sonido de respaldo listo', fallbackSub: 'suena pase lo que pase',
      spotify: 'Spotify no disponible', spotifySub: 'tu alarma de respaldo suena igual',
    },
    promiseQuote: 'Tu alarma tiene que despertarte siempre.',
    promiseBody: 'Primero arranca un sonido garantizado, en el segundo exacto. Tu música o grabación se suma encima solo cuando realmente está sonando. Si algo falla, te despiertas igual.',
    sourcesH: 'Tres formas de despertar',
    sources: [
      { title: 'Spotify', body: 'Un botón, tus playlists. Premium, opcional.' },
      { title: 'Tu propia voz', body: 'Graba un mensaje en el navegador. Privado, en tu cuenta.' },
      { title: 'Sonidos Wake', body: 'Cinco sonidos incluidos. Sin internet, siempre.' },
    ],
    clockH: 'Modo reloj',
    clockBody: 'Inicia sesión, arma el reloj y deja la pestaña abierta: cualquier teléfono, tablet o laptop se convierte en un despertador de mesita con volumen progresivo y "mantener para apagar". Agrégalo a tu pantalla de inicio y se abre como una app.',
    mobileH: 'iPhone y Android',
    mobileBody: 'La app nativa le entrega tu alarma al sistema operativo — suena con el teléfono bloqueado, en No molestar o tras un reinicio. AlarmKit en iOS 26+, alarmas exactas en Android 13+.',
    mobileNote: ['En validación técnica, todavía no está en las tiendas — ', 'estado', '.'],
    faqH: 'Preguntas',
    faq: [
      { q: '¿Suena si Spotify está caído?', a: 'Sí. Cada alarma arranca con un sonido incluido antes de que Wake siquiera le pida a Spotify que reproduzca. Spotify solo suma — nunca resta.' },
      { q: '¿La web suena con el teléfono bloqueado?', a: 'No, y no vamos a fingir lo contrario: los navegadores no pueden hacer sonar una pestaña cerrada. El modo reloj necesita la pestaña abierta y la pantalla encendida. Para el teléfono bloqueado está la app nativa.' },
      { q: '¿Necesito Spotify Premium?', a: 'Solo para despertar con Spotify. Las grabaciones y los sonidos Wake funcionan con cualquier cuenta — o sin Spotify.' },
      { q: '¿Qué ve Wake cuando conecto Spotify?', a: 'Nada de lo que escribes. El inicio de sesión pasa en la página de Spotify y los tokens se quedan en el servidor, nunca en tu navegador.' },
      { q: '¿Es gratis?', a: 'Sí, mientras lo construimos en abierto. El código es público.' },
    ],
    finalH: 'Privado por defecto',
    finalBody: ['Tus alarmas y grabaciones viven en tu cuenta, protegidas por usuario. Lee la ', 'política de privacidad', ' — es corta.'],
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

        <div className="check" role="list">
          <div role="listitem"><span className="ok">✓</span> <span>{t.check.scheduled}</span> <span className="dim">{t.check.scheduledSub}</span></div>
          <div role="listitem"><span className="ok">✓</span> <span>{t.check.fallback}</span> <span className="dim">{t.check.fallbackSub}</span></div>
          <div role="listitem"><span className="warn">⚠</span> <span>{t.check.spotify}</span> <span className="dim">{t.check.spotifySub}</span></div>
        </div>
      </section>

      <section className="block promise">
        <p className="big-quote">{t.promiseQuote}</p>
        <p>{t.promiseBody}</p>
      </section>

      <section className="block">
        <h2>{t.sourcesH}</h2>
        <div className="mini-rows">
          {t.sources.map((s) => (
            <div key={s.title} className="mini-row">
              <strong>{s.title}</strong>
              <span>{s.body}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="block" id="mobile">
        <h2>{t.clockH}</h2>
        <p>{t.clockBody}</p>
        <h2 style={{ marginTop: 28 }}>{t.mobileH}</h2>
        <p>{t.mobileBody}</p>
        <p className="dim small">
          {t.mobileNote[0]}<Link href="/status">{t.mobileNote[1]}</Link>{t.mobileNote[2]}
        </p>
      </section>

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

      <section className="block final">
        <h2>{t.finalH}</h2>
        <p>
          {t.finalBody[0]}<Link href="/privacy">{t.finalBody[1]}</Link>{t.finalBody[2]}
        </p>
        <Suspense fallback={null}>
          <HeroActions t={t} />
        </Suspense>
      </section>
    </main>
  );
}
