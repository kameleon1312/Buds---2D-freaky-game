import { describe, expect, it } from 'vitest';
import type { BudLook, BudResponse, CreateBudResponse, LeaderboardResponse } from '@buds/shared';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/env.js';
import { createMemoryStore } from '../src/store/memory.js';
import { makeSlug } from '../src/store/slug.js';

function makeApp(env: Record<string, string> = {}) {
  return createApp(
    loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), CREATE_LIMIT_PER_MINUTE: '100', ...env }),
    { store: createMemoryStore() },
  );
}

type App = ReturnType<typeof makeApp>;

const look: BudLook = {
  gender: 'ona',
  mood: 'zadziorny',
  skin: 3,
  hair: 'kucyk',
  hairColor: 4,
  outfit: 'kurtka',
  outfitColor: 2,
  pantsColor: 1,
};

const post = (body: unknown, headers: Record<string, string> = {}) => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', ...headers },
});

async function createBud(app: App, name = 'Zuzia') {
  const res = await app.request('/v1/buds', post({ name, look }));
  expect(res.status).toBe(201);
  return (await res.json()) as CreateBudResponse;
}

describe('makeSlug', () => {
  it('transliterates Polish names and adds a random suffix', () => {
    expect(makeSlug('Łucja Żółć')).toMatch(/^lucja-zolc-[a-z2-9]{4}$/);
  });

  it('falls back when nothing usable is left', () => {
    expect(makeSlug('__')).toMatch(/^bud-[a-z2-9]{4}$/);
  });
});

describe('POST /v1/buds', () => {
  it('creates a bud and returns a one-time player token', async () => {
    const { bud, token } = await createBud(makeApp(), '  Zuzia  ');
    expect(bud).toMatchObject({ name: 'Zuzia', look, xp: 0 });
    expect(bud.slug).toMatch(/^zuzia-/);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(bud).not.toHaveProperty('token');
  });

  it.each([
    [{ name: 'A', look }],
    [{ name: '<script>', look }],
    [{ name: 'Ola', look: { ...look, skin: 42 } }],
    [{ name: 'Ola', look: { ...look, hair: 'irokez' } }],
    [{ name: 'Ola' }],
  ])('rejects invalid input %j', async (body) => {
    const res = await makeApp().request('/v1/buds', post(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_input' } });
  });

  it('is rate limited separately from reads', async () => {
    const app = makeApp({ CREATE_LIMIT_PER_MINUTE: '2' });
    const headers = { 'X-Real-IP': '9.9.9.9' };
    const body = { name: 'Ola', look };
    expect((await app.request('/v1/buds', post(body, headers))).status).toBe(201);
    expect((await app.request('/v1/buds', post(body, headers))).status).toBe(201);
    expect((await app.request('/v1/buds', post(body, headers))).status).toBe(429);
  });
});

describe('GET /v1/buds/me', () => {
  it('returns the bud for a valid player token', async () => {
    const app = makeApp();
    const { bud, token } = await createBud(app);
    const res = await app.request('/v1/buds/me', { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as BudResponse).bud).toEqual(bud);
  });

  it.each([undefined, 'Bearer nope', 'Basic abc', `Bearer ${'x'.repeat(500)}`])(
    '401 for auth header %s',
    async (authorization) => {
      const app = makeApp();
      await createBud(app);
      const res = await app.request(
        '/v1/buds/me',
        authorization ? { headers: { Authorization: authorization } } : {},
      );
      expect(res.status).toBe(401);
    },
  );
});

describe('GET /v1/buds/:slug', () => {
  it('returns the public profile', async () => {
    const app = makeApp();
    const { bud } = await createBud(app);
    const res = await app.request(`/v1/buds/${bud.slug}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as BudResponse).bud).toEqual(bud);
  });

  it('404s for unknown and malformed slugs', async () => {
    const app = makeApp();
    expect((await app.request('/v1/buds/nobody-abcd')).status).toBe(404);
    expect((await app.request('/v1/buds/..%2F..%2Fetc')).status).toBe(404);
  });
});

describe('GET /v1/buds/top', () => {
  it('lists buds, oldest first on equal xp', async () => {
    const app = makeApp();
    await createBud(app, 'Ania');
    await createBud(app, 'Bartek');
    const { buds } = (await (
      await app.request('/v1/buds/top?limit=10')
    ).json()) as LeaderboardResponse;
    expect(buds.map((b) => b.name)).toEqual(['Ania', 'Bartek']);
  });
});

describe('device pairing', () => {
  const pairCode = async (app: App, token: string) => {
    const res = await app.request('/v1/buds/me/pair-code', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as { code: string }).code;
  };

  it('links a second device to the same bud, once', async () => {
    const app = makeApp();
    const { bud, token } = await createBud(app);
    const code = await pairCode(app, token);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    const redeemed = await app.request('/v1/pair', post({ code: code.toLowerCase() }));
    expect(redeemed.status).toBe(201);
    const second = (await redeemed.json()) as CreateBudResponse;
    expect(second.bud).toEqual(bud);
    expect(second.token).not.toBe(token);

    // both devices now work
    for (const t of [token, second.token]) {
      const me = await app.request('/v1/buds/me', { headers: { Authorization: `Bearer ${t}` } });
      expect(me.status).toBe(200);
    }

    // codes are single-use
    expect((await app.request('/v1/pair', post({ code }))).status).toBe(404);
  });

  it('requires a player token to issue a code', async () => {
    const res = await makeApp().request('/v1/buds/me/pair-code', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('rejects malformed and unknown codes', async () => {
    const app = makeApp();
    expect((await app.request('/v1/pair', post({ code: '12' }))).status).toBe(400);
    expect((await app.request('/v1/pair', post({ code: 'ABCDEF' }))).status).toBe(404);
  });

  it('expires codes', async () => {
    let now = new Date('2026-10-12T12:00:00Z');
    const store = createMemoryStore(() => now);
    await store.savePairCode('ola-abcd', 'ABCDEF', new Date(now.getTime() + 60_000));
    now = new Date(now.getTime() + 120_000);
    expect(await store.redeemPairCode('ABCDEF', now)).toBeNull();
  });
});

describe('GET /v1/buds/:slug/sheet.png', () => {
  it('serves a 384×576 PNG sprite sheet (3 frames × 3 facings at 128×192)', async () => {
    const app = makeApp();
    const { bud } = await createBud(app);
    const res = await app.request(`/v1/buds/${bud.slug}/sheet.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    const png = Buffer.from(await res.arrayBuffer());
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(384);
    expect(png.readUInt32BE(20)).toBe(576);
  });

  it('scales on request', async () => {
    const app = makeApp();
    const { bud } = await createBud(app);
    const png = Buffer.from(
      await (await app.request(`/v1/buds/${bud.slug}/sheet.png?scale=4`)).arrayBuffer(),
    );
    expect(png.readUInt32BE(16)).toBe(192); // 3 × 16 × 4
  });

  it('404s for unknown buds', async () => {
    expect((await makeApp().request('/v1/buds/nobody-abcd/sheet.png')).status).toBe(404);
  });
});
