// Drawing kit for the world props: the Buds cel style (base + shade nudged to the bottom-right + highlight
// from the top-left, light from the top-left) with soft contours darker than the object's own colour.
// Only characters carry the black outline, so they pop out of the world.

/** SVG units per tile. Props are rendered at PPU px per tile (export-art.ts). */
export const T = 64;

export type Prop = {
  w: number;
  h: number;
  /** Ground point (anchor) inside the canvas: the bottom-centre of the footprint. */
  ax: number;
  ay: number;
  body: string;
  /** Lies flat on the ground (road markings, flowers): always drawn under characters. */
  flat?: boolean;
  /** Blocked cells, in tiles [width, depth]; the anchor is the middle of the bottom row. Width must be odd. */
  foot?: [number, number];
};

export type Tone = [base: string, dark: string];

export const n = (v: number) => +v.toFixed(2);

export const circ = (cx: number, cy: number, r: number) =>
  `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;

export const rr = (x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  return `M${n(x + r)} ${n(y)}H${n(x + w - r)}Q${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}V${n(y + h - r)}Q${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}H${n(x + r)}Q${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - r)}V${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Z`;
};

export const poly = (pts: [number, number][]) =>
  `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;

let ids = 0;
export const resetIds = () => (ids = 0);

/** Shape with cel shading: dark fill, base nudged towards the light and clipped, contour on top. */
export function shaded(
  d: string,
  [base, dark]: Tone,
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
    (width > 0
      ? `<path d="${d}" fill="none" stroke="${line}" stroke-width="${width}" stroke-linejoin="round"/>`
      : '')
  );
}

/** Flat fill with a contour (details inside a shaded shape). */
export const flat = (d: string, fill: string, line: string, width = 2) =>
  `<path d="${d}" fill="${fill}" stroke="${line}" stroke-width="${width}" stroke-linejoin="round"/>`;

export const fill = (d: string, color: string, opacity = 1) =>
  `<path d="${d}" fill="${color}"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`;

export const stroke = (d: string, color: string, width = 3, opacity = 1) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`;

/** Puffy blob made of circles: one silhouette, shade, base and leafy highlights clipped to it. */
export function puffs(
  circles: [number, number, number][],
  c: { base: string; dark: string; light: string; line: string },
  extra = '',
  outline = 7,
): string {
  const id = `p${ids++}`;
  const all = circles.map(([x, y, r]) => `<path d="${circ(x, y, r)}"/>`).join('');
  const lights = circles
    .map(([x, y, r]) => `<path d="${circ(x - r * 0.3, y - r * 0.38, r * 0.5)}"/>`)
    .join('');
  return (
    `<g fill="${c.line}" stroke="${c.line}" stroke-width="${outline}" stroke-linejoin="round">${all}</g>` +
    `<clipPath id="${id}">${all}</clipPath>` +
    `<g fill="${c.dark}">${all}</g>` +
    `<g clip-path="url(#${id})"><g fill="${c.base}" transform="translate(-7 -9)">${all}</g></g>` +
    `<g fill="${c.light}" clip-path="url(#${id})">${lights}</g>` +
    extra
  );
}

export const shadow = (cx: number, cy: number, rx: number, ry: number, o = 0.2) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="#1d2a14" opacity="${o}"/>`;

/** Deterministic pseudo-random numbers for art details (same PNGs every run). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- shared palette ----------
export const LEAF = { base: '#62b84e', dark: '#3f8f3e', light: '#86d062', line: '#2b5a2c' };
export const LEAF2 = { base: '#4fa65a', dark: '#327c46', light: '#73c46c', line: '#21503a' };
export const LEAF3 = { base: '#8cc44c', dark: '#5f9a3a', light: '#b0dc6a', line: '#3f6326' };
export const BARK: Tone = ['#8f5e3b', '#6b4229'];
export const BARK_LINE = '#45291a';
export const STONE: Tone = ['#bdb7ae', '#8f8a83'];
export const STONE_LINE = '#5d5853';
export const STONE_LIGHT = '#dcd8d1';
export const WOOD: Tone = ['#c48a52', '#9a6537'];
export const WOOD_LINE = '#5a3a22';
export const GLASS: Tone = ['#a9dcf5', '#7cc0e6'];
export const GLASS_DARK: Tone = ['#4a6178', '#34465a'];
export const METAL: Tone = ['#b7bec9', '#8a929e'];
export const LINE = '#3d2c24'; // default building contour

// ---------- building helpers ----------

/** Canvas for a building with the given footprint, extra room above for the facade and roof. */
export function frame(foot: [number, number], tilesTall: number, margin = 0.4) {
  const w = (foot[0] + margin * 2) * T;
  const h = (tilesTall + 0.3) * T;
  const ax = w / 2;
  const ay = h - 8;
  const L = ax - (foot[0] * T) / 2;
  const R = ax + (foot[0] * T) / 2;
  return { w, h, ax, ay, L, R };
}

