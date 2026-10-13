// Interiors: back walls (one tile wide, tiling side by side, in a theme per building), floor decals, furniture
// and the hidden caches (skrytki) with their opened look and the sparkle that gives them away.
import {
  GLASS,
  LINE,
  METAL,
  T,
  WOOD,
  WOOD_LINE,
  bricks,
  circ,
  fill,
  flat,
  n,
  poly,
  puffs,
  LEAF2,
  rng,
  rr,
  shaded,
  shadow,
  stroke,
  type Prop,
  type Tone,
} from './kit';

// ---------- walls ----------

type WallTheme = {
  paper: Tone;
  /** Lower panel (wainscot); none = wallpaper down to the baseboard. */
  panel?: Tone;
  base: string;
  /** Pattern drawn over the wallpaper. */
  pattern?: 'stripes' | 'bamboo' | 'bricks' | 'damask' | 'peeling' | 'hazard';
  trim?: string;
};

export const WALL_THEMES: Record<string, WallTheme> = {
  kawiarnia: {
    paper: ['#f3e3c3', '#e2cda5'],
    panel: ['#3fb39b', '#2c8574'],
    base: '#5a3a22',
    pattern: 'stripes',
  },
  komisariat: { paper: ['#cfdde8', '#b5c8d8'], panel: ['#4a6178', '#34465a'], base: '#262833' },
  garaz: { paper: ['#a7adb7', '#9199a4'], base: '#3a3d4a', pattern: 'hazard' },
  chatka: { paper: ['#dcb873', '#c49a55'], base: '#6b4229', pattern: 'bamboo' },
  dworek: {
    paper: ['#8a2f3c', '#73252f'],
    panel: ['#6b4229', '#4f2f1c'],
    base: '#3a2414',
    pattern: 'damask',
    trim: '#ffc93c',
  },
  urzad: { paper: ['#c9d4b8', '#b2bf9e'], panel: ['#6b7a5a', '#55634a'], base: '#3a3d2e' },
  silownia: {
    paper: ['#a8503f', '#8f4233'],
    panel: ['#3a3d4a', '#262833'],
    base: '#1a1c22',
    pattern: 'bricks',
  },
  ruina: { paper: ['#7fb3a8', '#679a8f'], base: '#3a3d4a', pattern: 'peeling' },
};

const WALL_H = 2.6 * T;

/** One tile of back wall (anchor = bottom of the wall row). Tiles side by side without seams. */
function wall(theme: WallTheme, variant: 'a' | 'okno' | 'obraz', seed: number): Prop {
  const w = T;
  const h = WALL_H;
  const ay = h - 0.1 * T; // sits flush on the row: the game lifts props by 0.1 tile
  const cap = 12;
  const baseH = 8;
  const panelTop = theme.panel ? ay - 0.75 * T : ay - baseH;
  const r = rng(seed);
  let s = fill(`M0 0H${w}V${n(ay)}H0Z`, theme.paper[0]);
  // light from the top-left: a soft darker band near the floor
  s += fill(`M0 ${n(panelTop - 18)}H${w}V${n(panelTop)}H0Z`, theme.paper[1], 0.7);
  switch (theme.pattern) {
    case 'stripes':
      for (const x of [8, 40]) s += fill(rr(x, cap, 14, panelTop - cap, 0), theme.paper[1], 0.55);
      break;
    case 'bamboo':
      for (const x of [10, 30, 50]) {
        s += stroke(`M${x} ${cap}V${n(panelTop)}`, theme.paper[1], 9);
        for (let y = cap + 22 + r() * 10; y < panelTop - 6; y += 34)
          s += stroke(`M${x - 5} ${n(y)}h10`, '#8a6538', 2.5);
      }
      break;
    case 'bricks':
      s += bricks(0, cap, w, panelTop - cap, '#5a2a20', 0.5);
      break;
    case 'damask':
      for (const [x, y] of [
        [16, 44],
        [48, 92],
        [16, 140],
      ] as const)
        s += stroke(
          `M${x} ${y - 9}q7 9 0 18q-7 -9 0 -18M${x - 8} ${y}h16`,
          theme.trim ?? '#ffffff',
          2.5,
          0.45,
        );
      break;
    case 'peeling':
      for (let i = 0; i < 2; i++) {
        const x = 6 + r() * 40;
        const y = cap + 20 + r() * (panelTop - cap - 60);
        s += flat(
          poly([
            [x, y],
            [x + 14 + r() * 8, y + 4],
            [x + 18, y + 18 + r() * 8],
            [x + 4, y + 22],
          ]),
          '#c9b593',
          '#5f7a70',
          1.5,
        );
      }
      s += stroke(`M${n(20 + r() * 20)} ${cap}l6 22l-8 18l5 20`, '#4a6a62', 2, 0.7);
      break;
    case 'hazard':
      for (let x = -24; x < w; x += 24)
        s += fill(
          poly([
            [x, ay - baseH],
            [x + 12, ay - baseH],
            [x + 24, ay - baseH - 20],
            [x + 12, ay - baseH - 20],
          ]),
          '#ffc93c',
        );
      s += fill(`M0 ${n(ay - baseH - 22)}H${w}V${n(ay - baseH - 20)}H0Z`, '#262833');
      break;
  }
  if (theme.panel) {
    s += fill(`M0 ${n(panelTop)}H${w}V${n(ay)}H0Z`, theme.panel[0]);
    s += fill(`M0 ${n(panelTop + 12)}H${w}V${n(ay)}H0Z`, theme.panel[1], 0.55);
    s += fill(
      `M0 ${n(panelTop)}H${w}V${n(panelTop + 5)}H0Z`,
      theme.trim ?? '#ffffff',
      theme.trim ? 0.9 : 0.35,
    );
  }
  s += fill(`M0 ${n(ay - baseH)}H${w}V${n(ay)}H0Z`, theme.base);
  // the cap: the wall's top edge seen from above
  s += fill(`M0 0H${w}V${cap}H0Z`, '#2a2730');
  s += fill(`M0 ${cap}H${w}V${cap + 3}H0Z`, '#121218', 0.6);

  const mid = (cap + panelTop) / 2;
  if (variant === 'okno') {
    const ww = 40;
    const wh = 56;
    const x = (w - ww) / 2;
    const y = mid - wh / 2;
    s += shaded(rr(x - 4, y - 4, ww + 8, wh + 8, 4), WOOD, WOOD_LINE, -2, -2, 2.5);
    s += shaded(rr(x, y, ww, wh, 3), GLASS, LINE, -4, -4, 2);
    s += stroke(
      `M${n(w / 2)} ${n(y)}V${n(y + wh)}M${n(x)} ${n(y + wh / 2)}H${n(x + ww)}`,
      WOOD[1],
      3,
    );
    s += stroke(`M${n(x + 6)} ${n(y + 8)}l10 0`, '#ffffff', 3, 0.8);
    s += flat(rr(x - 7, y + wh + 2, ww + 14, 7, 2), WOOD[0], WOOD_LINE, 2);
  } else if (variant === 'obraz') {
    const colors = ['#ffc93c', '#4cc7ff', '#ff7aa8', '#a3e635', '#b45cff'];
    const c = colors[Math.floor(r() * colors.length)]!;
    const fw = 38;
    const fh = 44;
    const x = (w - fw) / 2;
    const y = mid - fh / 2 - 6;
    s += shaded(rr(x, y, fw, fh, 3), [theme.trim ?? '#c48a52', '#7a5232'], LINE, -2, -2, 2.5);
    s += flat(rr(x + 6, y + 6, fw - 12, fh - 12, 2), '#f6f2e9', LINE, 1.5);
    s += fill(circ(x + fw / 2, y + fh / 2 + 2, 8), c);
    s += fill(
      poly([
        [x + 8, y + fh - 8],
        [x + 16, y + fh - 20],
        [x + 22, y + fh - 8],
      ]),
      '#5cc84a',
    );
  }
  return { w, h, ax: w / 2, ay, body: s };
}

