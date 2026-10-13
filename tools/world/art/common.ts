// Props shared by every district: trees, bushes, rocks, cottages, signs, fences, flowers, street furniture.
import {
  BARK,
  BARK_LINE,
  LEAF,
  LEAF2,
  LEAF3,
  LINE,
  STONE,
  STONE_LIGHT,
  STONE_LINE,
  T,
  WOOD,
  WOOD_LINE,
  circ,
  door,
  fill,
  flat,
  frame,
  n,
  puffs,
  rr,
  shaded,
  shadow,
  stroke,
  windowAt,
  type Prop,
  type Tone,
} from './kit';

export function tree(leaf: typeof LEAF, fruit?: string): Prop {
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
  const clumps = [
    [ax - 20, 80],
    [ax + 14, 92],
    [ax - 4, 60],
    [ax + 30, 72],
    [ax - 34, 104],
  ]
    .map(([x, y]) => stroke(`M${x! - 9} ${y}q9 7 18 0`, leaf.dark, 3.5))
    .join('');
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay - 2, 42, 11) +
      shaded(trunk, BARK, BARK_LINE, -4, 0) +
      puffs(crown, leaf, clumps + dots),
  };
}

export function bush(flowers?: string, leaf = LEAF2): Prop {
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
    foot: [1, 1],
    body:
      shadow(ax, ay, 34, 8) +
      puffs(
        [
          [ax - 16, ay - 20, 18],
          [ax + 16, ay - 20, 19],
          [ax, ay - 32, 20],
          [ax, ay - 14, 18],
        ],
        leaf,
        dots,
      ),
  };
}

export function rock(
  big: boolean,
  tone: Tone = STONE,
  line = STONE_LINE,
  light = STONE_LIGHT,
): Prop {
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
    foot: [1, 1],
    body:
      shadow(ax, ay, 38 * s, 7 * s) +
      shaded(d, tone, line, -6, -7) +
      stroke(`M${ax + 4 * s} ${ay - 34 * s}l-6 ${10 * s}l8 ${6 * s}`, tone[1], 3) +
      `<ellipse cx="${ax - 14 * s}" cy="${ay - 30 * s}" rx="${8 * s}" ry="${4 * s}" fill="${light}" transform="rotate(-20 ${ax - 14 * s} ${ay - 30 * s})"/>`,
  };
}

/** 5×3-tile cottage: the footprint's bottom edge is the anchor, the roof rises above it. */
export function house(roof: [string, string, string]): Prop {
  const { w, h, ax, ay, L } = frame([5, 3], 4.1);
  const line = '#4a3326';
  const wallTop = ay - 1.6 * T;
  const eave = wallTop - 2;
  const top = ay - 3.75 * T;
  const roofD = `M${L - 12} ${eave}L${L + 26} ${top + 22}Q${L + 32} ${top} ${L + 56} ${top}H${L + 5 * T - 56}Q${L + 5 * T - 32} ${top} ${L + 5 * T - 26} ${top + 22}L${L + 5 * T + 12} ${eave}Q${L + 5 * T + 14} ${eave + 14} ${L + 5 * T} ${eave + 14}H${L}Q${L - 14} ${eave + 14} ${L - 12} ${eave}Z`;
  const rows = [0.3, 0.52, 0.74]
    .map((t) => {
      const y = top + (eave - top) * t;
      const edge = L - 12 + (38 * (eave - y)) / (eave - top - 22);
      const span = L + 5 * T - edge - (edge - L) - 2 * 10;
      const count = Math.floor(span / 20);
      let d = `M${n(ax - (count * 20) / 2)} ${n(y)}`;
      for (let i = 0; i < count; i++) d += `q10 9 20 0`;
      return stroke(d, roof[1], 4);
    })
    .join('');
  const win = (cx: number) =>
    windowAt(cx - 22, wallTop + 26, 44, 38, { line, r: 10, cross: true }) +
    shaded(rr(cx - 26, wallTop + 64, 52, 12, 4), WOOD, line, -2, -2) +
    [cx - 16, cx - 4, cx + 8, cx + 18]
      .map(
        (x, i) =>
          `<circle cx="${x}" cy="${wallTop + 62}" r="5" fill="${['#ff7aa8', '#ffd23f', '#ffffff', '#ff7aa8'][i]}" stroke="${line}" stroke-width="1.5"/>`,
      )
      .join('');
  return {
    w,
    h,
    ax,
    ay,
    foot: [5, 3],
    body:
      shadow(ax, ay - 2, 2.6 * T, 12, 0.22) +
      shaded(rr(L + 3.6 * T, top - 26, 30, 70, 6), ['#d27a5a', '#a85a40'], line, -3, -3) +
      shaded(rr(L + 3.6 * T - 4, top - 30, 38, 12, 5), STONE, line, -2, -2) +
      shaded(
        rr(L + 8, wallTop, 5 * T - 16, ay - wallTop - 4, 8),
        ['#f7ecd6', '#e1cfaf'],
        line,
        -8,
        -4,
      ) +
      shaded(rr(L + 4, ay - 18, 5 * T - 8, 16, 6), STONE, line, -3, -3) +
      door(ax, ay - 6, 44, ay - 6 - (wallTop + 16), WOOD, line, true) +
      win(L + 0.5 * T + 6) +
      win(L + 4.5 * T - 6) +
      shaded(roofD, [roof[0], roof[1]], line, -6, -8) +
      rows +
      stroke(`M${L + 60} ${top + 8}H${L + 5 * T - 60}`, roof[2], 6, 0.9),
  };
}

