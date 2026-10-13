import { describe, expect, it } from 'vitest';
import { CONTENT, contentProblems, questBlocker, questById, type DistrictContent } from '../src';

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
