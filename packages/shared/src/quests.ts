import { z } from 'zod';
import { influenceSchema } from './influence';
import { budLookSchema } from './bud/look';
import { cacheProblems, cacheSchema } from './caches';
import { enemySchema } from './combat';
import { catalogItem } from './catalog';
import { DISTRICTS } from './districts';
import { DWOR_CARSKI } from './content/dwor-carski';
import { DZIKA_PUSZCZA } from './content/dzika-puszcza';
import { CHINATOWN } from './content/chinatown';
import { LAS_PALMAS } from './content/las-palmas';
import { LOCALS } from './content/locals';
import { dressed } from './content/wardrobe';
import { LOS_KARKOS } from './content/los-karkos';
import { MIASTO_ZIOMKOW } from './content/miasto-ziomkow';
import { NEW_PLACES } from './content/new-places';
import { ROUTES_CONTENT } from './content/routes';
import { WYSPA_STARTOWA } from './content/wyspa-startowa';
import { TRAINING_SPOTS } from './content/training';
import { levelFromXp } from './level';
import { trainingProblems, trainingSpotSchema } from './training';

/**
 * NPCs and quests — data the game shows and the API uses to grant XP. Content lives in `content/<district>.ts`
 * (one file per district, easy to replace with a hand-written list). The game gets it as JSON exported by
 * tools/world/export-quests.ts.
 *
 * Steps run in order; after the last one the player returns to the quest giver to hand it in.
 */

const id = z.string().regex(/^[a-z0-9-]{2,40}$/);
const cell = z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() });

export const npcSchema = z.object({
  id,
  name: z.string().min(2).max(24),
  district: id,
  /** Map cell the NPC stands on (map coordinates, y down). */
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  look: budLookSchema,
  /** Small talk when the NPC has nothing for you; one line is picked each time. */
  lines: z.array(z.string().min(1)).min(1),
  /**
   * Side characters stroll up to this many tiles around their cell (0 = stands still). Quest givers and quest
   * talk targets always stand still, so the player finds them where the map says.
   */
  wander: z.number().int().min(0).max(4).default(0),
});
export type Npc = z.infer<typeof npcSchema>;
export type NpcInput = z.input<typeof npcSchema>;

/**
 * A step against the clock: `seconds` from when the step begins. Too late, and the quest goes `back` that many steps
 * (0: this one again), with `late` said in a toast.
 */
const timed = {
  seconds: z.number().int().min(5).max(600).optional(),
  back: z.number().int().min(0).max(7).default(0),
  late: z.string().min(1).optional(),
};

export const questStepSchema = z.discriminatedUnion('kind', [
  /** Walk up to an NPC and talk. `text` is what they say. */
  z.object({ kind: z.literal('talk'), npc: id, text: z.string().min(1) }),
  /** Reach a place: any cell within `radius` of (x, y). */
  cell.extend({
    kind: z.literal('reach'),
    radius: z.number().int().min(1).max(6),
    label: z.string().min(1),
    ...timed,
  }),
  /** Win a duel against this opponent (from the same district). */
  z.object({ kind: z.literal('duel'), enemy: id, label: z.string().min(1) }),
  /** Pick up every item lying at `spots` (shown only while this step is active). */
  z.object({
    kind: z.literal('collect'),
    item: id,
    label: z.string().min(1),
    spots: z.array(cell).min(1).max(12),
    /** Not on the map, seen only from close by; `hint` in the quest log says where to look. */
    hidden: z.boolean().default(false),
    hint: z.string().min(1).optional(),
    ...timed,
  }),
  /**
   * An NPC asks something answered earlier in the quest: a wrong answer sends the quest `back` that many steps (to hear
   * it again), saying `wrong`.
   */
  z.object({
    kind: z.literal('ask'),
    npc: id,
    text: z.string().min(1),
    answers: z.array(z.string().min(1).max(40)).min(2).max(4),
    correct: z.number().int().min(0).max(3),
    wrong: z.string().min(1),
    back: z.number().int().min(0).max(7).default(0),
  }),
  /** A training mini-game played at an NPC: a score of at least `score` of 5 moves on, less says `wrong`. */
  z.object({
    kind: z.literal('game'),
    npc: id,
    skill: z.string().min(2).max(20),
    score: z.number().int().min(1).max(5),
    label: z.string().min(1),
    text: z.string().min(1),
    wrong: z.string().min(1),
  }),
]);
export type QuestStep = z.infer<typeof questStepSchema>;

