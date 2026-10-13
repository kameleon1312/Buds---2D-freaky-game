// Renders the world props (trees, houses, bushes, rocks, fence, notice board, flowers) for the Unity game.
// Vector art in the same cel style as the buds: base + shade nudged to the bottom-right + highlight from the
// top-left. Props get a soft, darker-than-their-colour contour (only characters carry the black outline,
// so they pop out of the world). 1 tile = 64 SVG units, rendered at PPU px per tile.
//
// Usage: pnpm --filter @buds/api exec tsx ../../tools/export-world-art.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const T = 64; // SVG units per tile
const PPU = 96; // output pixels per tile (Unity sprite pixelsPerUnit)

type Prop = { w: number; h: number; ax: number; ay: number; body: string };

const circ = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;

let ids = 0;
/** Shape with cel shading: dark fill, base nudged towards the light and clipped, contour on top. */
function shaded(
  d: string,
  base: string,
  dark: string,
  line: string,
  dx = -5,
  dy = -6,
  width = 3,
): string {
  const id = `c${ids++}`;
  return (
    `<clipPath id="${id}"><path d="${d}"/></clipPath>` +
    `<path d="${d}" fill="${dark}"/>` +
    `<g clip-path="url(#${id})"><path d="${d}" fill="${base}" transform="translate(${dx} ${dy})"/></g>` +
    `<path d="${d}" fill="none" stroke="${line}" stroke-width="${width}" stroke-linejoin="round"/>`
  );
}

/** Puffy blob made of circles: one silhouette, shade, base and leafy highlights clipped to it. */
function puffs(
  circles: [number, number, number][],
  c: { base: string; dark: string; light: string; line: string },
  extra = '',
): string {
  const id = `p${ids++}`;
  const all = circles.map(([x, y, r]) => `<path d="${circ(x, y, r)}"/>`).join('');
  const lights = circles
    .map(([x, y, r]) => `<path d="${circ(x - r * 0.3, y - r * 0.38, r * 0.5)}"/>`)
    .join('');
  return (
    `<g fill="${c.line}" stroke="${c.line}" stroke-width="7" stroke-linejoin="round">${all}</g>` +
    `<clipPath id="${id}">${all}</clipPath>` +
    `<g fill="${c.dark}">${all}</g>` +
    `<g clip-path="url(#${id})"><g fill="${c.base}" transform="translate(-7 -9)">${all}</g></g>` +
    `<g fill="${c.light}" clip-path="url(#${id})">${lights}</g>` +
    extra
  );
}

const shadow = (cx: number, cy: number, rx: number, ry: number, o = 0.2) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1d2a14" opacity="${o}"/>`;

// ---------- palette (world: warm, a touch less saturated than the UI) ----------
const LEAF = { base: '#62b84e', dark: '#3f8f3e', light: '#86d062', line: '#2b5a2c' };
const LEAF2 = { base: '#4fa65a', dark: '#327c46', light: '#73c46c', line: '#21503a' };
const LEAF3 = { base: '#8cc44c', dark: '#5f9a3a', light: '#b0dc6a', line: '#3f6326' };
const BARK = ['#8f5e3b', '#6b4229', '#45291a'] as const;
const STONE = ['#bdb7ae', '#8f8a83', '#5d5853', '#dcd8d1'] as const;
const WOOD = ['#c48a52', '#9a6537', '#5a3a22'] as const;
const WALL = ['#f7ecd6', '#e1cfaf'] as const;
const HOUSE_LINE = '#4a3326';

