'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** The landing page's sections the header links to, in the order they come down the page. */
const SECTIONS = [
  { id: 'podroz', label: 'Podróż' },
  { id: 'swiat', label: 'Świat' },
  { id: 'kreator', label: 'Stwórz' },
] as const;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Scrolls smoothly to an element (or the top), without a jump for readers who asked for less motion. */
export function scrollToTarget(target: HTMLElement | null) {
  const behavior: ScrollBehavior = reducedMotion() ? 'auto' : 'smooth';
  if (!target) window.scrollTo({ top: 0, behavior });
  else target.scrollIntoView({ behavior, block: 'start' });
}

/**
 * The pinned, frosted bar at the top of every page. The logo takes the reader home, and on the landing page it glides
 * back to the top instead of reloading (the address loses its #section). The bar settles into a denser background with
 * a hairline once the page has scrolled, and on the landing page the link of the section on screen is marked.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const home = pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // which section is on screen: the last one whose top has passed the upper third of the window
  useEffect(() => {
    if (!home) {
      setActive(null);
      return;
    }
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => !!el,
    );
    if (!els.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.35;
      let current: string | null = null;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      // past the end of the last section nothing is marked
      const last = els[els.length - 1]!;
      if (last.getBoundingClientRect().bottom < line) current = null;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [home]);

  const toTop = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!home || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    scrollToTarget(null);
    if (window.location.hash) history.replaceState(null, '', window.location.pathname);
  };

  const toSection = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!home || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    scrollToTarget(el);
    history.replaceState(null, '', `#${id}`);
  };

  return (
    <div className={`site-bar ${scrolled ? 'is-scrolled' : ''}`}>
      <header className="site-header">
        <Link href="/" className="logo" onClick={toTop} aria-label="Buds: na górę strony głównej">
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
        <nav aria-label="Główne">
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              href={`/#${s.id}`}
              onClick={toSection(s.id)}
              className={`${active === s.id ? 'is-active' : ''} ${s.id !== 'kreator' ? 'nav-wide' : ''}`}
              aria-current={active === s.id ? 'true' : undefined}
            >
              {s.label}
            </Link>
          ))}
          <Link href="/top" className={pathname === '/top' ? 'is-active' : ''}>
            Ranking
          </Link>
          <Link href="/konto" className={pathname.startsWith('/konto') ? 'is-active' : ''}>
            Konto
          </Link>
        </nav>
      </header>
    </div>
  );
}
