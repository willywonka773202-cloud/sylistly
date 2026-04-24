import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sylistly',
    short_name: 'Sylistly',
    description: 'Build and shop complete outfits from real products.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f2ee',
    theme_color: '#e8365d',
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
