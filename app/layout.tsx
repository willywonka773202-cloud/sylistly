import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  style: ['normal', 'italic'],
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Sylistly',
    template: '%s | Sylistly',
  },
  description: 'Build polished outfits from real products, save full looks, and shop every piece in one premium flow.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://sylistly.com'),
  applicationName: 'Sylistly',
  keywords: [
    'fashion app',
    'outfit builder',
    'virtual styling',
    'closet app',
    'shop outfits',
    'lookbook',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Sylistly',
    description: 'Build and shop complete outfits from real products.',
    url: '/',
    siteName: 'Sylistly',
    images: ['/og.svg'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sylistly',
    description: 'Build and shop complete outfits from real products.',
    images: ['/og.svg'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.svg', type: 'image/svg+xml' },
    ],
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="bg-bg text-ink">{children}</body>
    </html>
  );
}
