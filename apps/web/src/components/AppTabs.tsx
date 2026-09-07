'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/app', label: 'Alarms' },
  { href: '/app/clock', label: 'Clock' },
  { href: '/app/sounds', label: 'Sounds' },
  { href: '/app/settings', label: 'Settings' },
];

export function AppTabs() {
  const pathname = usePathname();
  return (
    <div className="tabs">
      {TABS.map((t) => {
        const active = t.href === '/app' ? pathname === '/app' : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? 'active' : ''}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