// ---------- floor decals (flat, one tile, tile seamlessly) ----------

/** Seams for one floor tile: transparent except the lines, the ground colour shows through. */
function floor(kind: 'deski' | 'parkiet' | 'kafle' | 'beton' | 'guma' | 'deski-stare'): Prop {
  const w = T;
  const h = T;
  const ay = h - 0.1 * T;
  const top = ay - T; // the tile spans [top, ay]
  const r = rng(kind.length * 31);
  const line = (d: string, o = 0.22) => stroke(d, '#2a1a10', 2, o);
  let s = '';
  switch (kind) {
    case 'deski':
    case 'deski-stare':
      for (let i = 0; i < 4; i++) {
        const y = top + i * 16;
        s += line(`M0 ${n(y)}H${w}`);
        const jx = [12, 44, 28, 56][i]!;
        s += line(`M${jx} ${n(y)}v16`);
      }
      if (kind === 'deski-stare') {
        s += stroke(`M${n(10 + r() * 30)} ${n(top + 20)}l8 6l-3 9`, '#1a1008', 2, 0.35);
        s += fill(circ(46, top + 44, 2.5), '#1a1008', 0.3);
      }
      break;
    case 'parkiet':
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const x = i * 32;
          const y = top + j * 32;
          s += line(`M${x} ${n(y)}h32v32h-32Z`, 0.18);
          s +=
            (i + j) % 2
              ? line(`M${x + 11} ${n(y)}v32M${x + 21} ${n(y)}v32`, 0.14)
              : line(`M${x} ${n(y + 11)}h32M${x} ${n(y + 21)}h32`, 0.14);
        }
      break;
    case 'kafle':
      s += stroke(
        `M0 ${n(top)}H${w}M0 ${n(top + 32)}H${w}M0 ${n(top)}V${n(ay)}M32 ${n(top)}V${n(ay)}`,
        '#ffffff',
        2.5,
        0.5,
      );
      s += fill(rr(4, top + 4, 10, 4, 2), '#ffffff', 0.35);
      break;
    case 'beton':
      for (let i = 0; i < 4; i++)
        s += fill(circ(r() * w, top + r() * T, 1.5 + r() * 2), '#3a3d4a', 0.18);
      s += line(`M0 ${n(top)}H${w}M0 ${n(top)}V${n(ay)}`, 0.12);
      break;
    case 'guma':
      s += stroke(rr(2, top + 2, w - 4, T - 4, 3), '#121218', 2.5, 0.45);
      s += fill(circ(14, top + 14, 1.5), '#ffffff', 0.15);
      break;
  }
  return { w, h, ax: w / 2, ay, flat: true, body: s };
}

// ---------- furniture ----------

/** A box seen from the front-top: front face, then the top surface overlapping its upper edge. */
function block(
  cx: number,
  bottom: number,
  width: number,
  front: number,
  top: number,
  topTone: Tone,
  frontTone: Tone,
  line = LINE,
  r = 5,
) {
  const x = cx - width / 2;
  return (
    shaded(rr(x, bottom - front, width, front, r), frontTone, line, -4, -3) +
    shaded(rr(x - 2, bottom - front - top, width + 4, top + 4, r), topTone, line, -5, -4)
  );
}

const canvas = (tilesW: number, tilesH: number, depth = 1) => {
  const w = tilesW * T + 16;
  const h = tilesH * T;
  return { w, h, ax: w / 2, ay: h - 6, foot: [tilesW, depth] as [number, number] };
};

