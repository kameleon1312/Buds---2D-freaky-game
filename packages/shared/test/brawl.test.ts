import { describe, expect, it } from 'vitest';
import {
  ABILITIES,
  BRAWL_TICK_MS,
  Brawl,
  CATALOG,
  CONTENT,
  KIT_SLOTS,
  KO_MS,
  MOVES,
  MOB_RESPAWN_MS,
  PVP_MIN_LEVEL,
  SAFE_TURFS,
  TURFS,
  ULTIMATES,
  WEAPON_KINDS,
  budFighter,
  catalogItem,
  cellFeet,
  characterStats,
  findPath,
  kitOf,
  knockoutLoss,
  nearestWalkable,
  positionWalkable,
  respawnPoint,
  safeAt,
  safeMap,
  walkGrid,
  type CatalogItem,
  type Enemy,
  type Fighter,
  type Unit,
  type WeaponKind,
} from '../src';

const xpForLevel = (level: number) => 100 * (level - 1) ** 2;
const MAP = 'miasto-ziomkow';

function bud(level: number, weapon?: string): Fighter {
  const worn = weapon ? [catalogItem(weapon)!] : [];
  return budFighter(
    'Bud',
    xpForLevel(level),
    characterStats(worn),
    worn[0] as CatalogItem | undefined,
  );
}

/** The weapon of a kind with the lowest level, to fight with it. */
const weaponOf = (kind: WeaponKind) =>
  (CATALOG as readonly CatalogItem[])
    .filter((i) => i.weapon === kind)
    .sort((a, b) => (a.minLevel ?? 0) - (b.minLevel ?? 0))[0]?.id;

const enemies = CONTENT.enemies as Enemy[];
const cityEnemy = (pick: (e: Enemy) => boolean) =>
  enemies.find((e) => e.district === MAP && pick(e))!;

/**
 * A simple player: walks to the nearest foe like the game's stick would (3.8 tiles/s, walls respected), presses the
 * ultimate and the abilities when they are ready and reach, guards when low, and attacks.
 */
function play(b: Brawl, id: string, targetId: string, now: number) {
  const me = b.units.get(id)!;
  const foe = b.units.get(targetId);
  if (!foe || foe.downUntil || me.downUntil) return;
  const d = Math.hypot(foe.x - me.x, foe.y - me.y);
  for (const slot of [4, 1, 2, 3, 0]) {
    const ability = me.kit[slot];
    if (!ability || me.ready[slot]! > now) continue;
    const spec = ABILITIES[ability];
    if (spec.shape === 'shield' && me.hp * 2 > me.maxHp) continue;
    const reach =
      spec.shape === 'self' ? (spec.radius ?? 2) * 0.8 : Math.max(1.2, spec.range * 0.9);
    if (spec.shape !== 'buff' && spec.shape !== 'shield' && d > reach) continue;
    if (!b.act(id, slot, foe.x, foe.y, foe.id)) return;
  }
  // close in to basic attack range
  const reach = Math.max(1.1, ABILITIES[me.kit[0]!].range * 0.85);
  if (d > reach && me.stunUntil <= now && me.rootUntil <= now) {
    const step = Math.min(d - reach + 0.05, 3.8 * (BRAWL_TICK_MS / 1000));
    const nx = me.x + ((foe.x - me.x) / d) * step;
    const ny = me.y + ((foe.y - me.y) / d) * step;
    if (positionWalkable(b.map, nx, ny)) b.moveBud(id, nx, ny, 0, true, me.fseq);
  }
}

/** One bud against one opponent of the city until someone drops: who won and how long it took (s). */
function duel(level: number, enemy: Enemy, weapon?: string, seed = 7) {
  let now = 1_000_000;
  const b = new Brawl(enemy.district, seed, now);
  b.addMobs([enemy]);
  const mob = [...b.units.values()].find((u) => u.enemyId === enemy.id)!;
  const start = nearestWalkable(enemy.district, mob.x + 1.6, mob.y) ?? { x: mob.x, y: mob.y - 1.5 };
  b.addBud('me', 'me', bud(level, weapon), start.x, start.y);
  const began = now;
  for (let i = 0; i < 20 * 120; i++) {
    now += BRAWL_TICK_MS;
    play(b, 'me', mob.id, now);
    const r = b.step(now);
    if (r.kills.length) return { won: true, seconds: (now - began) / 1000, kills: r.kills };
    if (r.downs.length) return { won: false, seconds: (now - began) / 1000, kills: [] };
  }
  return { won: false, seconds: Infinity, kills: [] };
}

