import { describe, expect, it } from 'vitest';
import {
  NEW_SHIELD_HOURS,
  hallSpot,
  RAID_RETRY_MINUTES,
  plotPrice,
  type DistrictsResponse,
  type FightResponse,
  type LandResponse,
} from '@buds/shared';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { createMemoryStore } from '../src/store/memory.js';

const look = {
  gender: 'on',
  mood: 'radosny',
  skin: 1,
  hair: 'krotkie',
  hairColor: 0,
  outfit: 'bluza',
  outfitColor: 1,
  pantsColor: 0,
};

const H = 3_600_000;
/** Free spots for a 3×3 building in a new district (gate to the south): either side of the gate's sector. */
const A = { x: 7, y: 22 };
const B = { x: 17, y: 22 };
const HALL = hallSpot('s');
const PRICE = plotPrice('pustkowie-ostepy');
/** XP of levels 3 and 6. */
const LEVEL_3 = 400;
const LEVEL_6 = 2500;

async function setup(extraEnv: Record<string, string> = {}) {
  const store = createMemoryStore();
  let clock = Date.UTC(2026, 9, 26, 12);
  const app = createApp(
    loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), RATE_LIMIT_PER_MINUTE: '1000', ...extraEnv }),
    { store, now: () => new Date(clock) },
  );
  const bud = async (name: string) => {
    const created = await app.request('/v1/buds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, look }),
    });
    const { token, bud } = (await created.json()) as { token: string; bud: { slug: string } };
    const call = (method: string, path: string, body?: unknown, auth = true) =>
      app.request(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(auth ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    /** Levels and coins the way the game grants them (a cache). */
    let n = 0;
    const grant = (xp: number, coins: number) =>
      store.openCache(bud.slug, `test-${n++}`, coins, xp);
    return { slug: bud.slug, call, grant };
  };
  const json = async <T = LandResponse>(res: Response) =>
    (await res.json()) as T & { error?: { code: string; message: string } };
  return {
    app,
    store,
    bud,
    json,
    now: () => clock,
    wait: (ms: number) => {
      clock += ms;
    },
  };
}

