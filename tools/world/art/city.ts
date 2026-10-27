// Miasto Ziomków: everyday city — housing blocks, tenements, shops, police station, skatepark, graffiti walls,
// cars, bus stop, garages, allotment sheds and road markings.
import {
  GLASS,
  GLASS_DARK,
  LINE,
  METAL,
  STONE,
  T,
  WOOD,
  awning,
  circ,
  door,
  fill,
  flat,
  flatRoof,
  frame,
  n,
  poly,
  rng,
  rr,
  shaded,
  shadow,
  stroke,
  windowAt,
  windowGrid,
  type Prop,
  type Tone,
} from './kit';
import { graffitiWall } from './graffiti';

export { graffitiWall };

/** Panel housing block, 7×4 footprint, four floors with balconies. */
function blok(wall: Tone, accent: Tone, seed: number): Prop {
  const foot: [number, number] = [7, 4];
  const { w, h, ax, ay, L, R } = frame(foot, 6.3);
  const roofTop = ay - 5.8 * T;
  const facadeTop = ay - 4.7 * T;
  const groundTop = ay - 1.05 * T;
  const r = rng(seed);
  let s = shadow(ax, ay - 2, 3.7 * T, 14, 0.24);
  s += shaded(rr(L, facadeTop - 6, R - L, ay - facadeTop + 6, 6), wall, LINE, -10, -4);
  // panel seams between floors
  for (let f = 1; f <= 4; f++) {
    const y = facadeTop + ((groundTop - facadeTop) / 4) * f;
    s += stroke(`M${L + 4} ${n(y)}H${R - 4}`, wall[1], 2.5, 0.8);
  }
  s += windowGrid(L + 6, R - 6, facadeTop + 4, groundTop - 2, 6, 4, {
    ww: 34,
    wh: 30,
    cross: true,
    extra: (x, y, ww, wh, c) =>
      c === 1 || c === 4
        ? shaded(rr(x - 8, y + wh + 2, ww + 16, 10, 3), accent, LINE, -2, -2) +
          stroke(
            `M${n(x - 6)} ${n(y + wh - 8)}V${n(y + wh + 2)}M${n(x + ww + 6)} ${n(y + wh - 8)}V${n(y + wh + 2)}M${n(x - 6)} ${n(y + wh - 8)}H${n(x + ww + 6)}`,
            accent[1],
            3,
          )
        : '',
  });
  // ground floor: entrance with canopy, small windows
  s += shaded(rr(L, groundTop, R - L, ay - groundTop, 4), [wall[1], wall[1]], LINE, 0, 0, 2);
  s += door(ax, ay - 2, 52, 52, GLASS_DARK, LINE);
  s += shaded(rr(ax - 42, groundTop + 2, 84, 10, 4), accent, LINE, -2, -2);
  s += windowGrid(L + 6, ax - 50, groundTop + 8, ay - 8, 2, 1, { ww: 30, wh: 26 });
  s += windowGrid(ax + 50, R - 6, groundTop + 8, ay - 8, 2, 1, { ww: 30, wh: 26 });
  // flat roof with antenna and AC boxes
  s += flatRoof(L, R, roofTop, facadeTop - roofTop + 4, ['#9aa1ad', '#7d8491']);
  const acX = L + 30 + r() * (R - L - 120);
  s += shaded(rr(acX, roofTop + 14, 30, 20, 4), METAL, LINE, -2, -2);
  s += stroke(
    `M${n(R - 50)} ${roofTop + 30}V${roofTop - 18}M${n(R - 62)} ${roofTop - 6}H${n(R - 38)}M${n(R - 58)} ${roofTop - 14}H${n(R - 42)}`,
    '#4a505c',
    3,
  );
  return { w, h, ax, ay, foot, body: s };
}

