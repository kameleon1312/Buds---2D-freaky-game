'use client';

import { useEffect, useState } from 'react';
import type { BudLook, Facing, WalkFrame } from '@buds/shared';
import { BudSprite } from './BudSprite';

/** Turntable: front → side → back → other side, walking in place. */
const TURN: { facing: Facing; flip: boolean }[] = [
  { facing: 'down', flip: false },
  { facing: 'side', flip: true },
  { facing: 'up', flip: false },
  { facing: 'side', flip: false },
];
const WALK: WalkFrame[] = [1, 0, 2, 0];

export function BudPreview({
  look,
  height = 240,
  name,
  spin = null,
}: {
  look: BudLook;
  height?: number;
  name?: string;
  /** turned by hand: stands this way (0 front, 1 and 3 sides, 2 back); null turns and walks by itself */
  spin?: number | null;
}) {
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setTick((t) => t + 1), 160);
    return () => clearInterval(id);
  }, []);

  // stand facing the viewer for the first 2.5 s after every change, so edits are easy to see
  useEffect(() => {
    setPaused(true);
    const id = setTimeout(() => setPaused(false), 2500);
    return () => clearTimeout(id);
  }, [look]);

  const held = spin !== null;
  const turn = held ? TURN[spin]! : paused ? TURN[0]! : TURN[Math.floor(tick / 16) % TURN.length]!;
  const frame = held || paused ? 0 : WALK[tick % WALK.length]!;

  return (
    <BudSprite
      look={look}
      height={height}
      facing={turn.facing}
      flip={turn.flip}
      frame={frame}
      label={name}
    />
  );
}
