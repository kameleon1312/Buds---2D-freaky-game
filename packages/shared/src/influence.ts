import { z } from 'zod';

/**
 * Influence (wpływ) an action earned in a turf this week (rivalry.ts). Kept apart so the quest, cache, training and
 * duel responses can carry it without importing the whole rivalry module.
 */
export const influenceSchema = z.object({
  turf: z.string(),
  name: z.string(),
  gained: z.number().int(),
  total: z.number().int(),
  /** The bud now rules this turf and didn't before this action. */
  captured: z.boolean(),
});
export type Influence = z.infer<typeof influenceSchema>;

/** How a PvP duel moved the challenger's rating. */
export const pvpResultSchema = z.object({
  opponent: z.string(),
  rating: z.number().int(),
  /** Positive after a win, negative after a loss. */
  delta: z.number().int(),
  league: z.string(),
  /** Paid wins left today. */
  paidLeft: z.number().int(),
});
export type PvpResult = z.infer<typeof pvpResultSchema>;
