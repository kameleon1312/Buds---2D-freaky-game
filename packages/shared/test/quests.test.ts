import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  cacheBlocker,
  cacheMap,
  cacheProblems,
  contentProblems,
  questBlocker,
  questById,
  type DistrictContent,
} from '../src';

describe('quest content', () => {
  it('is consistent: known NPCs, unique ids, no circular requirements', () => {
    expect(contentProblems(CONTENT)).toEqual([]);
  });

  it('gives a new player a path to level 3 in the start district', () => {
    const start = CONTENT.quests.filter((q) => q.district === 'miasto-ziomkow');
    expect(start.length).toBeGreaterThanOrEqual(6);
    expect(start.reduce((sum, q) => sum + q.xp, 0)).toBeGreaterThanOrEqual(400);
    // at least one quest is open from the very start
    expect(start.some((q) => questBlocker(q, 0, new Set()) === null)).toBe(true);
  });

  it('every NPC with quests also has small talk', () => {
    for (const n of CONTENT.npcs) expect(n.lines.length).toBeGreaterThan(0);
  });

  it('detects broken content', () => {
    const broken: DistrictContent = {
      npcs: [CONTENT.npcs[0]!, CONTENT.npcs[0]!],
      quests: [{ ...CONTENT.quests[0]!, giver: 'ghost', requires: [CONTENT.quests[0]!.id] }],
      caches: [],
    };
    const problems = contentProblems(broken);
    expect(problems.some((p) => p.includes('duplicate npc'))).toBe(true);
    expect(problems.some((p) => p.includes('unknown giver'))).toBe(true);
    expect(problems.some((p) => p.includes('circular'))).toBe(true);
  });
});

describe('questBlocker', () => {
  const first = questById('witaj-w-miescie')!;
  const shopping = questById('zakupy-haliny')!;
  const paint = questById('puszki-oli')!;

  it('allows an open quest once', () => {
    expect(questBlocker(first, 0, new Set())).toBeNull();
    expect(questBlocker(first, 0, new Set([first.id]))).toBe('already_completed');
  });

  it('enforces requirements and level', () => {
    expect(questBlocker(shopping, 0, new Set())).toBe('requires_other_quest');
    expect(questBlocker(shopping, 0, new Set([first.id]))).toBeNull();
    expect(questBlocker(paint, 99, new Set())).toBe('level_too_low');
    expect(questBlocker(paint, 100, new Set())).toBeNull();
  });
});

describe('caches', () => {
  it('every district hides some, a few of them inside rooms', () => {
    for (const d of ['miasto-ziomkow', 'las-palmas', 'dwor-carski', 'los-karkos']) {
      const here = CONTENT.caches.filter((c) => c.district === d);
      expect(here.length).toBeGreaterThanOrEqual(5);
      expect(here.some((c) => c.map)).toBe(true);
    }
  });

  it('allows a cache once and respects its level', () => {
    const cache = CONTENT.caches[0]!;
    expect(cacheBlocker(cache, 0, new Set())).toBeNull();
    expect(cacheBlocker(cache, 0, new Set([cache.id]))).toBe('already_opened');
    expect(cacheBlocker({ ...cache, minLevel: 3 }, 0, new Set())).toBe('level_too_low');
  });

  it('detects duplicate ids and rooms of another district', () => {
    const cache = CONTENT.caches[0]!;
    const problems = cacheProblems([
      cache,
      cache,
      { ...cache, id: 'inny', map: 'las-palmas-chatka' },
    ]);
    expect(problems.some((p) => p.includes('duplicate cache'))).toBe(true);
    expect(problems.some((p) => p.includes('is not in'))).toBe(true);
  });

  it('knows which map a cache lies on', () => {
    expect(cacheMap({ district: 'miasto-ziomkow' })).toBe('miasto-ziomkow');
    expect(cacheMap({ district: 'miasto-ziomkow', map: 'miasto-ziomkow-garaz' })).toBe(
      'miasto-ziomkow-garaz',
    );
  });
});
