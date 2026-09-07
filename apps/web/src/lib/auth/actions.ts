'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { env, isSupabaseConfigured } from '../env';
import { createSupabaseServerClient } from '../supabase/server';

export type AuthActionState = { error?: string; message?: string };

async function originFromRequest(): Promise<string> {
  if (env.appUrl) return env.appUrl.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : '';
}

export async function signInWithPassword(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) return { error: 'Wake is not configured yet. Add Supabase environment variables in Vercel.' };
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/app');
  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error.message) };
  redirect(next.startsWith('/') ? next : '/app');
}

export async function signUpWithPassword(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) return { error: 'Wake is not configured yet. Add Supabase environment variables in Vercel.' };
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
  if (!isSupabaseConfigured()) return { error: 'Wake is not configured yet. Add Supabase environment variables in Vercel.' };
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Enter your email.' };
  const supabase = await createSupabaseServerClient();
  const origin = await originFromRequest();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) return { error: friendly(error.message) };
  return { message: 'Magic link sent. Check your email.' };
}

function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.';
  if (/already registered/i.test(message)) return 'That email already has an account. Sign in instead.';
  if (/rate limit/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
  return message;
}
