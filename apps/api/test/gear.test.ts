import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import {
  CONTENT,
  MAX_BUDS_PER_ACCOUNT,
  catalogItem,
  type AccountBud,
  type AccountBudsResponse,
  type ApiError,
  type BuyResponse,
  type CreateBudResponse,
  type EquipmentResponse,
  type FightResponse,
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

    let res = await claim(body.token, alice);
    expect(res.status).toBe(200);
    expect(((await res.json()) as AccountBud).bud.slug).toBe(body.bud.slug);
    expect((await claim(body.token, alice)).status).toBe(200); // already hers: fine
    res = await claim(body.token, await es256('bob'));
    expect(res.status).toBe(409);
    expect(((await res.json()) as ApiError).error.code).toBe('bud_taken');
    expect((await claim('x'.repeat(40), alice)).status).toBe(404);
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
    // another account can't take it with a new code
    res = await link(await gameCode(), await es256('bob'));
    expect(res.status).toBe(409);
    expect(((await res.json()) as ApiError).error.code).toBe('bud_taken');
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

describe('duels', () => {
  async function ready(level = 1) {
    const ctx = setup();
    const { body } = await ctx.create();
    if (level > 1) await reachLevel(ctx.store, body.bud.slug, level);
    const post = (path: string, data?: unknown) =>
      ctx.app.request(path, { method: 'POST', ...ctx.json(data ?? {}, body.token) });
    return { ...ctx, body, post };
  }
  const read = async (res: Response) => (await res.json()) as FightResponse;

  it('needs the player token and a known opponent', async () => {
    const { app, post } = await ready();
    expect((await app.request('/v1/fights', { method: 'POST' })).status).toBe(401);
    expect((await post('/v1/fights', { enemyId: 'nikt' })).status).toBe(404);
    expect((await post('/v1/fights/not-a-uuid/move', { move: 'prosty' })).status).toBe(404);
  });

  it('starts with fists and full health, without leaking the RNG', async () => {
    const { post } = await ready();
    const res = await post('/v1/fights', { enemyId: 'dresiarz-z-bramy' });
    expect(res.status).toBe(201);
    const { fight } = await read(res);
    expect(fight.bud.moves).toEqual(MOVES_BY_WEAPON.piesci);
    expect(fight.bud.hp).toBe(fight.bud.maxHp);
    expect('rng' in fight).toBe(false);
  });

  it('uses the moves of the worn weapon and refuses others', async () => {
    const { app, store, json, body, post } = await ready(3);
    await store.grantItem(body.bud.slug, 'kij-hejnal', 'reward');
    await app.request('/v1/buds/me/equipment/held', {
      method: 'PUT',
      ...json({ itemId: 'kij-hejnal' }, body.token),
    });
    const { fight } = await read(await post('/v1/fights', { enemyId: 'dresiarz-z-bramy' }));
    expect(fight.bud.weapon).toBe('kij');
    expect((await post(`/v1/fights/${fight.id}/move`, { move: 'prosty' })).status).toBe(400);
    expect((await post(`/v1/fights/${fight.id}/move`, { move: 'zamach' })).status).toBe(200);
  });

  it('plays to the end on the server, grants XP and coins once, then rests the opponent', async () => {
    const { store, body, post } = await ready(4);
    const { fight } = await read(await post('/v1/fights', { enemyId: 'dresiarz-z-bramy' }));
    let last: FightResponse | null = null;
    for (let i = 0; i < 40; i++) {
      last = await read(await post(`/v1/fights/${fight.id}/move`, { move: 'sierpowy' }));
      if (last.fight.status !== 'active') break;
    }
    expect(last!.fight.status).toBe('won'); // a level 4 bud beats the level 1 doorman
    const reward = last!.reward!;
    expect(reward.xpGained).toBeGreaterThan(0);
    expect(reward.coinsGained).toBeGreaterThan(0);
    expect((await store.getBySlug(body.bud.slug))!.xp).toBe(reward.xp);
    expect((await store.wallet(body.bud.slug)).coins).toBe(reward.coins);
    if (reward.item)
      expect((await store.items(body.bud.slug)).some((i) => i.itemId === reward.item)).toBe(true);
    // no second reward, no instant rematch
    expect((await post(`/v1/fights/${fight.id}/move`, { move: 'prosty' })).status).toBe(409);
    const again = await post('/v1/fights', { enemyId: 'dresiarz-z-bramy' });
    expect(again.status).toBe(409);
    expect(((await again.json()) as ApiError).error.code).toBe('resting');
  });

  it('lets the bud run away without a reward', async () => {
    const { store, body, post } = await ready();
    const { fight } = await read(await post('/v1/fights', { enemyId: 'szef-gangu' }));
    const fled = await read(await post(`/v1/fights/${fight.id}/flee`));
    expect(fled.fight.status).toBe('fled');
    expect((await store.getBySlug(body.bud.slug))!.xp).toBe(0);
    expect((await post(`/v1/fights/${fight.id}/move`, { move: 'prosty' })).status).toBe(409);
  });

  it('a new duel abandons the unfinished one', async () => {
    const { post } = await ready();
    const first = (await read(await post('/v1/fights', { enemyId: 'kibol-mirek' }))).fight;
    await post('/v1/fights', { enemyId: 'ziomal-z-proca' });
    expect((await post(`/v1/fights/${first.id}/move`, { move: 'prosty' })).status).toBe(409);
  });

  it('keeps fights private to their bud', async () => {
    const ctx = await ready();
    const { fight } = await read(await ctx.post('/v1/fights', { enemyId: 'kibol-mirek' }));
    const other = await ctx.create('Inny');
    const res = await ctx.app.request(`/v1/fights/${fight.id}/move`, {
      method: 'POST',
      ...ctx.json({ move: 'prosty' }, other.body.token),
    });
    expect(res.status).toBe(404);
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
