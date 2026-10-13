import { randomLook, type BudLook } from '@buds/shared';

/** Seeded PRNG so server-rendered sample buds are identical on every request (no hydration drift). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleLooks(count: number, seed = 7): BudLook[] {
  const random = seeded(seed);
  return Array.from({ length: count }, (_, i) => randomLook(i % 2 ? 'ona' : 'on', random));
}
