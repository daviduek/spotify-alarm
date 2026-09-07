import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { UpdatePasswordForm } from '../../../components/PasswordForms';
import { getCurrentUser } from '../../../lib/supabase/server';

export const metadata: Metadata = { title: 'Choose a new password' };
export const dynamic = 'force-dynamic';

export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/reset?expired=1');
  return (
    <main className="auth-main">
      <UpdatePasswordForm email={user.email ?? ''} />
    </main>
  );
}