/** Pre-war tenement, 5×3, three floors, cornice and a slate roof. */
function kamienica(wall: Tone, trim: string, seed: number): Prop {
  const foot: [number, number] = [5, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 5.2);
  const roofTop = ay - 4.75 * T;
  const facadeTop = ay - 3.55 * T;
  const groundTop = ay - 1.1 * T;
  const r = rng(seed);
  let s = shadow(ax, ay - 2, 2.7 * T, 12, 0.24);
  // slate roof seen from the front: trapezoid with dormers
  s += shaded(
    poly([
      [L - 6, facadeTop + 4],
      [L + 22, roofTop],
      [R - 22, roofTop],
      [R + 6, facadeTop + 4],
    ]),
    ['#5b6372', '#454c59'],
    LINE,
    -6,
    -6,
  );
  for (const dx of [-1, 1]) {
    const cx = ax + dx * 1.2 * T;
    s += shaded(rr(cx - 18, roofTop + 12, 36, 34, 6), ['#e7dccb', '#cbbfa9'], LINE, -2, -2);
    s += windowAt(cx - 11, roofTop + 18, 22, 22, { r: 9, cross: true });
  }
  s += shaded(rr(L, facadeTop, R - L, ay - facadeTop, 4), wall, LINE, -9, -4);
  // cornice and floor ledges
  s += shaded(rr(L - 8, facadeTop - 4, R - L + 16, 14, 4), [trim, '#cfc4b2'], LINE, -2, -2);
  s += shaded(rr(L - 4, groundTop - 6, R - L + 8, 9, 3), [trim, '#cfc4b2'], LINE, -2, -2);
  s += windowGrid(L + 4, R - 4, facadeTop + 14, groundTop - 6, 4, 2, {
    ww: 30,
    wh: 42,
    r: 12,
    cross: true,
    sill: trim,
    extra: (x, y, ww) =>
      stroke(
        `M${n(x - 4)} ${n(y - 8)}Q${n(x + ww / 2)} ${n(y - 18)} ${n(x + ww + 4)} ${n(y - 8)}`,
        trim,
        5,
      ),
  });
  // ground floor: arched shop window, door
  s += windowAt(L + 16, groundTop + 12, 1.6 * T, ay - groundTop - 22, { r: 16, glass: GLASS });
  s += door(
    R - 0.9 * T,
    ay - 2,
    40,
    58,
    r() > 0.5 ? ['#5a7d9a', '#44617a'] : ['#8a4f3a', '#6d3c2c'],
    LINE,
    true,
  );
  return { w, h, ax, ay, foot, body: s };
}

type ShopKind = 'ciuchy' | 'kiosk' | 'kawiarnia' | 'bron' | 'owoce';

/** Shop icon on the sign board (no text, so it reads in any language). */
function shopIcon(kind: ShopKind, cx: number, cy: number): string {
  switch (kind) {
    case 'ciuchy':
      return flat(
        `M${cx - 14} ${cy - 10}l8 -6h12l8 6l-5 7l-4 -3v15h-14v-15l-4 3Z`,
        '#4cc7ff',
        LINE,
        2.5,
      );
    case 'kiosk':
      return (
        flat(rr(cx - 13, cy - 13, 26, 26, 3), '#ffffff', LINE, 2.5) +
        stroke(`M${cx - 8} ${cy - 6}h16M${cx - 8} ${cy}h16M${cx - 8} ${cy + 6}h10`, '#55514a', 2.5)
      );
    case 'kawiarnia':
      return (
        flat(`M${cx - 12} ${cy - 6}h20v8q0 10 -10 10q-10 0 -10 -10Z`, '#ffffff', LINE, 2.5) +
        stroke(
          `M${cx + 8} ${cy - 2}q8 0 6 6q-2 4 -7 3M${cx - 6} ${cy - 16}q3 3 0 6M${cx + 1} ${cy - 16}q3 3 0 6`,
          LINE,
          2.5,
        )
      );
    case 'bron':
      return (
        stroke(
          `M${cx - 14} ${cy + 12}L${cx + 12} ${cy - 14}M${cx + 14} ${cy + 12}L${cx - 12} ${cy - 14}`,
          '#7a4a2a',
          7,
        ) +
        stroke(
          `M${cx - 14} ${cy + 12}L${cx + 12} ${cy - 14}M${cx + 14} ${cy + 12}L${cx - 12} ${cy - 14}`,
          '#c48a52',
          4,
        )
      );
    case 'owoce':
      return (
        flat(circ(cx - 6, cy + 2, 9), '#ff7a3c', LINE, 2.5) +
        flat(circ(cx + 7, cy + 4, 8), '#a3e635', LINE, 2.5) +
        stroke(`M${cx - 6} ${cy - 7}q2 -6 7 -7`, '#3f8f3e', 3)
      );
  }
}

/** One-storey shop, 5×3: awning, sign with an icon, display windows. */
function shop(kind: ShopKind, wall: Tone, stripes: [string, string]): Prop {
  const foot: [number, number] = [5, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 3.5);
  const roofTop = ay - 3.1 * T;
  const facadeTop = ay - 2.2 * T;
  let s = shadow(ax, ay - 2, 2.7 * T, 12, 0.22);
  s += flatRoof(L, R, roofTop, facadeTop - roofTop + 4, ['#a8a29a', '#8c867d']);
  s += shaded(rr(L, facadeTop, R - L, ay - facadeTop, 6), wall, LINE, -9, -4);
  // sign board
  s += shaded(
    rr(ax - 1.3 * T, facadeTop + 8, 2.6 * T, 34, 8),
    ['#2b2e38', '#1d1f26'],
    LINE,
    -2,
    -2,
  );
  s += shopIcon(kind, ax, facadeTop + 25);
  s += awning(L + 6, R - 6, facadeTop + 50, 22, stripes[0], stripes[1]);
  // display windows and door
  s += windowAt(L + 14, facadeTop + 84, 1.45 * T, ay - facadeTop - 96, { r: 6 });
  s += windowAt(R - 14 - 1.45 * T, facadeTop + 84, 1.45 * T, ay - facadeTop - 96, { r: 6 });
  s += door(ax, ay - 2, 46, ay - facadeTop - 84, GLASS, LINE);
  return { w, h, ax, ay, foot, body: s };
}

