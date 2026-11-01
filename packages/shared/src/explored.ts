import { z } from 'zod';
import { WALK_GRIDS } from './walk-grids';

/**
 * The map's fog of war, kept per bud on the server, so a bud on an account finds its map uncovered on any device.
 * `seen` is one bit per cell, row by row from the north edge, in base64 (the game's `Exploration`). It only grows, and
 * it earns nothing: it is the bud's own record, not a reward.
 */
export const exploredRequestSchema = z.object({
  seen: z
    .string()
    .max(8000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export type ExploredRequest = z.infer<typeof exploredRequestSchema>;

export const exploredMapSchema = z.object({ map: z.string(), seen: z.string() });
export type ExploredMap = z.infer<typeof exploredMapSchema>;

export const exploredResponseSchema = z.object({ maps: z.array(exploredMapSchema) });
export type ExploredResponse = z.infer<typeof exploredResponseSchema>;

/** True when `seen` is exactly the size of that map's bit field; an unknown map fits nothing. */
export function exploredFits(mapId: string, seen: string): boolean {
  const grid = Object.hasOwn(WALK_GRIDS, mapId) ? WALK_GRIDS[mapId] : undefined;
  if (!grid) return false;
  const bytes = Math.ceil((grid.w * grid.h) / 8);
  const pad = seen.endsWith('==') ? 2 : seen.endsWith('=') ? 1 : 0;
  return seen.length % 4 === 0 && (seen.length / 4) * 3 - pad === bytes;
}
