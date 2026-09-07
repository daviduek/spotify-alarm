export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <span className="pill">iOS 26 · Android 14+ · in technical validation</span>
        <h1>
          Wake up to what you love.
          <br />
          Or just wake up.
        </h1>
        <p className="lead">
          Spotify. Your own voice. A simple alarm. Whatever you choose, the alarm itself is run by the operating system — so it rings even when Spotify,
          the internet, or our servers don&apos;t.
        </p>
        <p className="clock" aria-label="Next alarm 07:00 tomorrow">
          07:00
          <small>Next alarm · Tomorrow</small>
        </p>
        <div className="check" role="list" aria-label="Alarm readiness">
          <div role="listitem">
            <span className="ok">✓</span> <span>Alarm scheduled</span> <span className="dim">system alarm, works locked and offline</span>
          </div>
          <div role="listitem">
            <span className="ok">✓</span> <span>Fallback sound ready</span> <span className="dim">Sunrise · plays no matter what</span>
          </div>
          <div role="listitem">
            <span className="ok">✓</span> <span>Progressive wake-up</span> <span className="dim">Gentle · 5% → 50% over 5 min</span>
          </div>
          <div role="listitem">
            <span className="warn">⚠</span> <span>Spotify unavailable</span> <span className="dim">your fallback alarm will still ring</span>
          </div>
        </div>
      </section>

      <section className="block">
        <h2>One promise</h2>
        <p>
          <strong style={{ color: 'var(--text)' }}>Your alarm must always wake you up.</strong> Spotify makes it better, but never makes it less reliable. Wake
          schedules a native system alarm (AlarmKit on iOS, AlarmManager on Android) with a bundled fallback sound, then layers your music or your recording on
          top when they are available.
        </p>
      </section>

      <section className="block">
        <h2>Three ways to wake</h2>
        <div className="grid">
          <div className="card">
            <h3>Spotify</h3>
            <p>Pick a playlist, album or track. Wake tries to start it at alarm time and hands over smoothly from the fallback sound.</p>
          </div>
          <div className="card">
            <h3>Your own voice</h3>
            <p>Record a wake-up message. It stays on your device and plays when the alarm fires.</p>
          </div>
          <div className="card">
            <h3>Wake sounds</h3>
            <p>Sunrise, Soft, Piano, Birds, Classic. Bundled, offline, and always the safety net.</p>
          </div>
        </div>
      </section>

      <section className="block">
        <h2>Progressive volume</h2>
        <p>Gentle, Normal or Strong presets ramp the volume over minutes instead of shocking you awake. Custom curves if you want them.</p>
      </section>

      <section className="block">
        <h2>Local-first, private by default</h2>
        <p>
          No account needed. Alarms, recordings and settings live on your phone. Spotify sign-in uses Spotify&apos;s official OAuth flow (PKCE) — Wake never
          sees your password and never stores tokens outside the system keychain.
        </p>
      </section>
    </main>
  );
}