/** Police station, 7×3: blue stripe, star badge, siren on the roof. */
function komisariat(): Prop {
  const foot: [number, number] = [7, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 4);
  const roofTop = ay - 3.55 * T;
  const facadeTop = ay - 2.5 * T;
  let s = shadow(ax, ay - 2, 3.7 * T, 13, 0.24);
  s += flatRoof(L, R, roofTop, facadeTop - roofTop + 4, ['#8f97a5', '#757d8b']);
  s += shaded(rr(ax - 18, roofTop - 14, 36, 18, 8), ['#4c8fd6', '#36689f'], LINE, -2, -2);
  s += fill(circ(ax - 5, roofTop - 8, 4), '#ffffff', 0.7);
  s += shaded(rr(L, facadeTop, R - L, ay - facadeTop, 6), ['#e6ebf2', '#c5ccd8'], LINE, -10, -4);
  s += shaded(rr(L, facadeTop + 0.95 * T, R - L, 18, 2), ['#3d78c9', '#2d5c9c'], LINE, 0, -2);
  s += windowGrid(L + 8, R - 8, facadeTop + 8, facadeTop + 0.9 * T, 6, 1, {
    ww: 40,
    wh: 34,
    glass: GLASS_DARK,
  });
  s += shaded(
    rr(ax - 1.2 * T, ay - 1.25 * T, 2.4 * T, 1.25 * T - 2, 6),
    ['#d1d7e0', '#b2bac6'],
    LINE,
    -4,
    -2,
  );
  s += door(ax - 26, ay - 2, 48, 66, GLASS_DARK, LINE);
  s += door(ax + 26, ay - 2, 48, 66, GLASS_DARK, LINE);
  // star badge
  const star = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 ? 8 : 18;
    return [ax + Math.cos(a) * rad, facadeTop + 0.95 * T + 9 + Math.sin(a) * rad] as [
      number,
      number,
    ];
  });
  s += flat(poly(star), '#ffc93c', LINE, 2.5);
  s += windowGrid(L + 8, ax - 1.3 * T, ay - 1.1 * T, ay - 10, 2, 1, { ww: 36, wh: 34 });
  s += windowGrid(ax + 1.3 * T, R - 8, ay - 1.1 * T, ay - 10, 2, 1, { ww: 36, wh: 34 });
  return { w, h, ax, ay, foot, body: s };
}

function skateRamp(): Prop {
  const foot: [number, number] = [3, 2];
  const { w, h, ax, ay, L, R } = frame(foot, 2.3, 0.2);
  const concrete: Tone = ['#c9cdd4', '#a2a8b2'];
  const top = ay - 1.7 * T;
  let s = shadow(ax, ay - 2, 1.6 * T, 10, 0.22);
  s += shaded(`M${L} ${ay}V${top}H${R}V${ay}Z`, ['#9ba2ad', '#7f8691'], LINE, -6, -4);
  s += shaded(
    `M${L} ${ay}Q${L + 0.2 * T} ${top + 18} ${L + 0.9 * T} ${top + 10}H${R}V${ay}Z`,
    concrete,
    LINE,
    -6,
    -4,
  );
  s += shaded(rr(L + 0.8 * T, top + 2, R - L - 0.8 * T, 10, 4), METAL, LINE, -1, -1);
  s += stroke(`M${L + 0.4 * T} ${ay - 0.6 * T}l${0.5 * T} -10`, '#ff3d50', 6, 0.85);
  s += flat(circ(R - 0.7 * T, ay - 0.7 * T, 12), '#ffc93c', LINE, 2);
  return { w, h, ax, ay, foot, body: s };
}

function hoop(): Prop {
  const w = 1.4 * T;
  const h = 2.6 * T;
  const ax = w / 2;
  const ay = h - 6;
  const pole: Tone = ['#5b6372', '#414856'];
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 18, 5) +
      shaded(rr(ax - 5, ay - 2 * T, 10, 2 * T, 4), pole, LINE, -2, 0) +
      shaded(rr(ax - 36, ay - 2.45 * T, 72, 48, 6), ['#ffffff', '#dfe3ea'], LINE, -3, -3) +
      flat(rr(ax - 14, ay - 2.45 * T + 16, 28, 22, 2), 'none', '#ff3d50', 3) +
      `<ellipse cx="${ax}" cy="${n(ay - 2.45 * T + 50)}" rx="16" ry="5" fill="none" stroke="#ff7a1f" stroke-width="4"/>` +
      stroke(
        `M${ax - 15} ${n(ay - 2.45 * T + 51)}l5 20M${ax} ${n(ay - 2.45 * T + 55)}v18M${ax + 15} ${n(ay - 2.45 * T + 51)}l-5 20M${ax - 12} ${n(ay - 2.45 * T + 62)}h24`,
        '#ffffff',
        2,
      ),
  };
}

