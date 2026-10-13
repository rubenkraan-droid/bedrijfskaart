import type { Metadata, Viewport } from 'next';
import { AanmeldingProvider } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bedrijfskaart',
  description:
    'Interne kaart van de bedrijfsstructuur, met processen, taken, documenten en contactpersonen.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="bg-grond text-inkt flex min-h-full flex-col">
        <AanmeldingProvider>{children}</AanmeldingProvider>
      </body>
    </html>
  );
}
