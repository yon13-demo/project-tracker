import './globals.css';
import type { Metadata, Viewport } from 'next';
import { RegisterServiceWorker } from '@/components/RegisterServiceWorker';

export const metadata: Metadata = {
  metadataBase: new URL('https://weave.web.id'),
  title: 'Weave',
  description: 'Weave - work and project tracking.',
  icons: { icon: '/favicon.ico', apple: '/icons/icon-192.png' },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body><RegisterServiceWorker />{children}</body></html>;
}