describe('abilities', () => {
  it('every move of every weapon and every ultimate is a real-time ability', () => {
    for (const id of [...Object.keys(MOVES), ...Object.keys(ULTIMATES)])
      expect(ABILITIES[id as keyof typeof ABILITIES], id).toBeDefined();
    for (const [id, s] of Object.entries(ABILITIES)) {
      expect(s.cd, id).toBeGreaterThan(0);
      expect(s.windup, id).toBeGreaterThanOrEqual(0);
      expect(s.windup, id).toBeLessThan(900);
      if (s.shape === 'proj') expect(s.speed, id).toBeGreaterThan(5);
      if (s.shape === 'circle' || s.shape === 'self') expect(s.radius, id).toBeGreaterThan(0.5);
    }
  });

  it('gives five buttons: basic, two abilities, guard, and the ultimate from level 5', () => {
    const kit = kitOf(bud(3));
    expect(kit).toHaveLength(KIT_SLOTS);
    expect(kit[3]).toBe('garda');
    expect(kit[4]).toBeNull();
    expect(kitOf(bud(5))[4]).toBe('ult-piesci');
    expect(kitOf(bud(5))[0]).toBe('prosty');
  });
});

describe('safe zones', () => {
  it('rooms and the tutorial island are safe, cities only in their markets and harbours', () => {
    expect(safeMap('wyspa-startowa')).toBe(true);
    expect(safeMap('miasto-ziomkow-kawiarnia')).toBe(true);
    expect(safeMap(MAP)).toBe(false);
    expect(safeMap('pustkowie-ostepy')).toBe(false);
    const rynek = TURFS.find((t) => t.id === 'mz-rynek')!;
    const inside = cellFeet(MAP, (rynek.x0 + rynek.x1) >> 1, (rynek.y0 + rynek.y1) >> 1);
    expect(safeAt(MAP, inside.x, inside.y)).toBe(true);
    const park = TURFS.find((t) => t.id === 'mz-park-miejski')!;
    const out = cellFeet(MAP, (park.x0 + park.x1) >> 1, (park.y0 + park.y1) >> 1);
    expect(safeAt(MAP, out.x, out.y)).toBe(false);
    for (const id of SAFE_TURFS)
      expect(
        TURFS.some((t) => t.id === id),
        id,
      ).toBe(true);
  });

  it('gets a knocked-out bud up in a safe zone it can stand in', () => {
    const at = respawnPoint(MAP, 20, 20);
    expect(positionWalkable(MAP, at.x, at.y)).toBe(true);
    expect(safeAt(MAP, at.x, at.y)).toBe(true);
  });
});

describe('paths', () => {
  it('finds a way around walls', () => {
    const g = walkGrid(MAP)!;
    const a = nearestWalkable(MAP, 64.5, g.h - 1 - 53 + 0.2)!;
    const b = nearestWalkable(MAP, 80.5, g.h - 1 - 60 + 0.2)!;
    const path = findPath(MAP, a.x, a.y, b.x, b.y, 4000);
    expect(path.length).toBeGreaterThan(5);
    for (const p of path) expect(positionWalkable(MAP, p.x, p.y)).toBe(true);
    const end = path[path.length - 1]!;
    expect(Math.hypot(end.x - b.x, end.y - b.y)).toBeLessThan(1.5);
  });
});

