import { NextResponse, type NextRequest } from 'next/server';

import { deleteConnection, publicOrigin } from '../../../../lib/spotify/server';
import { getCurrentUser } from '../../../../lib/supabase/server';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  await deleteConnection(user.id);
  return NextResponse.redirect(`${publicOrigin(request.url)}/app/settings?spotify=disconnected`, { status: 303 });
}