const WOOD_DARK: Tone = ['#8f5e3b', '#6b4229'];
const PAPER: Tone = ['#f6f2e9', '#ddd5c4'];

function counter(): Prop {
  const c = canvas(3, 1.9);
  const { ax, ay } = c;
  let s = shadow(ax, ay, 96, 7);
  s += block(ax, ay, 184, 40, 18, ['#e6d7bd', '#c9b593'], WOOD);
  s += stroke(`M${ax - 60} ${ay - 34}v28M${ax} ${ay - 34}v28M${ax + 60} ${ay - 34}v28`, WOOD[1], 3);
  // coffee machine
  s += shaded(rr(ax - 84, ay - 92, 46, 42, 6), METAL, LINE, -3, -3);
  s += flat(rr(ax - 76, ay - 84, 30, 10, 3), '#262833', LINE, 1.5);
  s += flat(rr(ax - 66, ay - 62, 12, 10, 2), PAPER[0], LINE, 1.5);
  // cake under a glass dome and a cup
  s += shaded(`M${ax + 30} ${ay - 58}a26 26 0 0 1 52 0Z`, ['#d9f2fc', '#b5e2f5'], LINE, -3, -3, 2);
  s += flat(rr(ax + 42, ay - 72, 28, 14, 3), '#ff7aa8', LINE, 1.5);
  s += flat(rr(ax - 20, ay - 70, 16, 14, 3), '#ffffff', LINE, 1.5);
  return { ...c, body: s };
}

function table(round = true, tone: Tone = WOOD): Prop {
  const c = canvas(1, 1.25);
  const { ax, ay } = c;
  let s = shadow(ax, ay, 26, 6);
  s += shaded(rr(ax - 4, ay - 30, 8, 30, 2), ['#3a3d4a', '#262833'], LINE, -1, 0, 2);
  s += shaded(rr(ax - 18, ay - 4, 36, 6, 3), ['#3a3d4a', '#262833'], LINE, 0, 0, 2);
  s += round
    ? shaded(`M${ax - 30} ${ay - 36}a30 13 0 1 0 60 0a30 13 0 1 0 -60 0Z`, tone, LINE, -4, -3)
    : shaded(rr(ax - 30, ay - 48, 60, 22, 4), tone, LINE, -4, -3);
  s += flat(rr(ax - 8, ay - 46, 12, 10, 3), '#ffffff', LINE, 1.5);
  return { ...c, body: s };
}

function chair(tone: Tone = WOOD): Prop {
  const c = canvas(1, 1.2);
  const { ax, ay } = c;
  return {
    ...c,
    body:
      shadow(ax, ay, 18, 5) +
      shaded(rr(ax - 16, ay - 54, 32, 30, 5), tone, LINE, -3, -3) +
      shaded(rr(ax - 18, ay - 28, 36, 12, 4), tone, LINE, -3, -2) +
      stroke(`M${ax - 14} ${ay - 16}V${ay}M${ax + 14} ${ay - 16}V${ay}`, tone[1], 4),
  };
}

function shelf(contents: 'sloiki' | 'ksiazki' | 'narzedzia', seed: number): Prop {
  const c = canvas(1, 2.3);
  const { ax, ay } = c;
  const r = rng(seed);
  const x0 = ax - 30;
  let s =
    shadow(ax, ay, 32, 6) + shaded(rr(x0, ay - 128, 60, 128, 4), WOOD_DARK, WOOD_LINE, -3, -3);
  s += flat(rr(x0 + 6, ay - 122, 48, 116, 2), '#4f2f1c', WOOD_LINE, 1.5);
  const colors = ['#ff3d50', '#4cc7ff', '#ffc93c', '#a3e635', '#b45cff', '#ff9a1f', '#f6f2e9'];
  for (let k = 0; k < 3; k++) {
    const y = ay - 12 - k * 38;
    s += flat(rr(x0 + 4, y, 52, 6, 1), WOOD[0], WOOD_LINE, 1.5);
    let x = x0 + 9;
    while (x < x0 + 50) {
      const col = colors[Math.floor(r() * colors.length)]!;
      if (contents === 'ksiazki') {
        const bw = 6 + r() * 4;
        const bh = 22 + r() * 8;
        s += flat(rr(x, y - bh, bw, bh, 1), col, LINE, 1.2);
        x += bw + 1;
      } else if (contents === 'sloiki') {
        s +=
          flat(rr(x, y - 18, 12, 18, 3), '#d9f2fc', LINE, 1.2) +
          fill(rr(x + 2, y - 12, 8, 10, 2), col);
        x += 15;
      } else {
        s +=
          r() < 0.5
            ? stroke(`M${n(x + 4)} ${y}v-20m-4 0h8`, '#8a929e', 3)
            : flat(rr(x, y - 14, 14, 14, 2), col, LINE, 1.2);
        x += 16;
      }
    }
  }
  return { ...c, body: s };
}

function plant(): Prop {
  const c = canvas(1, 1.8);
  const { ax, ay } = c;
  return {
    ...c,
    body:
      shadow(ax, ay, 22, 5) +
      puffs(
        [
          [ax, ay - 70, 22],
          [ax - 18, ay - 54, 17],
          [ax + 18, ay - 56, 17],
          [ax, ay - 46, 16],
        ],
        LEAF2,
        '',
        5,
      ) +
      shaded(
        `M${ax - 18} ${ay - 32}H${ax + 18}L${ax + 14} ${ay}H${ax - 14}Z`,
        ['#d9744a', '#b85a35'],
        LINE,
        -3,
        -2,
      ),
  };
}

