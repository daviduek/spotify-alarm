import { getLocales } from 'expo-localization';

export type Locale = 'en' | 'es';

/**
 * Device-language detection, same contract as the web (EN default, neutral LatAm "tú" Spanish).
 * Screens keep their strings co-located: `const STR: Record<Locale, {...}>` + `STR[getLocale()]`.
 */
let cached: Locale | null = null;

export function getLocale(): Locale {
  if (cached) return cached;
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    cached = code === 'es' ? 'es' : 'en';
  } catch {
    cached = 'en';
  }
  return cached;
}
