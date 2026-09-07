import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AppTabs } from '../../components/AppTabs';
import { isSupabaseConfigured } from '../../lib/env';
import { getCurrentUser } from '../../lib/supabase/server';

// The whole /app area is per-user and session-dependent — never statically prerendered.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) redirect('/login?error=not_configured');
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/app');

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <Link href="/app" className="brand" style={{ fontWeight: 700, fontSize: 18 }}>
          Wake
        </Link>
        <AppTabs />
        <form action="/auth/signout" method="post">
          <button type="submit" className="btn btn-ghost" style={{ minHeight: 38, padding: '0 12px', fontSize: 13 }}>
            Sign out
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