function desk(): Prop {
  const c = canvas(3, 1.8);
  const { ax, ay } = c;
  let s = shadow(ax, ay, 90, 7);
  s += block(ax, ay, 176, 34, 22, ['#c48a52', '#9a6537'], ['#8f5e3b', '#6b4229']);
  s += flat(rr(ax + 30, ay - 30, 50, 24, 3), '#6b4229', WOOD_LINE, 1.5);
  s += stroke(`M${ax + 50} ${ay - 18}h10`, '#ffc93c', 3);
  // monitor, keyboard, papers, mug
  s += shaded(rr(ax - 60, ay - 104, 64, 46, 5), ['#3a3d4a', '#262833'], LINE, -2, -2);
  s += flat(rr(ax - 54, ay - 98, 52, 34, 3), '#4cc7ff', LINE, 1.5);
  s += stroke(`M${ax - 46} ${ay - 90}l14 0M${ax - 46} ${ay - 82}l24 0`, '#ffffff', 2.5, 0.7);
  s += flat(rr(ax - 32, ay - 58, 8, 6, 1), '#262833', LINE, 1.2);
  s += flat(rr(ax - 60, ay - 54, 56, 8, 2), '#d6d0c4', LINE, 1.5);
  s += flat(rr(ax + 20, ay - 64, 34, 12, 2), PAPER[0], LINE, 1.5);
  s += flat(rr(ax + 64, ay - 66, 12, 12, 3), '#ff3d50', LINE, 1.5);
  return { ...c, body: s };
}

function cabinet(tone: Tone = ['#8a929e', '#6f7783']): Prop {
  const c = canvas(1, 1.7);
  const { ax, ay } = c;
  let s = shadow(ax, ay, 28, 6) + block(ax, ay, 52, 76, 12, [tone[0], tone[1]], tone);
  for (const y of [ay - 66, ay - 42, ay - 18])
    s +=
      flat(rr(ax - 20, y, 40, 18, 2), tone[1], LINE, 1.5) +
      stroke(`M${ax - 7} ${y + 9}h14`, '#d6d0c4', 3);
  return { ...c, body: s };
}

function bars(): Prop {
  const w = T;
  const h = 2.2 * T;
  const ay = h - 6;
  let s = fill(`M0 ${ay - 6}H${w}V${ay}H0Z`, '#262833');
  s += fill(`M0 ${ay - 128}H${w}V${ay - 120}H0Z`, '#3a3d4a');
  for (const x of [8, 24, 40, 56])
    s += shaded(rr(x - 3, ay - 124, 6, 120, 3), ['#8a929e', '#5d6470'], LINE, -1, 0, 1.5);
  return { w, h, ax: w / 2, ay, foot: [1, 1], body: s };
}

function cooler(): Prop {
  const c = canvas(1, 1.9);
  const { ax, ay } = c;
  return {
    ...c,
    body:
      shadow(ax, ay, 22, 5) +
      shaded(rr(ax - 18, ay - 62, 36, 62, 5), PAPER, LINE, -3, -3) +
      shaded(
        `M${ax - 15} ${ay - 64}V${ay - 100}Q${ax} ${ay - 112} ${ax + 15} ${ay - 100}V${ay - 64}Z`,
        ['#a9dcf5', '#7cc0e6'],
        LINE,
        -3,
        -3,
      ) +
      flat(rr(ax - 10, ay - 50, 8, 8, 2), '#4cc7ff', LINE, 1.2) +
      flat(rr(ax + 2, ay - 50, 8, 8, 2), '#ff3d50', LINE, 1.2),
  };
}

function workbench(): Prop {
  const c = canvas(3, 1.8);
  const { ax, ay } = c;
  let s = shadow(ax, ay, 92, 7);
  s += stroke(`M${ax - 80} ${ay - 40}V${ay}M${ax + 80} ${ay - 40}V${ay}`, '#5a3a22', 7);
  s += shaded(rr(ax - 88, ay - 56, 176, 22, 4), WOOD, WOOD_LINE, -4, -3);
  s += flat(rr(ax - 80, ay - 24, 160, 6, 2), WOOD[1], WOOD_LINE, 1.5);
  // vice, toolbox, wrench, spray cans
  s += shaded(rr(ax - 78, ay - 78, 30, 24, 3), ['#4c8fd6', '#36689f'], LINE, -2, -2);
  s += shaded(rr(ax - 30, ay - 76, 50, 22, 4), ['#ff3d50', '#bd1c31'], LINE, -2, -2);
  s += stroke(`M${ax - 18} ${ay - 76}v-6h26v6`, LINE, 3);
  s += stroke(`M${ax + 32} ${ay - 60}l28 -6`, '#8a929e', 5);
  for (const [x, col] of [
    [ax + 66, '#a3e635'],
    [ax + 78, '#ffc93c'],
  ] as const)
    s += shaded(rr(x - 5, ay - 82, 10, 24, 3), [col, col], LINE, 0, 0, 1.5);
  return { ...c, body: s };
}

function crate(tone: Tone = WOOD): Prop {
  const c = canvas(1, 1.25);
  const { ax, ay } = c;
  let s = shadow(ax, ay, 28, 6) + block(ax, ay, 50, 38, 12, tone, [tone[1], '#7a5232']);
  s += stroke(`M${ax - 22} ${ay - 34}l44 30M${ax + 22} ${ay - 34}l-44 30`, WOOD_LINE, 3, 0.6);
  return { ...c, body: s };
}

