// Los Karkos: the rough district — abandoned blocks covered in graffiti, chain-link fences, car wrecks, burning
// barrels, trash and tyres, a junkyard, a boxing ring, a gym, a weapon shop and an old factory.
import { CAR, GRAFFITI_COLORS, SHOP, graffitiWall } from './city';
import { fenceKit } from './common';
import {
  GLASS_DARK,
  METAL,
  T,
  bricks,
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
  type Prop,
  type Tone,
} from './kit';

const LINE = '#2a2522';
const CONCRETE: Tone = ['#a39d93', '#86807a'];
const RUST: Tone = ['#a0603a', '#7d4a2c'];

/** A broken window: dark hole, boarded up, or cracked glass. */
function brokenWindow(x: number, y: number, w: number, h: number, kind: number): string {
  if (kind === 0)
    return windowAt(x, y, w, h, { glass: ['#2a2522', '#1c1917'], line: LINE, lit: false, r: 2 });
  if (kind === 1)
    return (
      windowAt(x, y, w, h, { glass: ['#2a2522', '#1c1917'], line: LINE, lit: false, r: 2 }) +
      shaded(rr(x - 3, y + h * 0.25, w + 6, 8, 2), ['#b0874f', '#8a6a3a'], LINE, -1, -1, 2) +
      shaded(rr(x - 3, y + h * 0.6, w + 6, 8, 2), ['#b0874f', '#8a6a3a'], LINE, -1, -1, 2)
    );
  return (
    windowAt(x, y, w, h, { glass: GLASS_DARK, line: LINE, r: 2 }) +
    stroke(
      `M${n(x + w * 0.3)} ${y}l${n(w * 0.2)} ${n(h * 0.45)}l${n(-w * 0.25)} ${n(h * 0.3)}M${n(x + w * 0.5)} ${n(y + h * 0.45)}l${n(w * 0.4)} ${n(h * 0.1)}`,
      '#ffffff',
      1.5,
      0.8,
    )
  );
}

/** Abandoned housing block, 7×4: concrete, broken and boarded windows, graffiti, exposed bricks, rebar. */
function ruinBlock(seed: number): Prop {
  const foot: [number, number] = [7, 4];
  const { w, h, ax, ay, L, R } = frame(foot, 5.6);
  const r = rng(seed);
  const facadeTop = ay - 4.1 * T;
  const roofTop = ay - 5.1 * T;
  let s = shadow(ax, ay - 2, 3.7 * T, 14, 0.28);
  // broken roof line: one corner collapsed
  s += shaded(
    poly([
      [L - 4, facadeTop + 6],
      [L - 4, roofTop],
      [R - 1.6 * T, roofTop],
      [R - 1.1 * T, roofTop + 22],
      [R - 0.6 * T, roofTop + 10],
      [R + 4, roofTop + 30],
      [R + 4, facadeTop + 6],
    ]),
    ['#77726b', '#5f5a54'],
    LINE,
    -6,
    -6,
  );
  s += stroke(
    `M${R - 1.1 * T} ${roofTop + 22}l-4 -26M${R - 0.9 * T} ${roofTop + 16}l6 -24M${R - 0.6 * T} ${roofTop + 10}l-2 -20`,
    '#7d4a2c',
    3,
  );
  s += shaded(rr(L, facadeTop, R - L, ay - facadeTop, 3), CONCRETE, LINE, -10, -4);
  // exposed brick patches and cracks
  s += shaded(
    rr(L + 1.2 * T, facadeTop + 0.6 * T, 1.1 * T, 0.7 * T, 10),
    ['#b8644a', '#94503b'],
    LINE,
    -2,
    -2,
    0,
  );
  s += bricks(L + 1.2 * T, facadeTop + 0.6 * T, 1.1 * T, 0.7 * T, '#6e3a2a', 0.6);
  s += stroke(
    `M${R - 2 * T} ${facadeTop + 10}l-10 30l14 18l-8 30M${L + 30} ${ay - 1.6 * T}l12 24l-6 20`,
    '#5f5a54',
    3,
  );
  for (let row = 0; row < 3; row++)
    for (let c = 0; c < 6; c++) {
      const x = L + 14 + c * ((R - L - 28) / 6) + 8;
      const y = facadeTop + 16 + row * 0.95 * T;
      s += brokenWindow(x, y, 34, 34, Math.floor(r() * 3));
    }
  // ground floor: steel shutter and a dark doorway, graffiti over it all
  s += shaded(rr(L + 20, ay - 0.95 * T, 1.6 * T, 0.95 * T - 4, 3), METAL, LINE, -3, -2);
  for (let k = 1; k < 6; k++)
    s += stroke(`M${L + 24} ${n(ay - 0.95 * T + k * 10)}h${1.6 * T - 8}`, '#8a929e', 2);
  s += door(ax + 0.6 * T, ay - 2, 48, 0.9 * T, ['#2a2522', '#1c1917'], LINE);
  const tags = graffitiWall(seed + 100, GRAFFITI_COLORS, true);
  s += `<g transform="translate(${n(R - 3.2 * T - (tags.w - 3 * T) / 2)} ${n(ay - tags.h - 4)})"><g transform="scale(1 0.62) translate(0 ${n(tags.h * 0.6)})">${tags.body.replace(/<ellipse cx="[^"]*" cy="[^"]*" rx="[^"]*" ry="[^"]*" fill="#1d2a14"[^>]*\/>/, '')}</g></g>`;
  return { w, h, ax, ay, foot, body: s };
}

