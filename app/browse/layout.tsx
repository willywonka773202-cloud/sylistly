import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// /browse is a 'use client' page (can't export metadata itself) but a content
// route in the sitemap — a thin server layout supplies unique title/description
// rather than inheriting the generic root "Sylistly" metadata.
export const metadata: Metadata = {
  title: 'Browse every piece',
  description:
    'Every piece in the Sylistly catalog — lock the one you love and restyle the whole fit around it.',
  openGraph: {
    title: 'Browse every piece · Sylistly',
    description: 'Every piece in the Sylistly catalog — lock what you love, restyle the rest.',
  },
};

export default function BrowseLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
