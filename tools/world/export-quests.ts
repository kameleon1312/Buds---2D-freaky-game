// Exports NPCs and quests from packages/shared (content/*.ts) for the Unity game:
//   apps/unity/Assets/Buds/Resources/Quests/content.json   (flat, JsonUtility-friendly)
//   apps/unity/Assets/Buds/Resources/Npcs/<npc>.png        (sprite sheets from the bud generator)
// and checks every position against the maps: NPCs and hidden caches stand on free ground without cutting a
// path off, every talk/reach/collect target can be reached from the spawn.
//
// Usage (from apps/api): pnpm exec tsx ../../tools/world/export-quests.ts
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  BASE_STORAGE,
  BIOME_BONUS,
  BUILDINGS,
  DISTRICT_NAME_MAX,
  DISTRICT_NAME_MIN,
  LAND_MIN_LEVEL,
  NEW_SHIELD_HOURS,
  PLOTS,
  PLOT_SIZE,
  PRODUCER_HOURS,
  RAIDS_PER_DAY,
  RAID_MIN_LEVEL,
  RAID_RETRY_MINUTES,
  RESOURCES,
  ROUTE_BONUS,
  SELL_BATCH,
  SECTOR,
  SECTORS,
  SECTOR_LIMIT,
  CLEARINGS,
  RANKS,
  ROUTE_STYLE,
  MAX_RENT_BOOST,
  clearingCost,
  noResources,
  plotPrice,
  CATALOG,
  CONTENT,
  DISTRICTS,
  TUTORIAL_ISLAND,
  cacheMap,
  SKILLS,
  SKILL_GEAR_MAX,
  SKILL_MAX_RANK,
  BUFFS,
  PERKS,
  PERK_MOVES,
  TRAINING_COOLDOWN_SECONDS,
  TRAINING_MAX_SCORE,
  TRAINING_XP_PER_RANK,
  MOVES,
  MOVES_BY_WEAPON,
  MOVE_UPGRADES,
  PORTS,
  ROUTES,
  ferryFare,
  SLOTS,
  STATS,
  WEAPON_KINDS,
  gearProblems,
  contentProblems,
  type Quest,
} from '@buds/shared';
import { ICONS } from './art/icons';
import { ALL_PROPS } from './art/index';
import { budSheetPng } from '../../apps/api/src/png';
import { mapPath, readMap, reachable, walkable, type MapGrid } from './maps/read';

const problems = [...contentProblems(CONTENT), ...gearProblems()];

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

// spawn points come from the [district] section (districts and the rooms caches lie in)
for (const id of new Set([
  ...DISTRICTS.map((d) => d.id),
  ...ROUTES.map((r) => r.id),
  TUTORIAL_ISLAND.id,
  ...CONTENT.caches.map(cacheMap),
  ...CONTENT.training.map((t) => t.map ?? t.district),
])) {
  let text: string;
  try {
    text = readFileSync(mapPath(id), 'utf8');
  } catch {
    problems.push(`no map ${id} (tools/world/export-maps.ts)`);
    continue;
  }
  const m = /spawn\s*=\s*(\d+),(\d+)/.exec(text);
  if (m) spawnOf.set(id, [Number(m[1]), Number(m[2])]);
}

// NPCs and caches block their cell in the game: check with all of them in place
const npcCells = new Map<string, Set<string>>();
for (const c of CONTENT.caches) {
  const id = cacheMap(c);
  if (!spawnOf.has(id)) continue;
  const m = mapOf(id);
  if (!walkable(m, c.x, c.y)) problems.push(`cache ${c.id} lies on a blocked cell (${c.x},${c.y})`);
  const prop = m.props[c.y]?.[c.x];
  if (prop && !prop.startsWith('podloga-')) problems.push(`cache ${c.id} lies on prop ${prop}`);
  const set = npcCells.get(id) ?? new Set<string>();
  set.add(`${c.x},${c.y}`);
  npcCells.set(id, set);
}
// training stations block their cell like a cache
for (const t of CONTENT.training) {
  const id = t.map ?? t.district;
  if (!spawnOf.has(id)) continue;
  const m = mapOf(id);
  if (!walkable(m, t.x, t.y))
    problems.push(`training spot ${t.id} stands on a blocked cell (${t.x},${t.y})`);
  if (m.props[t.y]?.[t.x])
    problems.push(`training spot ${t.id} stands on prop ${m.props[t.y]![t.x]}`);
  const set = npcCells.get(id) ?? new Set<string>();
  if (set.has(`${t.x},${t.y}`)) problems.push(`training spot ${t.id} shares its cell`);
  set.add(`${t.x},${t.y}`);
  npcCells.set(id, set);
}
// opponents stand like NPCs (one per spot)
for (const en of CONTENT.enemies)
  for (const p of en.spots) {
    const m = mapOf(en.district);
    if (!walkable(m, p.x, p.y))
      problems.push(`enemy ${en.id} stands on a blocked cell (${p.x},${p.y})`);
    if (m.props[p.y]?.[p.x]) problems.push(`enemy ${en.id} stands on prop ${m.props[p.y]![p.x]}`);
    const set = npcCells.get(en.district) ?? new Set<string>();
    set.add(`${p.x},${p.y}`);
    npcCells.set(en.district, set);
  }
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
for (const en of CONTENT.enemies)
  for (const p of en.spots)
    if (!nextTo(en.district, p.x, p.y))
      problems.push(`enemy ${en.id} at (${p.x},${p.y}) can't be reached`);
