// Writes every district map to apps/unity/Assets/Buds/Resources/Maps/<id>.txt and checks it
// (spawn and exits reachable, signs reachable, every prop known).
//
// Usage (from apps/api): pnpm exec tsx ../../tools/world/export-maps.ts [--preview dir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MapCanvas } from './maps/lib';
import { dworCarski } from './maps/dwor-carski';
import { lasPalmas } from './maps/las-palmas';
import { losKarkos } from './maps/los-karkos';
import { miastoZiomkow } from './maps/miasto-ziomkow';

const builders: (() => MapCanvas)[] = [miastoZiomkow, lasPalmas, dworCarski, losKarkos];

const dir = fileURLToPath(new URL('../../apps/unity/Assets/Buds/Resources/Maps/', import.meta.url));
mkdirSync(dir, { recursive: true });
for (const build of builders) {
  const map = build();
  const { reachable, walkable } = map.validate();
  writeFileSync(`${dir}${map.id}.txt`, map.toText());
  console.info(`${map.id}: ${map.w}×${map.h}, ${reachable}/${walkable} walkable cells reachable`);
}
