'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { env, isSupabaseConfigured } from '../env';
import type { Locale } from '../i18n';
import { getLocale } from '../i18n/server';
import { createSupabaseServerClient } from '../supabase/server';

export type AuthActionState = { error?: string; message?: string };

const MSG: Record<Locale, {
  notConfigured: string;
  enterEmailPassword: string;
  invalidSignup: string;
  checkInbox: string;
  enterEmail: string;
  magicLinkSent: string;
  resetOnItsWay: string;
  atLeast8: string;
  passwordsDontMatch: string;
  resetExpired: string;
  wrongCredentials: string;
  alreadyRegistered: string;
  rateLimit: string;
  emailNotConfirmed: string;
  pkce: string;
  samePassword: string;
}> = {
  en: {
    notConfigured: 'Wake is not configured yet. Add Supabase environment variables in Vercel.',
    enterEmailPassword: 'Enter your email and password.',
    invalidSignup: 'Use a valid email and a password of at least 8 characters.',
    checkInbox: 'Check your inbox to confirm your email, then sign in.',
    enterEmail: 'Enter your email.',
    magicLinkSent: 'Magic link sent. Check your email.',
    resetOnItsWay: 'If that email has an account, a reset link is on its way.',
    atLeast8: 'Use at least 8 characters.',
    passwordsDontMatch: "Passwords don't match.",
    resetExpired: 'Your reset link expired. Request a new one.',
    wrongCredentials: 'Wrong email or password.',
    alreadyRegistered: 'That email already has an account. Sign in instead.',
    rateLimit: 'Too many attempts. Wait a minute and try again.',
    emailNotConfirmed: 'Confirm your email first — check your inbox for the link.',
    pkce: 'Open the email link in the same browser you signed up from, or sign in with your password.',
    samePassword: 'Choose a password different from your current one.',
  },
  es: {
    notConfigured: 'Wake todavía no está configurado. Agrega las variables de entorno de Supabase en Vercel.',
    enterEmailPassword: 'Ingresa tu email y contraseña.',
    invalidSignup: 'Usa un email válido y una contraseña de al menos 8 caracteres.',
    checkInbox: 'Revisa tu bandeja de entrada para confirmar tu email y luego inicia sesión.',
    enterEmail: 'Ingresa tu email.',
    magicLinkSent: 'Enlace mágico enviado. Revisa tu email.',
    resetOnItsWay: 'Si ese email tiene una cuenta, un enlace de restablecimiento está en camino.',
    atLeast8: 'Usa al menos 8 caracteres.',
    passwordsDontMatch: 'Las contraseñas no coinciden.',
    resetExpired: 'Tu enlace de restablecimiento expiró. Solicita uno nuevo.',
    wrongCredentials: 'Email o contraseña incorrectos.',
    alreadyRegistered: 'Ese email ya tiene una cuenta. Inicia sesión.',
    rateLimit: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.',
    emailNotConfirmed: 'Primero confirma tu email — busca el enlace en tu bandeja de entrada.',
    pkce: 'Abre el enlace del email en el mismo navegador donde te registraste, o inicia sesión con tu contraseña.',
    samePassword: 'Elige una contraseña distinta de la actual.',
  },
};

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
  const locale = await getLocale();
  const t = MSG[locale];
  if (!isSupabaseConfigured()) return { error: t.notConfigured };
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = await safeNext(String(formData.get('next') ?? ''));
  if (!email || !password) return { error: t.enterEmailPassword };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error.message, locale) };
  redirect(next);
}

export async function signUpWithPassword(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const locale = await getLocale();
  const t = MSG[locale];
  if (!isSupabaseConfigured()) return { error: t.notConfigured };
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const displayName = String(formData.get('display_name') ?? '').trim();
  if (!email || password.length < 8) return { error: t.invalidSignup };

  const supabase = await createSupabaseServerClient();
  const origin = await originFromRequest();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || undefined }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: friendly(error.message, locale) };
  if (data.session) redirect('/app');
  return { message: t.checkInbox };
}

export async function sendMagicLink(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const locale = await getLocale();
  const t = MSG[locale];
  if (!isSupabaseConfigured()) return { error: t.notConfigured };
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: t.enterEmail };
  const supabase = await createSupabaseServerClient();
  const origin = await originFromRequest();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) return { error: friendly(error.message, locale) };
  return { message: t.magicLinkSent };
}

export async function requestPasswordReset(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const locale = await getLocale();
  const t = MSG[locale];
  if (!isSupabaseConfigured()) return { error: t.notConfigured };
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: t.enterEmail };
  const supabase = await createSupabaseServerClient();
  const origin = await originFromRequest();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/auth/update-password` });
  if (error) return { error: friendly(error.message, locale) };
  return { message: t.resetOnItsWay };
}

export async function updatePassword(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const locale = await getLocale();
  const t = MSG[locale];
  if (!isSupabaseConfigured()) return { error: t.notConfigured };
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) return { error: t.atLeast8 };
  if (password !== confirm) return { error: t.passwordsDontMatch };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t.resetExpired };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendly(error.message, locale) };
  redirect('/app?password=updated');
}

function friendly(message: string, locale: Locale): string {
  const t = MSG[locale];
  if (/invalid login credentials/i.test(message)) return t.wrongCredentials;
  if (/already registered/i.test(message)) return t.alreadyRegistered;
  if (/rate limit/i.test(message)) return t.rateLimit;
  if (/email not confirmed/i.test(message)) return t.emailNotConfirmed;
  if (/code verifier|pkce/i.test(message)) return t.pkce;
  if (/same password/i.test(message)) return t.samePassword;
  return message;
}
