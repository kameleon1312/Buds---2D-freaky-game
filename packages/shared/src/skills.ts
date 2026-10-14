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

// ---------- training on the map ----------

/** Training XP for one rank: every this many XP in a skill adds a rank on top of the spent points. */
export const TRAINING_XP_PER_RANK = 100;
/** Seconds before the same training spot can be used again. */
export const TRAINING_COOLDOWN_SECONDS = 90;
/** A training round scores 0..TRAINING_MAX_SCORE hits. */
export const TRAINING_MAX_SCORE = 5;

/** XP for a training round: 8 per hit, doubled with the Skupienie drink. */
export const trainingXp = (score: number, focused = false) =>
  Math.max(0, Math.min(TRAINING_MAX_SCORE, Math.floor(score))) * 8 * (focused ? 2 : 1);

/** Ranks earned by training (never above the max together with spent points). */
export const trainedRanks = (xp: number) => Math.floor(Math.max(0, xp) / TRAINING_XP_PER_RANK);

/** A skill's rank: spent points plus training, capped. */
export const effectiveRank = (spent: number, trainingXpTotal: number) =>
  Math.min(SKILL_MAX_RANK, spent + trainedRanks(trainingXpTotal));

// ---------- special abilities (perks) ----------

/**
 * Special abilities unlocked by a skill's rank (3 and 5). They are worked out from the ranks, never stored, and
 * applied where they matter: duels on the server, speed and caches in the game.
 */
export const PERKS = [
  {
    id: 'rytm-ulicy',
    skill: 'flow',
    rank: 3,
    name: 'Rytm ulicy',
    description: '+5% szybkości: chodzisz w rytmie bitu.',
  },
  {
    id: 'freestyle-mistrza',
    skill: 'flow',
    rank: 5,
    name: 'Freestyle mistrza',
    description: 'Nowy ruch w pojedynkach: Freestyle.',
  },
  {
    id: 'szybka-puszka',
    skill: 'graffiti',
    rank: 3,
    name: 'Szybka puszka',
    description: '+10% monet ze skrytek.',
  },
  {
    id: 'tag-legendy',
    skill: 'graffiti',
    rank: 5,
    name: 'Tag legendy',
    description: 'Nowy ruch w pojedynkach: Tag (oślepia).',
  },
  { id: 'na-fali', skill: 'surfing', rank: 3, name: 'Na fali', description: '+5% szybkości.' },
  {
    id: 'unik-surfera',
    skill: 'surfing',
    rank: 5,
    name: 'Unik surfera',
    description: 'Łatwiej unikasz ciosów w pojedynkach.',
  },
  {
    id: 'szosty-zmysl',
    skill: 'spryt',
    rank: 3,
    name: 'Szósty zmysł',
    description: 'Skrytki widzisz z dalszej odległości.',
  },
  {
    id: 'lowca-lupow',
    skill: 'spryt',
    rank: 5,
    name: 'Łowca łupów',
    description: 'Częściej wypada łup z pojedynków.',
  },
  {
    id: 'cios-specjalny',
    skill: 'walka',
    rank: 3,
    name: 'Cios specjalny',
    description: 'Nowy ruch w pojedynkach: Cios specjalny.',
  },
  {
    id: 'mistrz-ringu',
    skill: 'walka',
    rank: 5,
    name: 'Mistrz ringu',
    description: '+10% obrażeń w pojedynkach.',
  },
  {
    id: 'drugi-oddech',
    skill: 'przetrwanie',
    rank: 3,
    name: 'Drugi oddech',
    description: 'Raz na pojedynek, przy małym zdrowiu, wracasz do sił.',
  },
  {
    id: 'twardziel',
    skill: 'przetrwanie',
    rank: 5,
    name: 'Twardziel',
    description: '+20 zdrowia w pojedynkach.',
  },
] as const satisfies readonly {
  id: string;
  skill: SkillId;
  rank: number;
  name: string;
  description: string;
}[];
export type PerkId = (typeof PERKS)[number]['id'];

/** The perks a bud has with these effective ranks. */
export function perksFor(ranks: Partial<Record<SkillId, number>>): PerkId[] {
  return PERKS.filter((p) => (ranks[p.skill] ?? 0) >= p.rank).map((p) => p.id);
}

export const skillRankSchema = z.object({
  id: skillIdSchema,
  /** Ranks bought with skill points. */
  rank: z.number().int().min(0).max(SKILL_MAX_RANK),
  /** Training XP in this skill and the ranks it adds. */
  trainingXp: z.number().int().nonnegative().default(0),
  trained: z.number().int().nonnegative().default(0),
});

export const skillsResponseSchema = z.object({
  /** Points earned from levels. */
  points: z.number().int().nonnegative(),
  /** Points still free to spend. */
  available: z.number().int().nonnegative(),
  skills: z.array(skillRankSchema),
  /** Special abilities unlocked (by effective ranks). */
  perks: z.array(z.string()).default([]),
});
export type SkillsResponse = z.infer<typeof skillsResponseSchema>;

export const walletResponseSchema = z.object({
  coins: z.number().int().nonnegative(),
  gems: z.number().int().nonnegative(),
});
export type WalletResponse = z.infer<typeof walletResponseSchema>;
