import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { AuthForm } from '../../components/AuthForm';
import type { Locale } from '../../lib/i18n';
import { getLocale } from '../../lib/i18n/server';

const STR: Record<Locale, { title: string; notConfigured: string; forgot: string }> = {
  en: {
    title: 'Sign in',
    notConfigured: "Wake isn't connected to its database yet. See docs/SETUP-WEB.md.",
    forgot: 'Forgot your password?',
  },
  es: {
    title: 'Iniciar sesión',
    notConfigured: 'Wake todavía no está conectado a su base de datos. Consulta docs/SETUP-WEB.md.',
    forgot: '¿Olvidaste tu contraseña?',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: STR[locale].title };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const locale = await getLocale();
  const t = STR[locale];
  return (
    <main className="auth-main">
      {error === 'not_configured' ? (
        <p className="alert error" role="alert">{t.notConfigured}</p>
      ) : error ? (
        <p className="alert error" role="alert">{error}</p>
      ) : null}
      <Suspense>
        <AuthForm mode="login" next={next} />
      </Suspense>
      <p className="dim switch" style={{ textAlign: 'center' }}>
        <Link href="/auth/reset">{t.forgot}</Link>
      </p>
    </main>
  );
}
