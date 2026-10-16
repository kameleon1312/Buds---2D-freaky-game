'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react';

/**
 * Fades and slides its content in the first time it scrolls into view (the CSS lives in journey.css: .reveal).
 * `from` picks the direction, `delay` staggers neighbours. With reduced motion or without JavaScript (a <noscript>
 * rule in the layout) the content is simply there.
 */
export function Reveal({
  children,
  from = 'up',
  delay = 0,
  as: Tag = 'div',
  className = '',
}: {
  children: ReactNode;
  from?: 'up' | 'left' | 'right' | 'zoom';
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal reveal-${from} ${shown ? 'is-shown' : ''} ${className}`}
      style={{ '--delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