export const questSchema = z.object({
  id,
  title: z.string().min(2).max(40),
  district: id,
  giver: id,
  /** XP the server grants on completion. */
  xp: z.number().int().min(1).max(1000),
  minLevel: z.number().int().min(1).default(1),
  /** Quests that must be completed first. */
  requires: z.array(id).default([]),
  /** What the giver says when offering the quest. */
  intro: z.string().min(1),
  /** What the giver says when you hand it in. */
  done: z.string().min(1),
  steps: z.array(questStepSchema).min(1).max(8),
  /** Catalog item granted with the XP (optional). */
  rewardItem: id.optional(),
  /** Knocked out while on this quest: back to its first step, with these words. */
  fragile: z.string().min(1).optional(),
});
export type Quest = z.infer<typeof questSchema>;
export type QuestInput = z.input<typeof questSchema>;

export const districtContentSchema = z.object({
  npcs: z.array(npcSchema),
  quests: z.array(questSchema),
  caches: z.array(cacheSchema).default([]),
  enemies: z.array(enemySchema).default([]),
  training: z.array(trainingSpotSchema).default([]),
});
export type DistrictContent = z.infer<typeof districtContentSchema>;

/** All content, validated once at load. */
export const CONTENT: DistrictContent = (() => {
  // newer content goes last, so the original order (first quest, first boss…) stays as it was
  const all = [
    WYSPA_STARTOWA,
    MIASTO_ZIOMKOW,
    LAS_PALMAS,
    DWOR_CARSKI,
    LOS_KARKOS,
    CHINATOWN,
    DZIKA_PUSZCZA,
    NEW_PLACES,
    ROUTES_CONTENT,
  ];
  return districtContentSchema.parse({
    // everyone wears what people wear in their city
    npcs: [...all.flatMap((c) => c.npcs), ...LOCALS].map(dressed),
    quests: all.flatMap((c) => c.quests),
    caches: all.flatMap((c) => c.caches),
    enemies: all.flatMap((c) => c.enemies).map(dressed),
    training: [...TRAINING_SPOTS, ...DZIKA_PUSZCZA.training],
  });
})();

export const questById = (questId: string, content: DistrictContent = CONTENT) =>
  content.quests.find((q) => q.id === questId);

export const enemyById = (enemyId: string, content: DistrictContent = CONTENT) =>
  content.enemies.find((e) => e.id === enemyId);

export const npcById = (npcId: string, content: DistrictContent = CONTENT) =>
  content.npcs.find((n) => n.id === npcId);

/** Why a bud can't complete (or take) a quest right now, or null if it can. */
export function questBlocker(
  quest: Quest,
  xp: number,
  completed: ReadonlySet<string>,
): 'already_completed' | 'level_too_low' | 'requires_other_quest' | null {
  if (completed.has(quest.id)) return 'already_completed';
  if (levelFromXp(xp).level < quest.minLevel) return 'level_too_low';
  if (quest.requires.some((r) => !completed.has(r))) return 'requires_other_quest';
  return null;
}

