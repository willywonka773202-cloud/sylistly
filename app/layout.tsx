import type { Metadata, Viewport } from 'next';
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#080807',
};

export const metadata: Metadata = {
  title: 'Sylistly — Build Your Vibe',
  description: 'AI stylist that builds looks to get compliments. Discover your style identity.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Sylistly — Build Your Vibe',
    description: 'AI stylist that builds looks to get compliments',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="bg-bg text-ink antialiased">
        <div className="min-h-screen bg-bg">{children}</div>
      </body>
    </html>
  );
}