/** A window with frame, glass highlight and optional sill / shutters. */
export function windowAt(
  x: number,
  y: number,
  w: number,
  h: number,
  o: {
    glass?: Tone;
    frame?: string;
    line?: string;
    r?: number;
    cross?: boolean;
    sill?: string;
    lit?: boolean;
  } = {},
): string {
  const line = o.line ?? LINE;
  const glass = o.glass ?? GLASS;
  let s = shaded(rr(x, y, w, h, o.r ?? 4), glass, line, -3, -3, 2.5);
  if (o.cross)
    s += stroke(
      `M${n(x + w / 2)} ${n(y + 1)}V${n(y + h - 1)}M${n(x + 1)} ${n(y + h / 2)}H${n(x + w - 1)}`,
      o.frame ?? line,
      2.5,
    );
  if (o.lit !== false)
    s += stroke(`M${n(x + w * 0.22)} ${n(y + h * 0.22)}l${n(w * 0.2)} 0`, '#ffffff', 3, 0.75);
  if (o.sill) s += flat(rr(x - 3, y + h - 1, w + 6, 6, 2), o.sill, line, 2);
  return s;
}

/** Grid of windows across a facade band. */
export function windowGrid(
  L: number,
  R: number,
  top: number,
  bottom: number,
  cols: number,
  rows: number,
  o: Parameters<typeof windowAt>[4] & {
    ww?: number;
    wh?: number;
    skip?: (c: number, r: number) => boolean;
    extra?: (x: number, y: number, w: number, h: number, c: number, r: number) => string;
  } = {},
): string {
  const cw = (R - L) / cols;
  const ch = (bottom - top) / rows;
  const ww = o.ww ?? cw * 0.56;
  const wh = o.wh ?? ch * 0.6;
  let s = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (o.skip?.(c, r)) continue;
      const x = L + c * cw + (cw - ww) / 2;
      const y = top + r * ch + (ch - wh) / 2;
      s += windowAt(x, y, ww, wh, o);
      if (o.extra) s += o.extra(x, y, ww, wh, c, r);
    }
  return s;
}

/** Striped, scalloped shop awning between x0 and x1. */
export function awning(
  x0: number,
  x1: number,
  y: number,
  h: number,
  a: string,
  b: string,
  line = LINE,
): string {
  const stripes = Math.max(4, Math.round((x1 - x0) / 22));
  const sw = (x1 - x0) / stripes;
  let s = '';
  for (let i = 0; i < stripes; i++) {
    const sx = x0 + i * sw;
    s += `<path d="M${n(sx)} ${n(y)}H${n(sx + sw)}V${n(y + h)}Q${n(sx + sw / 2)} ${n(y + h + 10)} ${n(sx)} ${n(y + h)}Z" fill="${i % 2 ? b : a}"/>`;
  }
  let edge = `M${n(x0)} ${n(y)}H${n(x1)}V${n(y + h)}`;
  for (let i = stripes - 1; i >= 0; i--)
    edge += `Q${n(x0 + i * sw + sw / 2)} ${n(y + h + 10)} ${n(x0 + i * sw)} ${n(y + h)}`;
  s += `<path d="${edge}Z" fill="none" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>`;
  s += stroke(`M${n(x0 + 4)} ${n(y + 4)}H${n(x1 - 4)}`, '#ffffff', 3, 0.35);
  return s;
}

/** Flat roof seen from above: parapet edge and a lighter top surface. */
export function flatRoof(
  L: number,
  R: number,
  top: number,
  depth: number,
  tone: Tone,
  line = LINE,
): string {
  return (
    shaded(rr(L - 4, top, R - L + 8, depth, 6), tone, line, -6, -6) +
    flat(rr(L + 8, top + 8, R - L - 16, depth - 20, 4), tone[1], line, 0)
  );
}

/** Brick texture: staggered short strokes over a wall rectangle (clipped). */
export function bricks(
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  opacity = 0.45,
): string {
  const id = `b${ids++}`;
  let d = '';
  for (let row = 0, yy = y + 6; yy < y + h; row++, yy += 9) {
    for (let xx = x + (row % 2 ? 0 : 9); xx < x + w; xx += 18) d += `M${n(xx)} ${n(yy)}h12`;
  }
  return `<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/></clipPath><g clip-path="url(#${id})">${stroke(d, color, 2.5, opacity)}</g>`;
}

/** Simple door with a knob; arched when `arch`. */
export function door(
  cx: number,
  bottom: number,
  w: number,
  h: number,
  tone: Tone,
  line = LINE,
  arch = false,
): string {
  const x = cx - w / 2;
  const d = arch
    ? `M${n(x)} ${n(bottom)}V${n(bottom - h + w / 2)}Q${n(x)} ${n(bottom - h)} ${n(cx)} ${n(bottom - h)}Q${n(x + w)} ${n(bottom - h)} ${n(x + w)} ${n(bottom - h + w / 2)}V${n(bottom)}Z`
    : rr(x, bottom - h, w, h, 4);
  return (
    shaded(d, tone, line, -4, -3) +
    `<circle cx="${n(cx + w * 0.28)}" cy="${n(bottom - h * 0.45)}" r="3" fill="#ffc93c" stroke="${line}" stroke-width="1.5"/>`
  );
}
