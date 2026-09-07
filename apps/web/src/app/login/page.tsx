import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { AuthForm } from '../../components/AuthForm';

export const metadata: Metadata = { title: 'Sign in — Wake' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="auth-main">
      {error === 'not_configured' ? (
        <p className="alert error" role="alert">Wake isn&apos;t connected to its database yet. See docs/SETUP-WEB.md.</p>
      ) : error ? (
        <p className="alert error" role="alert">{error}</p>
      ) : null}
      <Suspense>
        <AuthForm mode="login" next={next} />
      </Suspense>
      <p className="dim switch" style={{ textAlign: 'center' }}>
        <Link href="/auth/reset">Forgot your password?</Link>
      </p>
    </main>
  );
}
