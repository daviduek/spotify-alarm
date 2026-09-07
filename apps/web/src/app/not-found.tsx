import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="auth-main">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h1>Page not found</h1>
        <p className="dim">That link doesn&apos;t exist. Your alarms are safe.</p>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <Link href="/" className="btn btn-ghost">Home</Link>
          <Link href="/app" className="btn btn-primary">Open app</Link>
        </div>
      </div>
    </main>
  );
}
