import { NextResponse } from 'next/server';

import { isSpotifyConfigured, isSupabaseConfigured } from '../../../lib/env';

export function GET() {
  return NextResponse.json({
    ok: true,
    supabaseConfigured: isSupabaseConfigured(),
    spotifyConfigured: isSpotifyConfigured(),
    time: new Date().toISOString(),
  });
}
