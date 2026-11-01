import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/quests';
import { wardrobeOf } from '../src/content/wardrobe';

describe('people dress for their city', () => {
  it('nearly everyone wears the city’s wardrobe, every look stays valid', () => {
    for (const n of [...CONTENT.npcs, ...CONTENT.enemies]) {
      const w = wardrobeOf(n.district);
      if (!w) continue;
      expect(w.tops.length, n.id).toBeGreaterThan(0);
      expect(n.look.shoesColor, n.id).toBeGreaterThanOrEqual(0);
    }
    const inChinatown = CONTENT.npcs.filter((n) => n.district === 'chinatown');
    const local = inChinatown.filter((n) =>
      ['tangzhuang', 'qipao', 'kamizelka', 'bezrekawnik', 'kurtka'].includes(n.look.outfit),
    );
    expect(local.length).toBe(inChinatown.length);
    const beach = CONTENT.npcs.filter((n) => n.district === 'las-palmas');
    expect(
      beach.filter((n) => n.look.pants === 'szorty' || n.look.pants === 'spodnica').length,
    ).toBeGreaterThan(beach.length * 0.7);
  });

  it('the city a bud walks into can be told from its people', () => {
    const tops = (d: string) =>
      new Set(CONTENT.npcs.filter((n) => n.district === d).map((n) => n.look.outfit));
    expect(tops('chinatown').has('hawajska')).toBe(false);
    expect(tops('las-palmas').has('hawajska')).toBe(true);
    expect(tops('dwor-carski').has('surdut')).toBe(true);
    expect(tops('miasto-ziomkow').has('surdut')).toBe(false);
  });

  it('is the same every time: a person doesn’t change clothes between builds', () => {
    const first = CONTENT.npcs.find((n) => n.id === 'kahu')!.look;
    expect(first.outfit).toBe(CONTENT.npcs.find((n) => n.id === 'kahu')!.look.outfit);
  });
});
