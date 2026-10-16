import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Rubik } from 'next/font/google';
import { SITE_URL } from '@/lib/site';
import './globals.css';
import './journey.css';

// Buds design system: Rubik everywhere (display 800-900 outlined, body 500-700).
const rubik = Rubik({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '700', '800', '900'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Buds — znajdź swojego ziomka', template: '%s | Buds' },
  description:
    'Stwórz swojego Buda — ziomka albo ziomeczkę z własnym nastrojem i stylem — i ruszaj z nim na przygodę w grze Buds.',
  openGraph: { type: 'website', locale: 'pl_PL', siteName: 'Buds' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#16181f',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={rubik.variable}>
      <head>
        {/* without JavaScript the scroll reveals never run: show everything */}
        <noscript>
          <style>{'.reveal{opacity:1;transform:none}'}</style>
        </noscript>
      </head>
      <body>
        {/* pinned to the top while scrolling, frosted so the page shows through */}
        <div className="site-bar">
          <header className="site-header">
            <Link href="/" className="logo">
              <Image
                src="/buds-icon.png"
                alt=""
                width={52}
                height={52}
                className="logo-icon"
                priority
              />
              <span>Buds</span>
            </Link>
            <nav>
              <Link href="/#kreator">Stwórz</Link>
              <Link href="/top">Ranking</Link>
              <Link href="/konto">Konto</Link>
            </nav>
          </header>
        </div>
        {children}
        <footer className="site-footer">
          <span>Buds · gra o ziomkach z charakterem</span>
          <nav className="footer-links">
            <Link href="/konto">Konto</Link>
            <Link href="/top">Ranking</Link>
            <Link href="/prywatnosc">Prywatność</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
