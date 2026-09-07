import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '../../../lib/supabase/server';

/** Exchanges the email-confirmation / magic-link / OAuth code for a session, then lands in /app. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app';
  const error = searchParams.get('error_description') ?? searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  }
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`);
    }
  }
  return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/app'}`);
}
