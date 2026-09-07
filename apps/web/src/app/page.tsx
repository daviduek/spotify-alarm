import Link from 'next/link';

import { getCurrentUser } from '../lib/supabase/server';

export default async function HomePage() {
  const user = await getCurrentUser().catch(() => null);
  const primaryHref = user ? '/app' : '/signup';
  const primaryLabel = user ? 'Open your alarms' : 'Get started free';

  return (
    <main>
      <section className="hero">
        <span className="pill">Web app · iOS &amp; Android in technical validation</span>
        <h1>Wake up to what you love.<br />Or just wake up.</h1>
        <p className="lead">
          Spotify, your own voice, or a simple alarm. Whatever you choose, the alarm is built to ring even when Spotify, the internet, or your account don&apos;t.
        </p>
        <div className="cta-row">
          <Link href={primaryHref} className="btn btn-primary">{primaryLabel}</Link>
          {!user ? <Link href="/login" className="btn btn-ghost">Sign in</Link> : <Link href="/app/clock" className="btn btn-ghost">Clock mode</Link>}
        </div>
        <p className="clock" aria-label="Next alarm 07:00 tomorrow">07:00<small>Next alarm · Tomorrow</small></p>
        <div className="check" role="list" aria-label="Alarm readiness">
          <div role="listitem"><span className="ok">✓</span> <span>Alarm scheduled</span> <span className="dim">rings while this tab stays open</span></div>
          <div role="listitem"><span className="ok">✓</span> <span>Fallback sound ready</span> <span className="dim">Sunrise · plays no matter what</span></div>
          <div role="listitem"><span className="ok">✓</span> <span>Progressive wake-up</span> <span className="dim">Gentle · 5% → 50% over 5 min</span></div>
          <div role="listitem"><span className="warn">⚠</span> <span>Spotify unavailable</span> <span className="dim">your fallback alarm still rings</span></div>
        </div>
      </section>

      <section className="block">
        <h2>One promise</h2>
        <p><strong style={{ color: 'var(--text)' }}>Your alarm must always wake you up.</strong> Spotify makes it better, but never makes it less reliable. Wake starts a guaranteed fallback sound first, then layers your music or your recording on top when they&apos;re available.</p>
      </section>

      <section className="block">
        <h2>Three ways to wake</h2>
        <div className="grid">
          <div className="card"><h3>Spotify</h3><p>Connect once with a single button. Pick a playlist, album or track — Wake tries to start it and falls back cleanly.</p></div>
          <div className="card"><h3>Your own voice</h3><p>Record a wake-up message in the browser. It&apos;s stored privately in your account and plays when the alarm fires.</p></div>
          <div className="card"><h3>Wake sounds</h3><p>Sunrise, Soft, Piano, Birds, Classic. Bundled and always the safety net.</p></div>
        </div>
      </section>

      <section className="block">
        <h2>Clock mode</h2>
        <p>Turn any laptop, tablet or phone into a nightstand clock: sign in, arm the clock, keep the tab open. Wake rings at the alarm time with a full-screen, hold-to-stop alarm. For a locked phone, the native mobile app is in technical validation — see <Link href="/status">status</Link>.</p>
      </section>

      <section className="block">
        <h2>Private by default</h2>
        <p>Your alarms and recordings live in your account with row-level security. Spotify sign-in uses Spotify&apos;s official flow — Wake never sees your password, and tokens never reach the browser.</p>
        <div className="cta-row"><Link href={primaryHref} className="btn btn-primary">{primaryLabel}</Link></div>
      </section>
    </main>
  );
}