function busStop(): Prop {
  const foot: [number, number] = [3, 1];
  const { w, h, ax, ay, L, R } = frame(foot, 2.1, 0.2);
  const line = '#2b2e38';
  let s = shadow(ax, ay - 2, 1.6 * T, 8, 0.2);
  s += fill(rr(L + 10, ay - 1.6 * T, R - L - 46, 1.5 * T, 6), '#bfe6f7', 0.55);
  s += stroke(`M${L + 10} ${ay - 1.6 * T}V${ay}M${R - 36} ${ay - 1.6 * T}V${ay}`, '#5b6372', 5);
  s += shaded(rr(L + 2, ay - 1.75 * T, R - L - 30, 14, 5), ['#3fb39b', '#2c8574'], line, -2, -2);
  s += shaded(rr(L + 24, ay - 0.62 * T, R - L - 80, 10, 4), WOOD, line, -1, -2);
  s += stroke(`M${R - 14} ${ay}V${ay - 1.9 * T}`, '#5b6372', 5);
  s += flat(circ(R - 14, ay - 1.9 * T, 15), '#ffc93c', line, 3);
  s += flat(rr(R - 22, ay - 1.9 * T - 6, 16, 11, 3), '#ffffff', line, 2);
  return { w, h, ax, ay, foot, body: s };
}

/** Parked car seen from the side (3 tiles incl. some air). */
function car(body: Tone, police = false): Prop {
  const foot: [number, number] = [3, 1];
  const { w, h, ax, ay } = frame(foot, 1.5, 0.1);
  const line = '#22242b';
  const x0 = ax - 1.25 * T;
  const x1 = ax + 1.25 * T;
  const base = ay - 14;
  let s = shadow(ax, ay - 2, 1.35 * T, 9, 0.26);
  s += shaded(
    `M${x0} ${base}V${base - 22}Q${x0} ${base - 30} ${x0 + 12} ${base - 31}L${ax - 30} ${base - 34}L${ax - 14} ${base - 58}Q${ax - 10} ${base - 62} ${ax - 2} ${base - 62}H${ax + 34}Q${ax + 42} ${base - 62} ${ax + 48} ${base - 56}L${ax + 62} ${base - 34}L${x1 - 10} ${base - 31}Q${x1} ${base - 30} ${x1} ${base - 20}V${base}Z`,
    body,
    line,
    -6,
    -4,
  );
  s += shaded(
    `M${ax - 8} ${base - 36}L${ax - 2} ${base - 54}H${ax + 12}V${base - 36}Z`,
    GLASS,
    line,
    -2,
    -2,
    2.5,
  );
  s += shaded(
    `M${ax + 18} ${base - 36}V${base - 54}H${ax + 38}L${ax + 52} ${base - 36}Z`,
    GLASS,
    line,
    -2,
    -2,
    2.5,
  );
  s += flat(rr(x1 - 14, base - 26, 10, 7, 3), '#fff3c4', line, 2);
  s += flat(rr(x0 + 3, base - 25, 9, 6, 3), '#ff6b5e', line, 2);
  s += stroke(`M${ax + 2} ${base - 30}h10`, line, 3);
  if (police) {
    s += shaded(rr(x0 + 4, base - 22, x1 - x0 - 8, 9, 2), ['#3d78c9', '#2d5c9c'], line, 0, -1, 2);
    s += shaded(rr(ax + 6, base - 72, 26, 10, 4), ['#ff3d50', '#bd1c31'], line, -1, -1, 2);
    s += fill(rr(ax + 19, base - 72, 13, 10, 4), '#4cc7ff');
  }
  for (const wx of [x0 + 0.55 * T, x1 - 0.55 * T]) {
    s +=
      flat(circ(wx, base + 2, 15), '#22242b', line, 2) +
      flat(circ(wx, base + 2, 7), '#b7bec9', line, 2);
  }
  return { w, h, ax, ay, foot, body: s };
}

/**
 * A row of three block garages, 3×2: a concrete shell with a tar-sealed roof edge (dark drips where it ran), a gutter
 * and a downpipe, rain streaks and a mossy plinth, weeds at the foot; up-and-over doors in three colours with ribs,
 * rust coming through and small number plates (blank: no words). Variant 1 has one door half open on a dark inside
 * with boxes and a bike wheel, variant 2 a sprayed throw-up across two doors and a satellite dish.
 */
