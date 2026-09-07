import Link from 'next/link';
import { Suspense } from 'react';

import { getCurrentUser } from '../lib/supabase/server';

async function HeroActions() {
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    return (
      <div className="cta-row">
        <Link href="/app" className="btn btn-primary btn-lg">Open your alarms</Link>
        <Link href="/app/clock" className="btn btn-ghost btn-lg">Clock mode</Link>
      </div>
    );
  }
  return (
    <div className="cta-row">
      <Link href="/signup" className="btn btn-primary btn-lg">Get started — it&apos;s free</Link>
      <Link href="/login" className="btn btn-ghost btn-lg">Sign in</Link>
    </div>
  );
}

const STEPS = [
  { n: '1', title: 'Set the time', body: 'Pick the days, a label, snooze and how gently it should wake you. Takes ten seconds.' },
  { n: '2', title: 'Choose what you hear', body: 'A Spotify playlist, a message in your own voice, or one of five built-in wake sounds.' },
  { n: '3', title: 'Sleep', body: 'Wake starts a guaranteed sound first, then layers your music or recording on top when it can.' },
];

const SOURCES = [
  { title: 'Spotify', tag: 'Optional · Premium', body: 'One button connects your account on Spotify’s own page. Pick a playlist, album or track; Wake tries to start it and falls back cleanly if it can’t.' },
  { title: 'Your own voice', tag: 'Private', body: 'Record a wake-up message right in the browser. It lives in your account, encrypted at rest, and plays the moment your alarm fires.' },
  { title: 'Wake sounds', tag: 'Always on', body: 'Sunrise, Soft, Piano, Birds, Classic. Bundled with the app, so they ring with no internet, no account issues, no excuses.' },
];

const FAQ = [
  { q: 'Will it really ring if Spotify is down?', a: 'Yes. Every alarm starts with a built-in sound before Wake even asks Spotify to play. Spotify only ever adds to the alarm — it can never subtract from it.' },
  { q: 'Does the web version work with my phone locked?', a: 'No, and we won’t pretend otherwise. Browsers can’t ring a closed tab. Clock mode keeps the tab open and the screen awake — great for a laptop or tablet on the nightstand. For a locked phone, that’s what the native app is for.' },
  { q: 'Do I need Spotify Premium?', a: 'Only to wake up to Spotify. Spotify limits remote playback to Premium accounts. Recordings and Wake sounds work with any account — or no Spotify at all.' },
  { q: 'What does Wake see when I connect Spotify?', a: 'Nothing you type. Sign-in happens on Spotify’s page; Wake receives an access token that stays on the server, never in your browser. Disconnect at any time from Settings.' },
  { q: 'Is it free?', a: 'Yes, while we build it in the open. The source is public.' },
];

