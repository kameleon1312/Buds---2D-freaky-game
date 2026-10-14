import { z } from 'zod';
import { skillIdSchema, TRAINING_MAX_SCORE } from './skills';

/**
 * Training spots (miejsca treningu): props on the map where a bud practises a skill in a short timing mini-game.
 * The game reports the score; the server grants training XP (`POST /v1/buds/me/training/:spotId`) with a cooldown
 * per spot. Every TRAINING_XP_PER_RANK training XP adds a rank on top of the spent skill points.
 */
export const TRAINING_LOOKS = ['worek', 'scena', 'sciana', 'deska', 'szachy', 'tor'] as const;
export type TrainingLook = (typeof TRAINING_LOOKS)[number];

const id = z.string().regex(/^[a-z0-9-]{2,40}$/);

export const trainingSpotSchema = z.object({
  id,
  district: id,
  /** Map id when the spot stands inside a room (defaults to the district map). */
  map: id.optional(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  skill: skillIdSchema,
  name: z.string().min(2).max(32),
  look: z.enum(TRAINING_LOOKS),
  /** What the mini-game asks for, e.g. "Trafiaj w rytm bitu". */
  hint: z.string().min(2).max(80),
});
export type TrainingSpot = z.infer<typeof trainingSpotSchema>;
export type TrainingSpotInput = z.input<typeof trainingSpotSchema>;

export function trainingProblems(spots: readonly TrainingSpot[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const s of spots) {
    if (ids.has(s.id)) problems.push(`duplicate training spot ${s.id}`);
    ids.add(s.id);
  }
  return problems;
}

// ---------- API shapes ----------

export const trainingSpotIdSchema = id;

export const trainRequestSchema = z.object({
  score: z.number().int().min(0).max(TRAINING_MAX_SCORE),
});

export const trainResponseSchema = z.object({
  spotId: id,
  skill: skillIdSchema,
  xpGained: z.number().int().nonnegative(),
  /** Training XP in the skill after this round. */
  trainingXp: z.number().int().nonnegative(),
  /** Effective rank (spent points + training) after this round. */
  rank: z.number().int().nonnegative(),
  rankUp: z.boolean(),
  /** Special abilities this round unlocked. */
  perksUnlocked: z.array(z.string()),
  /** Seconds before this spot can be used again. */
  cooldown: z.number().int().nonnegative(),
});
export type TrainResponse = z.infer<typeof trainResponseSchema>;
