'use client';

import { createContext, useContext } from 'react';

import { DEFAULT_LOCALE, type Locale } from './index';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Locale for client components. The value comes from the server-resolved request locale. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
