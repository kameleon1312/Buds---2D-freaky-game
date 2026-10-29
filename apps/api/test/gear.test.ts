import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import {
  CONTENT,
  MAX_BUDS_PER_ACCOUNT,
  catalogItem,
  type AccountBud,
  type AuthConfigResponse,
  type AccountBudsResponse,
  type ApiError,
  type BuyResponse,
  type CreateBudResponse,
  type EquipmentResponse,
  type MovesResponse,
  kitOf,
  rankCost,
  MOVES_BY_WEAPON,
  type OpenCacheResponse,
  type PairCodeResponse,
} from '@buds/shared';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { createMemoryStore } from '../src/store/memory.js';
import type { BudStore } from '../src/store/types.js';

const SECRET = 'x'.repeat(32);
const look = {
  gender: 'on',
  mood: 'radosny',
  skin: 1,
  hair: 'krotkie',
  hairColor: 0,
  outfit: 'bluza',
  outfitColor: 1,
  pantsColor: 0,
} as const;

// a key pair standing in for the project's asymmetric signing key (ES256, like new Supabase projects)
const keyPair = await generateKeyPair('ES256');
const jwks = createLocalJWKSet({
  keys: [{ ...(await exportJWK(keyPair.publicKey)), kid: 'k1', alg: 'ES256' }],
});

async function es256(sub: string, claims: Record<string, unknown> = {}) {
  return new SignJWT({ role: 'authenticated', email: `${sub}@buds.example`, ...claims })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setSubject(sub)
    .setExpirationTime('5m')
    .sign(keyPair.privateKey);
}

const hs256 = (sub: string) =>
  sign({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 60 }, SECRET, 'HS256');

