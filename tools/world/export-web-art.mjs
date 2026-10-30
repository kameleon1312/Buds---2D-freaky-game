// Copies the game's own pictures the landing page shows to apps/web/public/world (flat names), so the road a bud
// walks on the website is built from the real world of the game. Run after export-art.ts: node tools/world/export-web-art.mjs
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = (p) =>
  fileURLToPath(new URL(`../../apps/unity/Assets/Buds/Resources/${p}.png`, import.meta.url));
const out = fileURLToPath(new URL('../../apps/web/public/world/', import.meta.url));

const WORLD = [
  // the street of the hero and the town
  'kamienica-a',
  'kamienica-b',
  'kamienica-c',
  'kamienica-cegla-a',
  'kamienica-cegla-b',
  'blok-a',
  'blok-b',
  'kawiarnia',
  'sklep-ciuchy',
  'sklep-kiosk',
  'stragan-owoce',
  'house-blue',
  'house-red',
  'house-teal',
  'lamp',
  'tree-a',
  'tree-b',
  'bench',
  'hydrant',
  'przystanek',
  'auto-a',
  'auto-b',
  'fontanna',
  'bush-a',
  // the island
  'palm-a',
  'palm-b',
  'palm-c',
  'lodz',
  'parasol-a',
  'lezak-a',
  'muszle',
  'krab',
  'rozgwiazda',
  'flaming',
  // the night street
  'ring',
  'worek-bokserski',
  'beczka-ogien',
  'opony',
  'graffiti-a',
  'graffiti-c',
  'graffiti-e',
  // the wastelands
  'sosna',
  'swierk',
  'rock-a',
  'rock-b',
  'drzewo-suche',
  'kloda',
  'ruina-a',
  'wrak-a',
  'zlom',
  'sign',
  // the district
  'dz-na-sprzedaz',
  'dz-budowa',
  'dz-las-ratusz-1',
  'dz-las-ratusz-3',
  'dz-las-apartamentowiec',
  'dz-las-farma-solarna',
  'dz-las-szklarnia',
  'dz-las-fontanna',
  'dz-las-pomnik',
  'dz-las-iglica',
  // together
  'scena',
  'trybuna',
  // the rides
  'jazda-deskorolka-bok',
  'jazda-rower-bok',
  'jazda-motocykl-bok',
  'jazda-quad-bok',
  'jazda-hulajnowa-bok',
];
const OTHER = [
  'Ui/Fx/fx-bam',
  'Ui/Fx/fx-lup',
  'Ui/Fx/fx-ko',
  'Ui/Fx/fx-vs',
  'Ui/Fx/fx-wygrana',
  'Ui/Training/tr-rekin',
  'Ui/Training/tr-kubek',
  'Ui/Training/tr-rekawica',
  'Ui/Training/tr-mikrofon',
  'Ui/Training/tr-pies-a',
  'Ui/Training/tr-deska',
  'Ui/Training/Murals/oko-0',
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const name of WORLD) copyFileSync(from(`World/${name}`), `${out}${name}.png`);
for (const path of OTHER) copyFileSync(from(path), `${out}${path.split('/').pop()}.png`);
console.info(`copied ${readdirSync(out).length} pictures to ${out}`);
