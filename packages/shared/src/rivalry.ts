import { z } from 'zod';
import { DISTRICTS } from './districts';
import { publicNameOk } from './schemas';
import { ROOM_DOORS, TURFS } from './turfs';

/**
 * Rywalizacja (docs/rywalizacja.md): who rules which part of the world this week.
 *
 * - Rewiry (turfs): every named zone of every district. Duels won, quests handed in, caches opened and training
 *   rounds there earn influence (wpływ) for the week, capped per day so nobody wins by grinding one spot.
 * - The bud with the most influence in a turf this week rules it (with at least OWNER_MIN points) and collects a
 *   daily tribute (haracz) in coins. When the week ends its winners keep a title for good.
 * - Ekipy (crews): up to CREW_MAX buds sharing a name and a tag; their influence adds up in the crew ranking.
 * - Wyzwania tygodnia: weekly counts of things the server saw happen (wins, caches, quests, training, PvP wins).
 * - Pojedynki z Budami (PvP): duels against another bud's saved fighter, resolved by the same combat engine;
 *   an Elo rating sorts buds into leagues.
 * - Bazar: buds sell loot to each other for coins, the market keeps a 10% fee.
 *
 * Everything here is decided by the server; the game only shows it.
 */

export type Turf = {
  id: string;
  district: string;
  name: string;
  /** Map cells, inclusive (map coordinates, y down). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export { ROOM_DOORS, TURFS };

// ---------- time ----------

/** The rivalry week: ISO week in UTC, e.g. "2026-W42" (weeks start on Monday 00:00 UTC). */
export function weekKey(at: Date): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // the Thursday of this week decides the year
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** The week before `week` (for settling it). */
export function previousWeek(at: Date): string {
  return weekKey(new Date(at.getTime() - 7 * 86400000));
}

/** When the current week ends (next Monday 00:00 UTC). */
export function weekEnds(at: Date): Date {
  const day = at.getUTCDay() || 7;
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 8 - day));
}

/** The UTC day, e.g. "2026-10-17" (daily caps and tribute). */
export const dayKey = (at: Date) => at.toISOString().slice(0, 10);

export const weekSchema = z.string().regex(/^\d{4}-W\d{2}$/);

// ---------- turfs ----------

export const turfIdSchema = z.string().regex(/^[a-z0-9-]{2,40}$/);

export const turfById = (id: string) => TURFS.find((t) => t.id === id);

const area = (t: Turf) => (t.x1 - t.x0 + 1) * (t.y1 - t.y0 + 1);

/** The smallest turf holding the cell (zones nest: the Rynek inside Śródmieście), or undefined outside them. */
export function turfAt(district: string, x: number, y: number): Turf | undefined {
  let best: Turf | undefined;
  for (const t of TURFS) {
    if (t.district !== district || x < t.x0 || x > t.x1 || y < t.y0 || y > t.y1) continue;
    if (!best || area(t) < area(best)) best = t;
  }
  return best;
}

/** Like turfAt, but a cell inside a room counts for the turf where the room's door is. */
export function turfOf(district: string, map: string | undefined, x: number, y: number) {
  const door = map ? ROOM_DOORS[map] : undefined;
  return door ? turfAt(door[0], door[1], door[2]) : turfAt(district, x, y);
}

// ---------- influence ----------

/** Influence for what a bud did in a turf. */
export const INFLUENCE = {
  /** A duel won against an opponent of the turf (bosses count double). */
  duel: 10,
  quest: 20,
  cache: 8,
  training: 4,
} as const;
export type InfluenceKind = keyof typeof INFLUENCE;

/** Most influence one bud can earn in one turf per day. */
export const DAILY_INFLUENCE_CAP = 120;
/** Ruling a turf takes at least this much influence in the week. */
export const OWNER_MIN = 30;

/** The daily tribute (coins) for ruling a turf: tougher districts pay more. */
export function tributeFor(district: string): number {
  const level = DISTRICTS.find((d) => d.id === district)?.unlockLevel ?? 1;
  return 8 + 4 * level;
}

/** What the weekly winners get: the coins with the title (the title itself is kept forever). */
export const TURF_WIN_COINS = 60;
export const WEEK_TOP_COINS = [150, 90, 60] as const;

// ---------- weekly challenges ----------

