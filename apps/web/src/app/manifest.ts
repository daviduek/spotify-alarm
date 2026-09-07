import type { MetadataRoute } from 'next';

/** Installable PWA: "Add to Home Screen" gives clock mode a standalone, full-screen window. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wake — alarm clock',
    short_name: 'Wake',
    description: 'A reliable alarm clock with intelligent audio: Spotify, your own voice, or a simple alarm.',
    start_url: '/app/clock',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    categories: ['utilities', 'lifestyle', 'music'],
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
