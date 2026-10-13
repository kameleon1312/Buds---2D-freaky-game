import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CONTENT,
  type CachesResponse,
  type OpenCacheResponse,
  type ApiError,
  type BudLookInput,
  type LookOptions,
  type BudResponse,
  type CatalogItem,
  type CatalogResponse,
  type CompleteQuestResponse,
  type CreateBudResponse,
  type LeaderboardResponse,
  type OwnedItemsResponse,
  type QuestsResponse,
  type SkillsResponse,
  type WalletResponse,
} from '@buds/shared';
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

/** A look from before legwear and shoes became parts: still valid, with defaults. */
const look: BudLookInput = {
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
    [{ name: 'Ola', look: { ...look, hair: 'dredy' } }],
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

describe('items and catalog', () => {
  it('serves the catalog publicly, with reserved premium slots marked unavailable', async () => {
    const res = await makeApp().request('/v1/catalog');
    expect(res.status).toBe(200);
    const { items } = (await res.json()) as CatalogResponse;
    expect(items.some((i) => i.id === 'outfit-bluza' && i.price.currency === 'free')).toBe(true);
    for (const item of items.filter((i) => i.premium)) expect(item.available).toBe(false);
  });

  it('lists owned items only for the authenticated bud', async () => {
    const store = createMemoryStore();
    const app = createApp(
      loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), CREATE_LIMIT_PER_MINUTE: '100' }),
      { store },
    );
    const { bud, token } = await createBud(app);
    expect((await app.request('/v1/buds/me/items')).status).toBe(401);

    const auth = { headers: { Authorization: `Bearer ${token}` } };
    expect(
      ((await (await app.request('/v1/buds/me/items', auth)).json()) as OwnedItemsResponse).items,
    ).toEqual([]);

    await store.grantItem(bud.slug, 'outfit-premium-slot', 'reward');
    await store.grantItem(bud.slug, 'outfit-premium-slot', 'reward'); // idempotent
    const { items } = (await (
      await app.request('/v1/buds/me/items', auth)
    ).json()) as OwnedItemsResponse;
    expect(items).toEqual([
      expect.objectContaining({ itemId: 'outfit-premium-slot', source: 'reward' }),
    ]);
  });

  it('rejects a new bud wearing an item it does not own', async () => {
    const catalog: CatalogItem[] = CATALOG.map((i) =>
      i.id === 'outfit-kurtka'
        ? { ...i, premium: true, price: { currency: 'gems', amount: 300 } }
        : i,
    );
    const app = createApp(
      loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), CREATE_LIMIT_PER_MINUTE: '100' }),
      { store: createMemoryStore(), catalog },
    );
    const res = await app.request('/v1/buds', post({ name: 'Zuzia', look }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as ApiError).error.code).toBe('item_locked');
  });
});

