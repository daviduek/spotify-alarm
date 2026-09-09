/**
 * Locale handling: Wake ships fully bilingual (English/Spanish).
 * The locale is resolved per request: explicit cookie (user choice) → Accept-Language → 'en'.
 * Components keep their strings co-located in a `const STR = { en: {...}, es: {...} }` object and
 * index it with the locale from `getLocale()` (server) or `useLocale()` (client).
 */
export type Locale = 'en' | 'es';

export const LOCALES: readonly Locale[] = ['en', 'es'] as const;
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'wake_lang';

export function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'es';
}

/** Cookie wins; otherwise the highest-ranked supported language in Accept-Language; else English. */
export function resolveLocale(cookieValue: string | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(',')
      .map((part) => {
        const [tag, ...params] = part.trim().split(';');
        const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
        return { lang: tag.trim().toLowerCase(), q: q ? parseFloat(q.slice(2)) || 0 : 1 };
      })
      .sort((a, b) => b.q - a.q);
    for (const { lang } of ranked) {
      if (lang === 'es' || lang.startsWith('es-')) return 'es';
      if (lang === 'en' || lang.startsWith('en-')) return 'en';
    }
  }
  return DEFAULT_LOCALE;
}
