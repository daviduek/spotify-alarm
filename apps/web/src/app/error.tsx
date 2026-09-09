'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import type { Locale } from '../lib/i18n';
import { useLocale } from '../lib/i18n/client';

const STR: Record<Locale, { title: string; body: string; reference: string; tryAgain: string; openApp: string }> = {
  en: {
    title: 'Something went wrong',
    body: 'Wake hit an unexpected error. Your alarms and recordings are not affected.',
    reference: 'Reference',
    tryAgain: 'Try again',
    openApp: 'Open app',
  },
  es: {
    title: 'Algo salió mal',
    body: 'Wake encontró un error inesperado. Tus alarmas y grabaciones no se ven afectadas.',
    reference: 'Referencia',
    tryAgain: 'Reintentar',
    openApp: 'Abrir app',
  },
};

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useLocale();
  const t = STR[locale];
  useEffect(() => {
    console.error('[wake] unhandled error', error);
  }, [error]);
  return (
    <main className="auth-main">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h1>{t.title}</h1>
        <p className="dim">{t.body}</p>
        {error.digest ? <p className="dim" style={{ fontSize: 12 }}>{t.reference}: {error.digest}</p> : null}
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => reset()}>{t.tryAgain}</button>
          <Link href="/app" className="btn btn-ghost">{t.openApp}</Link>
        </div>
      </div>
    </main>
  );
}
