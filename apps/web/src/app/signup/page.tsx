import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthForm } from '../../components/AuthForm';
import type { Locale } from '../../lib/i18n';
import { getLocale } from '../../lib/i18n/server';

const TITLE: Record<Locale, string> = { en: 'Create account', es: 'Crear cuenta' };

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: TITLE[locale] };
}

export default function SignupPage() {
  return (
    <main className="auth-main">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
