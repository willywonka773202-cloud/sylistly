import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sylistly',
    short_name: 'Sylistly',
    description: 'Endless outfits from real products. Lock what you love, restyle the rest.',
    start_url: '/',
    display: 'standalone',
    // Match the Editorial Noir app shell so the PWA splash and status bar
    // are seamless with the UI (was cream/#e8365d — a different app's colors).
    background_color: '#0A0A0C',
    theme_color: '#0A0A0C',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/apple-touch-icon.svg',
        sizes: '180x180',
        type: 'image/svg+xml',
      },
    ],
  };
}
