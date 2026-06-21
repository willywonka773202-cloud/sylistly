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
    background_color: '#0D0D0F',
    theme_color: '#0D0D0F',
    // PNG 192/512 are what Android's installer + most platforms actually use;
    // SVG kept first for engines that prefer it. (iOS apple-touch-icon is wired
    // separately via metadata.icons.apple in layout.tsx — it must be PNG.)
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    // App shortcuts — long-press the installed icon for quick deep-links. Leads
    // with Today's Drop (the daily-engagement hook), so installed users get a
    // one-tap path back to the time-sensitive crate.
    shortcuts: [
      { name: "Today's Drop", short_name: 'Drop', description: 'Open your free daily outfit crate', url: '/drop' },
      { name: 'Discover looks', short_name: 'Discover', description: 'Browse curated complete looks', url: '/discover' },
      { name: 'Saved fits', short_name: 'Saved', description: 'Your saved outfits', url: '/saved' },
    ],
  };
}