function wreck(tone: Tone): Prop {
  const base = CAR(tone);
  // rust patches, no wheels (bricks instead), a smashed window
  const body = base.body
    .replace(
      /fill="#22242b" stroke="#22242b" stroke-width="2"\/>/g,
      'fill="#5d5853" stroke="#22242b" stroke-width="2"/>',
    )
    .concat(
      fill(circ(base.ax - 30, base.ay - 40, 12), RUST[0], 0.85),
      fill(circ(base.ax + 40, base.ay - 30, 9), RUST[1], 0.85),
      stroke(`M${base.ax + 22} ${base.ay - 66}l8 12l-6 8`, '#ffffff', 2, 0.9),
    );
  return { ...base, body };
}

function burningBarrel(): Prop {
  const w = 0.9 * T;
  const h = 1.5 * T;
  const ax = w / 2;
  const ay = h - 6;
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      `<ellipse cx="${ax}" cy="${ay - 10}" rx="34" ry="16" fill="#ff9a1f" opacity="0.18"/>` +
      shadow(ax, ay, 20, 5) +
      shaded(rr(ax - 18, ay - 46, 36, 46, 5), RUST, LINE, -4, -2) +
      stroke(`M${ax - 18} ${ay - 32}h36M${ax - 18} ${ay - 14}h36`, '#5e3820', 3) +
      `<path d="M${ax - 16} ${ay - 46}Q${ax - 18} ${ay - 70} ${ax - 6} ${ay - 82}Q${ax - 4} ${ay - 66} ${ax + 2} ${ay - 64}Q${ax + 6} ${ay - 86} ${ax + 14} ${ay - 76}Q${ax + 20} ${ay - 60} ${ax + 16} ${ay - 46}Z" fill="#ff9a1f" stroke="#bd1c31" stroke-width="2"/>` +
      `<path d="M${ax - 8} ${ay - 46}Q${ax - 8} ${ay - 60} ${ax} ${ay - 66}Q${ax + 8} ${ay - 58} ${ax + 8} ${ay - 46}Z" fill="#ffe27a"/>`,
  };
}

function trash(): Prop {
  const w = 1.2 * T;
  const h = 0.9 * T;
  const ax = w / 2;
  const ay = h - 6;
  const bag: Tone = ['#3a3d4a', '#262833'];
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay, 34, 6) +
      shaded(
        `M${ax - 34} ${ay}Q${ax - 40} ${ay - 34} ${ax - 14} ${ay - 36}Q${ax} ${ay - 28} ${ax - 2} ${ay}Z`,
        bag,
        LINE,
        -3,
        -3,
      ) +
      shaded(
        `M${ax - 8} ${ay}Q${ax - 10} ${ay - 44} ${ax + 14} ${ay - 42}Q${ax + 38} ${ay - 38} ${ax + 32} ${ay}Z`,
        ['#4a4e5c', '#363a47'],
        LINE,
        -3,
        -3,
      ) +
      stroke(`M${ax + 10} ${ay - 42}l-4 -8l8 2`, LINE, 2.5) +
      flat(rr(ax - 30, ay - 10, 18, 10, 2), '#d8cfbf', LINE, 1.5),
  };
}