function tree(leaf: typeof LEAF, fruit?: string): Prop {
  const w = 2.4 * T;
  const h = 3 * T;
  const ax = w / 2;
  const ay = h - 10;
  const trunk = `M${ax - 13} ${ay}Q${ax - 8} ${ay - 22} ${ax - 9} ${ay - 52}H${ax + 9}Q${ax + 8} ${ay - 22} ${ax + 13} ${ay}Z`;
  const crown: [number, number, number][] = [
    [ax, 66, 44],
    [ax - 34, 92, 30],
    [ax + 34, 92, 30],
    [ax - 22, 52, 28],
    [ax + 24, 54, 27],
    [ax, 108, 34],
  ];
  const dots = fruit
    ? [
        [ax - 30, 88],
        [ax + 18, 70],
        [ax + 36, 100],
        [ax - 8, 112],
        [ax - 14, 54],
      ]
        .map(
          ([x, y]) =>
            `<circle cx="${x}" cy="${y}" r="6" fill="${fruit}" stroke="${leaf.line}" stroke-width="2"/><circle cx="${x! - 2}" cy="${y! - 2}" r="2" fill="#fff" opacity="0.7"/>`,
        )
        .join('')
    : '';
  // leaf clumps: short arcs in the shade colour give the crown some volume
  const clumps = [
    [ax - 20, 80],
    [ax + 14, 92],
    [ax - 4, 60],
    [ax + 30, 72],
    [ax - 34, 104],
  ]
    .map(
      ([x, y]) =>
        `<path d="M${x! - 9} ${y}q9 7 18 0" fill="none" stroke="${leaf.dark}" stroke-width="3.5" stroke-linecap="round"/>`,
    )
    .join('');
  return {
    w,
    h,
    ax,
    ay,
    body:
      shadow(ax, ay - 2, 42, 11) +
      shaded(trunk, BARK[0], BARK[1], BARK[2], -4, 0) +
      puffs(crown, leaf, clumps + dots),
  };
}

function bush(flowers?: string): Prop {
  const w = 1.4 * T;
  const h = 1.15 * T;
  const ax = w / 2;
  const ay = h - 8;
  const dots = flowers
    ? [
        [ax - 16, ay - 30],
        [ax + 10, ay - 40],
        [ax + 20, ay - 22],
        [ax - 2, ay - 18],
      ]
        .map(
          ([x, y]) =>
            `<circle cx="${x}" cy="${y}" r="4.5" fill="${flowers}" stroke="#7a2f45" stroke-width="1.5"/>`,
        )
        .join('')
    : '';
  return {
    w,
    h,
    ax,
    ay,
    body:
      shadow(ax, ay, 34, 8) +
      puffs(
        [
          [ax - 16, ay - 20, 18],
          [ax + 16, ay - 20, 19],
          [ax, ay - 32, 20],
          [ax, ay - 14, 18],
        ],
        LEAF2,
        dots,
      ),
  };
}

function rock(big: boolean): Prop {
  const w = (big ? 1.3 : 1) * T;
  const h = (big ? 1 : 0.8) * T;
  const ax = w / 2;
  const ay = h - 7;
  const s = big ? 1 : 0.75;
  const d = `M${ax - 34 * s} ${ay}Q${ax - 40 * s} ${ay - 26 * s} ${ax - 18 * s} ${ay - 38 * s}Q${ax} ${ay - 48 * s} ${ax + 20 * s} ${ay - 36 * s}Q${ax + 38 * s} ${ay - 24 * s} ${ax + 34 * s} ${ay}Z`;
  return {
    w,
    h,
    ax,
    ay,
    body:
      shadow(ax, ay, 38 * s, 7 * s) +
      shaded(d, STONE[0], STONE[1], STONE[2], -6, -7) +
      `<path d="M${ax + 4 * s} ${ay - 34 * s}l-6 ${10 * s}l8 ${6 * s}" fill="none" stroke="${STONE[1]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<ellipse cx="${ax - 14 * s}" cy="${ay - 30 * s}" rx="${8 * s}" ry="${4 * s}" fill="${STONE[3]}" transform="rotate(-20 ${ax - 14 * s} ${ay - 30 * s})"/>`,
  };
}

