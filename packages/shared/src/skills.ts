import { z } from 'zod';

/**
 * Skills of a bud. Every level above 1 gives one skill point; the player spends points on skills (ranks 0..max).
 * Like XP, ranks are only ever changed by the server (`POST /v1/buds/me/skills/:id/upgrade`).
 * Effects plug into the systems that use them (fights, mini-games) as those arrive.
 */
export const SKILLS = [
  {
    id: 'flow',
    name: 'Flow',
    district: 'miasto-ziomkow',
    description: 'Freestyle: dłuższe combo i lepsze rymy w bitwach.',
  },
  {
    id: 'graffiti',
    name: 'Graffiti',
    district: 'miasto-ziomkow',
    description: 'Malujesz szybciej, a patrole słyszą cię z mniejszej odległości.',
  },
  {
    id: 'surfing',
    name: 'Surfing',
    district: 'las-palmas',
    description: 'Dłuższe nurkowanie i lepsze wyczucie fali.',
  },
  {
    id: 'spryt',
    name: 'Spryt',
    district: 'dwor-carski',
    description: 'Podpowiedzi w zagadkach i szybsze otwieranie sejfów urzędników.',
  },
  {
    id: 'walka',
    name: 'Walka',
    district: 'los-karkos',
    description: 'Mocniejsze ciosy i szybszy unik w potyczkach.',
  },
  {
    id: 'przetrwanie',
    name: 'Instynkt przetrwania',
    district: 'los-karkos',
    description: 'Wcześniej wyczuwasz zaczepki i zasadzki.',
  },
] as const;

export type SkillId = (typeof SKILLS)[number]['id'];
export const SKILL_MAX_RANK = 5;

export const skillIdSchema = z.enum(SKILLS.map((s) => s.id) as [SkillId, ...SkillId[]]);

/** Skill points earned up to a level (level 1 = 0 points). */
export const skillPointsForLevel = (level: number) => Math.max(0, Math.floor(level) - 1);

export const skillRankSchema = z.object({
  id: skillIdSchema,
  rank: z.number().int().min(0).max(SKILL_MAX_RANK),
});

export const skillsResponseSchema = z.object({
  /** Points earned from levels. */
  points: z.number().int().nonnegative(),
  /** Points still free to spend. */
  available: z.number().int().nonnegative(),
  skills: z.array(skillRankSchema),
});
export type SkillsResponse = z.infer<typeof skillsResponseSchema>;

export const walletResponseSchema = z.object({
  coins: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative(),
});
export type WalletResponse = z.infer<typeof walletResponseSchema>;