function garages(variant = 0): Prop {
  const foot: [number, number] = [3, 2];
  const { w, h, ax, ay, L, R } = frame(foot, 2.7, 0.18);
  const top = ay - 2.3 * T;
  const facadeTop = ay - 1.45 * T;
  const palettes: Tone[][] = [
    [
      ['#7fa6c9', '#5f86a9'],
      ['#c9a97f', '#a9895f'],
      ['#8fbf8a', '#6f9f6a'],
    ],
    [
      ['#c97f7f', '#a95f5f'],
      ['#8f9aa8', '#6f7a88'],
      ['#d9c27a', '#b9a25a'],
    ],
    [
      ['#6f8fa0', '#4f6f80'],
      ['#a48fc0', '#846fa0'],
      ['#c99a6b', '#a07448'],
    ],
  ];
  const doors = palettes[variant % palettes.length]!;
  const r = rng(830 + variant * 17);
  let s = shadow(ax, ay - 2, 1.75 * T, 10, 0.24);
  // the roof, seen from the front and above: tar sheet, a raised edge, gravel
  s += flatRoof(L, R, top, facadeTop - top + 4, ['#6f6c68', '#5a5753']);
  // the shell
  s += shaded(rr(L, facadeTop, R - L, ay - facadeTop, 3), ['#cfcac0', '#aea99f'], LINE, -6, -3);
  // the concrete edge beam under the roof, with tar running down from it
  s += shaded(rr(L - 4, facadeTop - 4, R - L + 8, 10, 2), ['#b8b3a9', '#98938a'], LINE, -1, -1, 2);
  let drips = '';
  for (let x = L + 6; x < R - 4; x += 10 + r() * 14)
    drips += `M${n(x)} ${n(facadeTop + 6)}v${n(3 + r() * 9)}`;
  s += stroke(drips, '#3d3a36', 2.2, 0.55);
  // rain streaks and a mossy, damp plinth
  let streaks = '';
  for (let x = L + 12; x < R - 6; x += 18 + r() * 20)
    streaks += `M${n(x)} ${n(facadeTop + 8)}v${n(14 + r() * 18)}`;
  s += stroke(streaks, '#8f8a80', 3, 0.25);
  s += fill(rr(L + 1, ay - 9, R - L - 2, 8, 2), '#6f8a5a', 0.35);
  // the doors
  const dw = (R - L - 8) / 3;
  doors.forEach((d, i) => {
    const x = L + 4 + i * dw + 2;
    const dTop = facadeTop + 12;
    const dh = ay - dTop - 4;
    const open = variant === 1 && i === 1;
    // the opening's dark reveal round every door
    s += fill(rr(x - 2, dTop - 2, dw - 4 + 4, dh + 4, 2), '#2a2724', 0.35);
    if (open) {
      // half up: the dark inside below, boxes and a wheel
      s += fill(rr(x, dTop, dw - 4, dh, 2), '#26231f', 1);
      s += shaded(rr(x + 6, ay - 22, 16, 14, 1), ['#c9a46a', '#a3804a'], '#5a4022', -1, -1, 1.4);
      s += shaded(rr(x + 10, ay - 32, 12, 10, 1), ['#c9a46a', '#a3804a'], '#5a4022', -1, -1, 1.4);
      s += `<circle cx="${n(x + dw - 16)}" cy="${n(ay - 15)}" r="9" fill="none" stroke="#151412" stroke-width="3"/>`;
      s += stroke(
        `M${n(x + dw - 16)} ${n(ay - 24)}v18M${n(x + dw - 25)} ${n(ay - 15)}h18`,
        '#4a4744',
        1,
        0.8,
      );
      s += shaded(rr(x - 2, dTop - 2, dw, dh * 0.45, 2), d, LINE, -2, -2, 2.5);
      s += fill(rr(x, dTop + dh * 0.43 - 2, dw - 4, 5, 1), '#000000', 0.3);
    } else {
      s += shaded(rr(x, dTop, dw - 4, dh, 2), d, LINE, -3, -2, 2.5);
      let ribs = '';
      for (let k = 1; k < 7; k++) ribs += `M${n(x + 3)} ${n(dTop + (k * dh) / 7)}h${n(dw - 10)}`;
      s += stroke(ribs, d[1], 2);
      s += stroke(
        ribs.replace(/M([\d.]+) ([\d.]+)/g, (_, a, b) => `M${a} ${Number(b) + 1.6}`),
        '#ffffff',
        1,
        0.25,
      );
      // the handle and rust coming through at the bottom corners
      s += shaded(rr(x + dw / 2 - 7, dTop + dh * 0.55, 10, 4, 1), METAL, LINE, -0.5, -0.5, 1.2);
      s += fill(
        `M${n(x + 2)} ${n(ay - 6)}q4 -${n(6 + r() * 6)} ${n(10 + r() * 8)} -2v2Z`,
        '#a0522d',
        0.55,
      );
      if (r() > 0.4)
        s += fill(circ(x + dw - 12, dTop + dh * (0.3 + r() * 0.4), 2.5 + r() * 2), '#a0522d', 0.4);
    }
    // the number plate over the door (blank)
    s += shaded(
      rr(x + dw / 2 - 8, facadeTop + 2, 12, 7, 1),
      ['#f2efe8', '#d2cfc6'],
      LINE,
      -0.5,
      -0.5,
      1,
    );
  });
  // a gutter along the edge and a downpipe at the right
  s += stroke(`M${n(L - 2)} ${n(facadeTop + 7)}H${n(R + 3)}`, '#8a8f97', 3);
  s += stroke(`M${n(R + 1)} ${n(facadeTop + 7)}V${n(ay - 3)}`, '#7a7f87', 4);
  s += stroke(`M${n(R + 1)} ${n(ay - 3)}h5`, '#7a7f87', 4);
  if (variant === 2) {
    // a throw-up across two doors: two fat round outlines with a fill and a shine (letters of no word)
    const gx = L + dw * 0.55;
    const gy = ay - 0.55 * T;
    s += `<path d="M${n(gx)} ${n(gy)}q10 -26 30 -8q14 -22 32 -2q18 -14 26 10q-30 14 -88 0Z" fill="#ff5fa2" stroke="#1b1b1b" stroke-width="3" opacity="0.92"/>`;
    s += stroke(
      `M${n(gx + 8)} ${n(gy - 8)}q8 -10 16 -2M${n(gx + 44)} ${n(gy - 14)}q8 -6 12 2`,
      '#ffffff',
      2.4,
      0.8,
    );
    // a satellite dish on the roof
    s += stroke(`M${n(R - 30)} ${n(top + 14)}v-10`, '#5b606b', 3);
    s += shaded(
      `M${n(R - 44)} ${n(top + 2)}a14 9 0 0 1 28 -6l-4 12Z`,
      ['#e9edf2', '#c3c9d2'],
      LINE,
      -1,
      -1,
      1.6,
    );
  }
  // weeds at the foot of the wall
  let weeds = '';
  for (let x = L + 4; x < R; x += 12 + r() * 18)
    weeds += `M${n(x)} ${n(ay)}l-3 -9M${n(x)} ${n(ay)}l1 -11M${n(x)} ${n(ay)}l4 -8`;
  s += stroke(weeds, '#5d8f3a', 2);
  return { w, h, ax, ay, foot, body: s };
}

