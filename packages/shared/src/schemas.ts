import { z } from 'zod';
import { BUD_NAME_MAX, BUD_NAME_MIN } from './bud/constants';
import { budLookSchema } from './bud/look';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const meResponseSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  role: z.string(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// ---------- buds ----------

export const budNameSchema = z
  .string()
  .trim()
  .min(BUD_NAME_MIN, `Imię musi mieć co najmniej ${BUD_NAME_MIN} znaki`)
  .max(BUD_NAME_MAX, `Imię może mieć maksymalnie ${BUD_NAME_MAX} znaków`)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} .'_-]*$/u, 'Tylko litery, cyfry, spacje i . _ -');

export const createBudSchema = z.object({
  name: budNameSchema,
  look: budLookSchema,
});
export type CreateBudInput = z.infer<typeof createBudSchema>;

/** Changing a bud's look later (the in-game look editor): the same rules as creating one. */
export const updateLookSchema = z.object({ look: budLookSchema });
export type UpdateLookInput = z.infer<typeof updateLookSchema>;

export const budSlugSchema = z.string().regex(/^[a-z0-9-]{3,40}$/);

/** Public view of a bud — safe to show anyone. */
export const budRecordSchema = z.object({
  slug: z.string(),
  name: z.string(),
  look: budLookSchema,
  xp: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type BudRecord = z.infer<typeof budRecordSchema>;

export const budResponseSchema = z.object({ bud: budRecordSchema });
export type BudResponse = z.infer<typeof budResponseSchema>;

/** Returned once, on creation. The token is the guest player's only credential. */
export const createBudResponseSchema = z.object({ bud: budRecordSchema, token: z.string() });
export type CreateBudResponse = z.infer<typeof createBudResponseSchema>;

export const leaderboardResponseSchema = z.object({ buds: z.array(budRecordSchema) });
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

// ---------- device pairing (web -> game) ----------

export const PAIR_CODE_TTL_MINUTES = 10;

export const pairCodeResponseSchema = z.object({ code: z.string(), expiresAt: z.string() });
export type PairCodeResponse = z.infer<typeof pairCodeResponseSchema>;

export const redeemPairSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z2-9]{6}$/, 'Kod ma 6 znaków'),
});
