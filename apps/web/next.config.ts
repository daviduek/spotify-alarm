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
        ],
      },
    ];
  },
};

export default nextConfig;
