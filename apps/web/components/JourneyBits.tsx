'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

/** A thin lime bar along the top of the page: how far along the journey through Buds the reader is. */
export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
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
  }, []);
  return (
    <div className="scroll-progress" aria-hidden>
      <span style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}

export type Shot = { id: string; label: string; title: string; text: string; src: string };

/**
 * Screens from the game in a landscape phone frame: tabs to pick, and it moves on by itself every few seconds
 * (paused while the reader hovers or after they pick one).
 */
export function GameplayTabs({ shots }: { shots: Shot[] }) {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (!auto || hover) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % shots.length), 5200);
    return () => window.clearTimeout(id);
  }, [active, auto, hover, shots.length]);
  const shot = shots[active]!;

  return (
    <div
      className="gameplay"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="gameplay-tabs" role="tablist" aria-label="Rozgrywka">
        {shots.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            className="gameplay-tab"
            onClick={() => {
              setActive(i);
              setAuto(false);
            }}
          >
            <span>{s.label}</span>
            {i === active && auto && !hover && (
              <i className="gameplay-timer" aria-hidden key={active} />
            )}
          </button>
        ))}
      </div>
      <div className="gameplay-stage">
        <div className="device">
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
        <div className="gameplay-copy" key={shot.id}>
          <h3>{shot.title}</h3>
          <p>{shot.text}</p>
        </div>
      </div>
    </div>
  );
}
