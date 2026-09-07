'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { sendMagicLink, signInWithPassword, signUpWithPassword, type AuthActionState } from '../lib/auth/actions';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
      {pending ? 'Working…' : label}
    </button>
  );
}

export function AuthForm({ mode, next }: { mode: 'login' | 'signup'; next?: string }) {
  const action = mode === 'login' ? signInWithPassword : signUpWithPassword;
  const [state, formAction] = useActionState<AuthActionState, FormData>(action, {});
  const [magicState, magicAction] = useActionState<AuthActionState, FormData>(sendMagicLink, {});

  return (
    <div className="auth-card">
      <h1>{mode === 'login' ? 'Welcome back' : 'Create your Wake account'}</h1>
      <p className="dim">{mode === 'login' ? 'Sign in to your alarms, recordings and Spotify.' : 'Free. No credit card. Your alarms sync across devices.'}</p>

      <form action={formAction} className="stack">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {mode === 'signup' ? (
          <label className="field">
            <span>Name</span>
            <input name="display_name" type="text" autoComplete="name" placeholder="David" />
          </label>
        ) : null}
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required autoComplete="email" placeholder="you@email.com" />
        </label>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'} minLength={8} />
        </label>
        {state.error ? <p className="alert error" role="alert">{state.error}</p> : null}
        {state.message ? <p className="alert ok" role="status">{state.message}</p> : null}
        <SubmitButton label={mode === 'login' ? 'Sign in' : 'Create account'} />
      </form>

      <div className="divider"><span>or</span></div>

      <form action={magicAction} className="stack">
        <label className="field">
          <span>Magic link</span>
          <input name="email" type="email" required autoComplete="email" placeholder="you@email.com" />
        </label>
        {magicState.error ? <p className="alert error" role="alert">{magicState.error}</p> : null}
        {magicState.message ? <p className="alert ok" role="status">{magicState.message}</p> : null}
        <button type="submit" className="btn btn-ghost">Email me a magic link</button>
      </form>

      <p className="dim switch">
        {mode === 'login' ? (
          <>New here? <Link href="/signup">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href="/login">Sign in</Link></>
        )}
      </p>
    </div>
  );
}
