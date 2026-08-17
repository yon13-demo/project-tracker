import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'ProjectTrack', description: 'Project completion tracker' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="id"><body>{children}</body></html>; }