function bed(blanket: Tone): Prop {
  const c = canvas(1, 2.4, 2);
  const { ax, ay } = c;
  const top = ay - 2 * T + 4;
  let s = shadow(ax, ay, 32, 6);
  s += shaded(rr(ax - 30, top - 14, 60, 2 * T + 10, 6), WOOD_DARK, WOOD_LINE, -3, -3);
  s += shaded(rr(ax - 26, top, 52, 2 * T - 12, 6), PAPER, LINE, -3, -3);
  s += shaded(rr(ax - 20, top + 6, 40, 20, 8), ['#ffffff', '#e4dccb'], LINE, -2, -2);
  s += shaded(rr(ax - 27, top + 34, 54, 2 * T - 46, 6), blanket, LINE, -4, -3);
  s += stroke(`M${ax - 26} ${top + 46}H${ax + 26}`, '#ffffff', 3, 0.5);
  return { ...c, body: s };
}

function rug(a: string, b: string, woven = false): Prop {
  const w = 3 * T;
  const h = 2 * T;
  const ay = h - 0.1 * T;
  let s = flat(rr(8, 10, w - 16, h - 22, 10), a, LINE, 2.5);
  s += stroke(rr(20, 22, w - 40, h - 46, 6), b, 4);
  if (woven) for (let x = 30; x < w - 30; x += 16) s += stroke(`M${x} 30v${h - 62}`, b, 2, 0.5);
  else s += flat(`M${w / 2} ${h / 2 - 24}l26 20l-26 20l-26 -20Z`, b, LINE, 1.5);
  return { w, h, ax: w / 2, ay, flat: true, body: s };
}

function fireplace(): Prop {
  const c = canvas(3, 2.9);
  const { ax, ay } = c;
  let s = shadow(ax, ay, 90, 7);
  s += shaded(rr(ax - 84, ay - 130, 168, 130, 6), ['#dcd8d1', '#bdb7ae'], '#5d5853', -6, -4);
  s += shaded(rr(ax - 94, ay - 140, 188, 18, 5), ['#c48a52', '#9a6537'], WOOD_LINE, -3, -3);
  s += shaded(
    `M${ax - 50} ${ay}V${ay - 70}Q${ax} ${ay - 112} ${ax + 50} ${ay - 70}V${ay}Z`,
    ['#3a3d4a', '#1a1c22'],
    LINE,
    0,
    0,
  );
  s += fill(
    `M${ax - 30} ${ay - 6}Q${ax - 34} ${ay - 40} ${ax - 12} ${ay - 60}Q${ax - 10} ${ay - 34} ${ax} ${ay - 44}Q${ax + 6} ${ay - 70} ${ax + 22} ${ay - 52}Q${ax + 34} ${ay - 30} ${ax + 30} ${ay - 6}Z`,
    '#ff9a1f',
  );
  s += fill(
    `M${ax - 16} ${ay - 6}Q${ax - 18} ${ay - 30} ${ax - 2} ${ay - 40}Q${ax + 2} ${ay - 24} ${ax + 12} ${ay - 30}Q${ax + 20} ${ay - 16} ${ax + 16} ${ay - 6}Z`,
    '#ffe27a',
  );
  s += stroke(`M${ax - 36} ${ay - 4}h72`, '#6b4229', 6);
  // candlesticks and a clock on the mantel
  for (const x of [ax - 70, ax + 70])
    s +=
      flat(rr(x - 3, ay - 162, 6, 22, 1), '#ffc93c', LINE, 1.2) +
      fill(circ(x, ay - 166, 4), '#ffe27a');
  s +=
    shaded(rr(ax - 16, ay - 170, 32, 30, 6), ['#ffc93c', '#d98a0b'], LINE, -2, -2) +
    flat(circ(ax, ay - 155, 9), '#ffffff', LINE, 1.5);
  return { ...c, body: s };
}

function armchair(tone: Tone): Prop {
  const c = canvas(1, 1.5);
  const { ax, ay } = c;
  return {
    ...c,
    body:
      shadow(ax, ay, 30, 6) +
      shaded(rr(ax - 28, ay - 76, 56, 50, 12), tone, LINE, -4, -3) +
      shaded(rr(ax - 30, ay - 36, 60, 30, 8), tone, LINE, -3, -2) +
      shaded(rr(ax - 34, ay - 50, 14, 40, 6), tone, LINE, -2, -2) +
      shaded(rr(ax + 20, ay - 50, 14, 40, 6), tone, LINE, -2, -2) +
      stroke(`M${ax - 22} ${ay - 6}v6M${ax + 22} ${ay - 6}v6`, '#3a2414', 4),
  };
}

function longTable(): Prop {
  const c = canvas(5, 2.3, 2);
  const { ax, ay } = c;
  const top = ay - 2 * T + 18;
  let s = shadow(ax, ay, 150, 8);
  s += shaded(rr(ax - 150, top, 300, 2 * T - 44, 8), ['#8f5e3b', '#6b4229'], WOOD_LINE, -5, -4);
  s += shaded(rr(ax - 150, ay - 30, 300, 24, 6), ['#6b4229', '#4f2f1c'], WOOD_LINE, -2, -2);
  s += flat(rr(ax - 130, top + 18, 260, 40, 6), '#f6f2e9', LINE, 1.5);
  for (const x of [ax - 100, ax - 40, ax + 40, ax + 100])
    s += flat(circ(x, top + 38, 10), '#ffffff', LINE, 1.5);
  for (const x of [ax - 70, ax + 70])
    s +=
      flat(rr(x - 3, top + 4, 6, 30, 1), '#ffc93c', LINE, 1.2) + fill(circ(x, top, 5), '#ffe27a');
  s += shaded(`M${ax - 20} ${top + 40}a20 12 0 0 1 40 0Z`, ['#ff3d50', '#bd1c31'], LINE, -2, -2);
  return { ...c, body: s };
}

