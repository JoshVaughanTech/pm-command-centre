import './globals.css';
import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'SNTRI',
  description: 'PM command centre — manage projects, risks, and client communications with AI-powered recommendations.',
  openGraph: {
    title: 'SNTRI — PM Command Centre',
    description: 'One dashboard for your projects, risks, clients, and team. AI-powered moves, real-time integrations, and client portals.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SNTRI — PM Command Centre',
    description: 'One dashboard for your projects, risks, clients, and team.',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
