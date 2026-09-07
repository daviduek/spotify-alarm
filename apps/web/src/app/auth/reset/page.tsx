import type { Metadata } from 'next';

import { PasswordResetForm } from '../../../components/PasswordForms';

export const metadata: Metadata = { title: 'Reset password' };

export default function ResetPage() {
  return (
    <main className="auth-main">
      <PasswordResetForm />
    </main>
  );
}
