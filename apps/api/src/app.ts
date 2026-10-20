import { Hono, type Context } from 'hono';
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
  BUFFS,
  TRAINING_COOLDOWN_SECONDS,
  buffBonus,
  effectiveRank,
  perksFor,
  trainRequestSchema,
  trainedRanks,
  trainingSpotIdSchema,
  trainingXp,
  type BuffId,
  type ConsumablesResponse,
  type TrainResponse,
  skillIdSchema,
  skillPointsForLevel,
  type SkillsResponse,
  type WalletResponse,
  levelFromXp,
  districtById,
  ferryBlocker,
  ferryFare,
  ferryRequestSchema,
  portById,
  type FerryResponse,
  MAX_BUDS_PER_ACCOUNT,
  REMATCH_SECONDS,
  budFighter,
  enemyFighter,
  fightMoveRequestSchema,
  fightViewSchema,
  fightXp,
  levelOf,
  newFight,
  playTurn,
  rollLoot,
  startFightRequestSchema,
  type FightResponse,
  type FightState,
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
  type AuthConfigResponse,
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
  budLookSchema,
  lookOptions,
  type LookOptions,
  lockedItems,
  type CatalogItem,
  type CatalogResponse,
  type OwnedItemsResponse,
  createBudSchema,
  updateLookSchema,
  redeemPairSchema,
  type ApiError,
  type BudResponse,
  type CreateBudResponse,
  type HealthResponse,
  type LeaderboardResponse,
  type MeResponse,
  type PairCodeResponse,
  pvpOpponentOf,
  turfAt,
  turfOf,
  type BudRecord,
  type Fighter,
} from '@buds/shared';
import type { Env } from './env.js';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';
import { optionalUser, requireAuth, type AuthKeys, type AuthVariables } from './middleware/auth.js';
import {
  hashToken,
  newPlayerToken,
  requirePlayer,
  type PlayerVariables,
} from './middleware/player.js';
import { rateLimit } from './middleware/rate-limit.js';
import { budSheetPng, budSheetPngCached } from './png.js';
import { createRivalry } from './rivalry.js';
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
  /** The clock for drink boosts and training cooldowns (tests move it). */
  now?: () => Date;
};