describe('quests', () => {
  async function setup() {
    const store = createMemoryStore();
    const app = createApp(
      loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), CREATE_LIMIT_PER_MINUTE: '100' }),
      { store },
    );
    const { bud, token } = await createBud(app);
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const complete = (id: string) =>
      app.request(`/v1/buds/me/quests/${id}/complete`, { method: 'POST', ...auth });
    return { app, store, bud, auth, complete };
  }

  it('requires the player token', async () => {
    const { app } = await setup();
    expect((await app.request('/v1/buds/me/quests')).status).toBe(401);
    const res = await app.request('/v1/buds/me/quests/witaj-w-miescie/complete', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('grants XP once and reports level ups', async () => {
    const { app, auth, complete } = await setup();
    const res = await complete('witaj-w-miescie');
    expect(res.status).toBe(200);
    const body = (await res.json()) as CompleteQuestResponse;
    expect(body).toMatchObject({
      questId: 'witaj-w-miescie',
      xpGained: 60,
      xp: 60,
      level: 1,
      levelUp: false,
    });

    const again = await complete('witaj-w-miescie');
    expect(again.status).toBe(409);
    expect(((await again.json()) as ApiError).error.code).toBe('already_completed');

    const second = (await (await complete('zakupy-haliny')).json()) as CompleteQuestResponse;
    expect(second).toMatchObject({ xp: 110, level: 2, levelUp: true });

    const me = (await (await app.request('/v1/buds/me', auth)).json()) as BudResponse;
    expect(me.bud.xp).toBe(110);
    const list = (await (await app.request('/v1/buds/me/quests', auth)).json()) as QuestsResponse;
    expect(list.completed.sort()).toEqual(['witaj-w-miescie', 'zakupy-haliny']);
  });

  it('enforces requirements and minimum level', async () => {
    const { complete } = await setup();
    const early = await complete('zakupy-haliny');
    expect(early.status).toBe(409);
    expect(((await early.json()) as ApiError).error.code).toBe('requires_other_quest');
    const paint = await complete('puszki-oli');
    expect(((await paint.json()) as ApiError).error.code).toBe('level_too_low');
  });

  it('rejects unknown or malformed quest ids', async () => {
    const { complete } = await setup();
    expect((await complete('nie-ma-takiego')).status).toBe(404);
    expect((await complete('BAD%20ID')).status).toBe(404);
  });
});

describe('rewards, skills and wallet', () => {
  async function setup() {
    const store = createMemoryStore();
    const app = createApp(
      loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), CREATE_LIMIT_PER_MINUTE: '100' }),
      { store },
    );
    const { bud, token } = await createBud(app);
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const post = (path: string) => app.request(path, { method: 'POST', ...auth });
    return { app, store, bud, auth, post };
  }

  it('grants the quest reward item', async () => {
    const { app, auth, post } = await setup();
    for (const id of ['witaj-w-miescie', 'ulotki-basi'])
      expect((await post(`/v1/buds/me/quests/${id}/complete`)).status).toBe(200);
    const res = (await (
      await post('/v1/buds/me/quests/pierwszy-trik/complete')
    ).json()) as CompleteQuestResponse;
    expect(res.item).toBe('deskorolka');
    const items = (await (
      await app.request('/v1/buds/me/items', auth)
    ).json()) as OwnedItemsResponse;
    expect(items.items.map((i) => i.itemId)).toEqual(['deskorolka']);
  });

  it('gives one skill point per level and refuses to overspend', async () => {
    const { app, store, bud, auth, post } = await setup();
    expect((await app.request('/v1/buds/me/skills')).status).toBe(401);
    let skills = (await (await app.request('/v1/buds/me/skills', auth)).json()) as SkillsResponse;
    expect(skills).toMatchObject({ points: 0, available: 0 });
    expect(skills.skills.every((s) => s.rank === 0)).toBe(true);
    expect((await post('/v1/buds/me/skills/flow/upgrade')).status).toBe(409);

    await store.completeQuest(bud.slug, 'test', 400); // level 3 → 2 points
    expect((await post('/v1/buds/me/skills/flow/upgrade')).status).toBe(200);
    skills = (await (await post('/v1/buds/me/skills/walka/upgrade')).json()) as SkillsResponse;
    expect(skills).toMatchObject({ points: 2, available: 0 });
    expect(skills.skills.find((s) => s.id === 'flow')?.rank).toBe(1);
    expect((await post('/v1/buds/me/skills/flow/upgrade')).status).toBe(409);
    expect((await post('/v1/buds/me/skills/nieistnieje/upgrade')).status).toBe(404);
  });

  it('caps a skill at the maximum rank', async () => {
    const { bud, store, post } = await setup();
    await store.completeQuest(bud.slug, 'test', 10_000); // level 11 → 10 points
    for (let i = 0; i < 5; i++)
      expect((await post('/v1/buds/me/skills/spryt/upgrade')).status).toBe(200);
    expect((await post('/v1/buds/me/skills/spryt/upgrade')).status).toBe(409);
  });

  it('shows an empty wallet', async () => {
    const { app, auth } = await setup();
    expect((await app.request('/v1/buds/me/wallet')).status).toBe(401);
    expect(
      (await (await app.request('/v1/buds/me/wallet', auth)).json()) as WalletResponse,
    ).toEqual({ coins: 0, gems: 0 });
  });
});

