import type { Metadata, Viewport } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import './globals.css';

const body = DM_Sans({ variable: '--font-body', subsets: ['latin'] });
const display = Manrope({ variable: '--font-display', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://ytang208.github.io/ParkChi-Web/'),
  title: 'My Apps — useful tools in one place',
  description: 'A phone-inspired home for useful everyday apps, starting with ParkChi.',
  openGraph: {
    title: 'My Apps — useful tools in one place',
    description: 'A phone-inspired home for useful everyday apps, starting with ParkChi.',
    images: [{ url: 'og.png', width: 1200, height: 630, alt: 'My Apps — Useful tools, all in one place' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Apps — useful tools in one place',
    description: 'A phone-inspired home for useful everyday apps, starting with ParkChi.',
    images: ['og.png'],
  },
};

export const viewport: Viewport = { themeColor: '#063d32', colorScheme: 'light' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${body.variable} ${display.variable}`}>{children}</body></html>;
}
