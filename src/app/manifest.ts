import type { MetadataRoute } from 'next';

/** Lets Taske be added to the home screen and open full screen like an app (Android and iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Taske',
    short_name: 'Taske',
    description: 'A calm week planner for tasks across projects.',
    start_url: '/board',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0e',
    theme_color: '#0a0a0e',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
