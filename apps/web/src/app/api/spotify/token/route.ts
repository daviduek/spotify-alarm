import { NextResponse } from 'next/server';

import { SpotifyServerError, getFreshAccessToken } from '../../../../lib/spotify/server';
import { getCurrentUser } from '../../../../lib/supabase/server';

/** Short-lived access token for the Web Playback SDK. Never returns the refresh token. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  try {
    const { accessToken, expiresAt } = await getFreshAccessToken(user.id);
    return NextResponse.json({ accessToken, expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SpotifyServerError) {
      const status = error.code === 'not_connected' ? 404 : error.code === 'revoked' ? 401 : error.code === 'not_configured' ? 503 : 502;
      if (status >= 500) console.error('[spotify/token]', error.message);
      return NextResponse.json({ error: error.code }, { status });
    }
    console.error('[spotify/token]', error);
    return NextResponse.json({ error: 'unknown' }, { status: 500 });
  }
}
