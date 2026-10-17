import type { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  CHALLENGES,
  CREW_MAX,
  DAILY_INFLUENCE_CAP,
  DISTRICTS,
  INFLUENCE,
  MARKET_MAX_LISTINGS,
  OWNER_MIN,
  PVP_LEVEL_RANGE,
  PVP_PAID_WINS,
  PVP_REMATCH_SECONDS,
  RATING_START,
  RIVALRY_MIN_LEVEL,
  TURFS,
  TURF_WIN_COINS,
  WEEK_TOP_COINS,
  XP_CURVE,
  budSlugSchema,
  catalogItem,
  createCrewRequestSchema,
  crewTagSchema,
  dayKey,
  leagueFor,
  levelFromXp,
  levelOf,
  marketPayout,
  previousWeek,
  pvpCoins,
  pvpEnemyId,
  pvpOpponentOf,
  ratingDelta,
  sellRequestSchema,
  startPvpRequestSchema,
  tributeFor,
  turfById,
  weekEnds,
  weekKey,
  type ApiError,
  type BudRecord,
  type CatalogItem,
  type ChallengeId,
  type Crew,
  type DistrictContent,
  type Fighter,
  type FightResponse,
  type FightState,
  type Influence,
  type InfluenceKind,
  type Turf,
  type TurfState,
  type PvpResult,
  type crewListResponseSchema,
  type crewResponseSchema,
  type marketResponseSchema,
  type pvpOpponentsResponseSchema,
  type rankingResponseSchema,
  type rivalryMeResponseSchema,
  type tributeResponseSchema,
  type turfsResponseSchema,
} from '@buds/shared';
import type { z } from 'zod';
import type { AuthVariables } from './middleware/auth.js';
import { hashToken, requirePlayer, type PlayerVariables } from './middleware/player.js';
import type { BudStore } from './store/types.js';

type TurfsResponse = z.infer<typeof turfsResponseSchema>;
type RivalryMeResponse = z.infer<typeof rivalryMeResponseSchema>;
type RankingResponse = z.infer<typeof rankingResponseSchema>;
type TributeResponse = z.infer<typeof tributeResponseSchema>;
type CrewResponse = z.infer<typeof crewResponseSchema>;
type CrewListResponse = z.infer<typeof crewListResponseSchema>;
type PvpOpponentsResponse = z.infer<typeof pvpOpponentsResponseSchema>;
type MarketResponse = z.infer<typeof marketResponseSchema>;

const fail = (c: Context, status: 400 | 403 | 404 | 409, code: string, message: string) =>
  c.json<ApiError>({ error: { code, message } }, status);

/** The XP where a level starts (the curve of packages/shared level.ts). */
const xpAtLevel = (level: number) => XP_CURVE * (Math.max(1, level) - 1) ** 2;

/**
 * Rywalizacja on the server (docs/rywalizacja.md): influence for what buds do in the turfs, the weekly settlement,
 * crews, PvP duels against other buds' fighters and the market. The game only shows what this decides.
 */