function clock(): Prop {
  const c = canvas(1, 2.6);
  const { ax, ay } = c;
  return {
    ...c,
    body:
      shadow(ax, ay, 22, 5) +
      shaded(rr(ax - 20, ay - 150, 40, 150, 6), WOOD_DARK, WOOD_LINE, -3, -3) +
      shaded(
        `M${ax - 24} ${ay - 146}Q${ax} ${ay - 170} ${ax + 24} ${ay - 146}Z`,
        WOOD_DARK,
        WOOD_LINE,
        -2,
        -2,
      ) +
      flat(circ(ax, ay - 124, 15), '#f6f2e9', LINE, 2) +
      stroke(`M${ax} ${ay - 124}v-10M${ax} ${ay - 124}l7 4`, LINE, 2.5) +
      flat(rr(ax - 10, ay - 96, 20, 60, 4), '#4f2f1c', WOOD_LINE, 1.5) +
      stroke(`M${ax} ${ay - 94}v40`, '#ffc93c', 2) +
      flat(circ(ax, ay - 50, 7), '#ffc93c', LINE, 1.5),
  };
}

function safe(): Prop {
  const c = canvas(1, 1.4);
  const { ax, ay } = c;
  return {
    ...c,
    body:
      shadow(ax, ay, 28, 6) +
      block(ax, ay, 54, 58, 12, ['#5d6470', '#4a505c'], ['#4a505c', '#363a47']) +
      flat(rr(ax - 18, ay - 50, 36, 40, 4), '#363a47', LINE, 1.5) +
      flat(circ(ax, ay - 30, 10), '#b7bec9', LINE, 2) +
      stroke(`M${ax} ${ay - 30}l6 -5`, LINE, 2.5) +
      flat(rr(ax + 10, ay - 34, 6, 10, 2), '#ffc93c', LINE, 1.2),
  };
}

function benchPress(): Prop {
  const c = canvas(3, 1.7);
  const { ax, ay } = c;
  let s = shadow(ax, ay, 86, 7);
  s += stroke(`M${ax - 50} ${ay - 70}V${ay}M${ax + 50} ${ay - 70}V${ay}`, '#3a3d4a', 6);
  s += shaded(rr(ax - 40, ay - 34, 80, 18, 6), ['#ff3d50', '#bd1c31'], LINE, -3, -2);
  s += stroke(`M${ax - 30} ${ay - 16}V${ay}M${ax + 30} ${ay - 16}V${ay}`, '#262833', 4);
  s += stroke(`M${ax - 86} ${ay - 72}H${ax + 86}`, '#b7bec9', 5);
  for (const x of [ax - 78, ax - 66, ax + 66, ax + 78])
    s += shaded(rr(x - 5, ay - 92, 10, 40, 3), ['#3a3d4a', '#262833'], LINE, -1, -1, 2);
  return { ...c, body: s };
}

function punchingBag(): Prop {
  const c = canvas(1, 2.5);
  const { ax, ay } = c;
  return {
    ...c,
    body:
      shadow(ax, ay, 22, 5) +
      stroke(`M${ax} ${ay - 156}V${ay - 120}`, '#8a929e', 3) +
      shaded(rr(ax - 20, ay - 124, 40, 96, 16), ['#ff3d50', '#bd1c31'], LINE, -4, -3) +
      flat(rr(ax - 20, ay - 96, 40, 10, 0), '#262833', LINE, 1.5),
  };
}

function dumbbells(): Prop {
  const c = canvas(3, 1.4);
  const { ax, ay } = c;
  let s = shadow(ax, ay, 86, 6);
  s += shaded(rr(ax - 84, ay - 30, 168, 14, 4), ['#3a3d4a', '#262833'], LINE, -2, -2);
  s += stroke(`M${ax - 76} ${ay - 16}V${ay}M${ax + 76} ${ay - 16}V${ay}`, '#262833', 5);
  for (let i = 0; i < 5; i++) {
    const x = ax - 64 + i * 32;
    const r = 7 + i * 1.2;
    s += stroke(`M${x - 10} ${ay - 38}h20`, '#b7bec9', 4);
    s +=
      flat(circ(x - 10, ay - 38, r), '#262833', LINE, 1.5) +
      flat(circ(x + 10, ay - 38, r), '#262833', LINE, 1.5);
  }
  return { ...c, body: s };
}

function sofa(tone: Tone, worn = false): Prop {
  const c = canvas(3, 1.6);
  const { ax, ay } = c;
  let s = shadow(ax, ay, 94, 7);
  s += shaded(rr(ax - 90, ay - 80, 180, 48, 14), tone, LINE, -5, -3);
  s += shaded(rr(ax - 90, ay - 44, 180, 36, 10), tone, LINE, -4, -2);
  s += stroke(`M${ax} ${ay - 44}v34`, tone[1], 3);
  s += shaded(rr(ax - 98, ay - 60, 20, 52, 8), tone, LINE, -2, -2);
  s += shaded(rr(ax + 78, ay - 60, 20, 52, 8), tone, LINE, -2, -2);
  if (worn) {
    s += flat(
      poly([
        [ax - 50, ay - 36],
        [ax - 30, ay - 40],
        [ax - 26, ay - 24],
        [ax - 46, ay - 22],
      ]),
      '#c9b593',
      LINE,
      1.2,
    );
    s += stroke(`M${ax + 30} ${ay - 70}l8 10l-6 8`, '#f6f2e9', 2, 0.7);
  }
  return { ...c, body: s };
}