function tyres(): Prop {
  const w = 1 * T;
  const h = 1.2 * T;
  const ax = w / 2;
  const ay = h - 6;
  let s = shadow(ax, ay, 28, 6);
  for (let i = 0; i < 3; i++) {
    const y = ay - 10 - i * 18;
    s += `<ellipse cx="${ax}" cy="${y}" rx="26" ry="11" fill="#2a2a30" stroke="${LINE}" stroke-width="2.5"/><ellipse cx="${ax}" cy="${y - 3}" rx="11" ry="4" fill="#5d5853"/>`;
  }
  return { w, h, ax, ay, foot: [1, 1], body: s };
}

function junkPile(): Prop {
  const foot: [number, number] = [3, 2];
  const { w, h, ax, ay, L, R } = frame(foot, 2.2, 0.2);
  const r = rng(91);
  let s = shadow(ax, ay - 2, 1.7 * T, 10, 0.24);
  s += shaded(
    `M${L} ${ay}Q${L + 0.4 * T} ${ay - 1.4 * T} ${ax} ${ay - 1.7 * T}Q${R - 0.4 * T} ${ay - 1.4 * T} ${R} ${ay}Z`,
    ['#7d7770', '#625d57'],
    LINE,
    -6,
    -6,
  );
  for (let i = 0; i < 9; i++) {
    const x = L + 20 + r() * (R - L - 40);
    const y = ay - 14 - r() * 1.2 * T * (1 - Math.abs(x - ax) / (1.6 * T));
    const kind = Math.floor(r() * 3);
    if (kind === 0) s += shaded(rr(x - 14, y - 8, 28, 14, 2), RUST, LINE, -2, -2, 2);
    else if (kind === 1)
      s += flat(circ(x, y, 10), '#2a2a30', LINE, 2) + fill(circ(x, y, 4), '#8a929e');
    else s += stroke(`M${n(x - 14)} ${n(y)}l28 -10`, '#b7bec9', 5);
  }
  return { w, h, ax, ay, foot, body: s };
}

function ring(): Prop {
  const foot: [number, number] = [5, 5];
  const { w, h, ax, ay, L, R } = frame(foot, 5.6, 0.3);
  const top = ay - 4.6 * T;
  const floorTop = ay - 0.6 * T;
  let s = shadow(ax, ay - 2, 2.8 * T, 14, 0.26);
  // mat seen from above (a big square above the apron)
  s += shaded(rr(L + 6, top, R - L - 12, floorTop - top, 6), ['#4c8fd6', '#36689f'], LINE, -6, -6);
  s += flat(rr(L + 30, top + 26, R - L - 60, floorTop - top - 52, 4), 'none', '#ffffff', 3);
  s += shaded(rr(L, floorTop, R - L, ay - floorTop, 4), ['#ff3d50', '#bd1c31'], LINE, -6, -3);
  for (const [x, y] of [
    [L + 8, top - 30],
    [R - 20, top - 30],
    [L + 8, floorTop - 70],
    [R - 20, floorTop - 70],
  ] as const)
    s += shaded(rr(x, y, 12, 76, 4), METAL, LINE, -2, 0, 2.5);
  for (const k of [0, 1, 2]) {
    const off = 14 + k * 18;
    s += stroke(
      `M${L + 14} ${top - 26 + off}H${R - 14}M${L + 14} ${floorTop - 66 + off}H${R - 14}M${L + 14} ${top - 26 + off}V${floorTop - 66 + off}M${R - 14} ${top - 26 + off}V${floorTop - 66 + off}`,
      k === 1 ? '#ffffff' : '#ff3d50',
      4,
    );
  }
  return { w, h, ax, ay, foot, body: s };
}