/** 5×3-tile cottage: the footprint's bottom edge is the anchor, the roof rises above it. */
function house(roof: [string, string, string]): Prop {
  const w = 5.8 * T;
  const h = 4.4 * T;
  const ax = w / 2;
  const ay = h - 8;
  const L = ax - 2.5 * T; // footprint left edge
  const wallTop = ay - 1.6 * T;
  const eave = wallTop - 2;
  const top = ay - 3.75 * T;
  const roofD = `M${L - 12} ${eave}L${L + 26} ${top + 22}Q${L + 32} ${top} ${L + 56} ${top}H${L + 5 * T - 56}Q${L + 5 * T - 32} ${top} ${L + 5 * T - 26} ${top + 22}L${L + 5 * T + 12} ${eave}Q${L + 5 * T + 14} ${eave + 14} ${L + 5 * T} ${eave + 14}H${L}Q${L - 14} ${eave + 14} ${L - 12} ${eave}Z`;
  const rows = [0.3, 0.52, 0.74]
    .map((t) => {
      const y = top + (eave - top) * t;
      // follow the sloped roof edge from (L - 12, eave) up to (L + 26, top + 22)
      const edge = L - 12 + (38 * (eave - y)) / (eave - top - 22);
      const span = L + 5 * T - edge - (edge - L) - 2 * 10;
      const n = Math.floor(span / 20);
      const x0 = ax - (n * 20) / 2;
      let d = `M${x0} ${y}`;
      for (let i = 0; i < n; i++) d += `q10 9 20 0`;
      return `<path d="${d}" fill="none" stroke="${roof[1]}" stroke-width="4" stroke-linecap="round"/>`;
    })
    .join('');
  const win = (cx: number) =>
    shaded(rr(cx - 22, wallTop + 26, 44, 38, 10), '#a9dcf5', '#7cc0e6', HOUSE_LINE, -4, -4) +
    `<path d="M${cx} ${wallTop + 27}V${wallTop + 63}M${cx - 21} ${wallTop + 45}H${cx + 21}" stroke="${HOUSE_LINE}" stroke-width="3"/>` +
    `<path d="M${cx - 14} ${wallTop + 33}l8 0" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.8"/>` +
    shaded(rr(cx - 26, wallTop + 64, 52, 12, 4), WOOD[0], WOOD[1], HOUSE_LINE, -2, -2) +
    [cx - 16, cx - 4, cx + 8, cx + 18]
      .map(
        (x, i) =>
          `<circle cx="${x}" cy="${wallTop + 62}" r="5" fill="${['#ff7aa8', '#ffd23f', '#ffffff', '#ff7aa8'][i]}" stroke="${HOUSE_LINE}" stroke-width="1.5"/>`,
      )
      .join('');
  const door =
    `M${ax - 22} ${ay - 6}V${wallTop + 40}Q${ax - 22} ${wallTop + 16} ${ax} ${wallTop + 16}` +
    `Q${ax + 22} ${wallTop + 16} ${ax + 22} ${wallTop + 40}V${ay - 6}Z`;
  return {
    w,
    h,
    ax,
    ay,
    body:
      shadow(ax, ay - 2, 2.6 * T, 12, 0.22) +
      // chimney behind the roof
      shaded(rr(L + 3.6 * T, top - 26, 30, 70, 6), '#d27a5a', '#a85a40', HOUSE_LINE, -3, -3) +
      shaded(rr(L + 3.6 * T - 4, top - 30, 38, 12, 5), STONE[0], STONE[1], HOUSE_LINE, -2, -2) +
      // walls, stone footing, door, windows
      shaded(
        rr(L + 8, wallTop, 5 * T - 16, ay - wallTop - 4, 8),
        WALL[0],
        WALL[1],
        HOUSE_LINE,
        -8,
        -4,
      ) +
      shaded(rr(L + 4, ay - 18, 5 * T - 8, 16, 6), STONE[0], STONE[1], HOUSE_LINE, -3, -3) +
      shaded(door, WOOD[0], WOOD[1], HOUSE_LINE, -5, -3) +
      `<path d="M${ax} ${wallTop + 18}V${ay - 6}" stroke="${WOOD[1]}" stroke-width="3"/>` +
      `<circle cx="${ax + 12}" cy="${ay - 34}" r="3.5" fill="#ffc93c" stroke="${HOUSE_LINE}" stroke-width="1.5"/>` +
      win(L + 0.5 * T + 6) +
      win(L + 4.5 * T - 6) +
      // roof with scalloped shingle rows and a ridge highlight
      shaded(roofD, roof[0], roof[1], HOUSE_LINE, -6, -8) +
      rows +
      `<path d="M${L + 60} ${top + 8}H${L + 5 * T - 60}" stroke="${roof[2]}" stroke-width="6" stroke-linecap="round" opacity="0.9"/>`,
  };
}

