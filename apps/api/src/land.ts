import type { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  LAND_MIN_LEVEL,
  LAND_PROBLEM_TEXT,
  RAID_PROBLEM_TEXT,
  SELL_BATCH,
  build,
  buildRequestSchema,
  buyPlotRequestSchema,
  clearProblem,
  clearRequestSchema,
  collect,
  collectRequestSchema,
  dayKey,
  districtView,
  fortify,
  landDefence,
  landPower,
  landStateSchema,
  landView,
  levelFromXp,
  newLand,
  placementProblem,
  plotById,
  plotPrice,
  raid,
  raidEnemyId,
  raidHeld,
  raidPlotOf,
  raidProblem,
  raidRequestSchema,
  renameLandRequestSchema,
  sellResourceRequestSchema,
  sellValue,
  settle,
  startClearing,
  startRaid,
  upgrade,
  upgradeProblem,
  type ApiError,
  type BuildingId,
  type BudRecord,
  type DistrictsResponse,
  type FightState,
  type Fighter,
  type LandProblem,
  type LandResponse,
  type LandState,
  type RaidResult,
  type ResourceId,
  type Resources,
} from '@buds/shared';
import type { AuthVariables } from './middleware/auth.js';
import { requirePlayer, type PlayerVariables } from './middleware/player.js';
import type { BudStore } from './store/types.js';

type Vars = { Variables: AuthVariables & PlayerVariables };
type Ctx = Context<Vars>;

/** What a change to a district works out to: the new state, coins moved (rent in, prices out), what was gathered. */
type Outcome = { land: LandState; coins?: number; gathered?: Resources; rent?: number };

/**
 * Dystrykty (docs/dystrykty.md): plots on the wastelands, bought for coins, where each bud's district grows; seen
 * by everyone passing by and, from RAID_MIN_LEVEL, raided. Every rule is packages/shared land.ts worked out here on
 * the server from the stored documents and the server's clock; the game only says what it wants to do. A save is a
 * compare-and-swap on the district's version (tried again a few times when another device saved first), coins
 * (rent, prices, sales, the plot) move in the same transaction; a raid saves both districts in one.
 */
