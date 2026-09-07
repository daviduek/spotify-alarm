import type { MetadataRoute } from 'next';

import { env } from '../lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = env.appUrl || 'https://wakealarm.vercel.app';
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app', '/api', '/auth'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