describe('dystrykty', () => {
  it('buys a free plot for coins, by level, under a proper name; one per bud, one per plot', async () => {
    const { bud, json, store } = await setup();
    const ala = await bud('Ala');
    expect((await ala.call('GET', '/v1/land', undefined, false)).status).toBe(401);
    expect((await json(await ala.call('GET', '/v1/land'))).land).toBeNull();
    const buy = (name = 'Nowa Huta', plot = 'ostepy-1') =>
      ala.call('POST', '/v1/land', { plot, name });
    expect((await buy()).status).toBe(403);
    await ala.grant(LEVEL_3, PRICE - 1);
    expect((await json(await buy())).error?.code).toBe('not_enough_coins');
    await ala.grant(0, 1);
    expect((await buy('Nowa Huta', 'atlantyda-9')).status).toBe(404);
    expect((await json(await buy('Kurwa City'))).error?.message).toBe('Tej nazwy nie da się użyć');
    const made = await buy('  Nowa   Huta ');
    expect(made.status).toBe(201);
    const view = (await json(made)).land!;
    expect(view.land).toMatchObject({ plot: 'ostepy-1', name: 'Nowa Huta', clearing: null });
    expect(view.land.sectors).toHaveLength(4);
    expect(view.rank).toBe('Osada');
    expect(view.land.buildings[0]).toMatchObject({ kind: 'ratusz', x: HALL.x, y: HALL.y });
    expect((await store.wallet(ala.slug)).coins).toBe(0);
    expect((await buy('Druga', 'ostepy-2')).status).toBe(409);

    const bartek = await bud('Bartek');
    await bartek.grant(LEVEL_3, 1000);
    const taken = await bartek.call('POST', '/v1/land', { plot: 'ostepy-1', name: 'Moja' });
    expect((await json(taken)).error?.code).toBe('taken');
    expect((await store.wallet(bartek.slug)).coins).toBe(1000);
  });

  it('shows every district on a wasteland to anyone, without its stores', async () => {
    const { bud, json, store } = await setup();
    const ala = await bud('Ala');
    await ala.grant(LEVEL_3, PRICE);
    await ala.call('POST', '/v1/land', { plot: 'ostepy-2', name: 'Zielone Tarasy' });
    // a document from the first plan (stages, no sectors) is left out instead of breaking the list
    const old = await bud('Olek');
    const legacy = { plot: 'ostepy-3', name: 'Stara Huta', stage: 1 };
    await store.createLand(old.slug, 'ostepy-3', 'pustkowie-ostepy', legacy, 45, 0);
    const res = await ala.call('GET', '/v1/districts/pustkowie-ostepy', undefined, false);
    expect(res.status).toBe(200);
    const list = await json<DistrictsResponse>(res);
    expect(list.districts).toHaveLength(1);
    expect(list.districts[0]).toMatchObject({
      plot: 'ostepy-2',
      name: 'Zielone Tarasy',
      owner: { name: 'Ala', level: 3 },
    });
    expect(JSON.stringify(list)).not.toContain('resources');
    const empty = await json<DistrictsResponse>(
      await ala.call('GET', '/v1/districts/pustkowie-wydmy'),
    );
    expect(empty.districts).toEqual([]);
  });

  it('renames, builds, produces by the server clock, collects and sells, never trusting the game', async () => {
    const { bud, json, store, wait } = await setup();
    const ala = await bud('Ala');
    await ala.grant(LEVEL_3, PRICE);
    await ala.call('POST', '/v1/land', { plot: 'ostepy-1', name: 'Nowa Huta' });
    const renamed = await ala.call('POST', '/v1/land/name', { name: 'Zielone Wzgórze' });
    expect((await json(renamed)).land!.land.name).toBe('Zielone Wzgórze');
    expect((await ala.call('POST', '/v1/land/name', { name: 'a' })).status).toBe(400);

    const build = (kind: string, at: { x: number; y: number }) =>
      ala.call('POST', '/v1/land/build', { kind, ...at });
    const built = await build('betoniarnia', A);
    expect(built.status).toBe(200);
    const plant = (await json(built)).land!.land.buildings.find((b) => b.kind === 'betoniarnia')!;
    expect((await json(await build('betoniarnia', B))).error?.code).toBe('too_many');
    expect((await json(await build('szklarnia', { x: 7, y: 17 }))).error?.code).toBe('outside');
    expect((await json(await build('szklarnia', HALL))).error?.code).toBe('occupied');

    wait(60_000 + 2 * H);
    const got = await json(await ala.call('POST', '/v1/land/collect', { id: plant.id }));
    expect(got.gathered?.beton).toBe(48);
    expect(got.land!.land.resources.beton).toBe(100 + 48);
    expect((await ala.call('POST', '/v1/land/collect', { id: 999 })).status).toBe(404);

    const sell = (amount: number) =>
      ala.call('POST', '/v1/land/sell', { resource: 'beton', amount });
    expect((await json(await sell(105))).coins).toBe(40);
    expect((await sell(500)).status).toBe(409);
    expect((await store.wallet(ala.slug)).coins).toBe(40);
  });

  it('clears the plot sector by sector next to the district, one at a time, by the server clock', async () => {
    const { bud, json, store, wait } = await setup();
    const ala = await bud('Ala');
    await ala.grant(LEVEL_3, PRICE + 500);
    await ala.call('POST', '/v1/land', { plot: 'ostepy-1', name: 'Nowa Huta' });
    const clear = (sector: unknown) => ala.call('POST', '/v1/land/clear', { sector });
    expect((await clear('x')).status).toBe(400);
    expect((await json(await clear(0))).error?.code).toBe('not_next');
    const started = await json(await clear(20));
    expect(started.land!.land.clearing).toMatchObject({ sector: 20 });
    expect(started.coins).toBe(500 - 60);
    expect((await store.wallet(ala.slug)).coins).toBe(500 - 60);
    expect((await json(await clear(24))).error?.code).toBe('clearing');
    wait(60_000);
    const done = await json(await ala.call('GET', '/v1/land'));
    expect(done.land!.land.sectors).toContain(20);
    expect(done.land!.land.clearing).toBeNull();
    // the cleared sector can be built on now
    const shed = await ala.call('POST', '/v1/land/build', { kind: 'szklarnia', x: 2, y: 22 });
    expect(shed.status).toBe(200);
    expect((await json(await clear(15))).land!.land.clearing).toMatchObject({ sector: 15 });
    expect((await ala.call('POST', '/v1/land/buildings/abc/upgrade')).status).toBe(400);
    expect((await ala.call('POST', '/v1/land/buildings/77/upgrade')).status).toBe(404);
  });

  it('two saves from one version: only one wins, the other works it out again', async () => {
    const { bud, store } = await setup();
    const ala = await bud('Ala');
    await ala.grant(LEVEL_3, PRICE);
    await ala.call('POST', '/v1/land', { plot: 'ostepy-1', name: 'Nowa Huta' });
    // 100 concrete: two vertical farms (40 each) fit, a recycling plant (50) then would not
    const results = await Promise.all([
      ala.call('POST', '/v1/land/build', { kind: 'szklarnia', ...A }),
      ala.call('POST', '/v1/land/build', { kind: 'szklarnia', ...B }),
      ala.call('POST', '/v1/land/build', { kind: 'recykling', x: 8, y: 15 }),
    ]);
    const ok = results.filter((r) => r.status === 200).length;
    expect(ok).toBeGreaterThanOrEqual(1);
    const state = (await store.getLand(ala.slug))!.state as {
      resources: { beton: number };
      buildings: unknown[];
    };
    expect(state.resources.beton).toBeGreaterThanOrEqual(0);
    expect(state.buildings.length).toBe(1 + ok);
  });

  it('raids from level 6: shield, rest after a try, a duel against the fortified owner, loot or a log', async () => {
    const { app, bud, json, store, wait, now } = await setup();
    const ala = await bud('Ala');
    const bartek = await bud('Bartek');
    await ala.grant(LEVEL_6, PRICE);
    await bartek.grant(LEVEL_3, PRICE);
    await ala.call('POST', '/v1/land', { plot: 'ostepy-1', name: 'Nowa Huta' });
    await bartek.call('POST', '/v1/land', { plot: 'ostepy-2', name: 'Zielone Tarasy' });
    const raidOn = (plot: string) => ala.call('POST', '/v1/land/raids', { plot });

    expect((await json(await raidOn('ostepy-2'))).error?.code).toBe('target_too_low');
    await bartek.grant(LEVEL_6 - LEVEL_3, 0);
    expect((await json(await raidOn('ostepy-2'))).error?.code).toBe('shielded');
    expect((await json(await raidOn('ostepy-1'))).error?.code).toBe('own');
    expect((await raidOn('ostepy-3')).status).toBe(404);

    wait((NEW_SHIELD_HOURS + 1) * H);
    const started = await raidOn('ostepy-2');
    expect(started.status).toBe(201);
    const fight = (await json<FightResponse>(started)).fight;
    expect(fight.enemyId).toBe('raid-ostepy-2');
    expect(fight.enemy.name).toBe('Bartek');
    // the same level, so the extra health is the district's defence
    expect(fight.enemy.maxHp).toBeGreaterThan(fight.bud.maxHp);
    expect((await json(await raidOn('ostepy-2'))).error?.code).toBe('resting');

    // played to the end: a win takes loot and shields the district, a loss goes in its log
    const last = (await app.fights.finishShadow(ala.slug, fight.id, 'won', true))!;
    expect(last.raid).toMatchObject({ plot: 'ostepy-2', district: 'Zielone Tarasy' });
    const defender = (await store.getLand(bartek.slug))!.state as {
      raids: { by: string; won: boolean }[];
      shieldUntil: number;
    };
    expect(defender.raids[0]).toMatchObject({ by: 'Ala', won: last.raid!.won });
    if (last.raid!.won) expect(defender.shieldUntil).toBeGreaterThan(now());

    wait(RAID_RETRY_MINUTES * 60_000 + 1000);
    expect([201, 409]).toContain((await raidOn('ostepy-2')).status);
  });

  it('keeps a new district safe for LAND_SHIELD_HOURS (48 by default)', async () => {
    for (const [hours, env] of [
      [NEW_SHIELD_HOURS, {}],
      [0, { LAND_SHIELD_HOURS: '0' }],
    ] as const) {
      const { bud, json, now } = await setup(env);
      const ala = await bud('Ala');
      await ala.grant(LEVEL_3, PRICE);
      const made = await json(
        await ala.call('POST', '/v1/land', { plot: 'ostepy-1', name: 'Nowa Huta' }),
      );
      expect(made.land!.land.shieldUntil).toBe(now() + hours * H);
    }
    expect(() =>
      loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), LAND_SHIELD_HOURS: '-1' }),
    ).toThrow();
  });

  it('ranks the mightiest districts in public, by their names', async () => {
    const { bud } = await setup();
    const ala = await bud('Ala');
    await ala.grant(LEVEL_3, PRICE);
    await ala.call('POST', '/v1/land', { plot: 'ostepy-3', name: 'Stalowe Miasto' });
    const top = (await (await ala.call('GET', '/v1/land/top', undefined, false)).json()) as {
      lands: { name: string; district: string; route: string; power: number }[];
    };
    expect(top.lands[0]).toMatchObject({
      name: 'Ala',
      district: 'Stalowe Miasto',
      route: 'pustkowie-ostepy',
    });
    expect(top.lands[0]!.power).toBeGreaterThan(0);
  });
});
