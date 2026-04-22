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
  title: 'Sylistly — style anything, wear anything',
  description: 'AI-powered outfit builder. Search any brand across the web, build a look, buy it in one flow.',
  openGraph: {
    title: 'Sylistly',
    description: 'Style anything. Wear anything. Buy anything.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="bg-bg text-ink">{children}</body>
    </html>
  );
}
