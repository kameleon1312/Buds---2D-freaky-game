import { describe, expect, it } from 'vitest';
import {
  catalogItem,
  type ApiError,
  type BuyResponse,
  type CreateBudResponse,
  type FightResponse,
} from '@buds/shared';
import { CONTENT } from '@buds/shared';
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
} as const;

function setup() {
  const store = createMemoryStore();
  const app = createApp(
    loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), CREATE_LIMIT_PER_MINUTE: '100' }),
    { store },
  );
  const create = async () => {
    const res = await app.request('/v1/buds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Premium', look }),
    });
    return (await res.json()) as CreateBudResponse;
  };
  const call = (method: string, path: string, token?: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { store, create, call };
}

describe('premium shop', () => {
  it('needs the player token and sells only premium items', async () => {
    const { create, call } = setup();
    const { token } = await create();
    expect((await call('POST', '/v1/premium/mount-hulajnowa-neon/buy')).status).toBe(401);
    expect((await call('POST', '/v1/premium/mount-hulajnowa/buy', token)).status).toBe(404);
    expect((await call('POST', '/v1/premium/buty-sprintery-zlote/buy', token)).status).toBe(404);
    expect((await call('POST', '/v1/premium/nic/buy', token)).status).toBe(404);
    // premium items are not in the coin shop either
    expect((await call('POST', '/v1/shop/mount-hulajnowa-neon/buy', token)).status).toBe(404);
  });

  it('spends gems only, once, never on credit', async () => {
    const { store, create, call } = setup();
    const { token, bud } = await create();
    const item = catalogItem('mount-hulajnowa-neon')!;
    let res = await call('POST', `/v1/premium/${item.id}/buy`, token);
    expect(res.status).toBe(409);
    expect(((await res.json()) as ApiError).error.code).toBe('not_enough_gems');

    // gems only ever come from the server (a verified purchase)
    await store.grantGems(bud.slug, 500);
    res = await call('POST', `/v1/premium/${item.id}/buy`, token);
    expect(res.status).toBe(200);
    const bought = (await res.json()) as BuyResponse;
    expect(bought.gems).toBe(500 - item.price.amount);
    expect((await store.items(bud.slug)).find((i) => i.itemId === item.id)?.source).toBe(
      'purchase',
    );
    expect((await call('POST', `/v1/premium/${item.id}/buy`, token)).status).toBe(409);
    expect((await store.wallet(bud.slug)).gems).toBe(500 - item.price.amount);
  });

  it('respects levels and gives exactly the power of the twin', async () => {
    const { store, create, call } = setup();
    const { token, bud } = await create();
    await store.grantGems(bud.slug, 5000);
    const res = await call('POST', '/v1/premium/premium-kij-smoka/buy', token);
    expect(res.status).toBe(403);
    expect(((await res.json()) as ApiError).error.code).toBe('level_too_low');

    // a level-4 bud wears the neon stick (twin: palka-teleskopowa, level 6)
    await store.completeQuest(bud.slug, 'test-level', 100 * 3 ** 2);
    expect((await call('POST', '/v1/premium/premium-kij-neon/buy', token)).status).toBe(200);
    expect(
      (await call('PUT', '/v1/buds/me/equipment/held', token, { itemId: 'premium-kij-neon' }))
        .status,
    ).toBe(200);
    const enemy = CONTENT.enemies.find((e) => e.district === 'wyspa-startowa')!;
    const fight = (await (
      await call('POST', '/v1/fights', token, { enemyId: enemy.id })
    ).json()) as FightResponse;
    expect(fight.fight.bud.weapon).toBe(catalogItem('palka-teleskopowa')!.weapon);
  });
});
