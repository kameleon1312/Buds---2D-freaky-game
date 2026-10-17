import { z } from 'zod';
import { influenceSchema } from './influence';
import { levelFromXp } from './level';

/**
 * Hidden caches (skrytki): stashes lying around the districts and inside buildings. They are invisible until the
 * bud comes close (the game reveals them within a few tiles; the Spryt skill widens that), then the player searches
 * one and the server grants its coins and XP — once per bud, through `POST /v1/buds/me/caches/:id/open`.
 *
 * Content lives next to the NPCs and quests in `content/<district>.ts`.
 */

const id = z.string().regex(/^[a-z0-9-]{2,40}$/);

/** Looks in the world: art `skrytka-<look>` (and `-pusta` once emptied) in tools/world/art/interior.ts. */
export const CACHE_LOOKS = ['skrzynka', 'worek', 'kufer', 'cegly', 'dzban', 'opona'] as const;

export const cacheSchema = z.object({
  id,
  /** District it counts towards (the map screen shows found / all per district). */
  district: id,
  /** Map it lies on when not the district itself: one of the district's rooms (`<district>-<place>`). */
  map: id.optional(),
  /** Map cell (x right, y down); must be free ground the bud can stand next to. */
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  look: z.enum(CACHE_LOOKS),
  coins: z.number().int().min(1).max(500),
  xp: z.number().int().min(0).max(100).default(0),
  minLevel: z.number().int().min(1).default(1),
  /** What the bud finds inside (shown when opened). */
  text: z.string().min(1).max(160),
});
export type Cache = z.infer<typeof cacheSchema>;
export type CacheInput = z.input<typeof cacheSchema>;

/** The map a cache lies on. */
export const cacheMap = (cache: Pick<Cache, 'district' | 'map'>) => cache.map ?? cache.district;

/** Why a bud can't open a cache right now, or null if it can. */
export function cacheBlocker(
  cache: Cache,
  xp: number,
  opened: ReadonlySet<string>,
): 'already_opened' | 'level_too_low' | null {
  if (opened.has(cache.id)) return 'already_opened';
  if (levelFromXp(xp).level < cache.minLevel) return 'level_too_low';
  return null;
}

/** Problems in a list of caches (duplicate ids, rooms of another district) — empty when consistent. */
export function cacheProblems(caches: readonly Cache[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const c of caches) {
    if (ids.has(c.id)) problems.push(`duplicate cache ${c.id}`);
    ids.add(c.id);
    if (c.map && !c.map.startsWith(`${c.district}-`))
      problems.push(`cache ${c.id}: room ${c.map} is not in ${c.district}`);
  }
  return problems;
}

// ---------- API shapes ----------

export const cacheIdSchema = id;

export const cachesResponseSchema = z.object({ opened: z.array(id) });
export type CachesResponse = z.infer<typeof cachesResponseSchema>;

export const openCacheResponseSchema = z.object({
  cacheId: id,
  coinsGained: z.number().int().nonnegative(),
  /** Wallet balance after opening. */
  coins: z.number().int().nonnegative(),
  xpGained: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  level: z.number().int().min(1),
  levelUp: z.boolean(),
  /** Influence earned in the turf where it happened (none outside turfs). */
  influence: influenceSchema.nullable().default(null),
});
export type OpenCacheResponse = z.infer<typeof openCacheResponseSchema>;
