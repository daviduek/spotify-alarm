import Link from 'next/link';

import type { Locale } from '../lib/i18n';
import { getLocale } from '../lib/i18n/server';

const STR: Record<Locale, { title: string; body: string; home: string; openApp: string }> = {
  en: {
    title: 'Page not found',
    body: "That link doesn't exist. Your alarms are safe.",
    home: 'Home',
    openApp: 'Open app',
  },
  es: {
    title: 'Página no encontrada',
    body: 'Ese enlace no existe. Tus alarmas están a salvo.',
    home: 'Inicio',
    openApp: 'Abrir app',
  },
};

export default async function NotFound() {
  const locale = await getLocale();
  const t = STR[locale];
  return (
    <main className="auth-main">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h1>{t.title}</h1>
        <p className="dim">{t.body}</p>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <Link href="/" className="btn btn-ghost">{t.home}</Link>
          <Link href="/app" className="btn btn-primary">{t.openApp}</Link>
        </div>
      </div>
    </main>
  );
}
