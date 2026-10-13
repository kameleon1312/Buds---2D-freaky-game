import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import {
  CATALOG,
  CONTENT,
  SKILLS,
  SKILL_MAX_RANK,
  skillIdSchema,
  skillPointsForLevel,
  type SkillsResponse,
  type WalletResponse,
  levelFromXp,
  MAX_BUDS_PER_ACCOUNT,
  SLOTS,
  catalogItem,
  characterStats,
  claimBudRequestSchema,
  coinsWithLuck,
  emptyEquipment,
  equipRequestSchema,
  fitsSlot,
  slotIdSchema,
  type AccountBud,
  type AccountBudsResponse,
  type BuyResponse,
  type EquipmentResponse,
  type SkillId,
  cacheBlocker,
  cacheIdSchema,
  type CachesResponse,
  type OpenCacheResponse,
  questBlocker,
  questIdSchema,
  type CompleteQuestResponse,
  type DistrictContent,
  type QuestsResponse,
  PAIR_CODE_TTL_MINUTES,
  budSlugSchema,
  lockedItems,
  type CatalogItem,
  type CatalogResponse,
  type OwnedItemsResponse,
  createBudSchema,
  redeemPairSchema,
  type ApiError,
  type BudResponse,
  type CreateBudResponse,
  type HealthResponse,
  type LeaderboardResponse,
  type MeResponse,
  type PairCodeResponse,
} from '@buds/shared';
import type { Env } from './env.js';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import { optionalUser, requireAuth, type AuthKeys, type AuthVariables } from './middleware/auth.js';
import {
  hashToken,
  newPlayerToken,
  requirePlayer,
  type PlayerVariables,
} from './middleware/player.js';
import { rateLimit } from './middleware/rate-limit.js';
import { budSheetPng } from './png.js';
import { makePairCode } from './store/slug.js';
import type { BudStore } from './store/types.js';

const VERSION = process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev';
const startedAt = Date.now();

export type AppDeps = {
  store: BudStore;
  /** Injected so tests can price items; production uses the shared catalog. */
  catalog?: readonly CatalogItem[];
  /** NPCs and quests; production uses the shared content. */
  content?: DistrictContent;
  /** Public keys for account tokens; production fetches the project's JWKS. */
  jwks?: JWTVerifyGetKey;
};