describe('caches', () => {
  async function setup(content = CONTENT) {
    const app = createApp(
      loadEnv({ SUPABASE_JWT_SECRET: 'x'.repeat(32), CREATE_LIMIT_PER_MINUTE: '100' }),
      { store: createMemoryStore(), content },
    );
    const { token } = await createBud(app);
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const open = (id: string) =>
      app.request(`/v1/buds/me/caches/${id}/open`, { method: 'POST', ...auth });
    return { app, auth, open };
  }
  const first = CONTENT.caches[0]!;

  it('requires the player token', async () => {
    const { app } = await setup();
    expect((await app.request('/v1/buds/me/caches')).status).toBe(401);
    expect(
      (await app.request(`/v1/buds/me/caches/${first.id}/open`, { method: 'POST' })).status,
    ).toBe(401);
  });

  it('grants coins and XP once, into the wallet', async () => {
    const { app, auth, open } = await setup();
    const res = await open(first.id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as OpenCacheResponse;
    expect(body).toMatchObject({
      cacheId: first.id,
      coinsGained: first.coins,
      coins: first.coins,
      xpGained: first.xp,
      xp: first.xp,
    });
    expect((await open(first.id)).status).toBe(409);
    const list = (await (await app.request('/v1/buds/me/caches', auth)).json()) as CachesResponse;
    expect(list.opened).toEqual([first.id]);
    const wallet = (await (await app.request('/v1/buds/me/wallet', auth)).json()) as WalletResponse;
    expect(wallet.coins).toBe(first.coins);
    const me = (await (await app.request('/v1/buds/me', auth)).json()) as BudResponse;
    expect(me.bud.xp).toBe(first.xp);
  });

  it('adds up coins from several caches', async () => {
    const { open } = await setup();
    const [a, b] = CONTENT.caches;
    await open(a!.id);
    const body = (await (await open(b!.id)).json()) as OpenCacheResponse;
    expect(body.coins).toBe(a!.coins + b!.coins);
  });

  it('respects the minimum level', async () => {
    const locked = { ...first, id: 'zamknieta', minLevel: 5 };
    const { open } = await setup({ ...CONTENT, caches: [locked] });
    const res = await open('zamknieta');
    expect(res.status).toBe(409);
    expect(((await res.json()) as ApiError).error.code).toBe('level_too_low');
  });

  it('rejects unknown or malformed cache ids', async () => {
    const { open } = await setup();
    expect((await open('nie-ma-takiej')).status).toBe(404);
    expect((await open('ZŁA%20NAZWA')).status).toBe(404);
  });
});

describe('look creator', () => {
  it('lists every part per gender with labels and colours', async () => {
    const res = await makeApp().request('/v1/look/options');
    expect(res.status).toBe(200);
    const body = (await res.json()) as LookOptions;
    expect(body.byGender.map((g) => g.gender)).toEqual(['on', 'ona']);
    for (const g of body.byGender)
      for (const part of [g.hair, g.top, g.legs, g.shoes]) {
        expect(part.styles.length).toBeGreaterThanOrEqual(5);
        expect(part.colors.length).toBeGreaterThanOrEqual(8);
      }
    const ona = body.byGender.find((g) => g.gender === 'ona')!;
    expect(ona.legs.styles.some((s) => s.id === 'spodnica')).toBe(true);
    expect(ona.moods.find((m) => m.id === 'radosny')?.label).toBe('Radosna');
  });

  it('renders a preview sheet for a look that is not a bud yet', async () => {
    const encoded = Buffer.from(
      JSON.stringify({ ...look, pants: 'bojowki', shoes: 'glany', shoesColor: 3 }),
    ).toString('base64url');
    const res = await makeApp().request(`/v1/look/sheet.png?look=${encoded}&scale=2`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    const png = Buffer.from(await res.arrayBuffer());
    expect(png.readUInt32BE(16)).toBe(96); // 3 frames × 32 px
  });

  it('rejects broken looks', async () => {
    const app = makeApp();
    expect((await app.request('/v1/look/sheet.png?look=nie-json')).status).toBe(400);
    const bad = Buffer.from(JSON.stringify({ ...look, shoes: 'szpilki' })).toString('base64url');
    expect((await app.request(`/v1/look/sheet.png?look=${bad}`)).status).toBe(400);
  });

  it('keeps old looks valid and fills the new parts', async () => {
    const { bud } = await createBud(makeApp());
    expect(bud.look).toMatchObject({ pants: 'jeansy', shoes: 'trampki', shoesColor: 0 });
  });
});
