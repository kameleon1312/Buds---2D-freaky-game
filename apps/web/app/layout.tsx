import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Rubik } from 'next/font/google';
import { BudSprite } from '@/components/BudSprite';
import { sampleLooks } from '@/lib/looks';
import { SITE_URL } from '@/lib/site';
import './globals.css';

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

const logoLook = { ...sampleLooks(1, 3)[0]!, mood: 'radosny' as const };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={rubik.variable}>
      <body>
        <header className="site-header">
          <Link href="/" className="logo">
            <BudSprite look={logoLook} height={38} crop="head" />
            <span>Buds</span>
          </Link>
          <nav>
            <Link href="/#kreator">Stwórz</Link>
            <Link href="/top">Ranking</Link>
            <Link href="/konto">Konto</Link>
          </nav>
        </header>
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
