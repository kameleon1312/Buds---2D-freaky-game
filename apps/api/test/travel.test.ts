import { describe, expect, it } from 'vitest';
import { PORTS, ferryFare, portById } from '@buds/shared';
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

async function setup() {
  const store = createMemoryStore();
  const app = createApp(
    loadEnv({
      SUPABASE_JWT_SECRET: 'ferry-test-secret-that-is-long-enough-32',
      RATE_LIMIT_PER_MINUTE: '1000',
    }),
    { store },
  );
  const created = await app.request('/v1/buds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Marynarz', look }),
  });
  const { token, bud } = (await created.json()) as { token: string; bud: { slug: string } };
  const sail = (from: string, to: string, auth = true) =>
    app.request('/v1/buds/me/ferry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ from, to }),
    });
  return { store, slug: bud.slug, sail };
}

describe('ferries between the harbours', () => {
  it('needs a player token', async () => {
    const { sail } = await setup();
    expect((await sail('port-miasto', 'port-puszcza', false)).status).toBe(401);
  });

  it('takes the fare once, atomically, and never below zero', async () => {
    const { store, slug, sail } = await setup();
    // level 2 and 40 coins: enough for two trips to Dzika Puszcza, not three
    await store.openCache(slug, 'test-ferry', 40, 150);
    const fare = ferryFare(portById('port-puszcza')!);
    const first = await sail('port-miasto', 'port-puszcza');
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      coins: 40 - fare,
      fare,
      to: 'port-puszcza',
      district: 'dzika-puszcza',
    });
    expect((await sail('port-puszcza', 'port-miasto')).status).toBe(200);
    const poor = await sail('port-miasto', 'port-puszcza');
    expect(poor.status).toBe(409);
    expect(((await poor.json()) as { error: { code: string } }).error.code).toBe(
      'not_enough_coins',
    );
    expect((await store.wallet(slug)).coins).toBeGreaterThanOrEqual(0);
  });

  it("keeps the destination's level gate and refuses made-up or round trips", async () => {
    const { store, slug, sail } = await setup();
    await store.openCache(slug, 'test-ferry', 500, 0);
    const gated = await sail('port-miasto', 'port-karkos');
    expect(gated.status).toBe(403);
    expect(((await gated.json()) as { error: { code: string } }).error.code).toBe('level_too_low');
    expect((await sail('port-miasto', 'port-miasto')).status).toBe(404);
    expect((await sail('port-miasto', 'port-atlantyda')).status).toBe(404);
    expect((await store.wallet(slug)).coins).toBe(500);
  });

  it('has one harbour per city with a small fare', () => {
    expect(new Set(PORTS.map((p) => p.district)).size).toBe(PORTS.length);
    for (const p of PORTS) expect(ferryFare(p)).toBeLessThanOrEqual(40);
  });
});
