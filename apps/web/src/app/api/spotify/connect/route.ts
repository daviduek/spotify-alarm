import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { env, SPOTIFY_SCOPES, isSpotifyConfigured } from '../../../../lib/env';
import { AUTHORIZE_URL, pkceChallenge, publicOrigin, randomToken } from '../../../../lib/spotify/server';
import { getCurrentUser } from '../../../../lib/supabase/server';

/** One-button connect: builds the Spotify consent URL (PKCE) and redirects. State + verifier in short-lived cookies. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login?next=/app/settings', request.url));
  if (!isSpotifyConfigured()) return NextResponse.redirect(new URL('/app/settings?spotify=not_configured', request.url));

  const origin = publicOrigin(request.url);
  const redirectUri = `${origin}/api/spotify/callback`;
  const state = randomToken(16);
  const verifier = randomToken(48);
  const challenge = await pkceChallenge(verifier);

  const cookieStore = await cookies();
  const secure = origin.startsWith('https://');
  const opts = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: 600 };
  cookieStore.set('sp_oauth_state', state, opts);
  cookieStore.set('sp_oauth_verifier', verifier, opts);

  const params = new URLSearchParams({
    client_id: env.spotifyClientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'false',
  });
  return NextResponse.redirect(`${AUTHORIZE_URL}?${params.toString()}`);
}