function altanka(roof: Tone): Prop {
  const foot: [number, number] = [3, 2];
  const { w, h, ax, ay, L, R } = frame(foot, 2.8, 0.3);
  const line = '#4a3326';
  const wallTop = ay - 1.35 * T;
  const top = ay - 2.5 * T;
  let s = shadow(ax, ay - 2, 1.8 * T, 10, 0.22);
  s += shaded(rr(L + 6, wallTop, R - L - 12, ay - wallTop, 4), WOOD, line, -6, -3);
  for (let x = L + 20; x < R - 10; x += 16)
    s += stroke(`M${x} ${wallTop + 4}V${ay - 4}`, WOOD[1], 2, 0.8);
  s += windowAt(L + 18, wallTop + 16, 34, 28, { line, cross: true });
  s += door(R - 0.75 * T, ay - 2, 34, 0.95 * T, ['#3fb39b', '#2c8574'], line);
  // corrugated tin roof
  s += shaded(
    poly([
      [L - 8, wallTop + 6],
      [L + 10, top],
      [R - 10, top],
      [R + 8, wallTop + 6],
    ]),
    roof,
    line,
    -5,
    -5,
  );
  for (let x = L + 4; x < R; x += 12)
    s += stroke(`M${x} ${wallTop + 2}L${n(x + (ax - x) * 0.12)} ${top + 4}`, roof[1], 2, 0.7);
  return { w, h, ax, ay, foot, body: s };
}

