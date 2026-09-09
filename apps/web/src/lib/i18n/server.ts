import 'server-only';

import { cookies, headers } from 'next/headers';

import { LOCALE_COOKIE, resolveLocale, type Locale } from './index';

/** Request locale for Server Components, route handlers and server actions. */
export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerStore.get('accept-language'));
}