for (const c of CONTENT.caches)
  if (spawnOf.has(cacheMap(c)) && !nextTo(cacheMap(c), c.x, c.y))
    problems.push(`cache ${c.id} can't be reached`);
// NPCs and caches must not wall anything off: every cell reachable without them stays reachable
for (const [id, blocked] of npcCells) {
  const [sx, sy] = spawnOf.get(id)!;
  if (reach.get(id)!.size !== reachable(mapOf(id), sx, sy).size - blocked.size)
    problems.push(`${id}: NPCs or caches cut off part of the map`);
}
for (const t of CONTENT.training) {
  if (!nextTo(t.map ?? t.district, t.x, t.y))
    problems.push(`training spot ${t.id} can't be reached`);
  if (!ALL_PROPS[`trening-${t.look}`])
    problems.push(`training spot ${t.id}: no art trening-${t.look} (tools/world/art/rides.ts)`);
}
for (const i of CATALOG.filter((i) => i.slot === 'mount')) {
  const kind = i.id.replace(/^mount-/, '');
  for (const v of ['bok', 'przod', 'tyl'])
    if (!ALL_PROPS[`jazda-${kind}-${v}`])
      problems.push(`mount ${i.id}: no art jazda-${kind}-${v} (tools/world/art/rides.ts)`);
}
for (const c of CONTENT.caches)
  if (!ALL_PROPS[`skrytka-${c.look}`] || !ALL_PROPS[`skrytka-${c.look}-pusta`])
    problems.push(`cache ${c.id}: no art skrytka-${c.look} (tools/world/art/interior.ts)`);
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
// a step against the clock can be done on foot on a phone (the stick never runs), from where the last step ended
const WALK_TILES_PER_SECOND = 3.8;
const stepsBetween = (district: string, from: [number, number], to: [number, number]) => {
  const m = mapOf(district);
  const seen = new Map<string, number>([[from.join(), 0]]);
  const queue: [number, number][] = [from];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    if (x === to[0] && y === to[1]) return seen.get(`${x},${y}`)!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const k = `${x + dx},${y + dy}`;
      if (seen.has(k) || !walkable(m, x + dx, y + dy)) continue;
      seen.set(k, seen.get(`${x},${y}`)! + 1);
      queue.push([x + dx, y + dy]);
    }
  }
  return Infinity;
};
for (const q of CONTENT.quests) {
  const giver = CONTENT.npcs.find((n) => n.id === q.giver)!;
  let at: [number, number] = [giver.x, giver.y + 1];
  for (const s of q.steps) {
    if (s.kind === 'reach') {
      if (s.seconds) {
        const need = stepsBetween(q.district, at, [s.x, s.y]) / WALK_TILES_PER_SECOND;
        if (need > s.seconds)
          problems.push(
            `${q.id}: "${s.label}" takes ${Math.ceil(need)} s on foot, ${s.seconds} s given`,
          );
      }
      at = [s.x, s.y];
    } else if (s.kind === 'collect') {
      // the nearest item next, each time
      const left = [...s.spots];
      let need = 0;
      while (left.length) {
        left.sort(
          (a, b) =>
            Math.abs(a.x - at[0]) +
            Math.abs(a.y - at[1]) -
            Math.abs(b.x - at[0]) -
            Math.abs(b.y - at[1]),
        );
        const p = left.shift()!;
        need += stepsBetween(q.district, at, [p.x, p.y]);
        at = [p.x, p.y];
      }
      if (s.seconds && need / WALK_TILES_PER_SECOND > s.seconds)
        problems.push(
          `${q.id}: "${s.label}" takes ${Math.ceil(need / WALK_TILES_PER_SECOND)} s on foot, ${s.seconds} s given`,
        );
    } else if (s.kind === 'talk' || s.kind === 'ask' || s.kind === 'game') {
      const n = CONTENT.npcs.find((x) => x.id === s.npc);
      if (n && n.district === q.district) at = [n.x, n.y + 1];
    }
  }
}
// art: every collectible has a world sprite, every ownable item and skill an icon
for (const q of CONTENT.quests)
  for (const s of q.steps)
    if (s.kind === 'collect' && !ALL_PROPS[`item-${s.item}`])
      problems.push(`${q.id}: no art item-${s.item} (tools/world/art/quest.ts)`);
