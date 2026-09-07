'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { requestPasswordReset, updatePassword, type AuthActionState } from '../lib/auth/actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
      {pending ? 'Working…' : label}
    </button>
  );
}

export function PasswordResetForm() {
  const [state, action] = useActionState<AuthActionState, FormData>(requestPasswordReset, {});
  return (
    <div className="auth-card">
      <h1>Reset your password</h1>
      <p className="dim">We&apos;ll email you a link to choose a new one.</p>
      <form action={action} className="stack">
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required autoComplete="email" placeholder="you@email.com" />
        </label>
        {state.error ? <p className="alert error" role="alert">{state.error}</p> : null}
        {state.message ? <p className="alert ok" role="status">{state.message}</p> : null}
        <SubmitButton label="Send reset link" />
      </form>
      <p className="dim switch"><Link href="/login">Back to sign in</Link></p>
    </div>
  );
}

export function UpdatePasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState<AuthActionState, FormData>(updatePassword, {});
  return (
    <div className="auth-card">
      <h1>Choose a new password</h1>
      <p className="dim">{email ? `For ${email}.` : ''} At least 8 characters.</p>
      <form action={action} className="stack">
        <label className="field">
          <span>New password</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        <label className="field">
          <span>Confirm</span>
          <input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        </label>
        {state.error ? <p className="alert error" role="alert">{state.error}</p> : null}
        <SubmitButton label="Save password" />
      </form>
    </div>
  );
}
