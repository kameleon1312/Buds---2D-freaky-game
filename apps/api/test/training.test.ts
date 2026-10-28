import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  TRAINING_COOLDOWN_SECONDS,
  catalogItem,
  type ApiError,
  type BuyResponse,
  type ConsumablesResponse,
  type CreateBudResponse,
  type SkillsResponse,
  type TrainResponse,
} from '@buds/shared';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { createMemoryStore } from '../src/store/memory.js';

const look = {
  gender: 'ona',
  mood: 'radosny',
  skin: 2,
  hair: 'kok',
  hairColor: 1,
  outfit: 'bluza',
  outfitColor: 3,
  pantsColor: 0,
} as const;

function setup() {
  let clock = Date.now();
  const store = createMemoryStore(() => new Date(clock));
  const app = createApp(
    loadEnv({
      SUPABASE_JWT_SECRET: 'x'.repeat(32),
      CREATE_LIMIT_PER_MINUTE: '100',
      RATE_LIMIT_PER_MINUTE: '1000',
    }),
    { store, now: () => new Date(clock) },
  );
  const post = (path: string, token: string, body?: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const get = (path: string, token: string) =>
    app.request(path, { headers: { Authorization: `Bearer ${token}` } });
  const create = async () => {
    const res = await app.request('/v1/buds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Trenerka', look }),
    });
    return (await res.json()) as CreateBudResponse;
  };
  const later = (seconds: number) => {
    clock += seconds * 1000;
  };
  return { app, store, post, get, create, later };
}

const spot = CONTENT.training.find((t) => t.skill === 'walka')!;

describe('training', () => {
  it('needs the player token, a known spot and a valid score', async () => {
    const { post, create } = setup();
    const { token } = await create();
    expect((await post(`/v1/buds/me/training/${spot.id}`, 'nope', { score: 3 })).status).toBe(401);
    expect((await post('/v1/buds/me/training/nie-ma', token, { score: 3 })).status).toBe(404);
    expect((await post(`/v1/buds/me/training/${spot.id}`, token, { score: 9 })).status).toBe(400);
    expect((await post(`/v1/buds/me/training/${spot.id}`, token, {})).status).toBe(400);
  });

  it('grants training XP once per cooldown and turns it into ranks and perks', async () => {
    const { app, store, post, get, create, later } = setup();
    const { token, bud } = await create();
    let res = await post(`/v1/buds/me/training/${spot.id}`, token, { score: 5 });
    expect(res.status).toBe(200);
    let round = (await res.json()) as TrainResponse;
    expect(round).toMatchObject({ skill: 'walka', xpGained: 40, trainingXp: 40, rank: 0 });

    res = await post(`/v1/buds/me/training/${spot.id}`, token, { score: 5 });
    expect(res.status).toBe(409);
    expect(((await res.json()) as ApiError).error.code).toBe('resting');

    // 8 rounds of 40 XP = 320 XP = 3 ranks: Cios specjalny unlocks
    const unlocked: string[] = [];
    for (let i = 0; i < 7; i++) {
      later(TRAINING_COOLDOWN_SECONDS);
      round = (await (
        await post(`/v1/buds/me/training/${spot.id}`, token, { score: 5 })
      ).json()) as TrainResponse;
      unlocked.push(...round.perksUnlocked);
    }
    expect(round.rank).toBe(3);
    expect(unlocked).toEqual(['cios-specjalny']);

    const skills = (await (await get('/v1/buds/me/skills', token)).json()) as SkillsResponse;
    expect(skills.skills.find((s) => s.id === 'walka')).toMatchObject({
      rank: 0,
      trainingXp: 320,
      trained: 3,
    });
    expect(skills.perks).toEqual(['cios-specjalny']);

    // fights get the special move
    const fighter = await app.fights.fighterOf((await store.getBySlug(bud.slug))!, true);
    expect(fighter.moves).toContain('specjalny');
  });
});

describe('energy drinks', () => {
  it('are bought again and again, drunk one by one, and boost duels', async () => {
    const { app, store, post, get, create } = setup();
    const { token, bud } = await create();
    const drink = catalogItem('napoj-sila')!;
    expect((await post('/v1/shop/napoj-sila/buy', token)).status).toBe(409); // no coins yet
    for (const c of CONTENT.caches) await store.openCache(bud.slug, c.id, c.coins, 0);
    const coins = (await store.wallet(bud.slug)).coins;
    for (let i = 0; i < 2; i++)
      expect((await post('/v1/shop/napoj-sila/buy', token)).status).toBe(200);
    expect((await store.wallet(bud.slug)).coins).toBe(coins - 2 * drink.price.amount);

    let bag = (await (await get('/v1/buds/me/consumables', token)).json()) as ConsumablesResponse;
    expect(bag).toEqual({ items: [{ itemId: 'napoj-sila', qty: 2 }], buffs: [] });

    const record = (await store.getBySlug(bud.slug))!;
    const plain = await app.fights.fighterOf(record, true);

    const res = await post('/v1/buds/me/consumables/napoj-sila/use', token);
    expect(res.status).toBe(200);
    bag = (await res.json()) as ConsumablesResponse;
    expect(bag.items).toEqual([{ itemId: 'napoj-sila', qty: 1 }]);
    expect(bag.buffs.map((b) => b.buff)).toEqual(['sila']);
    expect(bag.buffs[0]!.secondsLeft).toBeGreaterThan(290);

    const boosted = await app.fights.fighterOf(record, true);
    expect(boosted.attack - plain.attack).toBe(6);
  });

  it('boosts run out and drinks run out', async () => {
    const { store, post, get, create, later } = setup();
    const { token, bud } = await create();
    await store.grantConsumable(bud.slug, 'napoj-turbo', 1);
    expect((await post('/v1/buds/me/consumables/napoj-turbo/use', token)).status).toBe(200);
    const again = await post('/v1/buds/me/consumables/napoj-turbo/use', token);
    expect(again.status).toBe(409);
    expect(((await again.json()) as ApiError).error.code).toBe('none_left');
    later(181);
    const bag = (await (await get('/v1/buds/me/consumables', token)).json()) as ConsumablesResponse;
    expect(bag).toEqual({ items: [], buffs: [] });
    expect((await post('/v1/buds/me/consumables/kurtka-skorzana/use', token)).status).toBe(404);
  });
});

describe('mounts', () => {
  it('are bought for coins and ridden in their own slot', async () => {
    const { store, post, app, create } = setup();
    const { token, bud } = await create();
    for (const c of CONTENT.caches.slice(0, 6)) await store.openCache(bud.slug, c.id, c.coins, 0);
    const res = await post('/v1/shop/mount-deskorolka/buy', token);
    expect(res.status).toBe(200);
    expect(((await res.json()) as BuyResponse).itemId).toBe('mount-deskorolka');
    const put = (slot: string, itemId: string) =>
      app.request(`/v1/buds/me/equipment/${slot}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });
    expect((await put('feet', 'mount-deskorolka')).status).toBe(400);
    expect((await put('mount', 'mount-deskorolka')).status).toBe(200);
    expect((await store.equipment(bud.slug)).mount).toBe('mount-deskorolka');
    // the quad only drops from strong opponents
    expect((await post('/v1/shop/mount-quad/buy', token)).status).toBe(404);
  });
});
