'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[wake] unhandled error', error);
  }, [error]);
  return (
    <main className="auth-main">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p className="dim">Wake hit an unexpected error. Your alarms and recordings are not affected.</p>
        {error.digest ? <p className="dim" style={{ fontSize: 12 }}>Reference: {error.digest}</p> : null}
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => reset()}>Try again</button>
          <Link href="/app" className="btn btn-ghost">Open app</Link>
        </div>
      </div>
    </main>
  );
}