function gym(): Prop {
  const foot: [number, number] = [5, 3];
  const { w, h, ax, ay, L, R } = frame(foot, 3.6);
  const roofTop = ay - 3.2 * T;
  const facadeTop = ay - 2.3 * T;
  let s = shadow(ax, ay - 2, 2.7 * T, 12, 0.24);
  s += flatRoof(L, R, roofTop, facadeTop - roofTop + 4, ['#6f7380', '#585c68']);
  s += shaded(rr(L, facadeTop, R - L, ay - facadeTop, 3), ['#8a929e', '#6f7783'], LINE, -8, -3);
  for (let x = L + 10; x < R - 4; x += 12)
    s += stroke(`M${x} ${facadeTop + 4}V${ay - 4}`, '#6f7783', 2.5, 0.8);
  s += shaded(
    rr(ax - 1.1 * T, facadeTop + 10, 2.2 * T, 34, 6),
    ['#2b2e38', '#1d1f26'],
    LINE,
    -2,
    -2,
  );
  // dumbbell sign
  s +=
    stroke(`M${ax - 26} ${facadeTop + 27}h52`, '#b7bec9', 5) +
    flat(rr(ax - 34, facadeTop + 17, 10, 20, 3), '#ff3d50', LINE, 2) +
    flat(rr(ax + 24, facadeTop + 17, 10, 20, 3), '#ff3d50', LINE, 2);
  s += shaded(rr(ax - 0.8 * T, ay - 1.2 * T, 1.6 * T, 1.2 * T - 2, 3), METAL, LINE, -3, -2);
  for (let k = 1; k < 7; k++)
    s += stroke(`M${ax - 0.8 * T + 4} ${n(ay - 1.2 * T + k * 10)}h${1.6 * T - 8}`, '#8a929e', 2);
  s += windowAt(L + 16, facadeTop + 60, 1 * T, 40, { glass: GLASS_DARK, line: LINE, r: 2 });
  s += windowAt(R - 16 - T, facadeTop + 60, 1 * T, 40, { glass: GLASS_DARK, line: LINE, r: 2 });
  return { w, h, ax, ay, foot, body: s };
}

function factory(): Prop {
  const foot: [number, number] = [9, 5];
  const { w, h, ax, ay, L, R } = frame(foot, 7.2, 0.3);
  const facadeTop = ay - 3 * T;
  const roofTop = ay - 4.2 * T;
  const brick: Tone = ['#9a5a44', '#7c4636'];
  let s = shadow(ax, ay - 2, 4.8 * T, 16, 0.28);
  // tall chimney
  const cx = R - 1.4 * T;
  s += shaded(
    `M${cx - 26} ${facadeTop}L${cx - 18} ${ay - 7 * T}H${cx + 18}L${cx + 26} ${facadeTop}Z`,
    brick,
    LINE,
    -4,
    -2,
  );
  s += bricks(cx - 24, ay - 6.9 * T, 48, 3.8 * T, '#5e3326', 0.5);
  s += shaded(rr(cx - 24, ay - 7.05 * T, 48, 12, 3), ['#5d5853', '#45413d'], LINE, -1, -1, 2);
  // saw-tooth roof
  const teeth = 4;
  const tw = (R - L) / teeth;
  for (let i = 0; i < teeth; i++) {
    const x = L + i * tw;
    s += shaded(
      poly([
        [x, facadeTop + 4],
        [x, roofTop],
        [x + tw, facadeTop - 10],
        [x + tw, facadeTop + 4],
      ]),
      ['#6f6a64', '#57534e'],
      LINE,
      -4,
      -4,
    );
    s += shaded(
      poly([
        [x + 4, roofTop + 8],
        [x + 4, facadeTop - 4],
        [x + 18, facadeTop - 6],
        [x + 18, roofTop + 14],
      ]),
      GLASS_DARK,
      LINE,
      -1,
      -1,
      2,
    );
  }
  s += shaded(rr(L, facadeTop, R - L, ay - facadeTop, 3), brick, LINE, -12, -4);
  s += bricks(L + 3, facadeTop + 3, R - L - 6, ay - facadeTop - 6, '#5e3326', 0.45);
  const r = rng(97);
  for (let c = 0; c < 8; c++) {
    const x = L + 18 + c * ((R - L - 36) / 8) + 6;
    s += brokenWindow(x, facadeTop + 22, 40, 0.9 * T, Math.floor(r() * 3));
  }
  s += shaded(rr(ax - 1.1 * T, ay - 1.5 * T, 2.2 * T, 1.5 * T - 2, 3), RUST, LINE, -4, -2);
  for (let k = 1; k < 9; k++)
    s += stroke(`M${ax - 1.1 * T + 4} ${n(ay - 1.5 * T + k * 10)}h${2.2 * T - 8}`, '#5e3820', 2);
  return { w, h, ax, ay, foot, body: s };
}

function deadTree(): Prop {
  const w = 1.8 * T;
  const h = 2.6 * T;
  const ax = w / 2;
  const ay = h - 8;
  const branches = `M${ax} ${ay}V${ay - 1.3 * T}M${ax} ${ay - 0.9 * T}l-30 -34l-10 -22M${ax} ${ay - 1.1 * T}l28 -30l18 -8M${ax} ${ay - 1.3 * T}l-6 -40l10 -20M${ax - 30} ${ay - 0.9 * T - 34}l-20 -6M${ax + 28} ${ay - 1.1 * T - 30}l4 -24`;
  return {
    w,
    h,
    ax,
    ay,
    foot: [1, 1],
    body:
      shadow(ax, ay - 2, 26, 6) + stroke(branches, '#3a2a20', 13) + stroke(branches, '#6b5444', 8),
  };
}

