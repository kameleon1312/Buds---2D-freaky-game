import { describe, expect, it } from 'vitest';
import {
  WALK_GRIDS,
  type BudExport,
  type CreateBudResponse,
  type ExploredResponse,
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
} as const;

const MAP = 'las-palmas';
const size = Math.ceil((WALK_GRIDS[MAP]!.w * WALK_GRIDS[MAP]!.h) / 8);
const field = (first: number) => {
  const bytes = Buffer.alloc(size);
  bytes[0] = first;
  return bytes.toString('base64');
};

function setup() {
  const app = createApp(
    loadEnv({
      SUPABASE_JWT_SECRET: 'x'.repeat(32),
      CREATE_LIMIT_PER_MINUTE: '1000',
      RATE_LIMIT_PER_MINUTE: '10000',
    }),
    { store: createMemoryStore() },
  );
  const bud = async (name: string) => {
    const res = await app.request('/v1/buds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, look }),
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as CreateBudResponse).token;
  };
  const put = (token: string, map: string, seen: unknown) =>
    app.request(`/v1/buds/me/explored/${map}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ seen }),
    });
  const get = async (token: string) =>
    (await (
      await app.request('/v1/buds/me/explored', { headers: { authorization: `Bearer ${token}` } })
    ).json()) as ExploredResponse;
  return { app, bud, put, get };
}

describe('the explored map', () => {
  it('needs a player token', async () => {
    const { app } = setup();
    expect((await app.request('/v1/buds/me/explored')).status).toBe(401);
  });

  it('only ever grows, whichever device saves', async () => {
    const { bud, put, get } = setup();
    const token = await bud('Odkrywca');
    expect((await get(token)).maps).toEqual([]);
    expect(await (await put(token, MAP, field(0b0001))).json()).toEqual({
      map: MAP,
      seen: field(0b0001),
    });
    // another device knows other cells: the answer holds both
    const merged = await put(token, MAP, field(0b0100));
    expect(((await merged.json()) as { seen: string }).seen).toBe(field(0b0101));
    expect((await get(token)).maps).toEqual([{ map: MAP, seen: field(0b0101) }]);
  });

  it('is each bud’s own', async () => {
    const { bud, put, get } = setup();
    const one = await bud('Pierwszy');
    const two = await bud('Drugi');
    await put(one, MAP, field(1));
    expect((await get(two)).maps).toEqual([]);
  });

  it('refuses unknown maps, wrong sizes and rubbish', async () => {
    const { bud, put } = setup();
    const token = await bud('Sprawdzacz');
    expect((await put(token, 'nie-ma-takiej', field(1))).status).toBe(400);
    expect((await put(token, 'constructor', field(1))).status).toBe(400);
    expect((await put(token, MAP, 'AAAA')).status).toBe(400);
    expect((await put(token, MAP, 'not base64!')).status).toBe(400);
    expect((await put(token, MAP, 7)).status).toBe(400);
  });

  it('is part of the data export', async () => {
    const { app, bud, put } = setup();
    const token = await bud('Eksporter');
    await put(token, MAP, field(1));
    const res = await app.request('/v1/buds/me/export', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(((await res.json()) as BudExport).explored).toEqual([{ map: MAP, seen: field(1) }]);
  });
});

describe('the clothes of the cities', () => {
  it('are not for players: a look wearing them is refused', async () => {
    const { app } = setup();
    for (const worn of [{ outfit: 'surdut' }, { hair: 'cylinder' }]) {
      const res = await app.request('/v1/buds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Elegant', look: { ...look, ...worn } }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    }
  });
});
