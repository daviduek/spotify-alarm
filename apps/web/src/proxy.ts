import type { NextRequest } from 'next/server';

import { updateSession } from './lib/supabase/session';

/**
 * Next.js 16 Proxy (formerly middleware). Refreshes the Supabase session on every request and
 * guards /app and /api/spotify. Skips static assets and audio files.
 */
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sounds/|robots.txt|.*\\.(?:png|jpg|jpeg|svg|ico|webp|wav|mp3)$).*)'],
};
