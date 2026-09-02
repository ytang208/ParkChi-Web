import type { Metadata, Viewport } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import './globals.css';

const body = DM_Sans({ variable: '--font-body', subsets: ['latin'] });
const display = Manrope({ variable: '--font-display', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://ytang208.github.io/ParkChi-Web/'),
  title: 'ParkChi — Never lose your parking spot',
  description: 'Save your parked car, Chicago street reminders, and vehicle renewal dates in one simple place.',
  openGraph: {
    title: 'ParkChi — Never lose your parking spot',
    description: 'Save your parked car, street reminders, and vehicle renewal dates.',
    images: [{ url: 'og.png', width: 1200, height: 630, alt: 'ParkChi — Never lose your parking spot' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ParkChi — Never lose your parking spot',
    description: 'Save your parked car, street reminders, and vehicle renewal dates.',
    images: ['og.png'],
  },
};

export const viewport: Viewport = { themeColor: '#063d32', colorScheme: 'light' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${body.variable} ${display.variable}`}>{children}</body></html>;
}
