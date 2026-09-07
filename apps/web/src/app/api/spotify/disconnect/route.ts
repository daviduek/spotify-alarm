import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient, getCurrentUser } from '../../../../lib/supabase/server';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  await supabase.from('spotify_connections').delete().eq('user_id', user.id);
  return NextResponse.redirect(new URL('/app/settings?spotify=disconnected', request.url), { status: 303 });
}
