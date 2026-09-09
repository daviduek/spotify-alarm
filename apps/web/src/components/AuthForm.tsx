'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { sendMagicLink, signInWithPassword, signUpWithPassword, type AuthActionState } from '../lib/auth/actions';
import type { Locale } from '../lib/i18n';
import { useLocale } from '../lib/i18n/client';

const STR: Record<Locale, {
  working: string;
  loginTitle: string;
  signupTitle: string;
  loginSubtitle: string;
  signupSubtitle: string;
  name: string;
  email: string;
  password: string;
  passwordPlaceholder: string;
  signIn: string;
  createAccount: string;
  or: string;
  magicLink: string;
  emailMagicLink: string;
  newHere: string;
  createAnAccount: string;
  haveAccount: string;
  emailPlaceholder: string;
}> = {
  en: {
    working: 'Working…',
    loginTitle: 'Welcome back',
    signupTitle: 'Create your Wake account',
    loginSubtitle: 'Sign in to your alarms, recordings and Spotify.',
    signupSubtitle: 'Free. No credit card. Your alarms sync across devices.',
    name: 'Name',
    email: 'Email',
    password: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    signIn: 'Sign in',
    createAccount: 'Create account',
    or: 'or',
    magicLink: 'Magic link',
    emailMagicLink: 'Email me a magic link',
    newHere: 'New here?',
    createAnAccount: 'Create an account',
    haveAccount: 'Already have an account?',
    emailPlaceholder: 'you@email.com',
  },
  es: {
    working: 'Procesando…',
    loginTitle: 'Hola de nuevo',
    signupTitle: 'Crea tu cuenta de Wake',
    loginSubtitle: 'Inicia sesión para acceder a tus alarmas, grabaciones y Spotify.',
    signupSubtitle: 'Gratis. Sin tarjeta de crédito. Tus alarmas se sincronizan entre dispositivos.',
    name: 'Nombre',
    email: 'Email',
    password: 'Contraseña',
    passwordPlaceholder: 'Mínimo 8 caracteres',
    signIn: 'Iniciar sesión',
    createAccount: 'Crear cuenta',
    or: 'o',
    magicLink: 'Enlace mágico',
    emailMagicLink: 'Enviarme un enlace mágico',
    newHere: '¿Primera vez?',
    createAnAccount: 'Crea una cuenta',
    haveAccount: '¿Ya tienes una cuenta?',
    emailPlaceholder: 'tu@email.com',
  },
};

function SubmitButton({ label, working }: { label: string; working: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
      {pending ? working : label}
    </button>
  );
}

export function AuthForm({ mode, next }: { mode: 'login' | 'signup'; next?: string }) {
  const locale = useLocale();
  const t = STR[locale];
  const action = mode === 'login' ? signInWithPassword : signUpWithPassword;
  const [state, formAction] = useActionState<AuthActionState, FormData>(action, {});
  const [magicState, magicAction] = useActionState<AuthActionState, FormData>(sendMagicLink, {});

  return (
    <div className="auth-card">
      <h1>{mode === 'login' ? t.loginTitle : t.signupTitle}</h1>
      <p className="dim">{mode === 'login' ? t.loginSubtitle : t.signupSubtitle}</p>

      <form action={formAction} className="stack">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {mode === 'signup' ? (
          <label className="field">
            <span>{t.name}</span>
            <input name="display_name" type="text" autoComplete="name" placeholder="David" />
          </label>
        ) : null}
        <label className="field">
          <span>{t.email}</span>
          <input name="email" type="email" required autoComplete="email" placeholder={t.emailPlaceholder} />
        </label>
        <label className="field">
          <span>{t.password}</span>
          <input name="password" type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'signup' ? t.passwordPlaceholder : '••••••••'} minLength={8} />
        </label>
        {state.error ? <p className="alert error" role="alert">{state.error}</p> : null}
        {state.message ? <p className="alert ok" role="status">{state.message}</p> : null}
        <SubmitButton label={mode === 'login' ? t.signIn : t.createAccount} working={t.working} />
      </form>

      <div className="divider"><span>{t.or}</span></div>

      <form action={magicAction} className="stack">
        <label className="field">
          <span>{t.magicLink}</span>
          <input name="email" type="email" required autoComplete="email" placeholder={t.emailPlaceholder} />
        </label>
        {magicState.error ? <p className="alert error" role="alert">{magicState.error}</p> : null}
        {magicState.message ? <p className="alert ok" role="status">{magicState.message}</p> : null}
        <button type="submit" className="btn btn-ghost">{t.emailMagicLink}</button>
      </form>

      <p className="dim switch">
        {mode === 'login' ? (
          <>{t.newHere} <Link href="/signup">{t.createAnAccount}</Link></>
        ) : (
          <>{t.haveAccount} <Link href="/login">{t.signIn}</Link></>
        )}
      </p>
    </div>
  );
}
