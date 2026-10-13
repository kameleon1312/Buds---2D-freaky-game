// Exports NPCs and quests from packages/shared (content/*.ts) for the Unity game:
//   apps/unity/Assets/Buds/Resources/Quests/content.json   (flat, JsonUtility-friendly)
//   apps/unity/Assets/Buds/Resources/Npcs/<npc>.png        (sprite sheets from the bud generator)
// and checks every position against the district maps: NPCs stand on free ground without cutting a path
// off, every talk/reach/collect target can be reached from the spawn.
//
// Usage (from apps/api): pnpm exec tsx ../../tools/world/export-quests.ts
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CATALOG,
  CONTENT,
  DISTRICTS,
  SKILLS,
  SKILL_MAX_RANK,
  contentProblems,
  type Quest,
} from '@buds/shared';
import { ICONS } from './art/icons';
import { ALL_PROPS } from './art/index';
import { budSheetPng } from '../../apps/api/src/png';
import { mapPath, readMap, reachable, walkable, type MapGrid } from './maps/read';

const problems = contentProblems(CONTENT);

const maps = new Map<string, MapGrid>();
const spawnOf = new Map<string, [number, number]>();
const mapOf = (district: string) => {
  let m = maps.get(district);
  if (!m) {
    m = readMap(district);
    maps.set(district, m);
  }
  return m;
};

// spawn points come from the [district] section
for (const d of DISTRICTS) {
  const text = readFileSync(mapPath(d.id), 'utf8');
  const m = /spawn\s*=\s*(\d+),(\d+)/.exec(text);
  if (m) spawnOf.set(d.id, [Number(m[1]), Number(m[2])]);
}

// NPCs block their cell in the game: check with all of them in place
const npcCells = new Map<string, Set<string>>();
for (const n of CONTENT.npcs) {
  const m = mapOf(n.district);
  if (!walkable(m, n.x, n.y)) problems.push(`npc ${n.id} stands on a blocked cell (${n.x},${n.y})`);
  if (m.props[n.y]?.[n.x]) problems.push(`npc ${n.id} stands on prop ${m.props[n.y]![n.x]}`);
  const set = npcCells.get(n.district) ?? new Set<string>();
  set.add(`${n.x},${n.y}`);
  npcCells.set(n.district, set);
}
const reach = new Map<string, Set<string>>();
for (const [district, blocked] of npcCells) {
  const [sx, sy] = spawnOf.get(district)!;
  reach.set(district, reachable(mapOf(district), sx, sy, blocked));
}
const canReach = (district: string, x: number, y: number) =>
  reach.get(district)?.has(`${x},${y}`) ?? false;
const nextTo = (district: string, x: number, y: number) =>
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => canReach(district, x + dx!, y + dy!));

for (const n of CONTENT.npcs)
  if (!nextTo(n.district, n.x, n.y)) problems.push(`npc ${n.id} can't be reached`);
for (const q of CONTENT.quests) {
  for (const s of q.steps) {
    if (s.kind === 'reach') {
      let ok = false;
      for (let dy = -s.radius; dy <= s.radius && !ok; dy++)
        for (let dx = -s.radius; dx <= s.radius && !ok; dx++)
          if (canReach(q.district, s.x + dx, s.y + dy)) ok = true;
      if (!ok) problems.push(`${q.id}: place "${s.label}" can't be reached`);
    }
    if (s.kind === 'collect')
      for (const p of s.spots)
        if (!canReach(q.district, p.x, p.y))
          problems.push(`${q.id}: ${s.item} at (${p.x},${p.y}) can't be reached`);
  }
}
// art: every collectible has a world sprite, every ownable item and skill an icon
for (const q of CONTENT.quests)
  for (const s of q.steps)
    if (s.kind === 'collect' && !ALL_PROPS[`item-${s.item}`])
      problems.push(`${q.id}: no art item-${s.item} (tools/world/art/quest.ts)`);
for (const item of CATALOG.filter((i) => i.available))
  if (!(item.id in ICONS.items))
    problems.push(`catalog item ${item.id} has no icon (tools/world/art/icons.ts)`);
for (const skill of SKILLS)
  if (!(skill.id in ICONS.skills))
    problems.push(`skill ${skill.id} has no icon (tools/world/art/icons.ts)`);
if (problems.length) {
  console.error(`Quest content has problems:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}

// ---------- JSON for Unity (JsonUtility can't do unions: steps are flattened) ----------
const flatStep = (s: Quest['steps'][number]) => ({
  kind: s.kind,
  npc: s.kind === 'talk' ? s.npc : '',
  text: s.kind === 'talk' ? s.text : '',
  x: s.kind === 'reach' ? s.x : 0,
  y: s.kind === 'reach' ? s.y : 0,
  radius: s.kind === 'reach' ? s.radius : 0,
  label: s.kind === 'talk' ? '' : s.label,
  item: s.kind === 'collect' ? s.item : '',
  spots: s.kind === 'collect' ? s.spots : [],
});
const json = {
  npcs: CONTENT.npcs.map(({ id, name, district, x, y, lines }) => ({
    id,
    name,
    district,
    x,
    y,
    lines,
  })),
  quests: CONTENT.quests.map((q) => ({
    id: q.id,
    title: q.title,
    district: q.district,
    giver: q.giver,
    xp: q.xp,
    minLevel: q.minLevel,
    requires: q.requires,
    intro: q.intro,
    done: q.done,
    rewardItem: q.rewardItem ?? '',
    steps: q.steps.map(flatStep),
  })),
  // the Bud panel shows names, kinds and rarities; prices stay on the server
  items: CATALOG.filter((i) => i.available).map(({ id, name, kind, rarity }) => ({
    id,
    name,
    kind,
    rarity,
  })),
  skills: SKILLS.map(({ id, name, description, district }) => ({
    id,
    name,
    description,
    district,
  })),
  skillMaxRank: SKILL_MAX_RANK,
};
const unity = (p: string) =>
  fileURLToPath(new URL(`../../apps/unity/Assets/Buds/Resources/${p}`, import.meta.url));
mkdirSync(unity('Quests'), { recursive: true });
writeFileSync(unity('Quests/content.json'), JSON.stringify(json, null, 2) + '\n');

// ---------- NPC sprite sheets (same generator as players; smaller than a player's sheet) ----------
mkdirSync(unity('Npcs'), { recursive: true });
const keep = new Set(CONTENT.npcs.map((n) => `${n.id}.png`));
for (const f of readdirSync(unity('Npcs')))
  if (f.endsWith('.png') && !keep.has(f)) {
    rmSync(unity(`Npcs/${f}`));
    rmSync(unity(`Npcs/${f}.meta`), { force: true });
  }
for (const n of CONTENT.npcs) writeFileSync(unity(`Npcs/${n.id}.png`), budSheetPng(n.look, 6));

const xp = CONTENT.quests.reduce((sum, q) => sum + q.xp, 0);
console.info(`exported ${CONTENT.npcs.length} NPCs and ${CONTENT.quests.length} quests (${xp} XP)`);