function tv(): Prop {
  const c = canvas(1, 1.7);
  const { ax, ay } = c;
  return {
    ...c,
    body:
      shadow(ax, ay, 28, 6) +
      block(ax, ay, 54, 30, 10, WOOD_DARK, ['#6b4229', '#4f2f1c']) +
      shaded(rr(ax - 26, ay - 92, 52, 48, 8), ['#5d5853', '#45413d'], LINE, -3, -3) +
      flat(rr(ax - 20, ay - 86, 36, 34, 6), '#3a6e5a', LINE, 1.5) +
      stroke(`M${ax - 14} ${ay - 80}l10 0`, '#ffffff', 3, 0.6) +
      stroke(`M${ax - 8} ${ay - 92}l-10 -14M${ax + 8} ${ay - 92}l10 -14`, LINE, 2),
  };
}

function floorLamp(): Prop {
  const c = canvas(1, 2.3);
  const { ax, ay } = c;
  return {
    ...c,
    body:
      shadow(ax, ay, 18, 5) +
      shaded(rr(ax - 14, ay - 8, 28, 8, 4), ['#3a3d4a', '#262833'], LINE, 0, 0, 2) +
      stroke(`M${ax} ${ay - 8}V${ay - 112}`, '#3a3d4a', 4) +
      shaded(
        `M${ax - 22} ${ay - 108}L${ax - 14} ${ay - 140}H${ax + 14}L${ax + 22} ${ay - 108}Z`,
        ['#ffe27a', '#ffc93c'],
        LINE,
        -3,
        -2,
      ),
  };
}

const doormat = (): Prop => {
  const w = 3 * T;
  const h = T;
  const ay = h - 0.1 * T;
  return {
    w,
    h,
    ax: w / 2,
    ay,
    flat: true,
    body:
      flat(rr(26, 10, w - 52, h - 22, 6), '#8f5e3b', LINE, 2.5) +
      stroke(rr(36, 18, w - 72, h - 38, 4), '#c48a52', 3),
  };
};

/** One-tile mat outside a door you can walk through: the lime trim says "this one opens". */
const entranceMat = (): Prop => {
  const w = T;
  const h = T;
  const ay = h - 0.1 * T;
  return {
    w,
    h,
    ax: w / 2,
    ay,
    flat: true,
    body:
      flat(rr(6, 14, w - 12, h - 30, 6), '#8f5e3b', LINE, 2.5) +
      stroke(rr(12, 20, w - 24, h - 42, 4), '#a3e635', 3.5) +
      stroke(`M${w / 2 - 8} ${h / 2 - 2}l8 -7l8 7`, '#a3e635', 3.5),
  };
};

// ---------- caches (skrytki) ----------

/** A hidden cache: looks like ordinary junk until you search it; opened = emptied. */
function cache(
  kind: 'skrzynka' | 'worek' | 'kufer' | 'cegly' | 'dzban' | 'opona',
  open: boolean,
): Prop {
  const w = 1.1 * T;
  const h = 1.3 * T;
  const ax = w / 2;
  const ay = h - 6;
  let s = shadow(ax, ay, 26, 6);
  switch (kind) {
    case 'skrzynka':
      s += block(ax, ay, 46, 32, 10, WOOD, [WOOD[1], '#7a5232'], WOOD_LINE);
      s += stroke(`M${ax - 20} ${ay - 28}l40 24`, WOOD_LINE, 3, 0.6);
      if (open)
        s +=
          shaded(rr(ax - 26, ay - 68, 52, 12, 3), WOOD, WOOD_LINE, -2, -2) +
          fill(rr(ax - 20, ay - 44, 40, 6, 2), '#4f2f1c');
      break;
    case 'kufer':
      s += shaded(rr(ax - 26, ay - 30, 52, 30, 4), WOOD_DARK, WOOD_LINE, -3, -3);
      s += open
        ? shaded(
            `M${ax - 26} ${ay - 32}L${ax - 22} ${ay - 64}H${ax + 22}L${ax + 26} ${ay - 32}Z`,
            WOOD_DARK,
            WOOD_LINE,
            -2,
            -2,
          ) + fill(rr(ax - 22, ay - 34, 44, 6, 2), '#2a1a10')
        : shaded(
            `M${ax - 26} ${ay - 30}V${ay - 40}Q${ax} ${ay - 60} ${ax + 26} ${ay - 40}V${ay - 30}Z`,
            WOOD_DARK,
            WOOD_LINE,
            -2,
            -2,
          ) + flat(rr(ax - 6, ay - 36, 12, 12, 2), '#ffc93c', LINE, 1.5);
      s += stroke(`M${ax - 16} ${ay - 30}V${ay}M${ax + 16} ${ay - 30}V${ay}`, '#ffc93c', 3, 0.8);
      break;
    case 'worek':
      s += open
        ? shaded(
            `M${ax - 26} ${ay}Q${ax - 30} ${ay - 14} ${ax - 10} ${ay - 18}Q${ax + 12} ${ay - 22} ${ax + 26} ${ay - 8}Q${ax + 28} ${ay} ${ax + 20} ${ay}Z`,
            ['#c9b593', '#a8946f'],
            LINE,
            -3,
            -2,
          )
        : shaded(
            `M${ax - 24} ${ay}Q${ax - 30} ${ay - 34} ${ax - 8} ${ay - 44}L${ax - 4} ${ay - 54}H${ax + 6}L${ax + 8} ${ay - 44}Q${ax + 30} ${ay - 34} ${ax + 24} ${ay}Z`,
            ['#c9b593', '#a8946f'],
            LINE,
            -4,
            -3,
          ) + stroke(`M${ax - 8} ${ay - 46}h16`, '#6b4229', 3);
      break;
    case 'cegly': {
      const brick: Tone = ['#c8674f', '#a3523a'];
      const spots = open
        ? [
            [-18, 0],
            [8, 0],
            [-30, -12],
          ]
        : [
            [-18, 0],
            [8, 0],
            [-6, -14],
            [20, -14],
            [-30, -14],
            [6, -28],
          ];
      for (const [dx, dy] of spots)
        s += shaded(rr(ax + dx! - 12, ay + dy! - 14, 24, 14, 2), brick, '#5a2a20', -2, -2, 2);
      break;
    }
    case 'dzban':
      s += open
        ? shaded(
            `M${ax - 26} ${ay}Q${ax - 30} ${ay - 18} ${ax - 14} ${ay - 22}L${ax + 4} ${ay - 18}L${ax - 2} ${ay}Z`,
            ['#d9744a', '#b85a35'],
            LINE,
            -2,
            -2,
          ) +
          shaded(
            `M${ax + 4} ${ay}L${ax + 10} ${ay - 16}L${ax + 26} ${ay - 10}L${ax + 22} ${ay}Z`,
            ['#d9744a', '#b85a35'],
            LINE,
            -2,
            -2,
          )
        : shaded(
            `M${ax - 12} ${ay}Q${ax - 30} ${ay - 22} ${ax - 14} ${ay - 46}H${ax + 14}Q${ax + 30} ${ay - 22} ${ax + 12} ${ay}Z`,
            ['#d9744a', '#b85a35'],
            LINE,
            -4,
            -3,
          ) +
          shaded(rr(ax - 12, ay - 54, 24, 10, 3), ['#d9744a', '#b85a35'], LINE, -1, -1) +
          stroke(`M${ax - 20} ${ay - 26}h40`, '#ffc93c', 3, 0.7);
      break;
    case 'opona':
      s += `<ellipse cx="${ax}" cy="${ay - 12}" rx="28" ry="12" fill="#2a2a30" stroke="${LINE}" stroke-width="2.5"/>`;
      s += `<ellipse cx="${ax}" cy="${ay - 15}" rx="12" ry="5" fill="${open ? '#1a1a1f' : '#5d5853'}"/>`;
      if (!open) s += flat(rr(ax - 8, ay - 26, 16, 10, 2), '#c9b593', LINE, 1.5);
      break;
  }
  return { w, h, ax, ay, body: s };
}

