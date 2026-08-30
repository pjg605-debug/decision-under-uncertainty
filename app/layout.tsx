import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Decision / T0',
  description: 'Practice human judgment under uncertainty before history reveals the outcome.',
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3001'),
  openGraph: {
    title: 'Decision / T0',
    description: 'Judgment under uncertainty. Choose before history reveals the outcome.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Decision / T0 — Judgment under uncertainty' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Decision / T0',
    description: 'Judgment under uncertainty. Choose before history reveals the outcome.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
