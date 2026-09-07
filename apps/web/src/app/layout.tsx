import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import './globals.css';
import { getCurrentUser } from '../lib/supabase/server';
import { env } from '../lib/env';

const SITE_URL = env.appUrl || 'https://wakealarm.vercel.app';
const TITLE = 'Wake — the alarm that always rings';
const DESCRIPTION = 'Wake up to Spotify, your own voice, or a simple alarm. The alarm always rings; music makes it better, never less reliable.';

export const metadata: Metadata = {
  title: { default: TITLE, template: '%s · Wake' },
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  applicationName: 'Wake',
  keywords: ['alarm clock', 'Spotify alarm', 'wake up to music', 'progressive volume alarm', 'record your own alarm'],
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', url: SITE_URL, siteName: 'Wake', images: [{ url: '/opengraph-image', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon', apple: '/apple-icon' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Wake' },
};

export const viewport: Viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

/** Auth-aware nav link, isolated in Suspense so public pages stay streamable. */
async function SessionNav() {
  const user = await getCurrentUser().catch(() => null);
  return user ? <Link href="/app" className="nav-cta">Open app</Link> : <Link href="/login">Sign in</Link>;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="site">
            <Link href="/" className="brand" aria-label="Wake home">
              <span className="brand-dot" aria-hidden="true" />Wake
            </Link>
            <nav aria-label="Main">
              <Link href="/#how">How it works</Link>
              <Link href="/#mobile">Mobile</Link>
              <Link href="/status">Status</Link>
              <Suspense fallback={<Link href="/login">Sign in</Link>}>
                <SessionNav />
              </Suspense>
            </nav>
          </header>
          {children}
          <footer className="site">
            <span>© {new Date().getFullYear()} Wake. Working title — not affiliated with Spotify AB.</span>
            <span>
              <a href="https://github.com/daviduek/spotify-alarm">Source</a> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
            </span>
          </footer>
        </div>
      </body>
    </html>
  );
}
