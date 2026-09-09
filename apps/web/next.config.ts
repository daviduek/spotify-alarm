import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // @wake/domain is consumed from TypeScript source (no build step) — see packages/domain.
  transpilePackages: ['@wake/domain'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'microphone=(self), autoplay=(self), screen-wake-lock=(self)' },
          {
            // Report-only first: watch the console in prod for violations before enforcing.
            key: 'Content-Security-Policy-Report-Only',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' https://sdk.scdn.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: data: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.spotify.com; frame-src https://sdk.scdn.co; font-src 'self' data:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.spotify.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
