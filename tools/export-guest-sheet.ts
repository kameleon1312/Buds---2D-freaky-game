// Regenerates the offline "guest" bud sheet bundled with the Unity game.
// Usage: pnpm --filter @buds/api exec tsx ../../tools/export-guest-sheet.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { BudLook } from '@buds/shared';
import { budSheetPng } from '../apps/api/src/png';

const guest: BudLook = {
  gender: 'on',
  mood: 'radosny',
  skin: 1,
  hair: 'krotkie',
  hairColor: 1,
  outfit: 'bluza',
  outfitColor: 0,
  pantsColor: 0,
};

const out = fileURLToPath(
  new URL('../apps/unity/Assets/Buds/Resources/Sheets/guest.png', import.meta.url),
);
writeFileSync(out, budSheetPng(guest));
console.info(`wrote ${out}`);