/** `unit` is the "many" form (5 oddanych zadań); `units` has all three Polish forms: 1 / 2–4 / 5+. */
export const CHALLENGES = [
  {
    id: 'zwyciestwa',
    name: 'Zwycięstwa',
    unit: 'wygranych pojedynków',
    units: ['wygrany pojedynek', 'wygrane pojedynki', 'wygranych pojedynków'],
  },
  {
    id: 'zadania',
    name: 'Zadania',
    unit: 'oddanych zadań',
    units: ['oddane zadanie', 'oddane zadania', 'oddanych zadań'],
  },
  {
    id: 'skrytki',
    name: 'Skrytki',
    unit: 'otwartych skrytek',
    units: ['otwarta skrytka', 'otwarte skrytki', 'otwartych skrytek'],
  },
  {
    id: 'trening',
    name: 'Trening',
    unit: 'rund treningu',
    units: ['runda treningu', 'rundy treningu', 'rund treningu'],
  },
  {
    id: 'pvp',
    name: 'Pojedynki z Budami',
    unit: 'wygranych z Budami',
    units: ['wygrana z Budem', 'wygrane z Budami', 'wygranych z Budami'],
  },
] as const;
export type ChallengeId = (typeof CHALLENGES)[number]['id'];
export const challengeIdSchema = z.enum(
  CHALLENGES.map((c) => c.id) as [ChallengeId, ...ChallengeId[]],
);

// ---------- crews ----------

export const CREW_MAX = 12;
/** Founding or joining a crew, PvP and the market open once a bud has left the tutorial island. */
export const RIVALRY_MIN_LEVEL = 2;
export const crewNameSchema = z
  .string()
  .trim()
  .min(3, 'Nazwa ekipy ma od 3 do 20 znaków')
  .max(20, 'Nazwa ekipy ma od 3 do 20 znaków')
  .regex(/^[\p{L}\p{N} .'-]+$/u, 'Nazwa ekipy może mieć litery, cyfry, spacje i kropki')
  // a crew's name and tag show in rankings and over heads: the same filter as every public name
  .refine(publicNameOk, 'Tej nazwy nie da się użyć');
export const crewTagSchema = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9]{2,4}$/, 'Tag ma 2–4 litery lub cyfry')
      .refine((tag) => publicNameOk(tag.toLowerCase()), 'Tego tagu nie da się użyć'),
  );

export const createCrewRequestSchema = z.object({ name: crewNameSchema, tag: crewTagSchema });

export const crewMemberSchema = z.object({
  slug: z.string(),
  name: z.string(),
  level: z.number().int(),
  role: z.enum(['leader', 'member']),
  points: z.number().int(),
});
export const crewSchema = z.object({
  tag: z.string(),
  name: z.string(),
  members: z.array(crewMemberSchema),
  /** Influence of all members this week. */
  points: z.number().int(),
});
export type Crew = z.infer<typeof crewSchema>;
export const crewResponseSchema = z.object({ crew: crewSchema.nullable() });
export const crewListResponseSchema = z.object({
  crews: z.array(
    z.object({
      tag: z.string(),
      name: z.string(),
      members: z.number().int(),
      points: z.number().int(),
    }),
  ),
});

// ---------- PvP ----------

export const RATING_START = 1000;
/** Elo: how much one result moves the ratings. */
export const RATING_K = 32;

/** The winner's gain (the loser loses the same). Always 1..K. */
export function ratingDelta(winner: number, loser: number): number {
  const expected = 1 / (1 + 10 ** ((loser - winner) / 400));
  return Math.max(1, Math.round(RATING_K * (1 - expected)));
}

export const LEAGUES = [
  { id: 'braz', name: 'Brąz', from: 0 },
  { id: 'srebro', name: 'Srebro', from: 1050 },
  { id: 'zloto', name: 'Złoto', from: 1150 },
  { id: 'platyna', name: 'Platyna', from: 1300 },
  { id: 'legenda', name: 'Legenda', from: 1500 },
] as const;
export type LeagueId = (typeof LEAGUES)[number]['id'];

export function leagueFor(rating: number) {
  let league: (typeof LEAGUES)[number] = LEAGUES[0];
  for (const l of LEAGUES) if (rating >= l.from) league = l;
  return league;
}

/** Coins for a PvP win, more in higher leagues; paid for the first PVP_PAID_WINS wins of a day. */
export const pvpCoins = (rating: number) =>
  10 + 5 * LEAGUES.findIndex((l) => l.id === leagueFor(rating).id);
