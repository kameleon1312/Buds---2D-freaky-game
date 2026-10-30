'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type TouchEvent,
} from 'react';
import Image from 'next/image';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Whether an element is on screen (false until it first is, and again once it scrolls away). */
function useOnScreen<T extends HTMLElement>(margin = '0px') {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setOn(!!e?.isIntersecting), {
      rootMargin: margin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, on] as const;
}

export type Shot = { id: string; label: string; title: string; text: string; src: string };

const SHOT_MS = 5600;

/**
 * Screens from the game in a landscape phone frame: tabs to pick (arrow keys, Home and End move between them, a swipe
 * on the screen too), and it moves on by itself every few seconds, only while it is on screen, the page is visible and
 * the reader is not hovering it, and never again after the reader picked one. The picture cross-fades, the words
 * slide in after it.
 */
export function GameplayTabs({ shots }: { shots: Shot[] }) {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const running = auto && !hover && onScreen && visible;
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % shots.length), SHOT_MS);
    return () => window.clearTimeout(id);
  }, [active, running, shots.length]);

  const pick = useCallback(
    (i: number, focus = false) => {
      const next = (i + shots.length) % shots.length;
      setActive(next);
      setAuto(false);
      if (focus) tabs.current[next]?.focus();
    },
    [shots.length],
  );

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: shots.length - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    pick(moves[e.key]!, true);
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touch.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current;
    const t = e.changedTouches[0];
    touch.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    // a clear sideways swipe only: scrolling the page down stays scrolling
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(t.clientY - start.y) * 1.5)
      pick(active + (dx < 0 ? 1 : -1));
  };

  const shot = shots[active]!;

  return (
    <div
      className="gameplay"
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="gameplay-tabs"
        role="tablist"
        aria-label="Dzielnice i miejsca"
        onKeyDown={onKey}
      >
        {shots.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${s.id}`}
            aria-selected={i === active}
            aria-controls="gameplay-panel"
            tabIndex={i === active ? 0 : -1}
            className="gameplay-tab"
            onClick={() => pick(i)}
          >
            <span>{s.label}</span>
            {i === active && running && (
              <i className="gameplay-timer" aria-hidden key={`${active}-${running}`} />
            )}
          </button>
        ))}
      </div>
      <div
        className="gameplay-stage"
        id="gameplay-panel"
        role="tabpanel"
        aria-labelledby={`tab-${shot.id}`}
      >
        <div className="device" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="device-screen">
            {shots.map((s, i) => (
              <Image
                key={s.id}
                src={s.src}
                alt={s.title}
                width={1200}
                height={521}
                sizes="(max-width: 760px) 100vw, 760px"
                className={`device-shot ${i === active ? 'is-active' : ''}`}
                priority={i === 0}
              />
            ))}
          </div>
        </div>
        <div className="gameplay-copy" key={shot.id} aria-live="polite">
          <p className="gameplay-count" aria-hidden>
            {String(active + 1).padStart(2, '0')} / {String(shots.length).padStart(2, '0')}
          </p>
          <h3>{shot.title}</h3>
          <p>{shot.text}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Its content drifts a little slower than the page while the hero scrolls away (a few pixels of depth, transform only),
 * and not at all with reduced motion.
 */
export function Parallax({ children, depth = 0.12 }: { children: ReactNode; depth?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.min(window.scrollY, window.innerHeight);
      el.style.transform = `translate3d(0, ${(y * depth).toFixed(1)}px, 0)`;
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
  }, [depth]);
  return (
    <div ref={ref} className="parallax">
      {children}
    </div>
  );
}