export function sign(): Prop {
  const w = 1.6 * T;
  const h = 1.8 * T;
  const ax = w / 2;
  const ay = h - 8;
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 40, 8) +
      shaded(rr(ax - 32, ay - 62, 10, 62, 3), [WOOD[1], '#5a3a22'], WOOD_LINE, -2, 0) +
      shaded(rr(ax + 22, ay - 62, 10, 62, 3), [WOOD[1], '#5a3a22'], WOOD_LINE, -2, 0) +
      shaded(rr(ax - 42, ay - 96, 84, 52, 8), WOOD, WOOD_LINE, -4, -4) +
      shaded(
        `M${ax - 50} ${ay - 94}L${ax} ${ay - 112}L${ax + 50} ${ay - 94}Z`,
        ['#e0614a', '#b8463a'],
        WOOD_LINE,
        -3,
        -3,
      ) +
      `<rect x="${ax - 34}" y="${ay - 88}" width="30" height="34" rx="2" fill="#f6f2e9" stroke="${WOOD_LINE}" stroke-width="2" transform="rotate(-4 ${ax - 19} ${ay - 71})"/>` +
      `<rect x="${ax + 2}" y="${ay - 86}" width="30" height="26" rx="2" fill="#fff6c9" stroke="${WOOD_LINE}" stroke-width="2" transform="rotate(5 ${ax + 17} ${ay - 73})"/>` +
      stroke(
        `M${ax - 28} ${ay - 78}h18M${ax - 28} ${ay - 70}h14M${ax + 8} ${ay - 76}h16`,
        '#a9afbd',
        2.5,
      ) +
      `<circle cx="${ax - 19}" cy="${ay - 86}" r="3" fill="#ff3d50"/><circle cx="${ax + 17}" cy="${ay - 84}" r="3" fill="#4cc7ff"/>`,
  };
}

/** Fence kit: post, rails to the east neighbour, rails up to the north neighbour. */
export function fenceKit(
  tone: Tone,
  line: string,
  opts: { postW?: number; postH?: number; mesh?: boolean } = {},
) {
  const pw = opts.postW ?? 14;
  const ph = opts.postH ?? 38;
  const post: Prop = {
    w: pw + 14,
    h: ph + 14,
    ax: (pw + 14) / 2,
    ay: ph + 8,
    foot: [1, 1],
    body:
      shadow((pw + 14) / 2, ph + 8, pw * 0.9, 4) + shaded(rr(7, 8, pw, ph, 5), tone, line, -3, -2),
  };
  const railsH = opts.mesh
    ? flat(`M4 ${16}H${T + 4}V${ph + 4}H4Z`, 'none', line, 0) +
      stroke(
        Array.from(
          { length: 9 },
          (_, i) => `M${4 + i * 8} ${12}l8 ${ph - 8}M${4 + i * 8 + 8} ${12}l-8 ${ph - 8}`,
        ).join(''),
        tone[1],
        1.6,
        0.85,
      ) +
      shaded(rr(4, 10, T, 5, 2), tone, line, 0, -1, 2)
    : shaded(rr(4, 16, T, 8, 3), tone, line, 0, -2) + shaded(rr(4, 30, T, 8, 3), tone, line, 0, -2);
  const h: Prop = { w: T + 8, h: ph + 14, ax: 4, ay: ph + 8, flat: false, body: railsH };
  const v: Prop = {
    w: 24,
    h: T + ph + 14,
    ax: 12,
    ay: T + ph + 8,
    body: opts.mesh
      ? stroke(`M12 ${16}V${T + 16}`, tone[1], 6, 0.9) + stroke(`M12 ${16}V${T + 16}`, tone[0], 3)
      : shaded(rr(7, 24, 10, T + 6, 4), tone, line, -2, 0),
  };
  return { post, h, v };
}