/** The glint over a cache you've noticed (drawn above it, twinkles in the game). */
const sparkle = (): Prop => {
  const w = 0.7 * T;
  const h = 0.7 * T;
  const c = w / 2;
  const star = (cx: number, cy: number, r: number) =>
    `M${cx} ${cy - r}Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy}Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r}Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy}Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r}Z`;
  return {
    w,
    h,
    ax: c,
    ay: h - 2,
    body:
      `<path d="${star(c, c, 18)}" fill="#ffe27a" stroke="#d98a0b" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<path d="${star(c + 13, c - 10, 6)}" fill="#ffffff" stroke="#d98a0b" stroke-width="1.5"/>` +
      fill(circ(c - 4, c - 4, 3), '#ffffff', 0.9),
  };
};

export const CACHE_KINDS = ['skrzynka', 'worek', 'kufer', 'cegly', 'dzban', 'opona'] as const;

const walls: Record<string, Prop> = {};
let seed = 700;
for (const [name, theme] of Object.entries(WALL_THEMES))
  for (const v of ['a', 'okno', 'obraz'] as const)
    walls[`sciana-${name}-${v}`] = wall(theme, v, seed++);

const caches: Record<string, Prop> = {};
for (const k of CACHE_KINDS) {
  caches[`skrytka-${k}`] = cache(k, false);
  caches[`skrytka-${k}-pusta`] = cache(k, true);
}

export const INTERIOR: Record<string, Prop> = {
  ...walls,
  'podloga-deski': floor('deski'),
  'podloga-deski-stare': floor('deski-stare'),
  'podloga-parkiet': floor('parkiet'),
  'podloga-kafle': floor('kafle'),
  'podloga-beton': floor('beton'),
  'podloga-guma': floor('guma'),
  lada: counter(),
  stolik: table(),
  'stolik-kwadrat': table(false, ['#f6f2e9', '#ddd5c4']),
  krzeslo: chair(),
  'krzeslo-metal': chair(['#8a929e', '#6f7783']),
  'regal-sloiki': shelf('sloiki', 81),
  'regal-ksiazki': shelf('ksiazki', 82),
  'regal-narzedzia': shelf('narzedzia', 83),
  roslina: plant(),
  biurko: desk(),
  szafka: cabinet(),
  'szafka-zielona': cabinet(['#6b7a5a', '#55634a']),
  krata: bars(),
  dystrybutor: cooler(),
  warsztat: workbench(),
  skrzynka: crate(),
  'lozko-a': bed(['#4cc7ff', '#1b86c9']),
  'lozko-b': bed(['#ff7aa8', '#d95a88']),
  'dywan-czerwony': rug('#bd1c31', '#ffc93c'),
  'dywan-plecionka': rug('#dcb873', '#a3803f', true),
  'dywan-zielony': rug('#3fb39b', '#f6f2e9'),
  kominek: fireplace(),
  fotel: armchair(['#8a2f3c', '#6e2430']),
  'stol-dlugi': longTable(),
  zegar: clock(),
  sejf: safe(),
  'lawka-sztanga': benchPress(),
  'worek-bokserski': punchingBag(),
  hantle: dumbbells(),
  kanapa: sofa(['#4c8fd6', '#36689f']),
  'kanapa-stara': sofa(['#8a7a5a', '#6b5d44'], true),
  telewizor: tv(),
  'lampa-stojaca': floorLamp(),
  wycieraczka: doormat(),
  'wycieraczka-wejscie': entranceMat(),
  ...caches,
  blysk: sparkle(),
};