export function createLand({
  store,
  now,
  shieldHours,
}: {
  store: BudStore;
  now: () => Date;
  /** How long a new district is safe (LAND_SHIELD_HOURS). */
  shieldHours?: number;
}) {
  const level = (bud: BudRecord) => levelFromXp(bud.xp).level;

  const parse = (state: unknown) => landStateSchema.parse(state);
  const load = async (slug: string): Promise<{ land: LandState; version: number } | null> => {
    const row = await store.getLand(slug);
    return row ? { land: parse(row.state), version: row.version } : null;
  };

  const problem = (c: Ctx, p: LandProblem) =>
    c.json<ApiError>(
      { error: { code: p, message: LAND_PROBLEM_TEXT[p] } },
      p === 'not_found' ? 404 : p === 'level_too_low' ? 403 : 409,
    );

  /**
   * Works a change out from the stored district and saves it; tries again from the new version when another device
   * saved in between. `work` returns the outcome, or a problem.
   */
  const change = async (c: Ctx, work: (land: LandState, at: number) => Outcome | LandProblem) => {
    const bud = c.get('bud');
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = await load(bud.slug);
      if (!row)
        return c.json<ApiError>(
          { error: { code: 'no_land', message: 'Nie masz jeszcze działki.' } },
          404,
        );
      const at = now().getTime();
      const out = work(settle(row.land, at), at);
      if (typeof out === 'string') return problem(c, out);
      const saved = await store.saveLand(
        bud.slug,
        row.version,
        out.land,
        landPower(out.land),
        out.coins ?? 0,
      );
      if (saved.status === 'conflict') continue;
      if (saved.status === 'poor') return problem(c, 'poor');
      return c.json<LandResponse>({
        land: landView(out.land, at),
        coins: saved.coins,
        ...(out.gathered ? { gathered: out.gathered } : {}),
        ...(out.rent ? { rent: out.rent } : {}),
      });
    }
    throw new HTTPException(409, { message: 'Spróbuj jeszcze raz.' });
  };

  /** A request body checked against a schema; a bad one is a 400 with the schema's own (Polish) message. */
  const body = async <T>(
    c: Ctx,
    schema: {
      safeParse: (v: unknown) => {
        success: boolean;
        data?: T;
        error?: { issues: { message: string }[] };
      };
    },
  ) => {
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      throw new HTTPException(400, { message: parsed.error?.issues[0]?.message ?? 'Złe dane' });
    return parsed.data as T;
  };

  // ---------- raids: a duel against the owner's fighter, fortified by its district ----------

  /** The defender of a plot: its district, version and owner, or null. */
  const defenderOf = async (plot: string) => {
    const row = await store.landOnPlot(plot);
    if (!row) return null;
    const owner = await store.getBySlug(row.slug);
    return owner ? { land: parse(row.state), version: row.version, owner } : null;
  };

  /**
   * The end of a raid the raider played (called once per fight, after the store has finished it): a won raid takes
   * its loot and shields the district, a lost one is only written in the district's log. Both districts are saved in
   * one transaction, worked out again when either changed meanwhile.
   */
  const finishRaid = async (bud: BudRecord, state: FightState): Promise<RaidResult | null> => {
    const plot = raidPlotOf(state.enemyId);
    if (!plot) return null;
    const won = state.status === 'won';
    for (let attempt = 0; attempt < 4; attempt++) {
      const [mine, theirs] = await Promise.all([load(bud.slug), defenderOf(plot)]);
      if (!mine || !theirs) return null;
      const at = now().getTime();
      const by = { name: bud.name, slug: bud.slug };
      // someone else's raid finished first and shielded the district: nothing left to take
      const out =
        won && theirs.land.shieldUntil <= at
          ? raid(mine.land, theirs.land, at, by)
          : {
              raider: mine.land,
              defender: won ? theirs.land : raidHeld(theirs.land, at, by),
              loot: { beton: 0, stal: 0, energia: 0, zywnosc: 0 },
            };
      const saved = await store.saveRaid(
        { slug: bud.slug, version: mine.version, state: out.raider, power: landPower(out.raider) },
        {
          slug: theirs.owner.slug,
          version: theirs.version,
          state: out.defender,
          power: landPower(out.defender),
        },
      );
      if (saved === 'conflict') continue;
      return { plot, district: theirs.land.name, won, loot: out.loot };
    }
    return { plot, district: '', won, loot: { beton: 0, stal: 0, energia: 0, zywnosc: 0 } };
  };

  function routes(
    app: Hono<Vars>,
    deps: {
      fighterOf: (bud: BudRecord, withDrinks: boolean) => Promise<Fighter>;
      startFight: (
        c: Context,
        bud: BudRecord,
        enemyId: string,
        me: Fighter,
        them: Fighter,
      ) => Promise<Response>;
      abandon: (slug: string) => Promise<void>;
    },
  ) {
    const player = requirePlayer(store);

    /** The bud's district (or null), worked out to the server's clock now. */
    app.get('/v1/land', player, async (c) => {
      const row = await load(c.get('bud').slug);
      return c.json<LandResponse>({ land: row ? landView(row.land, now().getTime()) : null });
    });

    /** Every district on a wasteland, as anyone passing by sees it (public: names, levels, buildings, defence). */
    app.get('/v1/districts/:route', async (c) => {
      const route = c.req.param('route');
      if (!/^[a-z-]{3,40}$/.test(route)) throw new HTTPException(400, { message: 'Złe pustkowie' });
      const rows = await store.landsOn(route);
      return c.json<DistrictsResponse>({
        route,
        now: now().getTime(),
        // a document the rules can't read (one from an older plan) is left out, never the whole list
        districts: rows.flatMap((r) => {
          const state = landStateSchema.safeParse(r.state);
          if (!state.success) return [];
          return [
            districtView(
              state.data,
              { slug: r.slug, name: r.name, level: levelFromXp(r.xp).level },
              now().getTime(),
            ),
          ];
        }),
      });
    });

    /** Buys a free plot (coins, once per bud) and founds the district on it under the name the bud chose. */
    app.post('/v1/land', player, async (c) => {
      const input = await body<{ plot: string; name: string }>(c, buyPlotRequestSchema);
      const bud = c.get('bud');
      if (level(bud) < LAND_MIN_LEVEL) return problem(c, 'level_too_low');
      const plot = plotById(input.plot);
      if (!plot) throw new HTTPException(404, { message: 'Nie ma takiej działki' });
      const at = now().getTime();
      const land = newLand(plot.id, input.name, at, shieldHours);
      const price = plotPrice(plot.route);
      const made = await store.createLand(
        bud.slug,
        plot.id,
        plot.route,
        land,
        landPower(land),
        price,
      );
      if (made.status === 'has_land')
        return c.json<ApiError>({ error: { code: 'has_land', message: 'Masz już działkę.' } }, 409);
      if (made.status === 'taken')
        return c.json<ApiError>(
          { error: { code: 'taken', message: 'Ktoś był szybszy: ta działka jest już kupiona.' } },
          409,
        );
      if (made.status === 'poor')
        return c.json<ApiError>(
          {
            error: {
              code: 'not_enough_coins',
              message: `Działka kosztuje ${price} monet. Brakuje ci ${price - made.coins}.`,
            },
          },
          409,
        );
      return c.json<LandResponse>({ land: landView(land, at), coins: made.coins }, 201);
    });

    /** A new name for the district (the same rules as when it was founded). */
    app.post('/v1/land/name', player, async (c) => {
      const input = await body<{ name: string }>(c, renameLandRequestSchema);
      return change(c, (land) => ({ land: { ...land, name: input.name } }));
    });

    app.post('/v1/land/build', player, async (c) => {
      const input = await body<{ kind: BuildingId; x: number; y: number; rot?: number }>(
        c,
        buildRequestSchema,
      );
      const lvl = level(c.get('bud'));
      return change(c, (land, at) => {
        const p = placementProblem(land, input.kind, input.x, input.y, lvl, input.rot ?? 0);
        if (p) return p;
        const next = build(land, input.kind, input.x, input.y, at, input.rot ?? 0);
        return next === 'walls_in' ? 'walls_in' : { land: next };
      });
    });

    app.post('/v1/land/buildings/:id/upgrade', player, async (c) => {
      const id = Number(c.req.param('id'));
      if (!Number.isInteger(id) || id < 0) throw new HTTPException(400, { message: 'Zły budynek' });
      const lvl = level(c.get('bud'));
      return change(c, (land, at) => {
        const p = upgradeProblem(land, id, lvl, at);
        if (p) return p;
        const out = upgrade(land, id, at);
        return { land: out.land, coins: out.coins, rent: out.coins };
      });
    });

    /** Gathers what the producers made (one by id, or all): resources into storage, rent into the wallet. */
    app.post('/v1/land/collect', player, async (c) => {
      const input = await body<{ id?: number }>(c, collectRequestSchema);
      return change(c, (land, at) => {
        if (input.id !== undefined && !land.buildings.some((b) => b.id === input.id))
          return 'not_found';
        const out = collect(land, at, input.id);
        return { land: out.land, gathered: out.gathered, coins: out.coins, rent: out.coins };
      });
    });

    /**
     * Clears a sector of the plot next to the district (coins and materials, the bud's and the town hall's level, one
     * at a time): a crew works on it for a while, then it is the district's to build on.
     */
    app.post('/v1/land/clear', player, async (c) => {
      const input = await body<{ sector: number }>(c, clearRequestSchema);
      const bud = c.get('bud');
      const lvl = level(bud);
      const { coins } = await store.wallet(bud.slug);
      return change(c, (land, at) => {
        const check = clearProblem(land, input.sector, lvl, coins, at);
        if (check.problem) return check.problem;
        return { land: startClearing(land, input.sector, at), coins: -check.coins };
      });
    });

    /** Sells resources for coins (whole batches of ten). */
    app.post('/v1/land/sell', player, async (c) => {
      const input = await body<{ resource: ResourceId; amount: number }>(
        c,
        sellResourceRequestSchema,
      );
      return change(c, (land) => {
        const have = land.resources[input.resource];
        if (have < input.amount) return 'poor';
        const sold = input.amount - (input.amount % SELL_BATCH);
        const coins = sellValue(input.resource, sold);
        if (sold <= 0 || coins <= 0) return 'poor';
        return {
          land: { ...land, resources: { ...land.resources, [input.resource]: have - sold } },
          coins,
        };
      });
    });

    /**
     * Raids another bud's district: checked (levels, shield, the day's limit, a rest after a failed try), counted on
     * the raider's district, then a duel against the owner's saved fighter fortified by the district's defence.
     */
    app.post('/v1/land/raids', player, async (c) => {
      const input = await body<{ plot: string }>(c, raidRequestSchema);
      const bud = c.get('bud');
      for (let attempt = 0; attempt < 4; attempt++) {
        const [mine, theirs] = await Promise.all([load(bud.slug), defenderOf(input.plot)]);
        if (!theirs) throw new HTTPException(404, { message: 'Na tej działce nikt nie mieszka' });
        const at = now().getTime();
        const day = dayKey(now());
        const p = raidProblem(
          mine?.land ?? null,
          level(bud),
          bud.slug,
          theirs.land,
          theirs.owner.slug,
          level(theirs.owner),
          at,
          day,
        );
        if (p)
          return c.json<ApiError>(
            { error: { code: p, message: RAID_PROBLEM_TEXT[p] } },
            p === 'level_too_low' ? 403 : 409,
          );
        const counted = startRaid(mine!.land, theirs.owner.slug, at, day);
        const saved = await store.saveLand(bud.slug, mine!.version, counted, landPower(counted), 0);
        if (saved.status === 'conflict') continue;
        await deps.abandon(bud.slug);
        const [me, owner] = await Promise.all([
          deps.fighterOf(bud, true),
          deps.fighterOf(theirs.owner, false),
        ]);
        const defence = landDefence(landPower(settle(theirs.land, at)));
        return deps.startFight(c, bud, raidEnemyId(input.plot), me, fortify(owner, defence));
      }
      throw new HTTPException(409, { message: 'Spróbuj jeszcze raz.' });
    });

    /** The mightiest districts (public: their names, their owners' names and levels, their wasteland and might). */
    app.get('/v1/land/top', async (c) => {
      const rows = await store.topLands(20);
      return c.json({
        lands: rows.map((r) => ({
          slug: r.slug,
          name: r.name,
          district: r.district,
          level: levelFromXp(r.xp).level,
          route: r.route,
          power: r.power,
        })),
      });
    });
  }

  return { routes, finishRaid };
}
