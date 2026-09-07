import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthForm } from '../../components/AuthForm';

export const metadata: Metadata = { title: 'Wake — Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="auth-main">
      {error === 'not_configured' ? <p className="alert error" role="alert">Wake isn&apos;t connected to its database yet. See docs/SETUP.md.</p> : error ? <p className="alert error" role="alert">{decodeURIComponent(error)}</p> : null}
      <Suspense>
        <AuthForm mode="login" next={next} />
      </Suspense>
    </main>
  );
}
