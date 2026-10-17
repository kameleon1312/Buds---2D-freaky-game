// Renders every world prop to apps/unity/Assets/Buds/Resources/World/<name>.png plus props.json
// (pivot = ground point, flat = lies on the ground, foot = blocked cells).
//
// Usage (from apps/api, which has resvg):
//   pnpm exec tsx ../../tools/world/export-art.ts                 # write PNGs + manifest
//   pnpm exec tsx ../../tools/world/export-art.ts --preview out.png [filter]   # contact sheet only
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { ICONS } from './art/icons';
import { FX } from './art/fx';
import { ALL_PROPS } from './art/index';
import { T } from './art/kit';

export const PPU = 96; // output pixels per tile (Unity sprite pixelsPerUnit)

const svgOf = (p: { w: number; h: number; body: string }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="0 0 ${p.w} ${p.h}">${p.body}</svg>`;

// lettering on props (banners, booth signs) uses the game's Rubik Black, never a system font
const SIGN_FONT = {
  fontFiles: [
    fileURLToPath(
      new URL('../../apps/unity/Assets/Buds/Resources/Fonts/Rubik-Black.ttf', import.meta.url),
    ),
  ],
  loadSystemFonts: false,
  defaultFontFamily: 'Rubik Black',
};

const args = process.argv.slice(2);
if (args[0] === '--fx-preview') {
  // every effect on the duel arena's dark surface, as the player sees them
  const gap = 30;
  let x = gap;
  let y = gap;
  let rowH = 0;
  let body = '';
  const W = 1900;
  for (const [name, p] of Object.entries(FX)) {
    if (x + p.w > W) {
      x = gap;
      y += rowH + gap + 24;
      rowH = 0;
    }
    body += `<g transform="translate(${x} ${y + 24})">${p.body}</g>`;
    body += `<text x="${x}" y="${y + 14}" font-family="sans-serif" font-size="18" fill="#a9afbd">${name}</text>`;
    rowH = Math.max(rowH, p.h);
    x += p.w + gap;
  }
  const H = y + rowH + 60;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#23262f"/>${body}</svg>`;
  writeFileSync(
    args[1]!,
    new Resvg(svg, { font: { ...SIGN_FONT, loadSystemFonts: true } }).render().asPng(),
  );
  console.info(`preview of ${Object.keys(FX).length} effects → ${args[1]}`);
} else if (args[0] === '--preview') {
  const filter = args[2];
  // a filter like "karuzela|mlyn" matches any of its parts
  const parts = filter?.split('|') ?? [];
  const entries = Object.entries(ALL_PROPS).filter(
    ([name]) => !filter || parts.some((f) => name.includes(f)),
  );
  const cols = 6;
  const cell = 7 * T;
  let x = 0;
  let y = 0;
  let rowH = 0;
  let body = '';
  entries.forEach(([name, p], i) => {
    if (i % cols === 0 && i > 0) {
      y += rowH + 40;
      x = 0;
      rowH = 0;
    }
    const scale = Math.min(1, cell / p.w);
    body += `<g transform="translate(${x + (cell - p.w * scale) / 2} ${y + 30}) scale(${scale})">${p.body}</g>`;
    body += `<text x="${x + cell / 2}" y="${y + 20}" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#333">${name}</text>`;
    rowH = Math.max(rowH, p.h * scale);
    x += cell;
  });
  const W = cols * cell;
  const H = y + rowH + 60;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#9fd07a"/>${body}</svg>`;
  writeFileSync(
    args[1]!,
    new Resvg(svg, {
      fitTo: { mode: 'zoom', value: 0.5 },
      font: { ...SIGN_FONT, loadSystemFonts: true },
    })
      .render()
      .asPng(),
  );
  console.info(`preview of ${entries.length} props → ${args[1]}`);
} else {
  const dir = fileURLToPath(
    new URL('../../apps/unity/Assets/Buds/Resources/World/', import.meta.url),
  );
  mkdirSync(dir, { recursive: true });
  const scale = PPU / T;
  const manifest: {
    name: string;
    pivotX: number;
    pivotY: number;
    flat: boolean;
    foot: [number, number];
  }[] = [];
  for (const [name, p] of Object.entries(ALL_PROPS)) {
    const png = new Resvg(svgOf(p), {
      fitTo: { mode: 'zoom', value: scale },
      font: SIGN_FONT,
    }).render();
    writeFileSync(`${dir}${name}.png`, png.asPng());
    // pivot from the bottom-left in 0..1, measured on the rendered (rounded) pixel size
    manifest.push({
      name,
      pivotX: +((p.ax * scale) / png.width).toFixed(4),
      pivotY: +(1 - (p.ay * scale) / png.height).toFixed(4),
      flat: !!p.flat,
      foot: p.foot ?? [1, 1],
    });
  }
  writeFileSync(`${dir}props.json`, JSON.stringify({ ppu: PPU, props: manifest }, null, 2) + '\n');
  console.info(`wrote ${manifest.length} props to ${dir}`);

  // Bud panel icons: Resources/Items/<item>.png and Resources/Skills/<skill>.png (128 px)
  for (const [folder, icons] of [
    ['Items', ICONS.items],
    ['Skills', ICONS.skills],
    ['Ui', ICONS.ui],
  ] as const) {
    const out = fileURLToPath(
      new URL(`../../apps/unity/Assets/Buds/Resources/${folder}/`, import.meta.url),
    );
    mkdirSync(out, { recursive: true });
    for (const [name, icon] of Object.entries(icons)) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${icon.body}</svg>`;
      writeFileSync(
        `${out}${name}.png`,
        new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 } }).render().asPng(),
      );
    }
    console.info(`wrote ${Object.keys(icons).length} icons to ${out}`);
  }

  // duel and rivalry effects: Resources/Ui/Fx/<name>.png, 1 px per unit
  const fxDir = fileURLToPath(
    new URL('../../apps/unity/Assets/Buds/Resources/Ui/Fx/', import.meta.url),
  );
  mkdirSync(fxDir, { recursive: true });
  for (const [name, p] of Object.entries(FX))
    writeFileSync(`${fxDir}${name}.png`, new Resvg(svgOf(p), { font: SIGN_FONT }).render().asPng());
  console.info(`wrote ${Object.keys(FX).length} effects to ${fxDir}`);
}