function bazaarStall(seed: number, tarp: Tone): Prop {
  const foot: [number, number] = [3, 1];
  const { w, h, ax, ay, L, R } = frame(foot, 2.2, 0.15);
  const r = rng(seed);
  let s = shadow(ax, ay - 2, 1.6 * T, 8, 0.22);
  s += stroke(`M${L + 6} ${ay - 1.7 * T}V${ay}M${R - 6} ${ay - 1.7 * T}V${ay}`, '#5d5853', 5);
  s += shaded(
    rr(L + 2, ay - 0.7 * T, R - L - 4, 0.7 * T - 2, 3),
    ['#8f6339', '#6b4229'],
    LINE,
    -4,
    -2,
  );
  for (let i = 0; i < 6; i++) {
    const x = L + 16 + i * ((R - L - 32) / 5);
    s += shaded(
      rr(x - 10, ay - 0.7 * T - 16, 20, 16, 3),
      [['#b7bec9', '#ffc93c', '#4cc7ff', '#a3e635'][Math.floor(r() * 4)]!, '#5d5853'],
      LINE,
      -1,
      -1,
      2,
    );
  }
  s += shaded(
    `M${L - 8} ${ay - 1.5 * T}L${L + 10} ${ay - 1.95 * T}H${R - 10}L${R + 8} ${ay - 1.5 * T}Q${ax} ${ay - 1.35 * T} ${L - 8} ${ay - 1.5 * T}Z`,
    tarp,
    LINE,
    -4,
    -4,
  );
  return { w, h, ax, ay, foot, body: s };
}

const puddle = (): Prop => ({
  w: 90,
  h: 44,
  ax: 45,
  ay: 34,
  flat: true,
  body: `<ellipse cx="45" cy="22" rx="38" ry="14" fill="#5f6b70" opacity="0.8"/><ellipse cx="36" cy="18" rx="14" ry="4" fill="#a9b6bb" opacity="0.6"/>`,
});

const rubble = (): Prop => ({
  w: 56,
  h: 30,
  ax: 28,
  ay: 24,
  flat: true,
  body:
    flat(
      poly([
        [6, 22],
        [12, 12],
        [22, 16],
        [20, 24],
      ]),
      '#8a847c',
      LINE,
      1.5,
    ) +
    flat(
      poly([
        [28, 24],
        [32, 14],
        [44, 12],
        [48, 24],
      ]),
      '#a39d93',
      LINE,
      1.5,
    ) +
    flat(rr(20, 8, 10, 7, 2), '#b8644a', LINE, 1.2),
});

const crack = (): Prop => ({
  w: T,
  h: 40,
  ax: T / 2,
  ay: 30,
  flat: true,
  body: stroke('M6 20l14 4l10 -8l12 10l16 -6', '#26282e', 2.5, 0.8),
});

const chain = fenceKit(['#8a929e', '#6f7783'], LINE, { postW: 8, postH: 50, mesh: true });

export const RUINS: Record<string, Prop> = {
  'ruina-a': ruinBlock(201),
  'ruina-b': ruinBlock(202),
  'wrak-a': wreck(['#8f6a5a', '#6e5044']),
  'wrak-b': wreck(['#5f7a8a', '#4a6070']),
  'beczka-ogien': burningBarrel(),
  smieci: trash(),
  opony: tyres(),
  zlom: junkPile(),
  ring: ring(),
  silownia: gym(),
  'sklep-bron': SHOP('bron', ['#8a929e', '#6f7783'], ['#3a3d4a', '#ff3d50']),
  fabryka: factory(),
  'drzewo-suche': deadTree(),
  'bazar-a': bazaarStall(301, ['#4c8fd6', '#36689f']),
  'bazar-b': bazaarStall(302, ['#ff9a1f', '#d97a0b']),
  'graffiti-d': graffitiWall(34, GRAFFITI_COLORS, true),
  'graffiti-e': graffitiWall(35, GRAFFITI_COLORS, true),
  kaluza: puddle(),
  gruz: rubble(),
  pekniecie: crack(),
  'siatka-post': chain.post,
  'siatka-h': chain.h,
  'siatka-v': chain.v,
};