export const PVP_PAID_WINS = 5;
/** The same opponent can be challenged again after this long. */
export const PVP_REMATCH_SECONDS = 3600;
/** Opponents offered are within this many levels. */
export const PVP_LEVEL_RANGE = 4;
/** Fight ids of PvP duels carry the opponent: "pvp-<slug>". */
export const pvpEnemyId = (slug: string) => `pvp-${slug}`;
export const pvpOpponentOf = (enemyId: string) =>
  enemyId.startsWith('pvp-') ? enemyId.slice(4) : null;

export const pvpOpponentSchema = z.object({
  slug: z.string(),
  name: z.string(),
  level: z.number().int(),
  rating: z.number().int(),
  league: z.string(),
  crewTag: z.string().nullable(),
  weapon: z.string().nullable(),
  /** Seconds until this bud can be challenged again (0 = now). */
  wait: z.number().int(),
});
export const pvpOpponentsResponseSchema = z.object({
  rating: z.number().int(),
  league: z.string(),
  wins: z.number().int(),
  losses: z.number().int(),
  opponents: z.array(pvpOpponentSchema),
});
export const startPvpRequestSchema = z.object({ opponent: z.string().min(3).max(60) });

// ---------- market (Bazar) ----------

export const MARKET_FEE = 0.1;
export const MARKET_MIN_PRICE = 5;
export const MARKET_MAX_PRICE = 5000;
export const MARKET_MAX_LISTINGS = 5;
/** What the seller gets for a sale at `price`. */
export const marketPayout = (price: number) => price - Math.max(1, Math.round(price * MARKET_FEE));

export const sellRequestSchema = z.object({
  itemId: z.string().regex(/^[a-z0-9-]{3,40}$/),
  price: z.number().int().min(MARKET_MIN_PRICE).max(MARKET_MAX_PRICE),
});
export const listingSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  price: z.number().int(),
  seller: z.object({ slug: z.string(), name: z.string() }),
  mine: z.boolean(),
  createdAt: z.string(),
});
export type Listing = z.infer<typeof listingSchema>;
export const marketResponseSchema = z.object({
  listings: z.array(listingSchema),
  coins: z.number().int(),
});

// ---------- what the game and the website read ----------

export const turfStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  district: z.string(),
  owner: z
    .object({
      slug: z.string(),
      name: z.string(),
      crewTag: z.string().nullable(),
      points: z.number().int(),
    })
    .nullable(),
  /** The asking bud's influence there this week (0 without a bud). */
  mine: z.number().int(),
  /** Their place among the turf's buds this week (null without points). */
  rank: z.number().int().nullable(),
  /** The asking bud rules it and hasn't collected today's tribute yet. */
  tributeReady: z.boolean(),
  tribute: z.number().int(),
});
export type TurfState = z.infer<typeof turfStateSchema>;
export const turfsResponseSchema = z.object({
  week: z.string(),
  endsAt: z.string(),
  turfs: z.array(turfStateSchema),
});

export {
  influenceSchema,
  pvpResultSchema,
  raidResultSchema,
  type Influence,
  type PvpResult,
  type RaidResult,
} from './influence';

export const titleSchema = z.object({ week: z.string(), title: z.string() });

export const rivalryMeResponseSchema = z.object({
  week: z.string(),
  endsAt: z.string(),
  points: z.number().int(),
  rank: z.number().int().nullable(),
  ruled: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      tributeReady: z.boolean(),
      tribute: z.number().int(),
    }),
  ),
  titles: z.array(titleSchema),
  crew: z.object({ tag: z.string(), name: z.string() }).nullable(),
  rating: z.number().int(),
  league: z.string(),
  challenges: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      count: z.number().int(),
      rank: z.number().int().nullable(),
    }),
  ),
});

export const rankingResponseSchema = z.object({
  week: z.string(),
  endsAt: z.string(),
  buds: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      level: z.number().int(),
      crewTag: z.string().nullable(),
      points: z.number().int(),
    }),
  ),
  crews: z.array(
    z.object({
      tag: z.string(),
      name: z.string(),
      points: z.number().int(),
      members: z.number().int(),
    }),
  ),
  challenges: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      unit: z.string(),
      leaders: z.array(z.object({ slug: z.string(), name: z.string(), count: z.number().int() })),
    }),
  ),
  pvp: z.array(
    z.object({ slug: z.string(), name: z.string(), rating: z.number().int(), league: z.string() }),
  ),
});

export const tributeResponseSchema = z.object({
  turf: z.string(),
  coins: z.number().int(),
  gained: z.number().int(),
});