export function flowers(petal: string, center: string): Prop {
  const w = 0.8 * T;
  const h = 0.6 * T;
  const ax = w / 2;
  const ay = h - 6;
  const flower = (x: number, y: number, r: number) =>
    [0, 72, 144, 216, 288]
      .map((a) => {
        const rad = (a * Math.PI) / 180;
        return `<circle cx="${n(x + Math.cos(rad) * r)}" cy="${n(y + Math.sin(rad) * r)}" r="${r * 0.75}" fill="${petal}" stroke="#3a5a2a" stroke-width="1.2"/>`;
      })
      .join('') + `<circle cx="${x}" cy="${y}" r="${r * 0.6}" fill="${center}"/>`;
  return {
    w,
    h,
    ax,
    ay,
    flat: true,
    body:
      stroke(
        `M${ax - 12} ${ay}q-2 -10 -6 -14M${ax} ${ay}v-18M${ax + 12} ${ay}q2 -10 6 -14`,
        '#3f8f3e',
        3,
      ) +
      `<ellipse cx="${ax - 6}" cy="${ay - 6}" rx="6" ry="3" fill="#4fa65a" transform="rotate(-30 ${ax - 6} ${ay - 6})"/>` +
      flower(ax - 16, ay - 16, 5) +
      flower(ax + 16, ay - 15, 5) +
      flower(ax, ay - 22, 6),
  };
}

export const tuft = (color = '#5fa843'): Prop => ({
  w: 32,
  h: 22,
  ax: 16,
  ay: 18,
  flat: true,
  body: stroke('M8 18q-1 -8 -5 -12M13 18q0 -10 -2 -15M18 18q1 -9 4 -13M23 18q2 -6 6 -9', color, 3),
});

export const pebbles = (a = '#d1b98a', b = '#f4e4bf'): Prop => ({
  w: 40,
  h: 20,
  ax: 20,
  ay: 16,
  flat: true,
  body:
    `<ellipse cx="13" cy="12" rx="7" ry="4.5" fill="${a}"/><ellipse cx="12" cy="11" rx="4" ry="2" fill="${b}"/>` +
    `<ellipse cx="28" cy="14" rx="5" ry="3.2" fill="${a}"/>`,
});

export const lily = (): Prop => ({
  w: 56,
  h: 36,
  ax: 28,
  ay: 30,
  flat: true,
  body:
    flat('M28 18L48 14A22 13 0 1 1 44 9Z', '#4fa65a', '#2e7a44', 2.5) +
    stroke('M14 20q8 -4 14 -2', '#7fcd5c', 2.5) +
    `<circle cx="20" cy="12" r="5" fill="#ff9fc0" stroke="#b84a74" stroke-width="1.5"/><circle cx="20" cy="12" r="2" fill="#ffd23f"/>`,
});

/** Street lamp; `gas` = ornate Victorian lantern. */
export function lamp(gas = false): Prop {
  const w = 0.9 * T;
  const h = 2.6 * T;
  const ax = w / 2;
  const ay = h - 8;
  const pole: Tone = gas ? ['#3a3d4a', '#262833'] : ['#5b6372', '#414856'];
  const line = '#1f2229';
  const head = gas
    ? shaded(poly4(ax, ay - 2.15 * T, 15, 30), ['#ffe9a8', '#f2c75c'], line, -3, -3) +
      shaded(
        `M${ax - 18} ${ay - 2.15 * T}L${ax} ${ay - 2.15 * T - 14}L${ax + 18} ${ay - 2.15 * T}Z`,
        pole,
        line,
        -2,
        -2,
      ) +
      `<circle cx="${ax}" cy="${n(ay - 2.15 * T + 15)}" r="18" fill="#ffd96a" opacity="0.25"/>`
    : shaded(rr(ax - 4, ay - 2.3 * T, 30, 12, 6), pole, line, -2, -2) +
      shaded(rr(ax + 8, ay - 2.3 * T + 10, 18, 8, 4), ['#fff3c4', '#ffd96a'], line, -1, -1) +
      `<ellipse cx="${ax + 17}" cy="${n(ay - 2.3 * T + 24)}" rx="20" ry="12" fill="#ffe27a" opacity="0.22"/>`;
  return {
    w: gas ? w : w + 24,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 14, 5) +
      shaded(rr(ax - 9, ay - 14, 18, 14, 4), pole, line, -2, -2) +
      shaded(
        rr(ax - 4, ay - (gas ? 2.15 : 2.3) * T + 6, 8, (gas ? 2.15 : 2.3) * T - 14, 3),
        pole,
        line,
        -2,
        0,
      ) +
      head,
  };
}

