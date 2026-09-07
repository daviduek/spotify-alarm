'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { env, isSupabaseConfigured } from '../env';
import { createSupabaseServerClient } from '../supabase/server';

export type AuthActionState = { error?: string; message?: string };

const NOT_CONFIGURED = 'Wake is not configured yet. Add Supabase environment variables in Vercel.';

async function originFromRequest(): Promise<string> {
  if (env.appUrl) return env.appUrl.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : '';
}

/** Only same-origin absolute paths are allowed as post-auth destinations (no `//evil`, no `/\evil`). */
export async function safeNext(next: string | null | undefined, fallback = '/app'): Promise<string> {
  if (!next) return fallback;
  return /^\/(?![/\\])/.test(next) ? next : fallback;
}

export async function signInWithPassword(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = await safeNext(String(formData.get('next') ?? ''));
  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error.message) };
  redirect(next);
}

export async function signUpWithPassword(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('display_name') ?? '').trim();
  if (!email || password.length < 8) return { error: 'Use a valid email and a password of at least 8 characters.' };

  const supabase = await createSupabaseServerClient();
  const origin = await originFromRequest();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || undefined }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: friendly(error.message) };
  if (data.session) redirect('/app');
  return { message: 'Check your inbox to confirm your email, then sign in.' };
}

export async function sendMagicLink(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Enter your email.' };
  const supabase = await createSupabaseServerClient();
  const origin = await originFromRequest();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) return { error: friendly(error.message) };
  return { message: 'Magic link sent. Check your email.' };
}

export async function requestPasswordReset(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Enter your email.' };
  const supabase = await createSupabaseServerClient();
  const origin = await originFromRequest();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/auth/update-password` });
  if (error) return { error: friendly(error.message) };
  return { message: 'If that email has an account, a reset link is on its way.' };
}

export async function updatePassword(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) return { error: 'Use at least 8 characters.' };
  if (password !== confirm) return { error: "Passwords don't match." };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your reset link expired. Request a new one.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendly(error.message) };
  redirect('/app?password=updated');
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/already registered/i.test(message)) return 'That email already has an account. Sign in instead.';
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  if (/email not confirmed/i.test(message)) return 'Confirm your email first — check your inbox for the link.';
  if (/code verifier|pkce/i.test(message)) return 'Open the email link in the same browser you signed up from, or sign in with your password.';
  if (/same password/i.test(message)) return 'Choose a password different from your current one.';
  return message;
}