describe('fights against the people of the districts', () => {
  it('an equal fight lasts seconds, not one blow and not forever', () => {
    for (const level of [1, 2, 3]) {
      const enemy =
        cityEnemy((e) => e.level === level && !e.boss && !e.ambush) ??
        cityEnemy((e) => !e.boss && !e.ambush);
      const results = [1, 2, 3, 4, 5].map((seed) =>
        duel(Math.max(level, enemy.level), enemy, undefined, seed),
      );
      const wins = results.filter((r) => r.won);
      expect(wins.length, `level ${level}`).toBeGreaterThanOrEqual(4);
      for (const r of wins) {
        expect(r.seconds, `level ${level}`).toBeGreaterThan(5);
        expect(r.seconds, `level ${level}`).toBeLessThan(30);
      }
    }
  });

  it('a much stronger opponent beats a beginner', () => {
    const strong = enemies.find((e) => e.level >= 7 && !e.boss && !e.ambush)!;
    const results = [1, 2, 3].map((seed) => duel(2, strong, undefined, seed));
    expect(results.filter((r) => r.won).length).toBeLessThanOrEqual(1);
  });

  it('every weapon wins an equal fight', () => {
    const enemy = cityEnemy((e) => e.level <= 3 && !e.boss && !e.ambush);
    for (const kind of WEAPON_KINDS) {
      const weapon = weaponOf(kind as WeaponKind);
      if (!weapon) continue;
      const level = Math.max(enemy.level + 1, catalogItem(weapon)!.minLevel ?? 1);
      const wins = [1, 2, 3, 4].map((s) => duel(level, enemy, weapon, s)).filter((r) => r.won);
      expect(wins.length, kind).toBeGreaterThanOrEqual(3);
    }
  });

  it('the beaten one stands up again later; everyone who hit it shares the win', () => {
    let now = 5_000_000;
    const enemy = cityEnemy((e) => !e.boss && !e.ambush);
    const b = new Brawl(MAP, 3, now);
    b.addMobs([enemy]);
    const mob = [...b.units.values()].find((u) => u.enemyId === enemy.id && u.spot === 0)!;
    const p1 = nearestWalkable(MAP, mob.x + 1, mob.y)!;
    const p2 = nearestWalkable(MAP, mob.x, mob.y - 1)!;
    b.addBud('a', 'a', bud(2), p1.x, p1.y);
    b.addBud('c', 'c', bud(2), p2.x, p2.y);
    let kill;
    for (let i = 0; i < 20 * 60 && !kill; i++) {
      now += BRAWL_TICK_MS;
      play(b, 'a', mob.id, now);
      play(b, 'c', mob.id, now);
      kill = b.step(now).kills[0];
    }
    expect(kill).toBeDefined();
    expect(new Set(kill!.by)).toEqual(new Set(['a', 'c']));
    expect(mob.downUntil).toBeGreaterThan(now);
    now += MOB_RESPAWN_MS + 100;
    b.step(now);
    expect(mob.downUntil).toBe(0);
    expect(mob.hp).toBe(mob.maxHp);
  });

  it('lurkers jump out when a bud comes close; others wait until they are hit', () => {
    let now = 1000;
    const lurker = enemies.find((e) => e.ambush)!;
    const b = new Brawl(lurker.district, 1, now);
    b.addMobs([lurker]);
    const mob = [...b.units.values()].find((u) => u.enemyId === lurker.id)!;
    expect(mob.lurking).toBe(true);
    const near = nearestWalkable(lurker.district, mob.x + 1.5, mob.y)!;
    b.addBud('me', 'me', bud(4), near.x, near.y);
    now += BRAWL_TICK_MS;
    const r = b.step(now);
    expect(r.events.some((e) => e.k === 'aggro' && e.u === mob.id)).toBe(true);
    expect(mob.target).toBe('me');

    const calm = cityEnemy((e) => !e.ambush);
    const c = new Brawl(MAP, 1, now);
    c.addMobs([calm]);
    const m2 = [...c.units.values()].find((u) => u.enemyId === calm.id)!;
    c.addBud('me', 'me', bud(4), m2.x + 1, m2.y);
    for (let i = 0; i < 40; i++) c.step((now += BRAWL_TICK_MS));
    expect(m2.target).toBeNull();
  });

  it('gives up when led away and goes home to heal', () => {
    let now = 1000;
    const enemy = cityEnemy((e) => !e.boss && !e.ambush);
    const b = new Brawl(MAP, 1, now);
    b.addMobs([enemy]);
    const mob = [...b.units.values()].find((u) => u.enemyId === enemy.id && u.spot === 0)!;
    b.addBud('me', 'me', bud(3), mob.x + 1, mob.y);
    b.act('me', 0, mob.x, mob.y, mob.id);
    for (let i = 0; i < 4; i++) b.step((now += BRAWL_TICK_MS));
    expect(mob.target).toBe('me');
    expect(mob.hp).toBeLessThan(mob.maxHp);
    // the bud walks far away (a teleport is fine for the test)
    const far = nearestWalkable(MAP, mob.home.x + 30, mob.home.y)!;
    b.moveBud('me', far.x, far.y, 0, false, 99);
    for (let i = 0; i < 20 * 20; i++) b.step((now += BRAWL_TICK_MS));
    expect(mob.target).toBeNull();
    expect(Math.hypot(mob.x - mob.home.x, mob.y - mob.home.y)).toBeLessThan(0.5);
    expect(mob.hp).toBe(mob.maxHp);
  });
});