function sign(): Prop {
  const w = 1.6 * T;
  const h = 1.8 * T;
  const ax = w / 2;
  const ay = h - 8;
  return {
    w,
    h,
    ax,
    ay,
    body:
      shadow(ax, ay, 40, 8) +
      shaded(rr(ax - 32, ay - 62, 10, 62, 3), WOOD[1], WOOD[2], WOOD[2], -2, 0) +
      shaded(rr(ax + 22, ay - 62, 10, 62, 3), WOOD[1], WOOD[2], WOOD[2], -2, 0) +
      shaded(rr(ax - 42, ay - 96, 84, 52, 8), WOOD[0], WOOD[1], WOOD[2], -4, -4) +
      shaded(
        `M${ax - 50} ${ay - 94}L${ax} ${ay - 112}L${ax + 50} ${ay - 94}Z`,
        '#e0614a',
        '#b8463a',
        WOOD[2],
        -3,
        -3,
      ) +
      `<rect x="${ax - 34}" y="${ay - 88}" width="30" height="34" rx="2" fill="#f6f2e9" stroke="${WOOD[2]}" stroke-width="2" transform="rotate(-4 ${ax - 19} ${ay - 71})"/>` +
      `<rect x="${ax + 2}" y="${ay - 86}" width="30" height="26" rx="2" fill="#fff6c9" stroke="${WOOD[2]}" stroke-width="2" transform="rotate(5 ${ax + 17} ${ay - 73})"/>` +
      `<path d="M${ax - 28} ${ay - 78}h18M${ax - 28} ${ay - 70}h14M${ax + 8} ${ay - 76}h16" stroke="#a9afbd" stroke-width="2.5" stroke-linecap="round"/>` +
      `<circle cx="${ax - 19}" cy="${ay - 86}" r="3" fill="#ff3d50"/><circle cx="${ax + 17}" cy="${ay - 84}" r="3" fill="#4cc7ff"/>`,
  };
}

const post = (): Prop => ({
  w: 28,
  h: 52,
  ax: 14,
  ay: 46,
  body: shadow(14, 46, 12, 4) + shaded(rr(7, 8, 14, 38, 5), WOOD[0], WOOD[1], WOOD[2], -3, -2),
});
/** Horizontal rails from one post (anchor) to the next tile east. */
const railH = (): Prop => ({
  w: T + 8,
  h: 52,
  ax: 4,
  ay: 46,
  body:
    shaded(rr(4, 16, T, 8, 3), WOOD[0], WOOD[1], WOOD[2], 0, -2) +
    shaded(rr(4, 30, T, 8, 3), WOOD[0], WOOD[1], WOOD[2], 0, -2),
});
/** Vertical rail from the post above down to this post (anchor at the lower post's base). */
const railV = (): Prop => ({
  w: 24,
  h: T + 52,
  ax: 12,
  ay: T + 46,
  body: shaded(rr(7, 24, 10, T + 6, 4), WOOD[0], WOOD[1], WOOD[2], -2, 0),
});