export default function HomePage() {
  return (
    <main className="landing">
      {/* Hero */}
      <section className="hero">
        <span className="pill">Web app live · iOS &amp; Android in technical validation</span>
        <h1>The alarm that <em>always</em> rings.</h1>
        <p className="lead">
          Wake up to Spotify, to your own voice, or to a simple sound — on a schedule that never depends on the internet being up, your account working, or Spotify feeling like it.
        </p>
        <Suspense fallback={<div className="cta-row"><Link href="/signup" className="btn btn-primary btn-lg">Get started — it&apos;s free</Link><Link href="/login" className="btn btn-ghost btn-lg">Sign in</Link></div>}>
          <HeroActions />
        </Suspense>

        <div className="hero-clock" aria-hidden="true">
          <div className="hero-clock-time">07:00</div>
          <div className="hero-clock-sub">Next alarm · Tomorrow · Morning</div>
        </div>

        <div className="check" role="list" aria-label="Alarm readiness example">
          <div role="listitem"><span className="ok">✓</span> <span>Alarm scheduled</span> <span className="dim">rings while this tab stays open</span></div>
          <div role="listitem"><span className="ok">✓</span> <span>Fallback sound ready</span> <span className="dim">Sunrise · plays no matter what</span></div>
          <div role="listitem"><span className="ok">✓</span> <span>Progressive wake-up</span> <span className="dim">Gentle · 5% → 50% over 5 min</span></div>
          <div role="listitem"><span className="warn">⚠</span> <span>Spotify unavailable</span> <span className="dim">your fallback alarm still rings</span></div>
        </div>
      </section>

      {/* Promise */}
      <section className="block promise">
        <h2>One promise</h2>
        <p className="big-quote">Your alarm must always wake you up.</p>
        <p>
          Most “music alarm” apps make the alarm depend on the music. Wake does the opposite: a guaranteed sound starts first, at the exact second, and your playlist or recording is
          layered on top only once it&apos;s actually playing. If anything fails — Spotify, Wi-Fi, an expired login — you still wake up.
        </p>
      </section>

      {/* How it works */}
      <section className="block" id="how">
        <h2>How it works</h2>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.n} className="step">
              <span className="step-n">{s.n}</span>
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
        <h2>Three ways to wake</h2>
        <div className="grid">
          {SOURCES.map((s) => (
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
        <h2>Built for sleeping people</h2>
        <div className="feature-list">
          <div><strong>Progressive volume.</strong> Gentle, Normal or Strong presets ramp the sound over minutes instead of blasting you awake.</div>
          <div><strong>Hold to stop.</strong> A one-second hold, not a tap you can dismiss half-asleep. Snooze is a deliberate, separate button.</div>
          <div><strong>Readiness check.</strong> Before you sleep, Wake tells you exactly what will ring and what might not — no surprises at 7 am.</div>
          <div><strong>Syncs across devices.</strong> Alarms and recordings live in your account. Sign in anywhere and they&apos;re there.</div>
        </div>
      </section>

      {/* Clock mode */}
      <section className="block">
        <h2>Clock mode</h2>
        <p>
          Turn any laptop, tablet or phone into a nightstand clock: sign in, arm the clock, keep the tab open. Wake keeps the screen awake, rings at the exact time with a
          full-screen alarm, and fades in your music or recording. Add it to your home screen and it opens like an app.
        </p>
        <p className="dim small">
          Honest limit: a browser can&apos;t ring a closed tab or a locked phone. Clock mode is for a device that stays on. For the locked-phone case, read on.
        </p>
      </section>

      {/* Mobile */}
      <section className="block" id="mobile">
        <h2>iPhone &amp; Android — the native app</h2>
        <p>
          The mobile app hands your alarm to the operating system itself, so it rings with the phone locked, in Do Not Disturb, or after a reboot — the same way the built-in
          clock does.
        </p>
        <div className="grid two">
          <div className="card">
            <span className="card-tag">iOS 26+</span>
            <h3>AlarmKit</h3>
            <p>Apple&apos;s alarm framework: full-screen alerts over the lock screen, protected from Focus modes and silent switch. Requires iOS 26 or newer.</p>
          </div>
          <div className="card">
            <span className="card-tag">Android 13+</span>
            <h3>Exact alarms</h3>
            <p>System alarm clock scheduling, a full-screen alarm over the lock screen, restored after reboot, doze-proof.</p>
          </div>
        </div>
        <p className="dim small">
          Status: in technical validation on real devices. Not on the App Store or Google Play yet. Follow progress on the <Link href="/status">status page</Link>.
        </p>
      </section>

      {/* FAQ */}
      <section className="block" id="faq">
        <h2>Questions</h2>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Privacy + CTA */}
      <section className="block final">
        <h2>Private by default</h2>
        <p>
          Your alarms and recordings are yours: row-level security in the database, a private storage bucket, and Spotify tokens that never leave the server. Read the{' '}
          <Link href="/privacy">privacy policy</Link> — it&apos;s short.
        </p>
        <Suspense fallback={null}>
          <HeroActions />
        </Suspense>
      </section>
    </main>
  );
}
