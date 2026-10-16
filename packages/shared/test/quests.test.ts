import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  TUTORIAL_ISLAND,
  cacheBlocker,
  catalogItem,
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

  it('quest NPCs stand still, locals stroll and give no quests', () => {
    const questNpcs = new Set(
      CONTENT.quests.flatMap((q) => [
        q.giver,
        ...q.steps.flatMap((s) => (s.kind === 'talk' ? [s.npc] : [])),
      ]),
    );
    const locals = CONTENT.npcs.filter((n) => n.wander > 0);
    expect(locals.length).toBeGreaterThanOrEqual(20);
    for (const n of CONTENT.npcs) if (questNpcs.has(n.id)) expect(n.wander, n.id).toBe(0);
    for (const n of locals) expect(questNpcs.has(n.id), n.id).toBe(false);
    // every district has some life in it
    for (const d of new Set(CONTENT.npcs.map((n) => n.district)))
      expect(locals.filter((n) => n.district === d).length, d).toBeGreaterThanOrEqual(3);
  });

  it('flags a quest NPC that wanders', () => {
    const giver = CONTENT.npcs.find((n) => n.id === CONTENT.quests[0]!.giver)!;
    const problems = contentProblems({
      ...CONTENT,
      npcs: CONTENT.npcs.map((n) => (n === giver ? { ...n, wander: 2 } : n)),
    });
    expect(problems.some((p) => p.includes('must not wander'))).toBe(true);
  });

  it('detects broken content', () => {
    const broken: DistrictContent = {
      npcs: [CONTENT.npcs[0]!, CONTENT.npcs[0]!],
      quests: [{ ...CONTENT.quests[0]!, giver: 'ghost', requires: [CONTENT.quests[0]!.id] }],
      caches: [],
      enemies: [],
      training: [CONTENT.training[0]!, CONTENT.training[0]!],
    };
    const problems = contentProblems(broken);
    expect(problems.some((p) => p.includes('duplicate npc'))).toBe(true);
    expect(problems.some((p) => p.includes('unknown giver'))).toBe(true);
    expect(problems.some((p) => p.includes('circular'))).toBe(true);
    expect(problems.some((p) => p.includes('duplicate training spot'))).toBe(true);
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

describe('tutorial island', () => {
  const island = CONTENT.quests.filter((q) => q.district === TUTORIAL_ISLAND.id);

  it('is a chain that ends with the quest that opens the pier', () => {
    expect(island.length).toBeGreaterThanOrEqual(4);
    const final = questById(TUTORIAL_ISLAND.finalQuest)!;
    expect(final.district).toBe(TUTORIAL_ISLAND.id);
    // every other island quest is needed (directly or not) before the final one
    const needed = new Set<string>();
    const walk = (id: string) => questById(id)!.requires.forEach((r) => (needed.add(r), walk(r)));
    walk(final.id);
    for (const q of island) if (q.id !== final.id) expect(needed.has(q.id)).toBe(true);
    expect(island.some((q) => questBlocker(q, 0, new Set()) === null)).toBe(true);
  });

  it('teaches a duel and gives a first weapon', () => {
    expect(island.some((q) => q.steps.some((s) => s.kind === 'duel'))).toBe(true);
    expect(island.some((q) => catalogItem(q.rewardItem ?? '')?.weapon)).toBe(true);
  });

  it('flags duels with unknown opponents', () => {
    const q = { ...island[0]!, steps: [{ kind: 'duel' as const, enemy: 'duch', label: 'x' }] };
    expect(
      contentProblems({ ...CONTENT, quests: [q] }).some((p) => p.includes('unknown enemy')),
    ).toBe(true);
  });
});
