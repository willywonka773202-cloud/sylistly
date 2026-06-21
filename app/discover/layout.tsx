import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// /discover is a 'use client' page (it can't export metadata itself), but it's a
// content route in the sitemap + a plausible organic landing page — so a thin
// server layout supplies unique title/description instead of inheriting the
// generic root "Sylistly" metadata.
export const metadata: Metadata = {
  title: 'Discover — curated looks',
  description:
    'A curated wall of complete, shoppable outfits. Tap one to remix it in the builder and make it yours.',
  openGraph: {
    title: 'Discover curated looks · Sylistly',
    description: 'A curated wall of complete, shoppable outfits — tap one to remix it and make it yours.',
  },
};

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
