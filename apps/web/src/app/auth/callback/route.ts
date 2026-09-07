import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { safeNext } from '../../../lib/auth/actions';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

/**
 * Lands email-confirmation, magic-link, password-reset and OAuth flows.
 * Supports both the PKCE `code` flow and `token_hash`+`type` links (which work when the email is
 * opened on a different device/browser than the one that requested it).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = await safeNext(searchParams.get('next'), type === 'recovery' ? '/auth/update-password' : '/app');
  const error = searchParams.get('error_description') ?? searchParams.get('error');

  const toLogin = (message: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  if (error) return toLogin(error);

  const supabase = await createSupabaseServerClient();
  if (tokenHash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (otpError) return toLogin(otpError.message);
  } else if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      const msg = /code verifier|pkce/i.test(exchangeError.message)
        ? 'Open the email link in the same browser you started from, or sign in with your password.'
        : exchangeError.message;
      return toLogin(msg);
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