function setup(store: BudStore = createMemoryStore()) {
  const app = createApp(loadEnv({ SUPABASE_JWT_SECRET: SECRET, CREATE_LIMIT_PER_MINUTE: '100' }), {
    store,
    jwks,
  });
  const json = (body: unknown, token?: string) => ({
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const create = async (name = 'Gracz', accountToken?: string) => {
    const res = await app.request('/v1/buds', {
      method: 'POST',
      ...json({ name, look }, accountToken),
    });
    return { res, body: (await res.json()) as CreateBudResponse };
  };
  return { app, store, json, create };
}

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

/** Gives a bud the XP of a level (through the quest grant, the only XP door of the memory store). */
const reachLevel = (store: BudStore, slug: string, level: number) =>
  store.completeQuest(slug, `test-level-${level}`, 100 * (level - 1) ** 2);

describe('gear', () => {
  it('starts empty, wears owned items and computes stats', async () => {
    const { app, store, json, create } = setup();
    const { body } = await create();
    const t = body.token;
    let eq = (await (
      await app.request('/v1/buds/me/equipment', auth(t))
    ).json()) as EquipmentResponse;
    expect(Object.values(eq.slots).every((v) => v === null)).toBe(true);
    expect(eq.stats).toMatchObject({ speed: 0, armor: 0, luck: 0 });

    // not owned yet
    let res = await app.request('/v1/buds/me/equipment/feet', {
      method: 'PUT',
      ...json({ itemId: 'buty-sprintery' }, t),
    });
    expect(res.status).toBe(403);

    await store.grantItem(body.bud.slug, 'buty-sprintery', 'reward');
    // owned, but the bud is too young for it
    res = await app.request('/v1/buds/me/equipment/feet', {
      method: 'PUT',
      ...json({ itemId: 'buty-sprintery' }, t),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as ApiError).error.code).toBe('level_too_low');
    await reachLevel(store, body.bud.slug, 6);
    res = await app.request('/v1/buds/me/equipment/feet', {
      method: 'PUT',
      ...json({ itemId: 'buty-sprintery' }, t),
    });
    expect(res.status).toBe(200);
    eq = (await res.json()) as EquipmentResponse;
    expect(eq.slots.feet).toBe('buty-sprintery');
    expect(eq.stats.speed).toBe(catalogItem('buty-sprintery')!.bonus!.speed);

    // taking it off
    eq = (await (
      await app.request('/v1/buds/me/equipment/feet', {
        method: 'PUT',
        ...json({ itemId: null }, t),
      })
    ).json()) as EquipmentResponse;
    expect(eq.slots.feet).toBeNull();
    expect(eq.stats.speed).toBe(0);
  });

  it('refuses the wrong slot, unknown slots and looks', async () => {
    const { app, store, json, create } = setup();
    const { body } = await create();
    await store.grantItem(body.bud.slug, 'buty-sprintery', 'reward');
    const put = (slot: string, itemId: unknown) =>
      app.request(`/v1/buds/me/equipment/${slot}`, {
        method: 'PUT',
        ...json({ itemId }, body.token),
      });
    expect((await put('head', 'buty-sprintery')).status).toBe(400);
    expect((await put('torso', 'outfit-bluza')).status).toBe(400); // looks are not gear
    expect((await put('ogon', 'buty-sprintery')).status).toBe(404);
    expect((await put('feet', 42)).status).toBe(400);
    expect((await app.request('/v1/buds/me/equipment')).status).toBe(401);
  });

  it('adds skill ranks from gear', async () => {
    const { app, store, json, create } = setup();
    const { body } = await create();
    await store.grantItem(body.bud.slug, 'monokl', 'reward');
    await reachLevel(store, body.bud.slug, 5);
    const eq = (await (
      await app.request('/v1/buds/me/equipment/face', {
        method: 'PUT',
        ...json({ itemId: 'monokl' }, body.token),
      })
    ).json()) as EquipmentResponse;
    expect(eq.stats.skills.spryt).toBe(1);
  });
});

describe('coin shop', () => {
  it('sells gear for coins, once, never on credit', async () => {
    const { app, store, create } = setup();
    const { body } = await create();
    const buy = (id: string) =>
      app.request(`/v1/shop/${id}/buy`, { method: 'POST', ...auth(body.token) });

    let res = await buy('buty-trampki');
    expect(res.status).toBe(409);
    expect(((await res.json()) as ApiError).error.code).toBe('not_enough_coins');

    // earn coins from caches, then buy
    for (const c of CONTENT.caches.slice(0, 6))
      await store.openCache(body.bud.slug, c.id, c.coins, 0);
    const before = (await store.wallet(body.bud.slug)).coins;
    res = await buy('buty-trampki');
    expect(res.status).toBe(200);
    const bought = (await res.json()) as BuyResponse;
    expect(bought.coins).toBe(before - catalogItem('buty-trampki')!.price.amount);
    expect(
      (await store.items(body.bud.slug)).find((i) => i.itemId === 'buty-trampki')?.source,
    ).toBe('shop');
    expect((await buy('buty-trampki')).status).toBe(409); // owned
  });

  it('only sells shop items', async () => {
    const { app, create } = setup();
    const { body } = await create();
    const buy = (id: string) =>
      app.request(`/v1/shop/${id}/buy`, { method: 'POST', ...auth(body.token) });
    expect((await buy('cylinder')).status).toBe(404); // a quest reward
    expect((await buy('buty-sprintery-zlote')).status).toBe(404); // premium, not for coins
    expect((await buy('nic')).status).toBe(404);
    expect((await app.request('/v1/shop/buty-trampki/buy', { method: 'POST' })).status).toBe(401);
  });

  it('turns luck into more coins from caches', async () => {
    const { app, store, json, create } = setup();
    const { body } = await create();
    await store.grantItem(body.bud.slug, 'muszla-szczescia', 'reward');
    await reachLevel(store, body.bud.slug, 4);
    await app.request('/v1/buds/me/equipment/accessory', {
      method: 'PUT',
      ...json({ itemId: 'muszla-szczescia' }, body.token),
    });
    const cache = CONTENT.caches.find((c) => c.coins >= 50)!;
    const res = await app.request(`/v1/buds/me/caches/${cache.id}/open`, {
      method: 'POST',
      ...auth(body.token),
    });
    const opened = (await res.json()) as OpenCacheResponse;
    expect(opened.coinsGained).toBe(Math.round(cache.coins * 1.06));
  });
});

describe('accounts', () => {
  it('accepts asymmetric (ES256) and legacy (HS256) account tokens', async () => {
    const { app } = setup();
    expect((await app.request('/v1/me', auth(await es256('u-es')))).status).toBe(200);
    expect((await app.request('/v1/me', auth(await hs256('u-hs')))).status).toBe(200);
  });

  it('rejects forged, anonymous and unsigned tokens', async () => {
    const { app } = setup();
    const other = await generateKeyPair('ES256');
    const forged = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject('u-x')
      .setExpirationTime('5m')
      .sign(other.privateKey);
    expect((await app.request('/v1/me', auth(forged))).status).toBe(401);
    expect((await app.request('/v1/me', auth(await es256('u', { role: 'anon' })))).status).toBe(
      401,
    );
    const none = `${btoa(JSON.stringify({ alg: 'none' }))}.${btoa(JSON.stringify({ sub: 'u', role: 'authenticated' }))}.`;
    expect((await app.request('/v1/me', auth(none))).status).toBe(401);
    expect((await app.request('/v1/account/buds')).status).toBe(401);
  });

  it('creates buds into the account and keeps the data private to it', async () => {
    const { app, create } = setup();
    const alice = await es256('alice');
    const { res, body } = await create('Ala', alice);
    expect(res.status).toBe(201);
    const list = (await (
      await app.request('/v1/account/buds', auth(alice))
    ).json()) as AccountBudsResponse;
    expect(list.buds.map((b) => b.bud.slug)).toEqual([body.bud.slug]);
    expect(list.buds[0]).toMatchObject({ level: 1, coins: 0, questsDone: 0, cachesFound: 0 });

    const bob = await es256('bob');
    const other = (await (
      await app.request('/v1/account/buds', auth(bob))
    ).json()) as AccountBudsResponse;
    expect(other.buds).toEqual([]);
  });

  it('refuses to create a bud with an invalid account token', async () => {
    const { create } = setup();
    expect((await create('Ktos', 'zly.token.tutaj')).res.status).toBe(401);
  });

  it('claims a guest bud once, for one account', async () => {
    const { app, json, create } = setup();
    const { body } = await create('Gosc');
    const alice = await es256('alice');
    const claim = (token: string, account: string) =>
      app.request('/v1/account/buds/claim', { method: 'POST', ...json({ token }, account) });

    // a phone paired while it was a guest
    const pair = (await (
      await app.request('/v1/buds/me/pair-code', { method: 'POST', ...json({}, body.token) })
    ).json()) as PairCodeResponse;
    const phone = (await (
      await app.request('/v1/pair', { method: 'POST', ...json({ code: pair.code }) })
    ).json()) as CreateBudResponse;

    let res = await claim(body.token, alice);
    expect(res.status).toBe(200);
    expect(((await res.json()) as AccountBud).bud.slug).toBe(body.bud.slug);
    // the guest key is spent by the claim
    expect((await claim(body.token, alice)).status).toBe(404);
    res = await claim(phone.token, await es256('bob'));
    expect(res.status).toBe(409);
    expect(((await res.json()) as ApiError).error.code).toBe('bud_taken');
    expect((await claim('x'.repeat(40), alice)).status).toBe(404);
  });

  it('gives an owner a device token to play an account bud in the game, nobody else', async () => {
    const { app, json, create } = setup();
    const alice = await es256('alice');
    const { body } = await create('Konto', alice);
    const device = (account?: string) =>
      app.request(`/v1/account/buds/${body.bud.slug}/device`, {
        method: 'POST',
        ...json({}, account),
      });

    expect((await device()).status).toBe(401);
    expect((await device(await es256('bob'))).status).toBe(404);
    const res = await device(alice);
    expect(res.status).toBe(200);
    const issued = (await res.json()) as CreateBudResponse;
    expect(issued.bud.slug).toBe(body.bud.slug);
    expect(issued.token).not.toBe(body.token);
    // the new token plays the same bud
    const me = await app.request('/v1/buds/me', {
      headers: { Authorization: `Bearer ${issued.token}` },
    });
    expect(((await me.json()) as { bud: { slug: string } }).bud.slug).toBe(body.bud.slug);
  });

  it('tells the game how to sign in (public values only)', async () => {
    const { app } = setup();
    const res = await app.request('/v1/auth/config');
    expect(res.status).toBe(200);
    const config = (await res.json()) as AuthConfigResponse;
    expect(config.enabled).toBe(false); // the test server has no Supabase
    expect(JSON.stringify(config)).not.toContain(SECRET);
  });

  it('links a bud from the game with the code it shows, once', async () => {
    const { app, json, create } = setup();
    const { body } = await create('Zgry');
    const alice = await es256('alice');
    const gameCode = async () =>
      (
        (await (
          await app.request('/v1/buds/me/pair-code', { method: 'POST', ...json({}, body.token) })
        ).json()) as PairCodeResponse
      ).code;
    const link = (code: string, account?: string) =>
      app.request('/v1/account/buds/link', { method: 'POST', ...json({ code }, account) });

    expect((await link(await gameCode())).status).toBe(401); // signed-in users only
    const code = await gameCode();
    let res = await link(code, alice);
    expect(res.status).toBe(200);
    expect(((await res.json()) as AccountBud).bud.slug).toBe(body.bud.slug);
    // the code is used up
    res = await link(code, alice);
    expect(res.status).toBe(404);
    expect(((await res.json()) as ApiError).error.code).toBe('invalid_code');
    // on the account now: the game hands out no more codes, so no other account can take it
    res = await app.request('/v1/buds/me/pair-code', { method: 'POST', ...json({}, body.token) });
    expect(res.status).toBe(403);
    expect(((await res.json()) as ApiError).error.code).toBe('bud_on_account');
    expect((await link('ab', alice)).status).toBe(400);
  });

  it('limits buds per account', async () => {
    const { create } = setup();
    const alice = await es256('alice');
    for (let i = 0; i < MAX_BUDS_PER_ACCOUNT; i++)
      expect((await create(`Bud${i}`, alice)).res.status).toBe(201);
    expect((await create('Jeszcze', alice)).res.status).toBe(409);
  });

  it('issues pairing codes only for the account’s own buds', async () => {
    const { app, create } = setup();
    const alice = await es256('alice');
    const { body } = await create('Ala', alice);
    const code = (slug: string, account: string) =>
      app.request(`/v1/account/buds/${slug}/pair-code`, { method: 'POST', ...auth(account) });
    const res = await code(body.bud.slug, alice);
    expect(res.status).toBe(201);
    const { code: pair } = (await res.json()) as PairCodeResponse;
    expect(pair).toMatch(/^[A-Z2-9]{6}$/);
    expect((await code(body.bud.slug, await es256('bob'))).status).toBe(404);
    // the code links the game like a code from the bud page
    const paired = await app.request('/v1/pair', {
      method: 'POST',
      body: JSON.stringify({ code: pair }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(paired.status).toBe(201);
  });
});

describe('fight ends (live fights, fights.ts)', () => {
  async function ready(level = 1) {
    const ctx = setup();
    const { body } = await ctx.create();
    if (level > 1) await reachLevel(ctx.store, body.bud.slug, level);
    const bud = (await ctx.store.getBySlug(body.bud.slug))!;
    return { ...ctx, body, bud, fights: ctx.app.fights };
  }

  it('the old turn-by-turn routes are gone', async () => {
    const { app, json, body } = await ready();
    for (const path of ['/v1/fights', '/v1/fights/x/move', '/v1/fights/x/flee'])
      expect((await app.request(path, { method: 'POST', ...json({}, body.token) })).status).toBe(
        404,
      );
  });

  it('fights with fists by default and the moves of the worn weapon', async () => {
    const { app, store, json, body, bud, fights } = await ready(3);
    expect((await fights.fighterOf(bud, true)).moves).toEqual(MOVES_BY_WEAPON.piesci);
    await store.grantItem(body.bud.slug, 'kij-hejnal', 'reward');
    await app.request('/v1/buds/me/equipment/held', {
      method: 'PUT',
      ...json({ itemId: 'kij-hejnal' }, body.token),
    });
    const armed = await fights.fighterOf(bud, true);
    expect(armed.weapon).toBe('kij');
    expect(armed.moves).toEqual(MOVES_BY_WEAPON.kij);
  });

  it('a won fight grants XP, coins and maybe loot, written down as a won fight', async () => {
    const { store, body, bud, fights } = await ready(4);
    const me = await fights.fighterOf(bud, true);
    const win = (await fights.winMob(bud.slug, 'dresiarz-z-bramy', 0, me))!;
    const reward = win.reward!;
    expect(reward.xpGained).toBeGreaterThan(0);
    expect(reward.coinsGained).toBeGreaterThan(0);
    expect((await store.getBySlug(body.bud.slug))!.xp).toBe(reward.xp);
    expect((await store.wallet(body.bud.slug)).coins).toBe(reward.coins);
    if (reward.item)
      expect((await store.items(body.bud.slug)).some((i) => i.itemId === reward.item)).toBe(true);
    expect(await store.lastWin(bud.slug, 'dresiarz-z-bramy')).not.toBeNull();
    expect(await fights.winMob(bud.slug, 'nikt', 0, me)).toBeNull();
  });

  it('a knockout by the street costs a few coins, never below zero', async () => {
    const { store, bud, fights } = await ready();
    const me = await fights.fighterOf(bud, true);
    expect(await fights.loseMob(bud.slug, 'dresiarz-z-bramy', me)).toEqual({ lost: 0, coins: 0 });
    await store.openCache(bud.slug, 'test-coins', 500, 0);
    const before = (await store.wallet(bud.slug)).coins;
    const ko = await fights.loseMob(bud.slug, 'dresiarz-z-bramy', me);
    expect(ko.lost).toBe(Math.min(20, Math.floor(before / 50)));
    expect((await store.wallet(bud.slug)).coins).toBe(before - ko.lost);
  });

  it('a street knockout between buds moves coins to the winner, only when the pair pays', async () => {
    const ctx = setup();
    const a = (await ctx.create('Ala')).body.bud;
    const v = (await ctx.create('Wiktor')).body.bud;
    await reachLevel(ctx.store, a.slug, 6);
    await reachLevel(ctx.store, v.slug, 6);
    await ctx.store.openCache(v.slug, 'test-coins', 400, 0);
    const before = (await ctx.store.wallet(v.slug)).coins;
    const out = await ctx.app.fights.street(a.slug, v.slug, true);
    expect(out.lost).toBe(Math.min(50, Math.floor((before * 5) / 100)));
    expect((await ctx.store.wallet(v.slug)).coins).toBe(before - out.lost);
    expect(out.win!.pvp!.opponent).toBe(v.slug);
    const again = await ctx.app.fights.street(a.slug, v.slug, false);
    expect(again.lost).toBe(0);
    expect(again.win).toBeNull();
  });
});

describe('level requirements', () => {
  it('the shop sells only what the bud is old enough for', async () => {
    const { app, store, create } = setup();
    const { body } = await create();
    for (const c of CONTENT.caches) await store.openCache(body.bud.slug, c.id, c.coins, 0);
    const res = await app.request('/v1/shop/buty-sprintery/buy', {
      method: 'POST',
      ...auth(body.token),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as ApiError).error.code).toBe('level_too_low');
  });
});

describe('ciosy: loadouts and move upgrades', () => {
  async function ready(level = 1, coins = 0) {
    const ctx = setup();
    const { body } = await ctx.create();
    if (level > 1) await reachLevel(ctx.store, body.bud.slug, level);
    if (coins) await ctx.store.openCache(body.bud.slug, 'test-coins', coins, 0);
    const call = (method: string, path: string, data?: unknown) =>
      method === 'GET'
        ? ctx.app.request(path, auth(body.token))
        : ctx.app.request(path, { method, ...ctx.json(data ?? {}, body.token) });
    return { ...ctx, body, call };
  }
  const read = async (res: Response) => (await res.json()) as MovesResponse & ApiError;

  it('shows the buttons of the weapon in hand and every option, behind the player token', async () => {
    const { app, call } = await ready();
    expect((await app.request('/v1/buds/me/moves')).status).toBe(401);
    const view = await read(await call('GET', '/v1/buds/me/moves'));
    expect(view.weapon).toBe('piesci');
    expect(view.kit).toEqual(['prosty', 'sierpowy', 'kopniak', 'garda', null]);
    expect(view.slots[1]!.options.map((o) => o.id)).toContain('podciecie');
  });

  it('saves a loadout of open moves and the fighter fights with it', async () => {
    const { app, store, body, call } = await ready(4);
    const kit = ['prosty', 'podciecie', 'kopniak', 'zryw', null];
    const saved = await call('PUT', '/v1/buds/me/moves/loadout', { weapon: 'piesci', kit });
    expect(saved.status).toBe(200);
    expect((await read(saved)).kit).toEqual(kit);
    const fighter = await app.fights.fighterOf((await store.getBySlug(body.bud.slug))!, true);
    expect(kitOf(fighter)).toEqual(kit);
    // closed, misplaced or doubled moves are refused
    for (const bad of [
      ['prosty', 'bomba', 'kopniak', 'garda', null],
      ['garda', 'sierpowy', 'kopniak', 'prosty', null],
      ['prosty', 'kopniak', 'kopniak', 'garda', null],
    ])
      expect(
        (await call('PUT', '/v1/buds/me/moves/loadout', { weapon: 'piesci', kit: bad })).status,
      ).toBe(409);
    expect(
      (await call('PUT', '/v1/buds/me/moves/loadout', { weapon: 'piesci', kit: ['x'] })).status,
    ).toBe(400);
  });

  it('upgrades a move for coins from a level, once per rank, never below zero coins', async () => {
    const { store, body, call } = await ready(1, 2000);
    expect((await read(await call('POST', '/v1/buds/me/moves/sierpowy/upgrade'))).error.code).toBe(
      'level',
    );
    await reachLevel(store, body.bud.slug, 3);
    const before = (await store.wallet(body.bud.slug)).coins;
    const up = await read(await call('POST', '/v1/buds/me/moves/sierpowy/upgrade'));
    const option = up.slots[1]!.options.find((o) => o.id === 'sierpowy')!;
    expect(option.rank).toBe(1);
    expect(up.coins).toBe(before - rankCost('sierpowy', 1));
    expect((await store.moveRanks(body.bud.slug)).sierpowy).toBe(1);
    expect((await read(await call('POST', '/v1/buds/me/moves/sierpowy/upgrade'))).error.code).toBe(
      'level',
    );
    expect((await call('POST', '/v1/buds/me/moves/nic/upgrade')).status).toBe(404);
    expect((await read(await call('POST', '/v1/buds/me/moves/bomba/upgrade'))).error.code).toBe(
      'locked',
    );
  });
});