export function fountain(stone: Tone = STONE, fancy = false): Prop {
  const foot: [number, number] = fancy ? [5, 3] : [3, 3];
  const { w, h, ax, ay } = frame(foot, fancy ? 3.6 : 2.6, 0.2);
  const line = '#4a4741';
  const rx = (foot[0] / 2) * T - 6;
  const cy = ay - 0.9 * T;
  let s = shadow(ax, ay - 4, rx + 8, 14, 0.24);
  s += shaded(
    `M${ax - rx} ${cy}V${ay - 26}Q${ax - rx} ${ay - 6} ${ax} ${ay - 6}Q${ax + rx} ${ay - 6} ${ax + rx} ${ay - 26}V${cy}Z`,
    stone,
    line,
    -6,
    -3,
  );
  s += `<ellipse cx="${ax}" cy="${cy}" rx="${rx}" ry="${0.62 * T}" fill="${stone[0]}" stroke="${line}" stroke-width="3"/>`;
  s += `<ellipse cx="${ax}" cy="${cy + 2}" rx="${rx - 12}" ry="${0.62 * T - 10}" fill="#5cbdeb"/>`;
  s += `<ellipse cx="${ax - 10}" cy="${cy - 6}" rx="${rx * 0.45}" ry="${0.18 * T}" fill="#c4ecfc" opacity="0.7"/>`;
  const colTop = ay - (fancy ? 2.9 : 2.1) * T;
  s += shaded(rr(ax - 9, colTop + 20, 18, cy - colTop - 20, 4), stone, line, -2, 0);
  if (fancy) {
    s += `<ellipse cx="${ax}" cy="${n(colTop + 0.55 * T)}" rx="${0.85 * T}" ry="${0.25 * T}" fill="${stone[0]}" stroke="${line}" stroke-width="3"/>`;
    s += `<ellipse cx="${ax}" cy="${n(colTop + 0.55 * T + 2)}" rx="${0.85 * T - 8}" ry="${0.25 * T - 6}" fill="#5cbdeb"/>`;
    s += flat(circ(ax, colTop + 6, 12), '#ffc93c', line, 2.5);
  }
  // water arcs
  s += stroke(
    `M${ax} ${colTop + 18}q-22 -30 -46 ${n(cy - colTop - 30)}M${ax} ${colTop + 18}q22 -30 46 ${n(cy - colTop - 30)}M${ax} ${colTop + 18}v-18`,
    '#c4ecfc',
    5,
    0.9,
  );
  return { w, h, ax, ay, foot, body: s };
}

// ---------- flat ground markings ----------
const dash = (vertical: boolean): Prop => ({
  w: T,
  h: T,
  ax: T / 2,
  ay: T / 2 + 16,
  flat: true,
  body: vertical
    ? fill(rr(T / 2 - 4, 12, 8, T - 24, 3), '#f6f2e9', 0.9)
    : fill(rr(12, T / 2 - 4, T - 24, 8, 3), '#f6f2e9', 0.9),
});
const zebra = (vertical: boolean): Prop => ({
  w: T,
  h: T,
  ax: T / 2,
  ay: T / 2 + 16,
  flat: true,
  body: vertical
    ? fill(rr(6, 6, 20, T - 12, 3), '#f6f2e9', 0.9) + fill(rr(38, 6, 20, T - 12, 3), '#f6f2e9', 0.9)
    : fill(rr(6, 6, T - 12, 20, 3), '#f6f2e9', 0.9) +
      fill(rr(6, 38, T - 12, 20, 3), '#f6f2e9', 0.9),
});
const manhole = (): Prop => ({
  w: 48,
  h: 40,
  ax: 24,
  ay: 30,
  flat: true,
  body:
    `<ellipse cx="24" cy="20" rx="20" ry="13" fill="#2d3039" stroke="#22242b" stroke-width="2"/>` +
    stroke('M10 20h28M14 13h20M14 27h20', '#4a4e5c', 2),
});
const rails = (vertical: boolean): Prop => {
  const sleepers = vertical
    ? [8, 24, 40, 56].map((y) => fill(rr(10, y - 4, T - 20, 8, 2), '#7a5a3e')).join('') +
      stroke(`M22 0V${T}M42 0V${T}`, '#8a929e', 5)
    : [8, 24, 40, 56].map((x) => fill(rr(x - 4, 10, 8, T - 20, 2), '#7a5a3e')).join('') +
      stroke(`M0 22H${T}M0 42H${T}`, '#8a929e', 5);
  return { w: T, h: T, ax: T / 2, ay: T / 2 + 16, flat: true, body: sleepers };
};

// ---------- street details (flat, scattered by the maps' [scatter] rules) ----------

/** A gully grate by the kerb. */
const drain = (): Prop => ({
  w: 44,
  h: 34,
  ax: 22,
  ay: 26,
  flat: true,
  body:
    flat(rr(4, 6, 36, 22, 3), '#3b3f49', '#262930', 2) +
    stroke('M10 10v14M16 10v14M22 10v14M28 10v14M34 10v14', '#1c1e24', 2.4) +
    stroke('M7 9h30', '#6b707c', 1.6, 0.7),
});

/** An oil stain on the asphalt, with a faint rainbow sheen. */
const oil = (): Prop => ({
  w: 56,
  h: 34,
  ax: 28,
  ay: 26,
  flat: true,
  body:
    `<ellipse cx="28" cy="18" rx="22" ry="11" fill="#1e2027" opacity="0.45"/>` +
    `<ellipse cx="24" cy="16" rx="11" ry="5" fill="#2a2d36" opacity="0.6"/>` +
    stroke('M14 17q8 -6 18 -3', '#7b6fd1', 1.6, 0.35) +
    stroke('M18 20q8 -5 16 -2', '#4cc7ff', 1.4, 0.3),
});

