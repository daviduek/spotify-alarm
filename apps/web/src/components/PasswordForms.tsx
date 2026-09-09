'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { requestPasswordReset, updatePassword, type AuthActionState } from '../lib/auth/actions';
import type { Locale } from '../lib/i18n';
import { useLocale } from '../lib/i18n/client';

const STR: Record<Locale, {
  working: string;
  resetTitle: string;
  resetSubtitle: string;
  email: string;
  emailPlaceholder: string;
  sendResetLink: string;
  backToSignIn: string;
  chooseTitle: string;
  forEmail: (email: string) => string;
  atLeast8: string;
  newPassword: string;
  confirm: string;
  savePassword: string;
}> = {
  en: {
    working: 'Working…',
    resetTitle: 'Reset your password',
    resetSubtitle: "We'll email you a link to choose a new one.",
    email: 'Email',
    emailPlaceholder: 'you@email.com',
    sendResetLink: 'Send reset link',
    backToSignIn: 'Back to sign in',
    chooseTitle: 'Choose a new password',
    forEmail: (email) => `For ${email}.`,
    atLeast8: 'At least 8 characters.',
    newPassword: 'New password',
    confirm: 'Confirm',
    savePassword: 'Save password',
  },
  es: {
    working: 'Procesando…',
    resetTitle: 'Restablece tu contraseña',
    resetSubtitle: 'Te enviaremos por email un enlace para elegir una nueva.',
    email: 'Email',
    emailPlaceholder: 'tu@email.com',
    sendResetLink: 'Enviar enlace de restablecimiento',
    backToSignIn: 'Volver a iniciar sesión',
    chooseTitle: 'Elige una nueva contraseña',
    forEmail: (email) => `Para ${email}.`,
    atLeast8: 'Mínimo 8 caracteres.',
    newPassword: 'Nueva contraseña',
    confirm: 'Confirmar',
    savePassword: 'Guardar contraseña',
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

export function PasswordResetForm() {
  const locale = useLocale();
  const t = STR[locale];
  const [state, action] = useActionState<AuthActionState, FormData>(requestPasswordReset, {});
  return (
    <div className="auth-card">
      <h1>{t.resetTitle}</h1>
      <p className="dim">{t.resetSubtitle}</p>
      <form action={action} className="stack">
        <label className="field">
          <span>{t.email}</span>
          <input name="email" type="email" required autoComplete="email" placeholder={t.emailPlaceholder} />
        </label>
        {state.error ? <p className="alert error" role="alert">{state.error}</p> : null}
        {state.message ? <p className="alert ok" role="status">{state.message}</p> : null}
        <SubmitButton label={t.sendResetLink} working={t.working} />
      </form>
      <p className="dim switch"><Link href="/login">{t.backToSignIn}</Link></p>
    </div>
  );
}

export function UpdatePasswordForm({ email }: { email: string }) {
  const locale = useLocale();
  const t = STR[locale];
  const [state, action] = useActionState<AuthActionState, FormData>(updatePassword, {});
  return (
    <div className="auth-card">
      <h1>{t.chooseTitle}</h1>
      <p className="dim">{email ? `${t.forEmail(email)} ` : ''}{t.atLeast8}</p>
      <form action={action} className="stack">
        <label className="field">
          <span>{t.newPassword}</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <label className="field">
          <span>{t.confirm}</span>
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {state.error ? <p className="alert error" role="alert">{state.error}</p> : null}
        <SubmitButton label={t.savePassword} working={t.working} />
      </form>
    </div>
  );
}
