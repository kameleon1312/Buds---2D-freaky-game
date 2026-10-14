import { describe, expect, it } from 'vitest';
import {
  BUFFS,
  CATALOG,
  CONTENT,
  DRINKS,
  MOUNTS,
  PERKS,
  SKILLS,
  SKILL_MAX_RANK,
  TRAINING_XP_PER_RANK,
  budFighter,
  buffBonus,
  characterStats,
  effectiveRank,
  enemyById,
  enemyFighter,
  gearProblems,
  newFight,
  perksFor,
  playTurn,
  rollLoot,
  trainingXp,
} from '../src';

const stats = characterStats([]);

describe('training and perks', () => {
  it('training XP adds ranks on top of spent points, capped', () => {
    expect(trainingXp(5)).toBe(40);
    expect(trainingXp(5, true)).toBe(80);
    expect(trainingXp(99)).toBe(40);
    expect(trainingXp(-3)).toBe(0);
    expect(effectiveRank(1, TRAINING_XP_PER_RANK * 2 + 50)).toBe(3);
    expect(effectiveRank(4, TRAINING_XP_PER_RANK * 9)).toBe(SKILL_MAX_RANK);
  });

  it('every skill has a perk at rank 3 and 5', () => {
    for (const s of SKILLS) {
      expect(PERKS.filter((p) => p.skill === s.id).map((p) => p.rank)).toEqual([3, 5]);
    }
    expect(perksFor({ walka: 3 })).toEqual(['cios-specjalny']);
    expect(perksFor({ walka: 5, flow: 2 })).toEqual(['cios-specjalny', 'mistrz-ringu']);
  });

  it('every skill can be trained somewhere', () => {
    for (const s of SKILLS) expect(CONTENT.training.some((t) => t.skill === s.id)).toBe(true);
  });

  it('perks add special moves and health', () => {
    const plain = budFighter('Bud', 0, stats, undefined);
    const pro = budFighter('Bud', 0, stats, undefined, {
      perks: ['cios-specjalny', 'tag-legendy', 'twardziel'],
    });
    expect(pro.moves).toEqual([...plain.moves, 'tag', 'specjalny']);
    expect(pro.maxHp).toBe(plain.maxHp + 20);
  });

  it('drinks boost duel stats', () => {
    const plain = budFighter('Bud', 0, stats, undefined);
    const boosted = budFighter('Bud', 0, stats, undefined, {
      buffs: ['sila', 'pancerz', 'regeneracja', 'turbo', 'fart'],
    });
    expect(boosted.attack - plain.attack).toBe(6);
    expect(boosted.armor - plain.armor).toBe(6);
    expect(boosted.maxHp - plain.maxHp).toBe(25);
    expect(boosted.speed - plain.speed).toBe(5);
    expect(boosted.luck - plain.luck).toBe(10);
    expect(buffBonus(['skupienie']).trainingFocus).toBe(true);
    expect(BUFFS.every((b) => b.seconds > 0)).toBe(true);
  });

  it('Drugi oddech saves the bud once a fight', () => {
    const boss = CONTENT.enemies.find((e) => e.boss)!;
    let saved = 0;
    for (let seed = 1; seed <= 20; seed++) {
      let s = newFight(
        boss.id,
        budFighter('Bud', 0, stats, undefined, { perks: ['drugi-oddech'] }),
        enemyFighter(boss),
        seed,
      );
      while (s.status === 'active') {
        const r = playTurn(s, 'garda');
        saved += r.events.filter((e) => e.secondWind?.who === 'bud').length;
        s = r.state;
      }
      expect(s.bud.status.secondWind).toBe(true);
    }
    expect(saved).toBe(20);
  });

  it('Łowca łupów drops loot more often; drinks drop too', () => {
    const e = enemyById('dresiarz') ?? CONTENT.enemies[0]!;
    const plain = Array.from({ length: 400 }, (_, i) => rollLoot(e, 0, CATALOG, new Set(), i + 1));
    const hunter = Array.from({ length: 400 }, (_, i) =>
      rollLoot(e, 0, CATALOG, new Set(), i + 1, { perks: ['lowca-lupow'] }),
    );
    expect(hunter.filter((l) => l.itemId).length).toBeGreaterThan(
      plain.filter((l) => l.itemId).length,
    );
    const drinks = plain.filter((l) => l.drink).length;
    expect(drinks).toBeGreaterThan(60);
    expect(drinks).toBeLessThan(140);
  });
});

describe('mounts and drinks', () => {
  it('six mounts from skateboard to quad, each faster', () => {
    expect(MOUNTS.map((m) => m.id)).toEqual([
      'mount-deskorolka',
      'mount-hulajnowa',
      'mount-rower',
      'mount-e-hulajnowa',
      'mount-motocykl',
      'mount-quad',
    ]);
    const speeds = MOUNTS.map((m) => m.mountSpeed!);
    expect([...speeds].sort((a, b) => a - b)).toEqual(speeds);
    for (const m of MOUNTS) expect(m.slot).toBe('mount');
    expect(MOUNTS.some((m) => !m.shop)).toBe(true);
  });

  it('a drink for every boost; never for real money', () => {
    expect(new Set(DRINKS.map((d) => d.drink))).toEqual(new Set(BUFFS.map((b) => b.id)));
    for (const d of [...DRINKS, ...MOUNTS]) expect(d.price.currency).toBe('coins');
    expect(gearProblems()).toEqual([]);
  });

  it('mounts do not count toward gear stats', () => {
    expect(characterStats(MOUNTS)).toEqual(stats);
  });
});