/** A handful of fallen leaves. */
const leaves = (seed: number): Prop => {
  const r = rng(seed);
  let body = '';
  const colors = ['#d9922e', '#c4572f', '#e8b83c', '#9a6b2f'];
  for (let i = 0; i < 5; i++) {
    const x = 8 + r() * 40;
    const y = 8 + r() * 16;
    const a = Math.round(r() * 180);
    const c = colors[Math.floor(r() * colors.length)]!;
    body +=
      `<g transform="rotate(${a} ${n(x)} ${n(y)})">` +
      `<path d="M${n(x - 6)} ${n(y)}q6 -5 12 0q-6 5 -12 0Z" fill="${c}" stroke="#6b4426" stroke-width="1"/>` +
      `<path d="M${n(x - 5)} ${n(y)}h10" stroke="#6b4426" stroke-width="0.8" opacity="0.6"/></g>`;
  }
  return { w: 56, h: 32, ax: 28, ay: 26, flat: true, body };
};

/** A weed pushing through a gap between paving slabs. */
const weed = (): Prop => ({
  w: 40,
  h: 30,
  ax: 20,
  ay: 24,
  flat: true,
  body:
    stroke('M4 22h12l4 -3h16', '#7d776b', 2, 0.6) +
    stroke('M18 21q-2 -8 -7 -11M20 21q0 -9 2 -14M22 21q3 -7 8 -9', '#5fa843', 2.6) +
    `<circle cx="22" cy="7" r="2.6" fill="#ffd25c"/>`,
});

/** A hairline crack across a slab. */
const hairline = (): Prop => ({
  w: 52,
  h: 30,
  ax: 26,
  ay: 24,
  flat: true,
  body: stroke('M4 18l10 -4l6 3l9 -7l7 2l10 -6M20 17l3 6', '#5e594f', 1.8, 0.55),
});

const GRAFFITI = ['#ff3d50', '#4cc7ff', '#a3e635', '#b45cff', '#ff9a1f', '#ffc93c'];

export const CITY: Record<string, Prop> = {
  'blok-a': blok(['#f1e6cf', '#d9c9a8'], ['#3fb39b', '#2c8574'], 11),
  'blok-b': blok(['#d4e6f2', '#aec8db'], ['#ffc93c', '#d98a0b'], 12),
  'blok-c': blok(['#f3d5cd', '#dcb3aa'], ['#b45cff', '#8a3fd1'], 13),
  'kamienica-a': kamienica(['#f0c27a', '#d6a35a'], '#f6efe2', 21),
  'kamienica-b': kamienica(['#f2a99a', '#d98a7b'], '#f6efe2', 22),
  'kamienica-c': kamienica(['#a9d4c4', '#86b5a4'], '#f6efe2', 23),
  'sklep-ciuchy': shop('ciuchy', ['#f6f2e9', '#ddd5c4'], ['#4cc7ff', '#ffffff']),
  'sklep-kiosk': shop('kiosk', ['#f3e3a8', '#d9c787'], ['#ff3d50', '#ffffff']),
  kawiarnia: shop('kawiarnia', ['#e9d3bd', '#cdb59d'], ['#3fb39b', '#f6f2e9']),
  komisariat: komisariat(),
  'skate-ramp': skateRamp(),
  kosz: hoop(),
  'graffiti-a': graffitiWall(31, GRAFFITI),
  'graffiti-b': graffitiWall(32, GRAFFITI),
  'graffiti-c': graffitiWall(33, GRAFFITI),
  przystanek: busStop(),
  'auto-a': car(['#e8524a', '#b83a34']),
  'auto-b': car(['#4c8fd6', '#36689f']),
  'auto-c': car(['#ffc93c', '#d98a0b']),
  radiowoz: car(['#f6f2e9', '#cfd5de'], true),
  garaze: garages(0),
  'garaze-b': garages(1),
  'garaze-c': garages(2),
  'altanka-a': altanka(['#7fa6c9', '#5f86a9']),
  'altanka-b': altanka(['#c86b4e', '#a3523a']),
  fontanna: fountain(),
  'road-dash': dash(false),
  'road-dash-v': dash(true),
  zebra: zebra(false),
  'zebra-v': zebra(true),
  manhole: manhole(),
  kratka: drain(),
  'plama-oleju': oil(),
  'liscie-a': leaves(71),
  'liscie-b': leaves(72),
  chwast: weed(),
  rysa: hairline(),
  'rails-h': rails(false),
  'rails-v': rails(true),
};

export const SHOP = shop;
export const GRAFFITI_COLORS = GRAFFITI;
export const CAR = car;