export function createApp(
  env: Env,
  { store, catalog = CATALOG, content = CONTENT, jwks }: AppDeps,
) {
  const keys: AuthKeys = {
    secret: env.SUPABASE_JWT_SECRET,
    jwks:
      jwks ??
      (env.SUPABASE_URL
        ? createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', env.SUPABASE_URL))
        : undefined),
  };
  const app = new Hono<{ Variables: AuthVariables & PlayerVariables }>();

  app.use('*', requestId());
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: (origin) => (origin === env.WEB_ORIGIN ? origin : null),
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }),
  );
  app.use(
    '*',
    bodyLimit({
      maxSize: 100 * 1024,
      onError: (c) =>
        c.json<ApiError>({ error: { code: 'payload_too_large', message: 'Body too large' } }, 413),
    }),
  );
  app.use('/v1/*', rateLimit(env.RATE_LIMIT_PER_MINUTE));

  app.get('/health', (c) =>
    c.json<HealthResponse>({
      status: 'ok',
      version: VERSION,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    }),
  );

  app.get('/v1/me', requireAuth(keys), (c) => {
    const user = c.get('user');
    return c.json<MeResponse>({ id: user.id, email: user.email, role: user.role });
  });

  // ---------- buds ----------

  app.post('/v1/buds', rateLimit(env.CREATE_LIMIT_PER_MINUTE), async (c) => {
    const body = await c.req.json().catch(() => null);
    const input = createBudSchema.safeParse(body);
    if (!input.success) {
      const message = input.error.issues[0]?.message ?? 'Invalid input';
      return c.json<ApiError>({ error: { code: 'invalid_input', message } }, 400);
    }
    // a brand-new bud owns nothing beyond the free starter set
    const locked = lockedItems(input.data.look, new Set(), catalog);
    if (locked.length) {
      return c.json<ApiError>(
        { error: { code: 'item_locked', message: `Nie masz jeszcze: ${locked.join(', ')}` } },
        403,
      );
    }
    // signed in on the website: the new bud belongs to the account right away
    const user = await optionalUser(c, keys);
    if (user && (await store.budsOfUser(user.id)).length >= MAX_BUDS_PER_ACCOUNT) {
      return c.json<ApiError>(
        {
          error: {
            code: 'too_many_buds',
            message: `Na jednym koncie zmieści się ${MAX_BUDS_PER_ACCOUNT} Budów`,
          },
        },
        409,
      );
    }
    const token = newPlayerToken();
    const bud = await store.create(input.data, hashToken(token), user?.id);
    return c.json<CreateBudResponse>({ bud, token }, 201);
  });

  app.get('/v1/buds/me', requirePlayer(store), (c) => c.json<BudResponse>({ bud: c.get('bud') }));

  // items granted beyond the starter set; only the server writes these
  app.get('/v1/buds/me/items', requirePlayer(store), async (c) =>
    c.json<OwnedItemsResponse>({ items: await store.items(c.get('bud').slug) }),
  );

  // ---------- quests ----------

  app.get('/v1/buds/me/quests', requirePlayer(store), async (c) =>
    c.json<QuestsResponse>({ completed: await store.completedQuests(c.get('bud').slug) }),
  );

  /**
   * The game reports a finished quest; the server checks that it exists, its requirements and level, and grants
   * the XP exactly once. (Checking *how* it was done needs the server-authoritative multiplayer world.)
   */
  app.post('/v1/buds/me/quests/:id/complete', requirePlayer(store), async (c) => {
    const questId = questIdSchema.safeParse(c.req.param('id'));
    const quest = questId.success ? content.quests.find((q) => q.id === questId.data) : undefined;
    if (!quest) throw new HTTPException(404, { message: 'Nie ma takiego zadania' });
    const bud = c.get('bud');
    const completed = new Set(await store.completedQuests(bud.slug));
    const blocker = questBlocker(quest, bud.xp, completed);
    if (blocker) {
      const message = {
        already_completed: 'To zadanie jest już wykonane',
        level_too_low: `To zadanie wymaga poziomu ${quest.minLevel}`,
        requires_other_quest: 'Najpierw wykonaj wcześniejsze zadania',
      }[blocker];
      return c.json<ApiError>({ error: { code: blocker, message } }, 409);
    }
    const xp = await store.completeQuest(bud.slug, quest.id, quest.xp);
    if (xp === null) {
      return c.json<ApiError>(
        { error: { code: 'already_completed', message: 'To zadanie jest już wykonane' } },
        409,
      );
    }
    if (quest.rewardItem) await store.grantItem(bud.slug, quest.rewardItem, 'reward');
    const before = levelFromXp(bud.xp).level;
    const level = levelFromXp(xp).level;
    return c.json<CompleteQuestResponse>({
      questId: quest.id,
      xpGained: quest.xp,
      xp,
      level,
      levelUp: level > before,
      item: quest.rewardItem ?? null,
    });
  });

  // ---------- gear (ekwipunek) and the coin shop ----------

  const equipmentOf = async (slug: string) => {
    const slots = emptyEquipment();
    for (const [slot, itemId] of Object.entries(await store.equipment(slug)))
      if (slot in slots) slots[slot as keyof typeof slots] = itemId;
    return slots;
  };

  /** Stats the server trusts: worn items (still in the catalog) plus trained skills. */
  const statsOf = async (slug: string, slots?: Awaited<ReturnType<typeof equipmentOf>>) => {
    const worn = Object.values(slots ?? (await equipmentOf(slug)))
      .map((id) => (id ? catalogItem(id, catalog) : undefined))
      .filter((i) => i !== undefined);
    const ranks = Object.fromEntries((await store.skills(slug)).map((s) => [s.id, s.rank]));
    return characterStats(worn, ranks as Partial<Record<SkillId, number>>);
  };

  const equipmentResponse = async (slug: string): Promise<EquipmentResponse> => {
    const slots = await equipmentOf(slug);
    return { slots, stats: await statsOf(slug, slots) };
  };

  app.get('/v1/buds/me/equipment', requirePlayer(store), async (c) =>
    c.json<EquipmentResponse>(await equipmentResponse(c.get('bud').slug)),
  );

  /** Wears an owned item in its slot, or empties the slot (`itemId: null`). */
  app.put('/v1/buds/me/equipment/:slot', requirePlayer(store), async (c) => {
    const slot = slotIdSchema.safeParse(c.req.param('slot'));
    if (!slot.success) throw new HTTPException(404, { message: 'Nie ma takiego miejsca' });
    const input = equipRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) {
      return c.json<ApiError>(
        { error: { code: 'invalid_input', message: 'Podaj przedmiot' } },
        400,
      );
    }
    const bud = c.get('bud');
    const itemId = input.data.itemId;
    if (itemId !== null) {
      const item = catalogItem(itemId, catalog);
      if (!fitsSlot(item, slot.data)) {
        const where = SLOTS.find((s) => s.id === slot.data)!.name.toLowerCase();
        return c.json<ApiError>(
          { error: { code: 'wrong_slot', message: `Tego nie założysz na: ${where}` } },
          400,
        );
      }
      const owned = new Set((await store.items(bud.slug)).map((i) => i.itemId));
      if (item!.price.currency !== 'free' && !owned.has(itemId)) {
        return c.json<ApiError>(
          { error: { code: 'item_locked', message: `Nie masz jeszcze: ${item!.name}` } },
          403,
        );
      }
    }
    await store.equip(bud.slug, slot.data, itemId);
    return c.json<EquipmentResponse>(await equipmentResponse(bud.slug));
  });

  /** Buys gear for coins earned in the game. Real money will only ever buy looks (catalog rule). */
  app.post('/v1/shop/:itemId/buy', requirePlayer(store), async (c) => {
    const item = catalogItem(c.req.param('itemId'), catalog);
    if (!item?.shop || !item.available || item.price.currency !== 'coins') {
      throw new HTTPException(404, { message: 'Tego nie ma w sklepie' });
    }
    const result = await store.buyItem(c.get('bud').slug, item.id, item.price.amount);
    if (result.status === 'owned') {
      return c.json<ApiError>({ error: { code: 'owned', message: 'Już to masz' } }, 409);
    }
    if (result.status === 'poor') {
      const missing = item.price.amount - result.coins;
      return c.json<ApiError>(
        { error: { code: 'not_enough_coins', message: `Brakuje ci ${missing} monet` } },
        409,
      );
    }
    return c.json<BuyResponse>({ itemId: item.id, coins: result.coins });
  });

  // ---------- accounts (signed in on the website) ----------

  const accountBud = async (slug: string): Promise<AccountBud> => {
    const bud = (await store.getBySlug(slug))!;
    const [wallet, items, equipment, quests, caches] = await Promise.all([
      store.wallet(slug),
      store.items(slug),
      equipmentResponse(slug),
      store.completedQuests(slug),
      store.openedCaches(slug),
    ]);
    return {
      bud,
      level: levelFromXp(bud.xp).level,
      coins: wallet.coins,
      gems: wallet.gems,
      items,
      equipment: equipment.slots,
      stats: equipment.stats,
      questsDone: quests.length,
      cachesFound: caches.length,
    };
  };

  /** Everything private about the account's buds. */
  app.get('/v1/account/buds', requireAuth(keys), async (c) => {
    const buds = await store.budsOfUser(c.get('user').id);
    return c.json<AccountBudsResponse>({
      buds: await Promise.all(buds.map((b) => accountBud(b.slug))),
    });
  });

  /** Links the guest bud this browser created (proved by its guest token) to the account. */
  app.post('/v1/account/buds/claim', requireAuth(keys), async (c) => {
    const input = claimBudRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) {
      return c.json<ApiError>(
        { error: { code: 'invalid_input', message: 'Brak tokenu Buda' } },
        400,
      );
    }
    const bud = await store.getByTokenHash(hashToken(input.data.token));
    if (!bud) throw new HTTPException(404, { message: 'Nie znaleziono tego Buda' });
    const user = c.get('user');
    if ((await store.budsOfUser(user.id)).length >= MAX_BUDS_PER_ACCOUNT) {
      return c.json<ApiError>(
        {
          error: {
            code: 'too_many_buds',
            message: `Na jednym koncie zmieści się ${MAX_BUDS_PER_ACCOUNT} Budów`,
          },
        },
        409,
      );
    }
    const result = await store.claimBud(bud.slug, user.id);
    if (result === 'taken') {
      return c.json<ApiError>(
        { error: { code: 'bud_taken', message: 'Ten Bud należy już do innego konta' } },
        409,
      );
    }
    return c.json<AccountBud>(await accountBud(bud.slug));
  });

  /** A pairing code for one of the account's buds: the way to bring it to a new phone. */
  app.post('/v1/account/buds/:slug/pair-code', requireAuth(keys), async (c) => {
    const slug = budSlugSchema.safeParse(c.req.param('slug'));
    if (!slug.success || (await store.ownerOf(slug.data)) !== c.get('user').id) {
      throw new HTTPException(404, { message: 'Nie masz takiego Buda' });
    }
    const code = makePairCode();
    const expiresAt = new Date(Date.now() + PAIR_CODE_TTL_MINUTES * 60_000);
    await store.savePairCode(slug.data, code, expiresAt);
    return c.json<PairCodeResponse>({ code, expiresAt: expiresAt.toISOString() }, 201);
  });

  // ---------- caches (skrytki) ----------

  app.get('/v1/buds/me/caches', requirePlayer(store), async (c) =>
    c.json<CachesResponse>({ opened: await store.openedCaches(c.get('bud').slug) }),
  );

  /**
   * The game reports a searched cache; the server checks that it exists and the bud's level, and grants its coins
   * and XP exactly once. (Like quests, checking that the bud really stood there needs the multiplayer server.)
   */
  app.post('/v1/buds/me/caches/:id/open', requirePlayer(store), async (c) => {
    const cacheId = cacheIdSchema.safeParse(c.req.param('id'));
    const cache = cacheId.success ? content.caches.find((k) => k.id === cacheId.data) : undefined;
    if (!cache) throw new HTTPException(404, { message: 'Nie ma takiej skrytki' });
    const bud = c.get('bud');
    const opened = new Set(await store.openedCaches(bud.slug));
    const already = {
      error: { code: 'already_opened', message: 'Ta skrytka jest już pusta' },
    } satisfies ApiError;
    const blocker = cacheBlocker(cache, bud.xp, opened);
    if (blocker === 'already_opened') return c.json<ApiError>(already, 409);
    if (blocker === 'level_too_low') {
      return c.json<ApiError>(
        {
          error: {
            code: 'level_too_low',
            message: `Tę skrytkę otworzysz od poziomu ${cache.minLevel}`,
          },
        },
        409,
      );
    }
    // Szczęście from worn gear adds coins (computed here, never by the game)
    const coins = coinsWithLuck(cache.coins, (await statsOf(bud.slug)).luck);
    const result = await store.openCache(bud.slug, cache.id, coins, cache.xp);
    if (!result) return c.json<ApiError>(already, 409);
    const before = levelFromXp(bud.xp).level;
    const level = levelFromXp(result.xp).level;
    return c.json<OpenCacheResponse>({
      cacheId: cache.id,
      coinsGained: coins,
      coins: result.coins,
      xpGained: cache.xp,
      xp: result.xp,
      level,
      levelUp: level > before,
    });
  });

  // ---------- skills and wallet ----------

  const skillsOf = async (slug: string, xp: number): Promise<SkillsResponse> => {
    const ranks = new Map((await store.skills(slug)).map((s) => [s.id, s.rank]));
    const points = skillPointsForLevel(levelFromXp(xp).level);
    const spent = [...ranks.values()].reduce((a, b) => a + b, 0);
    return {
      points,
      available: Math.max(0, points - spent),
      skills: SKILLS.map((s) => ({ id: s.id, rank: ranks.get(s.id) ?? 0 })),
    };
  };

  app.get('/v1/buds/me/skills', requirePlayer(store), async (c) => {
    const bud = c.get('bud');
    return c.json<SkillsResponse>(await skillsOf(bud.slug, bud.xp));
  });

  /** Spends one skill point (points = level - 1). The server checks free points and the max rank. */
  app.post('/v1/buds/me/skills/:id/upgrade', requirePlayer(store), async (c) => {
    const skill = skillIdSchema.safeParse(c.req.param('id'));
    if (!skill.success) throw new HTTPException(404, { message: 'Nie ma takiej umiejętności' });
    const bud = c.get('bud');
    const points = skillPointsForLevel(levelFromXp(bud.xp).level);
    const rank = await store.upgradeSkill(bud.slug, skill.data, points, SKILL_MAX_RANK);
    if (rank === null) {
      return c.json<ApiError>(
        {
          error: {
            code: 'no_skill_point',
            message: 'Brak wolnych punktów albo umiejętność jest na maksimum',
          },
        },
        409,
      );
    }
    return c.json<SkillsResponse>(await skillsOf(bud.slug, bud.xp));
  });

  app.get('/v1/buds/me/wallet', requirePlayer(store), async (c) =>
    c.json<WalletResponse>(await store.wallet(c.get('bud').slug)),
  );

  // ---------- catalog ----------

  app.get('/v1/catalog', (c) =>
    c.json<CatalogResponse>({ items: [...catalog] }, 200, {
      'Cache-Control': 'public, max-age=300',
    }),
  );

  // web shows this code; the game redeems it for its own token
  app.post('/v1/buds/me/pair-code', requirePlayer(store), async (c) => {
    const code = makePairCode();
    const expiresAt = new Date(Date.now() + PAIR_CODE_TTL_MINUTES * 60_000);
    await store.savePairCode(c.get('bud').slug, code, expiresAt);
    return c.json<PairCodeResponse>({ code, expiresAt: expiresAt.toISOString() }, 201);
  });

  // tight limit: this is the one endpoint where guessing would pay off
  app.post('/v1/pair', rateLimit(env.CREATE_LIMIT_PER_MINUTE), async (c) => {
    const input = redeemPairSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) {
      return c.json<ApiError>(
        { error: { code: 'invalid_input', message: 'Kod ma 6 znaków' } },
        400,
      );
    }
    const slug = await store.redeemPairCode(input.data.code, new Date());
    const bud = slug ? await store.getBySlug(slug) : null;
    if (!bud) throw new HTTPException(404, { message: 'Kod nieważny lub wygasł' });
    const token = newPlayerToken();
    await store.addToken(bud.slug, hashToken(token));
    return c.json<CreateBudResponse>({ bud, token }, 201);
  });

  app.get('/v1/buds/top', async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 100);
    return c.json<LeaderboardResponse>({ buds: await store.top(limit) });
  });

  app.get('/v1/buds/:slug/sheet.png', async (c) => {
    const slug = budSlugSchema.safeParse(c.req.param('slug'));
    const bud = slug.success ? await store.getBySlug(slug.data) : null;
    if (!bud) throw new HTTPException(404, { message: 'Bud not found' });
    // default 8 → 128×192 px per frame; 2..16 accepted
    const scale = Math.min(Math.max(Math.round(Number(c.req.query('scale'))) || 8, 2), 16);
    return c.body(new Uint8Array(budSheetPng(bud.look, scale)), 200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300',
    });
  });

  app.get('/v1/buds/:slug', async (c) => {
    const slug = budSlugSchema.safeParse(c.req.param('slug'));
    const bud = slug.success ? await store.getBySlug(slug.data) : null;
    if (!bud) throw new HTTPException(404, { message: 'Bud not found' });
    return c.json<BudResponse>({ bud });
  });

  app.notFound((c) =>
    c.json<ApiError>({ error: { code: 'not_found', message: 'Not found' } }, 404),
  );

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      // keep headers set by earlier middleware (CORS, rate-limit, security headers)
      return c.json<ApiError>(
        { error: { code: `http_${err.status}`, message: err.message } },
        err.status,
      );
    }
    console.error(`[${c.get('requestId')}]`, err);
    return c.json<ApiError>({ error: { code: 'internal', message: 'Internal server error' } }, 500);
  });

  return app;
}
