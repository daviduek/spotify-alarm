import { NextResponse } from 'next/server';

import { SpotifyServerError, getFreshAccessToken } from '../../../../lib/spotify/server';
import { createSupabaseServerClient, getCurrentUser } from '../../../../lib/supabase/server';

/** Short-lived access token for the Web Playback SDK. Never returns the refresh token. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  try {
    const supabase = await createSupabaseServerClient();
    const { accessToken, expiresAt } = await getFreshAccessToken(supabase, user.id);
    return NextResponse.json({ accessToken, expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof SpotifyServerError) {
      const status = error.code === 'not_connected' ? 404 : error.code === 'revoked' ? 401 : 502;
      return NextResponse.json({ error: error.code }, { status });
    }
    return NextResponse.json({ error: 'unknown' }, { status: 500 });
  }
}
