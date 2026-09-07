import type { Metadata, Viewport } from 'next';
import Link from 'next/link';

import './globals.css';
import { getCurrentUser } from '../lib/supabase/server';

export const metadata: Metadata = {
  title: 'Wake — a reliable alarm clock with intelligent audio',
  description: 'Wake up to Spotify, your own voice, or a simple alarm. The alarm always rings; Spotify makes it better, never less reliable.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://wake.example.com'),
  openGraph: { title: 'Wake', description: 'A reliable alarm clock with intelligent audio sources.', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="site">
            <Link href="/" className="brand" aria-label="Wake home">Wake</Link>
            <nav aria-label="Main">
              <Link href="/status">Status</Link>
              <Link href="/privacy">Privacy</Link>
              {user ? <Link href="/app">Open app</Link> : <Link href="/login">Sign in</Link>}
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
