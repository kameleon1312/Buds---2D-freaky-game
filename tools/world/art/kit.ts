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
  // leaf detail, the same for a crown every time (seeded by its shape): small leaf clusters with their own shade
  // inside the foliage, deeper shade where the clumps overlap, and a few sun dapples on the lit side
  const r = rng(Math.round(circles.reduce((a, [x, y, cr]) => a + x * 3 + y * 7 + cr * 11, 0)));
  let clusters = '';
  let deep = '';
  let dapples = '';
  for (const [x, y, cr] of circles) {
    deep += `<path d="${circ(x + cr * 0.28, y + cr * 0.42, cr * 0.42)}"/>`;
    const count = Math.max(1, Math.round(cr / 13));
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const d = cr * (0.25 + r() * 0.55);
      const lx = x + Math.cos(a) * d;
      const ly = y + Math.sin(a) * d;
      const lr = cr * (0.16 + r() * 0.1);
      // a leaf clump: a scalloped arc that catches light on top and shades underneath
      clusters += `<path d="M${n(lx - lr)} ${n(ly)}q${n(lr * 0.5)} ${n(-lr * 0.9)} ${n(lr)} 0q${n(lr * 0.5)} ${n(-lr * 0.9)} ${n(lr)} 0"/>`;
    }
    if (r() > 0.35)
      dapples += `<path d="${circ(x - cr * (0.1 + r() * 0.35), y - cr * (0.35 + r() * 0.25), 1.6 + r() * 2)}"/>`;
  }
  return (
    `<g fill="${c.line}" stroke="${c.line}" stroke-width="${outline}" stroke-linejoin="round">${all}</g>` +
    `<clipPath id="${id}">${all}</clipPath>` +
    `<g fill="${c.dark}">${all}</g>` +
    `<g clip-path="url(#${id})"><g fill="${c.base}" transform="translate(-7 -9)">${all}</g></g>` +
    `<g fill="${c.line}" opacity="0.16" clip-path="url(#${id})">${deep}</g>` +
    `<g fill="${c.light}" clip-path="url(#${id})">${lights}</g>` +
    `<g fill="none" stroke="${c.dark}" stroke-width="2.4" stroke-linecap="round" opacity="0.5" clip-path="url(#${id})">${clusters}</g>` +
    `<g fill="#fffbe0" opacity="0.55" clip-path="url(#${id})">${dapples}</g>` +
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
  const r = rng(Math.round(x * 13 + y * 7 + w));
  const roll = r();
  // now and then a warm light is on inside (the same windows every export)
  const warm = o.lit !== false && !o.glass && roll > 0.88;
  const glass = warm ? (['#ffe3a1', '#f5b85c'] as Tone) : (o.glass ?? GLASS);
  const shape = rr(x, y, w, h, o.r ?? 4);
  const id = `w${ids++}`;
  // the recess: the wall's own shade around the frame, deeper at the top-left where the light comes from
  let s = fill(rr(x - 3, y - 3, w + 6, h + 6, (o.r ?? 4) + 2), '#1b2030', 0.16);
  s += shaded(shape, glass, line, -3, -3, 2.5);
  s += `<clipPath id="${id}"><path d="${shape}"/></clipPath><g clip-path="url(#${id})">`;
  if (!warm && o.lit !== false) {
    if (roll < 0.22) {
      // curtains drawn to the sides
      const c = ['#f3ede2', '#e8a3a3', '#a8c8e8', '#f2d08a'][Math.floor(r() * 4)]!;
      s += fill(
        `M${n(x)} ${n(y)}h${n(w * 0.3)}q${n(-w * 0.12)} ${n(h * 0.5)} 0 ${n(h)}h${n(-w * 0.3)}Z`,
        c,
        0.9,
      );
      s += fill(
        `M${n(x + w)} ${n(y)}h${n(-w * 0.3)}q${n(w * 0.12)} ${n(h * 0.5)} 0 ${n(h)}h${n(w * 0.3)}Z`,
        c,
        0.9,
      );
    } else if (roll < 0.36) {
      // a blind half way down
      const bh = h * (0.3 + r() * 0.3);
      s += fill(`M${n(x)} ${n(y)}h${n(w)}v${n(bh)}h${n(-w)}Z`, '#e9e2d4', 0.95);
      let slats = '';
      for (let yy = y + 4; yy < y + bh - 1; yy += 4) slats += `M${n(x)} ${n(yy)}h${n(w)}`;
      s += stroke(slats, '#b8ae9c', 1.2, 0.8);
    } else if (roll < 0.5) {
      // the room behind: a darker band low in the glass
      s += fill(`M${n(x)} ${n(y + h * 0.62)}h${n(w)}v${n(h * 0.38)}h${n(-w)}Z`, '#3d5a75', 0.22);
    }
  }
  if (warm) s += fill(circ(x + w * 0.5, y + h * 0.3, Math.min(w, h) * 0.16), '#fff7d6', 0.8); // a lamp inside
  // the sky's reflection: a soft diagonal band across the glass
  s += fill(
    `M${n(x + w * 0.15)} ${n(y + h)}L${n(x + w * 0.55)} ${n(y)}h${n(w * 0.18)}L${n(x + w * 0.33)} ${n(y + h)}Z`,
    '#ffffff',
    warm ? 0.12 : 0.22,
  );
  s += `</g>`;
  // frame drawn again over the curtains and the reflection
  s += `<path d="${shape}" fill="none" stroke="${line}" stroke-width="2.5" stroke-linejoin="round"/>`;
  if (o.cross)
    s += stroke(
      `M${n(x + w / 2)} ${n(y + 1)}V${n(y + h - 1)}M${n(x + 1)} ${n(y + h / 2)}H${n(x + w - 1)}`,
      o.frame ?? line,
      2.5,
    );
  if (o.lit !== false)
    s += stroke(`M${n(x + w * 0.22)} ${n(y + h * 0.22)}l${n(w * 0.2)} 0`, '#ffffff', 3, 0.75);
  if (o.sill) {
    s += fill(rr(x - 2, y + h + 5, w + 4, 4, 2), '#1b2030', 0.18); // the sill's shadow on the wall
    s += flat(rr(x - 3, y + h - 1, w + 6, 6, 2), o.sill, line, 2);
    // a pot of flowers on some sills
    if (r() > 0.82) {
      const px = x + w * (0.2 + r() * 0.5);
      s += flat(rr(px - 5, y + h - 9, 10, 8, 2), '#c0673f', line, 1.5);
      s +=
        fill(circ(px - 3, y + h - 12, 3.4), '#4f9e45') +
        fill(circ(px + 3, y + h - 12, 3.4), '#62b84e');
      s += fill(circ(px, y + h - 15, 2.2), ['#ff6f91', '#ffd25c', '#ffffff'][Math.floor(r() * 3)]!);
    }
  }
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
  // the shade the awning throws on the shop front
  s =
    fill(
      `M${n(x0 + 2)} ${n(y + h + 4)}H${n(x1 - 2)}V${n(y + h + 18)}H${n(x0 + 2)}Z`,
      '#1b2030',
      0.16,
    ) + s;
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
  const r = rng(Math.round(L * 3 + top * 5 + R));
  let gravel = '';
  for (let i = 0; i < ((R - L) * depth) / 260; i++)
    gravel += `<path d="${circ(L + 10 + r() * (R - L - 20), top + 10 + r() * (depth - 24), 0.9 + r() * 1.2)}"/>`;
  let seams = '';
  for (let xx = L + 40 + r() * 20; xx < R - 20; xx += 48 + r() * 30)
    seams += `M${n(xx)} ${n(top + 10)}v${n(depth - 24)}`;
  return (
    shaded(rr(L - 4, top, R - L + 8, depth, 6), tone, line, -6, -6) +
    flat(rr(L + 8, top + 8, R - L - 16, depth - 20, 4), tone[1], line, 0) +
    stroke(seams, '#000000', 2, 0.12) +
    `<g fill="#ffffff" opacity="0.18">${gravel}</g>` +
    // the parapet's lit edge
    stroke(`M${n(L)} ${n(top + 3)}H${n(R)}`, '#ffffff', 2.5, 0.35)
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
    // the doorway: a dark recess a little wider than the door
    fill(arch ? d : rr(x - 3, bottom - h - 3, w + 6, h + 3, 5), '#1b2030', 0.22) +
    shaded(d, tone, line, -4, -3) +
    // panels on the door leaf
    stroke(
      `M${n(x + w * 0.22)} ${n(bottom - h * 0.78)}h${n(w * 0.56)}M${n(x + w * 0.22)} ${n(bottom - h * 0.4)}h${n(w * 0.56)}`,
      tone[1],
      2,
      0.7,
    ) +
    `<circle cx="${n(cx + w * 0.28)}" cy="${n(bottom - h * 0.45)}" r="3" fill="#ffc93c" stroke="${line}" stroke-width="1.5"/>` +
    // a stone step in front
    flat(rr(x - 6, bottom - 3, w + 12, 6, 2), '#cfc8bc', line, 1.5)
  );
}
