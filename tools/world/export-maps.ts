// Writes every district map and every interior to apps/unity/Assets/Buds/Resources/Maps/<id>.txt and checks
// them (spawn, exits and doors reachable, signs reachable, every prop known, every door leads to a room whose
// way out leads back to that district).
//
// Usage (from apps/api): pnpm exec tsx ../../tools/world/export-maps.ts [--preview dir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MapCanvas } from './maps/lib';
import { dworCarski } from './maps/dwor-carski';
import { dzikaPuszcza } from './maps/dzika-puszcza';
import { interiors } from './maps/interiors';
import { lasPalmas } from './maps/las-palmas';
import { losKarkos } from './maps/los-karkos';
import { miastoZiomkow } from './maps/miasto-ziomkow';
import { wyspaStartowa } from './maps/wyspa-startowa';

const districts = [miastoZiomkow, dzikaPuszcza, lasPalmas, dworCarski, losKarkos].map((build) =>
  build(),
);
const rooms = interiors();

const problems: string[] = [];
for (const d of districts)
  for (const door of d.doors) {
    const room = rooms.find((r) => r.id === door.target);
    if (!room) problems.push(`${d.id}: door to unknown room ${door.target}`);
    else if (room.outside !== d.id)
      problems.push(`${room.id}: leads out to ${room.outside}, not ${d.id}`);
  }
for (const r of rooms)
  if (!districts.some((d) => d.doors.some((door) => door.target === r.id)))
    problems.push(`${r.id}: no door leads into it`);
if (problems.length) throw new Error(`Maps have problems:\n  - ${problems.join('\n  - ')}`);

const dir = fileURLToPath(new URL('../../apps/unity/Assets/Buds/Resources/Maps/', import.meta.url));
mkdirSync(dir, { recursive: true });
// the tutorial island: its pier leads to Miasto Ziomków, one way
const island = wyspaStartowa();

for (const map of [...districts, island, ...rooms] as MapCanvas[]) {
  const { reachable, walkable } = map.validate();
  writeFileSync(`${dir}${map.id}.txt`, map.toText());
  console.info(`${map.id}: ${map.w}×${map.h}, ${reachable}/${walkable} walkable cells reachable`);
}
