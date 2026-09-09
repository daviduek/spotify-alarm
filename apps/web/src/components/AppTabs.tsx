'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { Locale } from '../lib/i18n';
import { useLocale } from '../lib/i18n/client';

const TAB_LABELS: Record<Locale, string[]> = {
  en: ['Alarms', 'Clock', 'Sounds', 'Settings'],
  es: ['Alarmas', 'Reloj', 'Sonidos', 'Ajustes'],
};

const TAB_HREFS = ['/app', '/app/clock', '/app/sounds', '/app/settings'];

export function AppTabs() {
  const pathname = usePathname();
  const locale = useLocale();
  const labels = TAB_LABELS[locale];
  return (
    <div className="tabs">
      {TAB_HREFS.map((href, i) => {
        const active = href === '/app' ? pathname === '/app' : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? 'active' : ''}>
            {labels[i]}
          </Link>
        );
      })}
    </div>
  );
}
