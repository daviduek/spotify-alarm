'use client';

import { useRouter } from 'next/navigation';

import { LOCALE_COOKIE, LOCALES, type Locale } from '../lib/i18n';
import { useLocale } from '../lib/i18n/client';

/** EN | ES toggle. Sets the locale cookie and re-renders the tree with the new language. */
export function LangSwitch() {
  const router = useRouter();
  const current = useLocale();

  const pick = (locale: Locale) => {
    if (locale === current) return;
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <span className="lang-switch" role="group" aria-label="Language / Idioma">
      {LOCALES.map((l, i) => (
        <span key={l}>
          {i > 0 ? <span aria-hidden="true"> · </span> : null}
          <button type="button" className={l === current ? 'on' : ''} lang={l} onClick={() => pick(l)}>
            {l.toUpperCase()}
          </button>
        </span>
      ))}
    </span>
  );
}
