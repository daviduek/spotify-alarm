import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import './globals.css';
import { LangSwitch } from '../components/LangSwitch';
import { env } from '../lib/env';
import type { Locale } from '../lib/i18n';
import { LocaleProvider } from '../lib/i18n/client';
import { getLocale } from '../lib/i18n/server';
import { getCurrentUser } from '../lib/supabase/server';

const SITE_URL = env.appUrl || 'https://wakealarm.vercel.app';

const META: Record<Locale, { title: string; description: string }> = {
  en: {
    title: 'Wake — the alarm that always rings',
    description: 'Wake up to Spotify, your own voice, or a simple alarm. The alarm always rings; music makes it better, never less reliable.',
  },
  es: {
    title: 'Wake — la alarma que siempre suena',
    description: 'Despierta con Spotify, con tu propia voz o con una alarma simple. La alarma siempre suena; la música la mejora, nunca la hace menos confiable.',
  },
};

const STR: Record<Locale, { how: string; mobile: string; status: string; signIn: string; openApp: string; notAffiliated: string; source: string; privacy: string; terms: string }> = {
  en: { how: 'FAQ', mobile: 'Mobile', status: 'Status', signIn: 'Sign in', openApp: 'Open app', notAffiliated: 'Working title — not affiliated with Spotify AB.', source: 'Source', privacy: 'Privacy', terms: 'Terms' },
  es: { how: 'FAQ', mobile: 'Móvil', status: 'Estado', signIn: 'Iniciar sesión', openApp: 'Abrir app', notAffiliated: 'Nombre provisorio — sin afiliación con Spotify AB.', source: 'Código', privacy: 'Privacidad', terms: 'Términos' },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const { title, description } = META[locale];
  return {
    title: { default: title, template: '%s · Wake' },
    description,
    metadataBase: new URL(SITE_URL),
    applicationName: 'Wake',
    keywords: ['alarm clock', 'Spotify alarm', 'wake up to music', 'despertador', 'alarma con Spotify', 'progressive volume alarm'],
    openGraph: { title, description, type: 'website', url: SITE_URL, siteName: 'Wake', images: [{ url: '/opengraph-image', width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
    manifest: '/manifest.webmanifest',
    icons: { icon: '/icon', apple: '/apple-icon' },
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Wake' },
  };
}

export const viewport: Viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

/** Auth-aware nav link, isolated in Suspense so public pages stay streamable. */
async function SessionNav({ locale }: { locale: Locale }) {
  const user = await getCurrentUser().catch(() => null);
  return user ? <Link href="/app" className="nav-cta">{STR[locale].openApp}</Link> : <Link href="/login">{STR[locale].signIn}</Link>;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = STR[locale];
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider locale={locale}>
          <div className="container">
            <header className="site">
              <Link href="/" className="brand" aria-label="Wake home">
                <span className="brand-dot" aria-hidden="true" />Wake
              </Link>
              <nav aria-label="Main">
                <Link href="/#faq">{t.how}</Link>
                <Link href="/#mobile">{t.mobile}</Link>
                <Link href="/status">{t.status}</Link>
                <Suspense fallback={<Link href="/login">{t.signIn}</Link>}>
                  <SessionNav locale={locale} />
                </Suspense>
              </nav>
            </header>
            {children}
            <footer className="site">
              <span>© {new Date().getFullYear()} Wake. {t.notAffiliated}</span>
              <span>
                <LangSwitch /> · <a href="https://github.com/daviduek/spotify-alarm">{t.source}</a> · <Link href="/privacy">{t.privacy}</Link> · <Link href="/terms">{t.terms}</Link>
              </span>
            </footer>
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
