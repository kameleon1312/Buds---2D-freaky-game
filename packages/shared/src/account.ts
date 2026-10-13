import { z } from 'zod';
import { ownedItemSchema } from './catalog';
import { characterStatsSchema, equipmentSchema } from './gear';
import { budRecordSchema } from './schemas';

/**
 * Accounts (Supabase Auth, e-mail + password): a signed-in user owns buds, sees their private data (wallet, items,
 * gear, progress) and can link a device to them from anywhere. Guest buds created before signing in are claimed with
 * the guest token this browser keeps. Only the API reads and writes this; the public profile stays minimal.
 */

/** A user can hold this many buds. */
export const MAX_BUDS_PER_ACCOUNT = 5;

export const accountBudSchema = z.object({
  bud: budRecordSchema,
  level: z.number().int().min(1),
  coins: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative(),
  items: z.array(ownedItemSchema),
  equipment: equipmentSchema,
  stats: characterStatsSchema,
  questsDone: z.number().int().nonnegative(),
  cachesFound: z.number().int().nonnegative(),
});
export type AccountBud = z.infer<typeof accountBudSchema>;

export const accountBudsResponseSchema = z.object({ buds: z.array(accountBudSchema) });
export type AccountBudsResponse = z.infer<typeof accountBudsResponseSchema>;

/** Links a guest bud: the guest token proves the browser created it. */
export const claimBudRequestSchema = z.object({ token: z.string().min(16).max(200) });
export type ClaimBudRequest = z.infer<typeof claimBudRequestSchema>;