/** Content problems (unknown NPCs, duplicate ids, impossible chains) — empty when everything is consistent. */
export function contentProblems(content: DistrictContent): string[] {
  const problems: string[] = [];
  const npcIds = new Set<string>();
  for (const n of content.npcs) {
    if (npcIds.has(n.id)) problems.push(`duplicate npc ${n.id}`);
    npcIds.add(n.id);
  }
  const questIds = new Set<string>();
  for (const q of content.quests) {
    if (questIds.has(q.id)) problems.push(`duplicate quest ${q.id}`);
    questIds.add(q.id);
  }
  // the people quests point to stay put
  const stay = new Set(
    content.quests.flatMap((q) => [
      q.giver,
      ...q.steps.flatMap((s) =>
        s.kind === 'talk' || s.kind === 'ask' || s.kind === 'game' ? [s.npc] : [],
      ),
    ]),
  );
  for (const n of content.npcs)
    if (n.wander > 0 && stay.has(n.id)) problems.push(`${n.id}: a quest NPC must not wander`);
  for (const q of content.quests) {
    const giver = content.npcs.find((n) => n.id === q.giver);
    if (!giver) problems.push(`${q.id}: unknown giver ${q.giver}`);
    else if (giver.district !== q.district)
      problems.push(`${q.id}: giver ${q.giver} lives in another district`);
    for (const r of q.requires)
      if (!questIds.has(r)) problems.push(`${q.id}: requires unknown quest ${r}`);
    q.steps.forEach((s, i) => {
      if ((s.kind === 'talk' || s.kind === 'ask' || s.kind === 'game') && !npcIds.has(s.npc))
        problems.push(`${q.id}: talks to unknown npc ${s.npc}`);
      if (s.kind === 'ask' && s.correct >= s.answers.length)
        problems.push(`${q.id}: the right answer is not among the answers`);
      if ((s.kind === 'ask' || s.kind === 'reach' || s.kind === 'collect') && s.back > i)
        problems.push(`${q.id}: step ${i} goes back further than the quest has steps`);
      if (s.kind === 'collect' && s.hidden && !s.hint)
        problems.push(`${q.id}: hidden items need a hint`);
      if (s.kind === 'duel') {
        const foe = content.enemies.find((e) => e.id === s.enemy);
        if (!foe) problems.push(`${q.id}: duel with unknown enemy ${s.enemy}`);
        else if (foe.district !== q.district)
          problems.push(`${q.id}: ${s.enemy} lives in another district`);
      }
    });
    if (q.rewardItem && !catalogItem(q.rewardItem))
      problems.push(`${q.id}: reward ${q.rewardItem} is not in the catalog`);
  }
  // requirement chains must not loop
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (questId: string): boolean => {
    if (done.has(questId)) return true;
    if (visiting.has(questId)) return false;
    visiting.add(questId);
    const ok = (questById(questId, content)?.requires ?? []).every(visit);
    visiting.delete(questId);
    done.add(questId);
    return ok;
  };
  for (const q of content.quests) if (!visit(q.id)) problems.push(`${q.id}: circular requirements`);
  // the quests that open the next city can be done before it is needed
  for (const d of DISTRICTS) {
    const gate = 'gateQuest' in d ? d.gateQuest : undefined;
    if (!gate) continue;
    const q = questIds.has(gate) ? questById(gate, content) : undefined;
    if (!q) problems.push(`${d.id}: gate quest ${gate} doesn't exist`);
    else if (q.minLevel > d.unlockLevel)
      problems.push(`${d.id}: gate quest ${gate} needs a higher level than the city`);
  }
  problems.push(...cacheProblems(content.caches));
  problems.push(...trainingProblems(content.training));
  const enemyIds = new Set<string>();
  for (const e of content.enemies) {
    if (enemyIds.has(e.id)) problems.push(`duplicate enemy ${e.id}`);
    enemyIds.add(e.id);
    if (npcIds.has(e.id)) problems.push(`enemy ${e.id} has the id of an npc`);
    if (e.coins[1] < e.coins[0]) problems.push(`enemy ${e.id}: coins range is backwards`);
  }
  return problems;
}

// ---------- API shapes ----------

export const questIdSchema = id;

export const questsResponseSchema = z.object({ completed: z.array(id) });
export type QuestsResponse = z.infer<typeof questsResponseSchema>;

export const completeQuestResponseSchema = z.object({
  questId: id,
  xpGained: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  level: z.number().int().min(1),
  levelUp: z.boolean(),
  /** Item granted with the quest, if any. */
  item: z.string().nullable(),
  /** Influence earned in the turf where it happened (none outside turfs). */
  influence: influenceSchema.nullable().default(null),
});
export type CompleteQuestResponse = z.infer<typeof completeQuestResponseSchema>;