describe('buds against buds', () => {
  const spot = () => {
    const park = TURFS.find((t) => t.id === 'mz-park-miejski')!;
    const c = cellFeet(MAP, (park.x0 + park.x1) >> 1, (park.y0 + park.y1) >> 1);
    return nearestWalkable(MAP, c.x, c.y)!;
  };

  it('only from level 6, never the same crew, never in a safe zone', () => {
    const now = 1000;
    const b = new Brawl(MAP, 1, now);
    const at = spot();
    const a = b.addBud('a', 'a', bud(PVP_MIN_LEVEL), at.x, at.y);
    const c = b.addBud('c', 'c', bud(PVP_MIN_LEVEL), at.x + 1, at.y);
    const low = b.addBud('low', 'low', bud(PVP_MIN_LEVEL - 1), at.x - 1, at.y);
    const mate = b.addBud('mate', 'a', bud(PVP_MIN_LEVEL), at.x, at.y + 1);
    expect(b.hostile(a, c)).toBe(true);
    expect(b.hostile(a, low)).toBe(false);
    expect(b.hostile(a, mate)).toBe(false);
    const rynek = TURFS.find((t) => t.id === 'mz-rynek')!;
    const safe = nearestWalkable(
      MAP,
      cellFeet(MAP, (rynek.x0 + rynek.x1) >> 1, (rynek.y0 + rynek.y1) >> 1).x,
      cellFeet(MAP, 0, (rynek.y0 + rynek.y1) >> 1).y,
    )!;
    c.x = safe.x;
    c.y = safe.y;
    expect(b.hostile(a, c)).toBe(false);
  });

  it('a knockout: down for a while, then up in a safe zone with full health and a moment of peace', () => {
    let now = 1000;
    const b = new Brawl(MAP, 2, now);
    const at = spot();
    b.addBud('a', 'a', bud(12), at.x, at.y);
    const v = b.addBud('v', 'v', bud(6), at.x + 1, at.y);
    let down;
    for (let i = 0; i < 20 * 60 && !down; i++) {
      now += BRAWL_TICK_MS;
      play(b, 'a', 'v', now);
      down = b.step(now).downs[0];
    }
    expect(down?.unit.id).toBe('v');
    expect(down?.by?.id).toBe('a');
    // knocked out: reports of the game are ignored, nothing can be cast
    expect(b.moveBud('v', at.x, at.y, 0, true, v.fseq)).toBe(false);
    expect(b.act('v', 0, at.x, at.y)).toBe('down');
    now += KO_MS + 50;
    const r = b.step(now);
    const up = r.events.find((e) => e.k === 'rsp' && e.v === 'v')!;
    expect(up).toBeDefined();
    expect(v.hp).toBe(v.maxHp);
    expect(safeAt(MAP, v.x, v.y)).toBe(true);
    expect(b.hostile(b.units.get('a')!, v)).toBe(false);
  });

  it('an even duel between two buds is over in seconds', () => {
    for (const level of [6, 12]) {
      let now = 1000;
      const b = new Brawl(MAP, level, now);
      const at = spot();
      b.addBud('a', 'a', bud(level), at.x, at.y);
      b.addBud('c', 'c', bud(level), at.x + 1.2, at.y);
      let down;
      for (let i = 0; i < 20 * 60 && !down; i++) {
        now += BRAWL_TICK_MS;
        play(b, 'a', 'c', now);
        play(b, 'c', 'a', now);
        down = b.step(now).downs[0];
      }
      expect(down, `level ${level}`).toBeDefined();
      const seconds = (now - 1000) / 1000;
      expect(seconds, `level ${level}`).toBeGreaterThan(6);
      expect(seconds, `level ${level}`).toBeLessThan(25);
    }
  });

  it('cooldowns hold, and a report from before a forced move is ignored', () => {
    let now = 1000;
    const b = new Brawl(MAP, 2, now);
    const at = spot();
    const me = b.addBud('a', 'a', bud(6), at.x, at.y);
    expect(b.act('a', 0, at.x + 1, at.y)).toBeNull();
    b.step((now += 300));
    expect(b.act('a', 0, at.x + 1, at.y)).toBe('cooldown');
    expect(b.act('a', 7, at.x + 1, at.y)).toBe('bad');
    expect(b.act('a', 4, at.x + 1, at.y)).toBeNull(); // the ultimate from level 5: a dash
    b.step((now += 400));
    expect(me.fseq).toBe(1);
    expect(b.moveBud('a', at.x, at.y, 0, true, 0)).toBe(false);
    expect(b.moveBud('a', me.x, me.y, 0, true, 1)).toBe(true);
  });
});

describe('knockout coins', () => {
  it('takes a small share of the pocket, capped', () => {
    expect(knockoutLoss(0, { percent: 2, max: 20 })).toBe(0);
    expect(knockoutLoss(100, { percent: 2, max: 20 })).toBe(2);
    expect(knockoutLoss(10_000, { percent: 2, max: 20 })).toBe(20);
    expect(knockoutLoss(400, { percent: 5, max: 50 })).toBe(20);
  });
});

// keep the unit type in use for readers of the test
export type { Unit };
