import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { exchangeCode, fetchMe, publicOrigin, saveConnection } from '../../../../lib/spotify/server';
import { getCurrentUser } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const origin = publicOrigin(request.url);
  const settings = (q: string) => NextResponse.redirect(`${origin}/app/settings?${q}`);
  const { searchParams } = new URL(request.url);
  const error = searchParams.get('error');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${origin}/login?next=/app/settings`);
  if (error) return settings(`spotify=denied`);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('sp_oauth_state')?.value;
  const verifier = cookieStore.get('sp_oauth_verifier')?.value;
  cookieStore.delete('sp_oauth_state');
  cookieStore.delete('sp_oauth_verifier');
  if (!code || !state || !expectedState || state !== expectedState || !verifier) return settings('spotify=state_mismatch');

  try {
    const token = await exchangeCode(code, `${origin}/api/spotify/callback`, verifier);
    if (!token.refresh_token) {
      console.error('[spotify/callback] no refresh_token in response');
      return settings('spotify=exchange_failed');
    }
    const me = await fetchMe(token.access_token);
    await saveConnection({
      user_id: user.id,
      spotify_user_id: me?.id ?? null,
      display_name: me?.display_name ?? null,
      product: me?.product ?? null,
      country: me?.country ?? null,
      scope: token.scope ?? null,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    });
    return settings('spotify=connected');
  } catch (err) {
    console.error('[spotify/callback]', err instanceof Error ? err.message : err);
    return settings('spotify=exchange_failed');
  }
}