export function createRivalry({
  store,
  now,
  catalog,
  content,
}: {
  store: BudStore;
  now: () => Date;
  catalog: readonly CatalogItem[];
  content: DistrictContent;
}) {
  // the last finished week this process has settled (the store settles each week once, whoever asks first)
  let settled = '';
  const settle = async () => {
    const week = previousWeek(now());
    if (settled === week) return;
    await store.settleWeek(week, OWNER_MIN, TURF_WIN_COINS, WEEK_TOP_COINS);
    settled = week;
  };

  /** Influence for something done at a place, and the week's challenge; null outside turfs. */
  const earn = async (
    slug: string,
    turf: Turf | undefined,
    kind: InfluenceKind,
    challenge: ChallengeId,
    times = 1,
  ): Promise<Influence | null> => {
    await settle();
    const at = now();
    if (!turf) {
      await store.bumpChallenge(slug, weekKey(at), challenge);
      return null;
    }
    const r = await store.addInfluence(
      slug,
      turf.id,
      weekKey(at),
      dayKey(at),
      INFLUENCE[kind] * times,
      DAILY_INFLUENCE_CAP,
      OWNER_MIN,
      challenge,
    );
    return { turf: turf.id, name: turf.name, ...r };
  };

  /** Rulers of these turfs this week (at least OWNER_MIN, first there on a tie). */
  const rulersOf = async (turfs: readonly Turf[], week: string) => {
    const boards = await store.turfBoards(
      turfs.map((t) => t.id),
      week,
    );
    const byTurf = new Map<string, typeof boards>();
    for (const row of boards) byTurf.set(row.turf, [...(byTurf.get(row.turf) ?? []), row]);
    return byTurf;
  };

  // ---------- PvP ----------

  const ratingOf = async (slug: string) =>
    (await store.ratings([slug])).get(slug) ?? { rating: RATING_START, wins: 0, losses: 0 };

  /** A lost PvP duel: the challenger's rating goes to the defender. */
  const losePvp = async (slug: string, opponent: string): Promise<PvpResult> => {
    const ratings = await store.ratings([slug, opponent]);
    const mine = ratings.get(slug)?.rating ?? RATING_START;
    const theirs = ratings.get(opponent)?.rating ?? RATING_START;
    const delta = ratingDelta(theirs, mine);
    const rating = await store.pvpLoss(slug, opponent, delta);
    return {
      opponent,
      rating,
      delta: rating - mine,
      league: leagueFor(rating).name,
      paidLeft: await paidLeft(slug),
    };
  };

  /** Paid PvP wins left today. */
  const paidLeft = async (slug: string) =>
    Math.max(0, PVP_PAID_WINS - (await store.pvpWinsToday(slug, dayKey(now()))));

  /** Ends every unfinished duel of the bud; a PvP duel left after the first turn counts as lost. */
  const abandon = async (slug: string) => {
    for (const f of await store.abandonFights(slug)) {
      const opponent = pvpOpponentOf(f.enemyId);
      if (opponent && f.turn > 0 && (await store.getBySlug(opponent)))
        await losePvp(slug, opponent);
    }
  };

  /**
   * The end of a PvP duel the challenger played: rating, the day's paid coins and the weekly challenge. Called once
   * per fight, after the store has finished it (the store's finish is the "only once" gate).
   */
  const finishPvp = async (
    bud: BudRecord,
    state: FightState,
  ): Promise<{ pvp: PvpResult; reward: FightResponse['reward'] }> => {
    const opponent = pvpOpponentOf(state.enemyId)!;
    if (state.status !== 'won') return { pvp: await losePvp(bud.slug, opponent), reward: null };
    const ratings = await store.ratings([bud.slug, opponent]);
    const mine = ratings.get(bud.slug)?.rating ?? RATING_START;
    const theirs = ratings.get(opponent)?.rating ?? RATING_START;
    const delta = ratingDelta(mine, theirs);
    const at = now();
    const r = await store.pvpWin(
      bud.slug,
      opponent,
      delta,
      dayKey(at),
      pvpCoins(mine + delta),
      PVP_PAID_WINS,
    );
    await settle();
    await store.bumpChallenge(bud.slug, weekKey(at), 'pvp');
    const level = levelFromXp(bud.xp).level;
    return {
      pvp: {
        opponent,
        rating: r.rating,
        delta,
        league: leagueFor(r.rating).name,
        paidLeft: Math.max(0, PVP_PAID_WINS - r.winsToday),
      },
      reward: {
        xpGained: 0,
        xp: bud.xp,
        level,
        levelUp: false,
        coinsGained: r.paid,
        coins: r.coins,
        item: null,
        drink: null,
      },
    };
  };

  // ---------- routes ----------

  function routes(
    app: Hono<{ Variables: AuthVariables & PlayerVariables }>,
    deps: {
      /** The bud's fighter as the server trusts it (gear, skills, perks; drinks only for the challenger). */
      fighterOf: (bud: BudRecord, withDrinks: boolean) => Promise<Fighter>;
      startFight: (
        c: Context,
        bud: BudRecord,
        enemyId: string,
        me: Fighter,
        them: Fighter,
      ) => Promise<Response>;
    },
  ) {
    const player = requirePlayer(store);
    /** The bud behind an optional player token (public reads show more to a signed-in player). */
    const maybeBud = async (c: Context) => {
      const [scheme, token] = (c.req.header('authorization') ?? '').split(' ');
      if (scheme?.toLowerCase() !== 'bearer' || !token || token.length > 100) return null;
      return store.getByTokenHash(hashToken(token));
    };
    const tooEarly = (c: Context, bud: BudRecord) =>
      levelFromXp(bud.xp).level < RIVALRY_MIN_LEVEL
        ? fail(c, 403, 'level_too_low', `Dostępne od poziomu ${RIVALRY_MIN_LEVEL}`)
        : null;

    /** Every turf of a district: who rules it, the asking bud's influence and tribute. */
    app.get('/v1/rivalry/district/:id', async (c) => {
      const district = DISTRICTS.find((d) => d.id === c.req.param('id'));
      if (!district) throw new HTTPException(404, { message: 'Nie ma takiej dzielnicy' });
      await settle();
      const at = now();
      const week = weekKey(at);
      const bud = await maybeBud(c);
      const turfs = TURFS.filter((t) => t.district === district.id);
      const [boards, claimed] = await Promise.all([
        rulersOf(turfs, week),
        bud ? store.tributesClaimed(bud.slug, dayKey(at)) : Promise.resolve([]),
      ]);
      const owners = turfs
        .map((t) => boards.get(t.id)?.[0])
        .filter((r) => r && r.points >= OWNER_MIN)
        .map((r) => r!.slug);
      const tags = await store.crewTags([...new Set(owners)]);
      const states: TurfState[] = turfs.map((t) => {
        const board = boards.get(t.id) ?? [];
        const top = board[0] && board[0].points >= OWNER_MIN ? board[0] : null;
        const i = bud ? board.findIndex((r) => r.slug === bud.slug) : -1;
        const mine = top !== null && top.slug === bud?.slug;
        return {
          id: t.id,
          name: t.name,
          district: t.district,
          owner: top
            ? {
                slug: top.slug,
                name: top.name,
                crewTag: tags.get(top.slug) ?? null,
                points: top.points,
              }
            : null,
          mine: i >= 0 ? board[i]!.points : 0,
          rank: i >= 0 ? i + 1 : null,
          tributeReady: mine && !claimed.includes(t.id),
          tribute: tributeFor(t.district),
        };
      });
      return c.json<TurfsResponse>({ week, endsAt: weekEnds(at).toISOString(), turfs: states });
    });

    /** The bud's week: influence, ruled turfs, titles, crew, rating and challenges. */
    app.get('/v1/rivalry/me', player, async (c) => {
      await settle();
      const bud = c.get('bud');
      const at = now();
      const week = weekKey(at);
      const [standing, boards, claimed, titles, crew, rating, challenges] = await Promise.all([
        store.weekStanding(bud.slug, week),
        rulersOf(TURFS, week),
        store.tributesClaimed(bud.slug, dayKey(at)),
        store.titles(bud.slug),
        store.crewOf(bud.slug),
        ratingOf(bud.slug),
        store.challengeStanding(bud.slug, week),
      ]);
      const ruled = TURFS.filter((t) => {
        const top = boards.get(t.id)?.[0];
        return top && top.points >= OWNER_MIN && top.slug === bud.slug;
      }).map((t) => ({
        id: t.id,
        name: t.name,
        tributeReady: !claimed.includes(t.id),
        tribute: tributeFor(t.district),
      }));
      const byId = new Map(challenges.map((x) => [x.challenge, x]));
      return c.json<RivalryMeResponse>({
        week,
        endsAt: weekEnds(at).toISOString(),
        points: standing.points,
        rank: standing.rank,
        ruled,
        titles,
        crew,
        rating: rating.rating,
        league: leagueFor(rating.rating).name,
        challenges: CHALLENGES.map((ch) => ({
          id: ch.id,
          name: ch.name,
          count: byId.get(ch.id)?.count ?? 0,
          rank: byId.get(ch.id)?.rank ?? null,
        })),
      });
    });

    /** The ruler's daily tribute (haracz): coins once per day per turf. */
    app.post('/v1/rivalry/turfs/:id/tribute', player, async (c) => {
      const turf = turfById(c.req.param('id'));
      if (!turf) throw new HTTPException(404, { message: 'Nie ma takiego rewiru' });
      await settle();
      const bud = c.get('bud');
      const at = now();
      const gained = tributeFor(turf.district);
      const coins = await store.claimTribute(
        bud.slug,
        turf.id,
        weekKey(at),
        dayKey(at),
        gained,
        OWNER_MIN,
      );
      if (coins === null) {
        const claimed = await store.tributesClaimed(bud.slug, dayKey(at));
        return claimed.includes(turf.id)
          ? fail(c, 409, 'already_collected', 'Dzisiejszy haracz już zebrany. Wróć jutro.')
          : fail(c, 409, 'not_ruler', `Nie rządzisz rewirem ${turf.name}`);
      }
      return c.json<TributeResponse>({ turf: turf.id, coins, gained });
    });

    /** The week's rankings: buds, crews, challenges and the PvP leagues. */
    app.get('/v1/rivalry/ranking', async (c) => {
      await settle();
      const at = now();
      const week = weekKey(at);
      const [buds, crews, leaders, pvp] = await Promise.all([
        store.weekTotals(week, 20),
        store.crewWeekTotals(week, 10),
        Promise.all(CHALLENGES.map((ch) => store.challengeLeaders(week, ch.id, 5))),
        store.pvpLeaders(10),
      ]);
      const tags = await store.crewTags(buds.map((b) => b.slug));
      c.header('Cache-Control', 'public, max-age=30');
      return c.json<RankingResponse>({
        week,
        endsAt: weekEnds(at).toISOString(),
        buds: buds.map((b) => ({
          slug: b.slug,
          name: b.name,
          level: levelFromXp(b.xp).level,
          crewTag: tags.get(b.slug) ?? null,
          points: b.points,
        })),
        crews,
        challenges: CHALLENGES.map((ch, i) => ({
          id: ch.id,
          name: ch.name,
          unit: ch.unit,
          leaders: leaders[i]!,
        })),
        pvp: pvp.map((p) => ({ ...p, league: leagueFor(p.rating).name })),
      });
    });

    // ---------- crews (ekipy) ----------

    const crewView = async (tag: string): Promise<Crew | null> => {
      const crew = await store.crewByTag(tag);
      if (!crew) return null;
      const week = weekKey(now());
      const points = await Promise.all(
        crew.members.map((m) => store.weekStanding(m.slug, week).then((s) => s.points)),
      );
      const members = crew.members.map((m, i) => ({
        slug: m.slug,
        name: m.name,
        level: levelFromXp(m.xp).level,
        role: m.role,
        points: points[i]!,
      }));
      return {
        tag: crew.tag,
        name: crew.name,
        members,
        points: members.reduce((a, m) => a + m.points, 0),
      };
    };

    app.get('/v1/crews', async (c) => {
      const [crews, totals] = await Promise.all([
        store.crews(50),
        store.crewWeekTotals(weekKey(now()), 50),
      ]);
      const points = new Map(totals.map((t) => [t.tag, t.points]));
      return c.json<CrewListResponse>({
        crews: crews.map((x) => ({ ...x, points: points.get(x.tag) ?? 0 })),
      });
    });

    app.get('/v1/buds/me/crew', player, async (c) => {
      const mine = await store.crewOf(c.get('bud').slug);
      return c.json<CrewResponse>({ crew: mine ? await crewView(mine.tag) : null });
    });

    app.get('/v1/crews/:tag', async (c) => {
      const tag = crewTagSchema.safeParse(c.req.param('tag'));
      const crew = tag.success ? await crewView(tag.data) : null;
      if (!crew) throw new HTTPException(404, { message: 'Nie ma takiej ekipy' });
      return c.json<CrewResponse>({ crew });
    });

    app.post('/v1/crews', player, async (c) => {
      const bud = c.get('bud');
      const early = tooEarly(c, bud);
      if (early) return early;
      const input = createCrewRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!input.success)
        return fail(c, 400, 'invalid_input', input.error.issues[0]?.message ?? 'Podaj nazwę i tag');
      const status = await store.createCrew(bud.slug, input.data.name, input.data.tag);
      if (status === 'in_crew') return fail(c, 409, 'in_crew', 'Najpierw opuść swoją ekipę');
      if (status === 'taken') return fail(c, 409, 'taken', 'Ta nazwa albo tag są już zajęte');
      return c.json<CrewResponse>({ crew: await crewView(input.data.tag) }, 201);
    });

    app.post('/v1/crews/leave', player, async (c) => {
      if (!(await store.leaveCrew(c.get('bud').slug)))
        return fail(c, 409, 'not_in_crew', 'Nie należysz do żadnej ekipy');
      return c.json<CrewResponse>({ crew: null });
    });

    app.post('/v1/crews/:tag/join', player, async (c) => {
      const bud = c.get('bud');
      const early = tooEarly(c, bud);
      if (early) return early;
      const tag = crewTagSchema.safeParse(c.req.param('tag'));
      if (!tag.success) throw new HTTPException(404, { message: 'Nie ma takiej ekipy' });
      const status = await store.joinCrew(bud.slug, tag.data, CREW_MAX);
      if (status === 'unknown') throw new HTTPException(404, { message: 'Nie ma takiej ekipy' });
      if (status === 'in_crew') return fail(c, 409, 'in_crew', 'Najpierw opuść swoją ekipę');
      if (status === 'full') return fail(c, 409, 'full', `Ekipa jest pełna (${CREW_MAX} osób)`);
      return c.json<CrewResponse>({ crew: await crewView(tag.data) });
    });

    // ---------- PvP: duels against other buds' fighters ----------

    /** Buds within PVP_LEVEL_RANGE levels, the closest ratings first. */
    app.get('/v1/pvp/opponents', player, async (c) => {
      const bud = c.get('bud');
      const level = levelFromXp(bud.xp).level;
      const lowest = Math.max(RIVALRY_MIN_LEVEL, level - PVP_LEVEL_RANGE);
      const around = (
        await store.budsAround(xpAtLevel(lowest), xpAtLevel(level + PVP_LEVEL_RANGE + 1) - 1, 80)
      ).filter((b) => b.slug !== bud.slug);
      const [ratings, last, tags] = await Promise.all([
        store.ratings([bud.slug, ...around.map((b) => b.slug)]),
        store.pvpLastChallenges(bud.slug),
        store.crewTags(around.map((b) => b.slug)),
      ]);
      const me = ratings.get(bud.slug) ?? { rating: RATING_START, wins: 0, losses: 0 };
      const at = now().getTime();
      const picked = around
        .map((b) => ({ b, rating: ratings.get(b.slug)?.rating ?? RATING_START }))
        .sort((x, y) => Math.abs(x.rating - me.rating) - Math.abs(y.rating - me.rating))
        .slice(0, 8);
      const weapons = await Promise.all(picked.map(({ b }) => store.equipment(b.slug)));
      return c.json<PvpOpponentsResponse>({
        rating: me.rating,
        league: leagueFor(me.rating).name,
        wins: me.wins,
        losses: me.losses,
        opponents: picked.map(({ b, rating }, i) => {
          const held = weapons[i]!.held;
          const seen = last.get(b.slug);
          return {
            slug: b.slug,
            name: b.name,
            level: levelFromXp(b.xp).level,
            rating,
            league: leagueFor(rating).name,
            crewTag: tags.get(b.slug) ?? null,
            weapon: held ? (catalogItem(held, catalog)?.name ?? null) : null,
            wait: seen
              ? Math.max(0, PVP_REMATCH_SECONDS - Math.floor((at - seen.getTime()) / 1000))
              : 0,
          };
        }),
      });
    });

    /** Challenges another bud: their saved fighter (gear and skills, no drinks) against yours. */
    app.post('/v1/pvp/fights', player, async (c) => {
      const bud = c.get('bud');
      const early = tooEarly(c, bud);
      if (early) return early;
      const input = startPvpRequestSchema.safeParse(await c.req.json().catch(() => null));
      const slug = input.success ? budSlugSchema.safeParse(input.data.opponent) : null;
      const opponent = slug?.success ? await store.getBySlug(slug.data) : null;
      if (!opponent || opponent.slug === bud.slug)
        throw new HTTPException(404, { message: 'Nie ma takiego Buda' });
      const gap = Math.abs(levelFromXp(opponent.xp).level - levelFromXp(bud.xp).level);
      if (gap > PVP_LEVEL_RANGE || levelFromXp(opponent.xp).level < RIVALRY_MIN_LEVEL)
        return fail(c, 409, 'out_of_range', 'Ten Bud jest poza twoim zasięgiem poziomów');
      if (!(await store.pvpChallenge(bud.slug, opponent.slug, PVP_REMATCH_SECONDS))) {
        const seen = (await store.pvpLastChallenges(bud.slug)).get(opponent.slug);
        const wait = seen
          ? Math.max(1, PVP_REMATCH_SECONDS - Math.floor((now().getTime() - seen.getTime()) / 1000))
          : PVP_REMATCH_SECONDS;
        return fail(
          c,
          409,
          'resting',
          `Z ${opponent.name} zmierzysz się znowu za ${Math.ceil(wait / 60)} min.`,
        );
      }
      await abandon(bud.slug);
      const [me, them] = await Promise.all([
        deps.fighterOf(bud, true),
        deps.fighterOf(opponent, false),
      ]);
      return deps.startFight(c, bud, pvpEnemyId(opponent.slug), me, them);
    });

    // ---------- market (Bazar) ----------

    /** Items that can change hands: loot and shop gear, never premium, drinks or quest rewards. */
    const questRewards = new Set(content.quests.map((q) => q.rewardItem).filter(Boolean));
    const tradeable = (itemId: string) => {
      const item = catalogItem(itemId, catalog);
      return item &&
        !item.premium &&
        item.kind !== 'consumable' &&
        item.price.currency !== 'free' &&
        item.price.currency !== 'gems' &&
        !questRewards.has(item.id)
        ? item
        : undefined;
    };

    const market = async (slug: string): Promise<MarketResponse> => {
      const [listings, wallet] = await Promise.all([store.listings(60), store.wallet(slug)]);
      return {
        listings: listings
          .filter((l) => catalogItem(l.itemId, catalog))
          .map((l) => ({ ...l, mine: l.seller.slug === slug })),
        coins: wallet.coins,
      };
    };

    app.get('/v1/market', player, async (c) =>
      c.json<MarketResponse>(await market(c.get('bud').slug)),
    );

    app.post('/v1/market', player, async (c) => {
      const bud = c.get('bud');
      const early = tooEarly(c, bud);
      if (early) return early;
      const input = sellRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!input.success) return fail(c, 400, 'invalid_input', 'Cena od 5 do 5000 monet');
      const item = tradeable(input.data.itemId);
      const owned = (await store.items(bud.slug)).find((i) => i.itemId === input.data.itemId);
      if (!item || (owned && !['reward', 'shop', 'trade'].includes(owned.source)))
        return fail(c, 409, 'not_tradeable', 'Tego nie wystawisz na Bazarze');
      const r = await store.marketList(bud.slug, item.id, input.data.price, MARKET_MAX_LISTINGS);
      if (r.status === 'not_owned') return fail(c, 409, 'not_owned', `Nie masz: ${item.name}`);
      if (r.status === 'worn') return fail(c, 409, 'worn', 'Najpierw to zdejmij');
      if (r.status === 'too_many')
        return fail(c, 409, 'too_many', `Naraz wystawisz najwyżej ${MARKET_MAX_LISTINGS} rzeczy`);
      return c.json<MarketResponse>(await market(bud.slug), 201);
    });

    app.post('/v1/market/:id/buy', player, async (c) => {
      const bud = c.get('bud');
      const early = tooEarly(c, bud);
      if (early) return early;
      const listing = await store.listing(c.req.param('id'));
      const item = listing ? catalogItem(listing.itemId, catalog) : undefined;
      if (!listing || !item) throw new HTTPException(404, { message: 'Ta oferta już zniknęła' });
      if (levelFromXp(bud.xp).level < levelOf(item))
        return fail(c, 403, 'level_too_low', `${item.name}: od poziomu ${levelOf(item)}`);
      const r = await store.marketBuy(
        bud.slug,
        listing.id,
        listing.price - marketPayout(listing.price),
      );
      if (r.status === 'gone') throw new HTTPException(404, { message: 'Ta oferta już zniknęła' });
      if (r.status === 'own') return fail(c, 409, 'own', 'To twoja oferta');
      if (r.status === 'owned') return fail(c, 409, 'owned', 'Już to masz');
      if (r.status === 'poor')
        return fail(c, 409, 'not_enough_coins', `Brakuje ci ${listing.price - r.coins} monet`);
      return c.json<MarketResponse>(await market(bud.slug));
    });

    app.delete('/v1/market/:id', player, async (c) => {
      const bud = c.get('bud');
      if (!(await store.marketCancel(bud.slug, c.req.param('id'))))
        throw new HTTPException(404, { message: 'Nie masz takiej oferty' });
      return c.json<MarketResponse>(await market(bud.slug));
    });
  }

  return { settle, earn, abandon, finishPvp, routes };
}