const poly4 = (cx: number, top: number, hw: number, hgt: number) =>
  `M${cx - hw * 0.7} ${top}H${cx + hw * 0.7}L${cx + hw} ${top + hgt}H${cx - hw}Z`;

export function bench(
  tone: Tone = WOOD,
  legs: Tone = ['#3a3d4a', '#262833'],
  ornate = false,
): Prop {
  const w = 1.8 * T;
  const h = 1.1 * T;
  const ax = w / 2;
  const ay = h - 8;
  const line = '#3a2a20';
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 52, 6) +
      shaded(rr(ax - 46, ay - 22, 8, 22, 3), legs, line, -1, 0) +
      shaded(rr(ax + 38, ay - 22, 8, 22, 3), legs, line, -1, 0) +
      shaded(rr(ax - 52, ay - 30, 104, 12, 4), tone, line, -2, -2) +
      shaded(rr(ax - 50, ay - 56, 100, 10, 4), tone, line, -2, -2) +
      shaded(rr(ax - 50, ay - 42, 100, 9, 4), tone, line, -2, -2) +
      (ornate
        ? stroke(`M${ax - 52} ${ay - 56}q-8 14 0 26M${ax + 52} ${ay - 56}q8 14 0 26`, legs[0], 4)
        : ''),
  };
}

export function bin(): Prop {
  const w = 0.8 * T;
  const h = 1.1 * T;
  const ax = w / 2;
  const ay = h - 6;
  const tone: Tone = ['#4f9a5a', '#3a7744'];
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 18, 5) +
      shaded(
        `M${ax - 15} ${ay - 46}H${ax + 15}L${ax + 12} ${ay}H${ax - 12}Z`,
        tone,
        '#24452a',
        -3,
        -2,
      ) +
      shaded(rr(ax - 18, ay - 52, 36, 9, 4), ['#5fb06b', '#3a7744'], '#24452a', -2, -2) +
      stroke(`M${ax - 6} ${ay - 38}v28M${ax + 6} ${ay - 38}v28`, tone[1], 3),
  };
}

export function planter(flowersColor = '#ff7aa8'): Prop {
  const w = 1.1 * T;
  const h = 1.1 * T;
  const ax = w / 2;
  const ay = h - 6;
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 26, 6) +
      puffs(
        [
          [ax - 12, ay - 34, 13],
          [ax + 12, ay - 34, 13],
          [ax, ay - 42, 13],
        ],
        LEAF,
        [ax - 12, ax + 2, ax + 14]
          .map(
            (x, i) =>
              `<circle cx="${x}" cy="${ay - 40 - (i % 2) * 6}" r="4.5" fill="${flowersColor}" stroke="#7a2f45" stroke-width="1.5"/>`,
          )
          .join(''),
        5,
      ) +
      shaded(
        `M${ax - 24} ${ay - 26}H${ax + 24}L${ax + 19} ${ay}H${ax - 19}Z`,
        ['#c97b5a', '#a35f43'],
        LINE,
        -3,
        -2,
      ),
  };
}

export function hydrant(): Prop {
  const w = 0.7 * T;
  const h = 0.9 * T;
  const ax = w / 2;
  const ay = h - 6;
  const red: Tone = ['#e8524a', '#b83a34'];
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 14, 4) +
      shaded(rr(ax - 9, ay - 36, 18, 36, 6), red, '#5e1d1a', -3, -2) +
      shaded(rr(ax - 15, ay - 26, 30, 8, 4), red, '#5e1d1a', -2, -2) +
      shaded(circ(ax, ay - 38, 9), red, '#5e1d1a', -2, -2) +
      fill(circ(ax - 3, ay - 41, 3), '#ffffff', 0.6),
  };
}

export const COMMON: Record<string, Prop> = {
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
  ...(() => {
    const f = fenceKit(WOOD, WOOD_LINE);
    return { 'fence-post': f.post, 'fence-h': f.h, 'fence-v': f.v };
  })(),
  'flowers-a': flowers('#ff9fc0', '#ffd23f'),
  'flowers-b': flowers('#ffd23f', '#ff9a1f'),
  'flowers-c': flowers('#ffffff', '#ffc93c'),
  tuft: tuft(),
  pebbles: pebbles(),
  lily: lily(),
  lamp: lamp(),
  bench: bench(),
  bin: bin(),
  planter: planter(),
  hydrant: hydrant(),
};