function flowers(petal: string, center: string): Prop {
  const w = 0.8 * T;
  const h = 0.6 * T;
  const ax = w / 2;
  const ay = h - 6;
  const flower = (x: number, y: number, r: number) =>
    [0, 72, 144, 216, 288]
      .map((a) => {
        const rad = (a * Math.PI) / 180;
        return `<circle cx="${(x + Math.cos(rad) * r).toFixed(1)}" cy="${(y + Math.sin(rad) * r).toFixed(1)}" r="${r * 0.75}" fill="${petal}" stroke="#3a5a2a" stroke-width="1.2"/>`;
      })
      .join('') + `<circle cx="${x}" cy="${y}" r="${r * 0.6}" fill="${center}"/>`;
  return {
    w,
    h,
    ax,
    ay,
    body:
      `<path d="M${ax - 12} ${ay}q-2 -10 -6 -14M${ax} ${ay}v-18M${ax + 12} ${ay}q2 -10 6 -14" stroke="#3f8f3e" stroke-width="3" stroke-linecap="round" fill="none"/>` +
      `<ellipse cx="${ax - 6}" cy="${ay - 6}" rx="6" ry="3" fill="#4fa65a" transform="rotate(-30 ${ax - 6} ${ay - 6})"/>` +
      flower(ax - 16, ay - 16, 5) +
      flower(ax + 16, ay - 15, 5) +
      flower(ax, ay - 22, 6),
  };
}

const tuft = (): Prop => ({
  w: 32,
  h: 22,
  ax: 16,
  ay: 18,
  body: `<path d="M8 18q-1 -8 -5 -12M13 18q0 -10 -2 -15M18 18q1 -9 4 -13M23 18q2 -6 6 -9" stroke="#5fa843" stroke-width="3" stroke-linecap="round" fill="none"/>`,
});

const pebbles = (): Prop => ({
  w: 40,
  h: 20,
  ax: 20,
  ay: 16,
  body:
    `<ellipse cx="13" cy="12" rx="7" ry="4.5" fill="#d1b98a"/><ellipse cx="12" cy="11" rx="4" ry="2" fill="#f4e4bf"/>` +
    `<ellipse cx="28" cy="14" rx="5" ry="3.2" fill="#d1b98a"/>`,
});

const lily = (): Prop => ({
  w: 56,
  h: 36,
  ax: 28,
  ay: 30,
  body:
    `<path d="M28 18L48 14A22 13 0 1 1 44 9Z" fill="#4fa65a" stroke="#2e7a44" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M14 20q8 -4 14 -2" stroke="#7fcd5c" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
    `<circle cx="20" cy="12" r="5" fill="#ff9fc0" stroke="#b84a74" stroke-width="1.5"/><circle cx="20" cy="12" r="2" fill="#ffd23f"/>`,
});

const PROPS: Record<string, Prop> = {
  'tree-a': tree(LEAF),
  'tree-b': tree(LEAF2),
  'tree-c': tree(LEAF3, '#ff7a3c'),
  'bush-a': bush(),
  'bush-b': bush('#ff7aa8'),
  'rock-a': rock(true),
  'rock-b': rock(false),
  'house-red': house(['#e0614a', '#b8463a', '#f28b73']),
  'house-blue': house(['#4c8fd6', '#36689f', '#7fb4ec']),
  'house-teal': house(['#3fb39b', '#2c8574', '#6fd2bc']),
  sign: sign(),
  'fence-post': post(),
  'fence-h': railH(),
  'fence-v': railV(),
  'flowers-a': flowers('#ff9fc0', '#ffd23f'),
  'flowers-b': flowers('#ffd23f', '#ff9a1f'),
  'flowers-c': flowers('#ffffff', '#ffc93c'),
  tuft: tuft(),
  pebbles: pebbles(),
  lily: lily(),
};

const dir = fileURLToPath(new URL('../apps/unity/Assets/Buds/Resources/World/', import.meta.url));
mkdirSync(dir, { recursive: true });
const scale = PPU / T;
const manifest: { name: string; pivotX: number; pivotY: number }[] = [];
for (const [name, p] of Object.entries(PROPS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="0 0 ${p.w} ${p.h}">${p.body}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: scale } }).render();
  writeFileSync(`${dir}${name}.png`, png.asPng());
  // pivot from the bottom-left in 0..1, measured on the rendered (rounded) pixel size
  manifest.push({
    name,
    pivotX: +((p.ax * scale) / png.width).toFixed(4),
    pivotY: +(1 - (p.ay * scale) / png.height).toFixed(4),
  });
}
writeFileSync(`${dir}props.json`, JSON.stringify({ ppu: PPU, props: manifest }, null, 2) + '\n');
console.info(`wrote ${manifest.length} props to ${dir}`);