for (const item of CATALOG.filter((i) => i.available || i.preview))
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
  npc: s.kind === 'talk' || s.kind === 'ask' || s.kind === 'game' ? s.npc : '',
  text: s.kind === 'talk' || s.kind === 'ask' || s.kind === 'game' ? s.text : '',
  seconds: (s.kind === 'reach' || s.kind === 'collect') && s.seconds ? s.seconds : 0,
  back: s.kind === 'reach' || s.kind === 'collect' || s.kind === 'ask' ? s.back : 0,
  late: (s.kind === 'reach' || s.kind === 'collect') && s.late ? s.late : '',
  hidden: s.kind === 'collect' && s.hidden,
  hint: s.kind === 'collect' && s.hint ? s.hint : '',
  answers: s.kind === 'ask' ? s.answers : [],
  correct: s.kind === 'ask' ? s.correct : 0,
  wrong: s.kind === 'ask' || s.kind === 'game' ? s.wrong : '',
  skill: s.kind === 'game' ? s.skill : '',
  score: s.kind === 'game' ? s.score : 0,
  x: s.kind === 'reach' ? s.x : 0,
  y: s.kind === 'reach' ? s.y : 0,
  radius: s.kind === 'reach' ? s.radius : 0,
  label: s.kind === 'talk' || s.kind === 'ask' ? '' : s.label,
  item: s.kind === 'collect' ? s.item : '',
  enemy: s.kind === 'duel' ? s.enemy : '',
  spots: s.kind === 'collect' ? s.spots : [],
});
const json = {
  npcs: CONTENT.npcs.map(({ id, name, district, x, y, lines, wander }) => ({
    id,
    name,
    district,
    x,
    y,
    lines,
    wander,
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
  // the Bud panel shows the paper doll, bonuses and the coin shop; prices are shown, the server charges
  items: CATALOG.filter((i) => i.available || i.preview).map((i) => ({
    id: i.id,
    name: i.name,
    kind: i.kind,
    rarity: i.rarity,
    slot: i.slot ?? '',
    speed: i.bonus?.speed ?? 0,
    armor: i.bonus?.armor ?? 0,
    luck: i.bonus?.luck ?? 0,
    skillBonus: Object.entries(i.bonus?.skills ?? {}).map(([id, rank]) => ({ id, rank })),
    coins: i.price.currency === 'coins' ? i.price.amount : 0,
    gems: i.price.currency === 'gems' ? i.price.amount : 0,
    twin: i.twin ?? '',
    minLevel: i.minLevel ?? 1,
    weapon: i.weapon ?? '',
    attack: i.bonus?.attack ?? 0,
    shop: !!i.shop,
    mountSpeed: i.mountSpeed ?? 0,
    drink: i.drink ?? '',
    premium: i.premium,
    available: i.available,
    description: i.description ?? '',
  })),
  stats: STATS.map(({ id, name, unit, max, description }) => ({
    id,
    name,
    unit,
    max,
    description,
  })),
  slots: SLOTS.map(({ id, name }) => ({ id, name })),
  skillGearMax: SKILL_GEAR_MAX,
  skills: SKILLS.map(({ id, name, description, district }) => ({
    id,
    name,
    description,
    district,
  })),
  skillMaxRank: SKILL_MAX_RANK,
  perks: PERKS.map(({ id, skill, rank, name, description }) => ({
    id,
    skill,
    rank,
    name,
    description,
    move: PERK_MOVES[id] ?? '',
  })),
  buffs: BUFFS.map(({ id, name, seconds, description }) => ({ id, name, seconds, description })),
  training: CONTENT.training.map((t) => ({
    id: t.id,
    district: t.district,
    map: t.map ?? t.district,
    x: t.x,
    y: t.y,
    skill: t.skill,
    name: t.name,
    look: t.look,
    hint: t.hint,
  })),
  trainingXpPerRank: TRAINING_XP_PER_RANK,
  trainingCooldown: TRAINING_COOLDOWN_SECONDS,
  trainingMaxScore: TRAINING_MAX_SCORE,
  enemies: CONTENT.enemies.map((en) => ({
    id: en.id,
    name: en.name,
    district: en.district,
    level: en.level,
    hp: en.hp,
    weapon: en.weapon,
    boss: en.boss,
    // hidden off the road on a route: jumps out and starts the duel on its own
    ambush: en.ambush,
    lines: en.lines,
    spots: en.spots,
  })),
  moves: Object.values(MOVES).map((mv) => ({
    id: mv.id,
    name: mv.name,
    anim: mv.anim,
    description: mv.description,
    hits: mv.hits ?? 1,
    effect: mv.effect ?? '',
    damage: mv.power[1] > 0,
    // shown on the move buttons (the server still decides every hit)
    power: mv.power,
    accuracy: mv.accuracy,
  })),
  weapons: WEAPON_KINDS.map((kind) => ({ kind, moves: MOVES_BY_WEAPON[kind] })),
  // learned moves: the stronger version of a weapon move, from a level and a skill rank (the server decides in duels)
  // travel: the wastelands between the cities and the harbours with their fares (travel.ts)
  routes: ROUTES.map((r) => ({
    id: r.id,
    name: r.name,
    a: r.a,
    b: r.b,
    minLevel: r.levels[0],
    maxLevel: r.levels[1],
  })),
  ports: PORTS.map((p) => ({
    id: p.id,
    district: p.district,
    name: p.name,
    x: p.x,
    y: p.y,
    fare: ferryFare(p),
    npc: `przewoznik-${p.id.replace('port-', '')}`,
  })),
  moveUpgrades: Object.entries(MOVE_UPGRADES).map(([from, u]) => ({
    from,
    to: u!.to,
    level: u!.level,
    skill: u!.skill,
    rank: u!.rank,
  })),
  // dystrykty: the plots, the stages and the rules the game needs to draw a district and say up front what can be
  // done (the server decides)
  land: {
    plotSize: PLOT_SIZE,
    sector: SECTOR,
    sectors: SECTORS,
    sectorLimit: [...SECTOR_LIMIT],
    nameMin: DISTRICT_NAME_MIN,
    nameMax: DISTRICT_NAME_MAX,
    minLevel: LAND_MIN_LEVEL,
    baseStorage: BASE_STORAGE,
    producerHours: PRODUCER_HOURS,
    bonus: BIOME_BONUS,
    sellBatch: SELL_BATCH,
    raidMinLevel: RAID_MIN_LEVEL,
    raidsPerDay: RAIDS_PER_DAY,
    raidRetryMinutes: RAID_RETRY_MINUTES,
    newShieldHours: NEW_SHIELD_HOURS,
    resources: RESOURCES.map((r) => ({ id: r.id, name: r.name, price: r.price })),
    routeBonus: Object.entries(ROUTE_BONUS).map(([route, resource]) => ({ route, resource })),
    plots: PLOTS.map((p) => ({ ...p, price: plotPrice(p.route) })),
    // what clearing the k-th sector asks for (k = 0 for the first one past the start)
    clearings: Array.from({ length: CLEARINGS }, (_, k) => {
      const c = clearingCost(k);
      return {
        ...noResources(),
        ...c.cost,
        coins: c.coins,
        level: c.level,
        seconds: c.seconds,
        yields: c.yields,
      };
    }),
    ranks: RANKS.map((r) => ({ min: r.min, name: r.name })),
    styles: Object.entries(ROUTE_STYLE).map(([route, style]) => ({ route, style })),
    maxRentBoost: MAX_RENT_BOOST,
    buildings: BUILDINGS.map((b) => ({
      id: b.id,
      name: b.name,
      w: b.w,
      h: b.h,
      produces: b.produces ?? '',
      limit: [...b.limit],
      blurb: b.blurb,
      prestige: 'prestige' in b ? b.prestige : 0,
      rentBoost: 'rentBoost' in b ? b.rentBoost : 0,
      levels: b.levels.map((l) => ({
        ...noResources(),
        ...l.cost,
        seconds: l.seconds,
        player: l.player,
        value: l.value,
      })),
    })),
  },
  caches: CONTENT.caches.map((c) => ({
    id: c.id,
    district: c.district,
    map: cacheMap(c),
    x: c.x,
    y: c.y,
    look: c.look,
    coins: c.coins,
    xp: c.xp,
    minLevel: c.minLevel,
    text: c.text,
  })),
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

// opponents: their own folder (same generator)
mkdirSync(unity('Enemies'), { recursive: true });
for (const en of CONTENT.enemies)
  writeFileSync(unity(`Enemies/${en.id}.png`), budSheetPng(en.look, 6));

const xp = CONTENT.quests.reduce((sum, q) => sum + q.xp, 0);
console.info(
  `exported ${CONTENT.npcs.length} NPCs, ${CONTENT.quests.length} quests (${xp} XP), ${CONTENT.caches.length} caches, ${CONTENT.enemies.length} opponents, ${CONTENT.training.length} training spots, ${CATALOG.length} items`,
);