export function createApp(
  env: Env,
  { store, catalog = CATALOG, content = CONTENT, jwks, now = () => new Date() }: AppDeps,
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
  const rivalry = createRivalry({ store, now, catalog, content });

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
  // every limit keys on the same client IP (CLIENT_IP_HEADER picks the one trusted header)
  const limit = (perMinute: number) => rateLimit(perMinute, 60_000, env.CLIENT_IP_HEADER);
  app.use('/v1/*', limit(env.RATE_LIMIT_PER_MINUTE));

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

  app.post('/v1/buds', limit(env.CREATE_LIMIT_PER_MINUTE), async (c) => {
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

  /**
   * A new look for the bud (the in-game look editor): the same look rules as creating one, and only items the bud
   * owns. The sheet at /v1/buds/:slug/sheet.png follows at once.
   */
  app.put('/v1/buds/me/look', requirePlayer(store), async (c) => {
    const input = updateLookSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) {
      const message = input.error.issues[0]?.message ?? 'Nieprawidłowy wygląd';
      return c.json<ApiError>({ error: { code: 'invalid_input', message } }, 400);
    }
    const bud = c.get('bud');
    const owned = new Set((await store.items(bud.slug)).map((i) => i.itemId));
    const locked = lockedItems(input.data.look, owned, catalog);
    if (locked.length) {
      return c.json<ApiError>(
        { error: { code: 'item_locked', message: `Nie masz jeszcze: ${locked.join(', ')}` } },
        403,
      );
    }
    return c.json<BudResponse>({ bud: await store.updateLook(bud.slug, input.data.look) });
  });

  /** Signs this device out: its player token is forgotten; other devices of the bud stay signed in. */
  app.post('/v1/buds/me/logout', requirePlayer(store), async (c) => {
    const token = (c.req.header('authorization') ?? '').split(' ')[1]!;
    await store.removeToken(hashToken(token));
    return c.body(null, 204);
  });

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
    // handed in to the giver: influence in the giver's turf
    const giver = content.npcs.find((n) => n.id === quest.giver);
    const influence = await rivalry.earn(
      bud.slug,
      giver ? turfAt(giver.district, giver.x, giver.y) : undefined,
      'quest',
      'zadania',
    );
    return c.json<CompleteQuestResponse>({
      questId: quest.id,
      xpGained: quest.xp,
      xp,
      level,
      levelUp: level > before,
      item: quest.rewardItem ?? null,
      influence,
    });
  });

  // ---------- gear (ekwipunek) and the coin shop ----------

  const equipmentOf = async (slug: string) => {
    const slots = emptyEquipment();
    for (const [slot, itemId] of Object.entries(await store.equipment(slug)))
      if (slot in slots) slots[slot as keyof typeof slots] = itemId;
    return slots;
  };

  /** Skill ranks as they count: points spent plus ranks earned by training (capped). */
  const ranksOf = async (slug: string) => {
    const [spent, trained] = await Promise.all([store.skills(slug), store.training(slug)]);
    const xp = new Map(trained.map((t) => [t.skill, t.xp]));
    const rank = new Map(spent.map((s) => [s.id, s.rank]));
    return Object.fromEntries(
      SKILLS.map((s) => [s.id, effectiveRank(rank.get(s.id) ?? 0, xp.get(s.id) ?? 0)]),
    ) as Record<SkillId, number>;
  };

  /** Boosts of energy drinks still running. */
  const buffsOf = async (slug: string): Promise<BuffId[]> => {
    const at = now().getTime();
    return (await store.buffs(slug))
      .filter((b) => b.until.getTime() > at && BUFFS.some((x) => x.id === b.buff))
      .map((b) => b.buff as BuffId);
  };

  /** Stats the server trusts: worn items (still in the catalog) plus skills (spent and trained). */
  const statsOf = async (slug: string, slots?: Awaited<ReturnType<typeof equipmentOf>>) => {
    const worn = Object.values(slots ?? (await equipmentOf(slug)))
      .map((id) => (id ? catalogItem(id, catalog) : undefined))
      .filter((i) => i !== undefined);
    return characterStats(worn, await ranksOf(slug));
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
      if (levelFromXp(bud.xp).level < levelOf(item)) {
        return c.json<ApiError>(
          {
            error: { code: 'level_too_low', message: `${item!.name}: od poziomu ${levelOf(item)}` },
          },
          403,
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

  /** Buys gear, rides and drinks for coins earned in the game. */
  /**
   * The ferry: from one city's harbour to another's for a small fare. The destination's level gate applies, the fare
   * is paid atomically (never below zero); the game then sails the bud there.
   */
  app.post('/v1/buds/me/ferry', requirePlayer(store), async (c) => {
    const input = ferryRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) throw new HTTPException(400, { message: 'Zły kurs' });
    const bud = c.get('bud');
    const blocker = ferryBlocker(input.data.from, input.data.to, levelFromXp(bud.xp).level);
    if (blocker === 'unknown_port' || blocker === 'same_port')
      throw new HTTPException(404, { message: 'Nie ma takiego kursu' });
    const to = portById(input.data.to)!;
    if (blocker === 'level_too_low') {
      const need = districtById(to.district)?.unlockLevel ?? 1;
      return c.json<ApiError>(
        { error: { code: 'level_too_low', message: `Tam pływamy od poziomu ${need}` } },
        403,
      );
    }
    const fare = ferryFare(to);
    const paid = await store.payFare(bud.slug, fare);
    if (paid.status === 'poor') {
      return c.json<ApiError>(
        {
          error: {
            code: 'not_enough_coins',
            message: `Brakuje ci ${fare - paid.coins} monet na bilet`,
          },
        },
        409,
      );
    }
    return c.json<FerryResponse>({ coins: paid.coins, fare, to: to.id, district: to.district });
  });

  app.post('/v1/shop/:itemId/buy', requirePlayer(store), async (c) => {
    const item = catalogItem(c.req.param('itemId'), catalog);
    if (!item?.shop || !item.available || item.price.currency !== 'coins') {
      throw new HTTPException(404, { message: 'Tego nie ma w sklepie' });
    }
    if (levelFromXp(c.get('bud').xp).level < levelOf(item)) {
      return c.json<ApiError>(
        { error: { code: 'level_too_low', message: `Dostępne od poziomu ${levelOf(item)}` } },
        403,
      );
    }
    const result =
      item.kind === 'consumable'
        ? await store.buyConsumable(c.get('bud').slug, item.id, item.price.amount)
        : await store.buyItem(c.get('bud').slug, item.id, item.price.amount);
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

  /**
   * The premium shop: unique rides and weapons for gems. Gems come only from verified real-money purchases, and
   * every premium item is exactly as strong as an earned twin (catalog rule), so money buys style, not power.
   */
  app.post('/v1/premium/:itemId/buy', requirePlayer(store), async (c) => {
    const item = catalogItem(c.req.param('itemId'), catalog);
    if (
      !item?.premium ||
      !item.available ||
      item.price.currency !== 'gems' ||
      item.price.amount <= 0
    ) {
      throw new HTTPException(404, { message: 'Tego nie ma w sklepie premium' });
    }
    const bud = c.get('bud');
    if (levelFromXp(bud.xp).level < levelOf(item)) {
      return c.json<ApiError>(
        { error: { code: 'level_too_low', message: `Dostępne od poziomu ${levelOf(item)}` } },
        403,
      );
    }
    const result = await store.buyItemWithGems(bud.slug, item.id, item.price.amount);
    if (result.status === 'owned') {
      return c.json<ApiError>({ error: { code: 'owned', message: 'Już to masz' } }, 409);
    }
    if (result.status === 'poor') {
      const missing = item.price.amount - result.gems;
      return c.json<ApiError>(
        { error: { code: 'not_enough_gems', message: `Brakuje ci ${missing} gemów` } },
        409,
      );
    }
    const wallet = await store.wallet(bud.slug);
    return c.json<BuyResponse>({ itemId: item.id, coins: wallet.coins, gems: result.gems });
  });

  // ---------- duels (pojedynki), resolved here one turn at a time ----------

  const fightIdSchema = z.string().uuid();
  /** What clients see: everything but the RNG state. */
  const view = (id: string, s: FightState) => ({
    ...fightViewSchema.omit({ id: true }).parse(s),
    id,
  });

  /** Starts a duel with an opponent of the districts; an unfinished earlier duel counts as fled. */
  app.post('/v1/fights', requirePlayer(store), async (c) => {
    const input = startFightRequestSchema.safeParse(await c.req.json().catch(() => null));
    const enemy = input.success
      ? content.enemies.find((e) => e.id === input.data.enemyId)
      : undefined;
    if (!enemy) throw new HTTPException(404, { message: 'Nie ma takiego przeciwnika' });
    const bud = c.get('bud');
    const last = await store.lastWin(bud.slug, enemy.id);
    const wait = last ? REMATCH_SECONDS - Math.floor((Date.now() - last.getTime()) / 1000) : 0;
    if (wait > 0) {
      return c.json<ApiError>(
        {
          error: {
            code: 'resting',
            message: `${enemy.name} dochodzi do siebie. Wróć za ${wait} s.`,
          },
        },
        409,
      );
    }
    await rivalry.abandon(bud.slug);
    const spot = Math.min(input.data!.spot ?? 0, enemy.spots.length - 1);
    return startFight(c, bud, enemy.id, await fighterOf(bud, true), enemyFighter(enemy), spot);
  });

  /** The bud's fighter as the server trusts it: worn gear, skills and perks, and running drinks if asked. */
  const fighterOf = async (bud: BudRecord, withDrinks: boolean) => {
    const slots = await equipmentOf(bud.slug);
    const stats = await statsOf(bud.slug, slots);
    const weapon = slots.held ? catalogItem(slots.held, catalog) : undefined;
    const [ranks, buffs] = await Promise.all([
      ranksOf(bud.slug),
      withDrinks ? buffsOf(bud.slug) : Promise.resolve([]),
    ]);
    return budFighter(bud.name, bud.xp, stats, weapon, { perks: perksFor(ranks), buffs });
  };

  const startFight = async (
    c: Context,
    bud: BudRecord,
    enemyId: string,
    me: Fighter,
    them: Fighter,
    spot?: number,
  ) => {
    const state: FightState = { ...newFight(enemyId, me, them, randomInt(1, 2 ** 31 - 1)), spot };
    const id = await store.createFight(bud.slug, state);
    return c.json<FightResponse>(
      { fight: view(id, state), events: [], reward: null, influence: null, pvp: null },
      201,
    );
  };

  /** One turn: the bud's move, the opponent's answer. A win grants XP, coins and maybe loot, once. */
  app.post('/v1/fights/:id/move', requirePlayer(store), async (c) => {
    const id = fightIdSchema.safeParse(c.req.param('id'));
    const bud = c.get('bud');
    const before = id.success ? await store.fight(bud.slug, id.data) : null;
    if (!id.success || !before)
      throw new HTTPException(404, { message: 'Nie ma takiego pojedynku' });
    if (before.status !== 'active') {
      return c.json<ApiError>(
        { error: { code: 'fight_over', message: 'Ten pojedynek już się skończył' } },
        409,
      );
    }
    const input = fightMoveRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success || !before.bud.moves.includes(input.data.move)) {
      return c.json<ApiError>(
        { error: { code: 'invalid_move', message: 'Nie masz takiego ruchu' } },
        400,
      );
    }
    const { state, events } = playTurn(before, input.data.move);
    const conflict = () =>
      c.json<ApiError>({ error: { code: 'fight_busy', message: 'Ruch już został wykonany' } }, 409);

    const done = { fight: view(id.data, state), events, reward: null, influence: null, pvp: null };
    if (state.status === 'active') {
      if (!(await store.saveTurn(bud.slug, id.data, before.turn, state))) return conflict();
      return c.json<FightResponse>(done);
    }
    // against another bud: no XP or loot, the rating moves and the day's first wins pay coins
    if (pvpOpponentOf(state.enemyId)) {
      if (!(await store.finishFight(bud.slug, id.data, before.turn, state, state.status, 0, 0)))
        return conflict();
      const { pvp, reward } = await rivalry.finishPvp(bud, state);
      return c.json<FightResponse>({ ...done, reward, pvp });
    }
    if (state.status === 'lost') {
      if (!(await store.finishFight(bud.slug, id.data, before.turn, state, 'lost', 0, 0)))
        return conflict();
      return c.json<FightResponse>(done);
    }

    // won: XP for the level gap, coins with luck, loot by the opponent's rarity table
    const enemy = content.enemies.find((e) => e.id === state.enemyId)!;
    const levelBefore = levelFromXp(bud.xp).level;
    const xpGained = fightXp(enemy, levelBefore);
    const owned = new Set((await store.items(bud.slug)).map((i) => i.itemId));
    const loot = rollLoot(enemy, state.bud.luck, catalog, owned, state.rng, {
      perks: state.bud.perks,
    });
    const result = await store.finishFight(
      bud.slug,
      id.data,
      before.turn,
      state,
      'won',
      xpGained,
      loot.coins,
    );
    if (!result) return conflict();
    if (loot.itemId) await store.grantItem(bud.slug, loot.itemId, 'reward');
    if (loot.drink) await store.grantConsumable(bud.slug, loot.drink, 1);
    const level = levelFromXp(result.xp).level;
    const spot = enemy.spots[Math.min(state.spot ?? 0, enemy.spots.length - 1)]!;
    const influence = await rivalry.earn(
      bud.slug,
      turfAt(enemy.district, spot.x, spot.y),
      'duel',
      'zwyciestwa',
      enemy.boss ? 2 : 1,
    );
    return c.json<FightResponse>({
      fight: view(id.data, state),
      events,
      influence,
      pvp: null,
      reward: {
        xpGained,
        xp: result.xp,
        level,
        levelUp: level > levelBefore,
        coinsGained: loot.coins,
        coins: result.coins,
        item: loot.itemId,
        drink: loot.drink,
      },
    });
  });

  /** Running away: no reward, no penalty. */
  app.post('/v1/fights/:id/flee', requirePlayer(store), async (c) => {
    const id = fightIdSchema.safeParse(c.req.param('id'));
    const bud = c.get('bud');
    const before = id.success ? await store.fight(bud.slug, id.data) : null;
    if (!id.success || !before)
      throw new HTTPException(404, { message: 'Nie ma takiego pojedynku' });
    const opponent = pvpOpponentOf(before.enemyId);
    let pvp: FightResponse['pvp'] = null;
    if (
      before.status === 'active' &&
      (await store.finishFight(bud.slug, id.data, before.turn, before, 'fled', 0, 0)) &&
      opponent &&
      before.turn > 0
    ) {
      // running from another bud after the first exchange counts as a loss (no dodging a bad rating)
      pvp = await rivalry.finishPvp(bud, { ...before, status: 'lost' }).then((r) => r.pvp);
    }
    return c.json<FightResponse>({
      fight: view(id.data, {
        ...before,
        status: before.status === 'active' ? 'fled' : before.status,
      }),
      events: [],
      reward: null,
      influence: null,
      pvp,
    });
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

  /**
   * Links a bud from the game: the game shows a pairing code (Twój Bud → Połącz z kontem) and the signed-in user
   * types it on the website. The code is used up; a bud of another account stays where it is.
   */
  app.post(
    '/v1/account/buds/link',
    limit(env.CREATE_LIMIT_PER_MINUTE),
    requireAuth(keys),
    async (c) => {
      const input = redeemPairSchema.safeParse(await c.req.json().catch(() => null));
      if (!input.success) {
        return c.json<ApiError>(
          { error: { code: 'invalid_input', message: 'Kod ma 6 znaków' } },
          400,
        );
      }
      const user = c.get('user');
      const mine = await store.budsOfUser(user.id);
      if (mine.length >= MAX_BUDS_PER_ACCOUNT) {
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
      const slug = await store.redeemPairCode(input.data.code, new Date());
      if (!slug) {
        return c.json<ApiError>(
          {
            error: {
              code: 'invalid_code',
              message: 'Ten kod jest nieważny albo wygasł. Wygeneruj nowy w grze.',
            },
          },
          404,
        );
      }
      const result = await store.claimBud(slug, user.id);
      if (result === 'taken') {
        return c.json<ApiError>(
          { error: { code: 'bud_taken', message: 'Ten Bud należy już do innego konta' } },
          409,
        );
      }
      return c.json<AccountBud>(await accountBud(slug));
    },
  );

  /** Public sign-in settings for the game (the project URL and its publishable key, both public by design). */
  app.get('/v1/auth/config', (c) => {
    const key = env.SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
    const url = env.SUPABASE_URL ?? null;
    return c.json<AuthConfigResponse>({ enabled: !!(url && key), url, publishableKey: key });
  });

  /**
   * Playing an account's bud on a new device: a signed-in owner gets a fresh player token for it (one token per
   * device, like pairing). Buds of other accounts stay out of reach.
   */
  app.post('/v1/account/buds/:slug/device', requireAuth(keys), async (c) => {
    const slug = budSlugSchema.safeParse(c.req.param('slug'));
    if (!slug.success || (await store.ownerOf(slug.data)) !== c.get('user').id) {
      throw new HTTPException(404, { message: 'Nie masz takiego Buda' });
    }
    const token = newPlayerToken();
    await store.addToken(slug.data, hashToken(token));
    const bud = (await store.getBySlug(slug.data))!;
    return c.json<CreateBudResponse>({ bud, token });
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
    // Szczęście from worn gear and the Fart drink adds coins, Szybka puszka 10% more (computed here, never by the game)
    const [stats, ranks, buffs] = await Promise.all([
      statsOf(bud.slug),
      ranksOf(bud.slug),
      buffsOf(bud.slug),
    ]);
    let coins = coinsWithLuck(cache.coins, stats.luck + buffBonus(buffs).luck);
    if (perksFor(ranks).includes('szybka-puszka')) coins = Math.floor((coins * 110) / 100);
    const result = await store.openCache(bud.slug, cache.id, coins, cache.xp);
    if (!result) return c.json<ApiError>(already, 409);
    const before = levelFromXp(bud.xp).level;
    const level = levelFromXp(result.xp).level;
    const influence = await rivalry.earn(
      bud.slug,
      turfOf(cache.district, cache.map, cache.x, cache.y),
      'cache',
      'skrytki',
    );
    return c.json<OpenCacheResponse>({
      influence,
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
    const [spentRows, trainedRows] = await Promise.all([store.skills(slug), store.training(slug)]);
    const ranks = new Map(spentRows.map((s) => [s.id, s.rank]));
    const training = new Map(trainedRows.map((t) => [t.skill, t.xp]));
    const points = skillPointsForLevel(levelFromXp(xp).level);
    const spent = [...ranks.values()].reduce((a, b) => a + b, 0);
    const skills = SKILLS.map((s) => {
      const rank = ranks.get(s.id) ?? 0;
      const trainingXp = training.get(s.id) ?? 0;
      return {
        id: s.id,
        rank,
        trainingXp,
        trained: effectiveRank(rank, trainingXp) - Math.min(SKILL_MAX_RANK, rank),
      };
    });
    return {
      points,
      available: Math.max(0, points - spent),
      skills,
      perks: perksFor(Object.fromEntries(skills.map((s) => [s.id, s.rank + s.trained]))),
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
    // ranks earned by training leave less room for points
    const trained = (await store.training(bud.slug)).find((t) => t.skill === skill.data)?.xp ?? 0;
    const maxSpent = Math.max(0, SKILL_MAX_RANK - trainedRanks(trained));
    const rank = await store.upgradeSkill(bud.slug, skill.data, points, maxSpent);
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

  // ---------- training on the map ----------

  /**
   * A training round at a spot on the map: the game reports the mini-game score (0..5), the server grants training
   * XP (doubled by the Skupienie drink) once per cooldown and works out new ranks and perks.
   */
  app.post('/v1/buds/me/training/:spotId', requirePlayer(store), async (c) => {
    const spotId = trainingSpotIdSchema.safeParse(c.req.param('spotId'));
    const spot = spotId.success ? content.training.find((t) => t.id === spotId.data) : undefined;
    if (!spot) throw new HTTPException(404, { message: 'Nie ma tu miejsca treningu' });
    const input = trainRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) {
      return c.json<ApiError>({ error: { code: 'invalid_input', message: 'Podaj wynik' } }, 400);
    }
    const bud = c.get('bud');
    const before = await ranksOf(bud.slug);
    const focused = buffBonus(await buffsOf(bud.slug)).trainingFocus;
    const xpGained = trainingXp(input.data.score, focused);
    const total = await store.train(
      bud.slug,
      spot.id,
      spot.skill,
      xpGained,
      TRAINING_COOLDOWN_SECONDS,
    );
    if (total === null) {
      const last = await store.lastTrained(bud.slug, spot.id);
      const wait = last
        ? Math.max(
            1,
            TRAINING_COOLDOWN_SECONDS - Math.floor((now().getTime() - last.getTime()) / 1000),
          )
        : TRAINING_COOLDOWN_SECONDS;
      return c.json<ApiError>(
        { error: { code: 'resting', message: `Odpocznij chwilę. Wróć za ${wait} s.` } },
        409,
      );
    }
    const after = await ranksOf(bud.slug);
    const had = new Set(perksFor(before));
    // a round that scored at all counts in the turf where the spot stands
    const influence =
      input.data.score > 0
        ? await rivalry.earn(
            bud.slug,
            turfOf(spot.district, spot.map, spot.x, spot.y),
            'training',
            'trening',
          )
        : null;
    return c.json<TrainResponse>({
      influence,
      spotId: spot.id,
      skill: spot.skill,
      xpGained,
      trainingXp: total,
      rank: after[spot.skill],
      rankUp: after[spot.skill] > before[spot.skill],
      perksUnlocked: perksFor(after).filter((p) => !had.has(p)),
      cooldown: TRAINING_COOLDOWN_SECONDS,
    });
  });

  // ---------- energy drinks (napoje) ----------

  const consumablesOf = async (slug: string): Promise<ConsumablesResponse> => {
    const at = now().getTime();
    const [items, buffs] = await Promise.all([store.consumables(slug), store.buffs(slug)]);
    return {
      items: items.filter((i) => i.qty > 0 && catalogItem(i.itemId, catalog)?.drink),
      buffs: buffs
        .filter((b) => b.until.getTime() > at && BUFFS.some((x) => x.id === b.buff))
        .map((b) => ({
          buff: b.buff as BuffId,
          until: b.until.toISOString(),
          secondsLeft: Math.ceil((b.until.getTime() - at) / 1000),
        })),
    };
  };

  app.get('/v1/buds/me/consumables', requirePlayer(store), async (c) =>
    c.json<ConsumablesResponse>(await consumablesOf(c.get('bud').slug)),
  );

  /** Drinks one energy drink: its boost runs for a while (drinking again restarts the timer). */
  app.post('/v1/buds/me/consumables/:itemId/use', requirePlayer(store), async (c) => {
    const item = catalogItem(c.req.param('itemId'), catalog);
    const buff = item?.drink ? BUFFS.find((b) => b.id === item.drink) : undefined;
    if (!item || !buff) throw new HTTPException(404, { message: 'Tego się nie pije' });
    const bud = c.get('bud');
    const until = await store.useConsumable(bud.slug, item.id, buff.id, buff.seconds);
    if (!until) {
      return c.json<ApiError>(
        { error: { code: 'none_left', message: `Nie masz już: ${item.name}` } },
        409,
      );
    }
    return c.json<ConsumablesResponse>(await consumablesOf(bud.slug));
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
  app.post('/v1/pair', limit(env.CREATE_LIMIT_PER_MINUTE), async (c) => {
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

  // ---------- the look creator (website and game) ----------

  /** Each body part's catalog and colours per gender: the game builds its creator from this. */
  app.get('/v1/look/options', (c) => {
    c.header('Cache-Control', 'public, max-age=3600');
    return c.json<LookOptions>(lookOptions());
  });

  /**
   * A preview sheet for a look that isn't a bud yet (the in-game creator). `look` is the JSON look, base64url.
   * Rendering costs CPU, so it has its own limit.
   */
  app.get('/v1/look/sheet.png', limit(env.PREVIEW_LIMIT_PER_MINUTE), (c) => {
    let look: unknown = null;
    try {
      look = JSON.parse(Buffer.from(c.req.query('look') ?? '', 'base64url').toString('utf8'));
    } catch {
      look = null;
    }
    const parsed = budLookSchema.safeParse(look);
    if (!parsed.success) {
      return c.json<ApiError>(
        { error: { code: 'invalid_input', message: 'Nieprawidłowy wygląd' } },
        400,
      );
    }
    const scale = Math.min(Math.max(Math.round(Number(c.req.query('scale'))) || 6, 2), 8);
    return c.body(new Uint8Array(budSheetPng(parsed.data, scale)), 200, {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    });
  });

  app.get('/v1/buds/:slug/sheet.png', async (c) => {
    const slug = budSlugSchema.safeParse(c.req.param('slug'));
    const bud = slug.success ? await store.getBySlug(slug.data) : null;
    if (!bud) throw new HTTPException(404, { message: 'Bud not found' });
    // default 8 → 128×192 px per frame; 2..16 accepted
    const scale = Math.min(Math.max(Math.round(Number(c.req.query('scale'))) || 8, 2), 16);
    return c.body(new Uint8Array(budSheetPngCached(bud.look, scale)), 200, {
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

  // ---------- rywalizacja: turfs, rankings, crews, PvP, market ----------

  rivalry.routes(app, { fighterOf, startFight });

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
