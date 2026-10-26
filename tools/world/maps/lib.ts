// Map authoring kit: paint grounds and props on a grid, then write the text format the game reads
// (apps/unity/Assets/Buds/Scripts/Runtime/World/MapFormat.cs). The text file is the source of truth; these
// scripts are just a convenient way to lay out big districts.
import { ALL_PROPS } from '../art/index';

export type Cell = { g: string; p?: string; s?: boolean };
export const PLOT_KINDS = ['quest', 'attraction', 'minigame', 'shop', 'arena'] as const;
export type PlotKind = (typeof PLOT_KINDS)[number];
export type Rect = [x0: number, y0: number, x1: number, y1: number];

/** Readable characters for common cells; everything else gets the next free character. */
const PREFERRED: Record<string, string> = {
  grass: '.',
  grass2: ',',
  asphalt: '=',
  sidewalk: ':',
  path: '-',
  water: '~',
  sand: '_',
  plaza: '+',
  cobble: ';',
  dirt: "'",
};
const POOL = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*?@^!{}<>()|"`',
  // more symbols for busy districts (the file is UTF-8): Greek and Latin-1 letters
  ...Array.from({ length: 25 }, (_, i) => String.fromCharCode(0x391 + i)).filter((c) => c !== '΢'),
  ...Array.from({ length: 25 }, (_, i) => String.fromCharCode(0x3b1 + i)),
  ...Array.from({ length: 62 }, (_, i) => String.fromCharCode(0xc0 + i)).filter(
    (c) => c !== '×' && c !== '÷',
  ),
];

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

/** Smooth 2D value noise in 0..1 (for organic coastlines and forest edges). */
export function noise2(seed: number, scale: number) {
  const r = rng(seed);
  const size = 64;
  const table = Array.from({ length: size * size }, () => r());
  const at = (x: number, y: number) =>
    table[(((y % size) + size) % size) * size + (((x % size) + size) % size)]!;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const fx = x / scale;
    const fy = y / scale;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = smooth(fx - x0);
    const ty = smooth(fy - y0);
    const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
}

export class MapCanvas {
  readonly cells: Cell[][];
  readonly signs: { x: number; y: number; title: string; text: string }[] = [];
  readonly exits: { r: Rect; district: string }[] = [];
  readonly zones: { r: Rect; name: string }[] = [];
  /** Doors into interiors: (x, y) is the building's anchor (middle of its bottom row), entered from below. */
  readonly doors: { x: number; y: number; target: string; name: string }[] = [];
  /**
   * Plots: free, reachable areas kept for content to come (quests, NPCs, attractions). Content refers to them by
   * id; the map promises they stay clear.
   */
  readonly plots: { r: Rect; id: string; kind: PlotKind; name: string }[] = [];
  readonly scatter: { ground: string; chance: number; props: string }[] = [];
  /** Działki on a wasteland: fenced plots players buy (top-left cell, the side the gate faces). */
  readonly lots: { id: string; x: number; y: number; gate: 'n' | 's' | 'e' | 'w' }[] = [];
  readonly ground: { name: string; kinds: string; radius: number; bands: [number, string][] }[] =
    [];
  base = '#86c95a';
  spawn: [number, number] = [0, 0];
  /** An interior belongs to the district it is entered from (`outside`). */
  kind: 'district' | 'interior' = 'district';
  outside?: string;
  /** Script that builds this map (named in the file header). */
  source?: string;

  constructor(
    readonly id: string,
    readonly name: string,
    readonly w: number,
    readonly h: number,
    fillGround = 'grass',
  ) {
    this.cells = Array.from({ length: h }, () =>
      Array.from({ length: w }, () => ({ g: fillGround })),
    );
  }

  in(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): Cell | undefined {
    return this.in(x, y) ? this.cells[y]![x] : undefined;
  }

  set(x: number, y: number, c: Cell) {
    if (this.in(x, y)) this.cells[y]![x] = { ...c };
  }

  /** Change only the ground, keeping props/solidity. */
  ground_(x: number, y: number, g: string) {
    const c = this.get(x, y);
    if (c) c.g = g;
  }

  rect([x0, y0, x1, y1]: Rect, c: Cell | ((x: number, y: number) => Cell | null)) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        const v = typeof c === 'function' ? c(x, y) : c;
        if (v) this.set(x, y, v);
      }
  }

  each(fn: (x: number, y: number, c: Cell) => void) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) fn(x, y, this.cells[y]![x]!);
  }

  /** Is the rectangle free of props and solid cells (and inside the map)? */
  free([x0, y0, x1, y1]: Rect, grounds?: string[]) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const c = this.get(x, y);
        if (!c || c.p || c.s || (grounds && !grounds.includes(c.g))) return false;
      }
    return true;
  }

  /**
   * Places a prop anchored at (x, y) = middle of the footprint's bottom row. The footprint (from the art)
   * becomes solid; `ground` (default: keep) is painted under it. Returns false if the spot is taken.
   */
  place(
    name: string,
    x: number,
    y: number,
    opts: { ground?: string; solid?: boolean; force?: boolean; grounds?: string[] } = {},
  ) {
    const art = ALL_PROPS[name.split('|')[0]!];
    if (!art) throw new Error(`unknown prop ${name}`);
    const [fw, fh] = art.foot ?? [1, 1];
    if (fw % 2 === 0) throw new Error(`${name}: footprint width must be odd`);
    const r: Rect = [x - (fw - 1) / 2, y - fh + 1, x + (fw - 1) / 2, y];
    if (!opts.force && !this.free(r, opts.grounds)) return false;
    const solid = opts.solid ?? !art.flat;
    for (let yy = r[1]; yy <= r[3]; yy++)
      for (let xx = r[0]; xx <= r[2]; xx++) {
        const c = this.get(xx, yy);
        if (!c) continue;
        this.set(xx, yy, { g: opts.ground ?? c.g, s: solid || undefined });
      }
    const c = this.get(x, y)!;
    this.set(x, y, { g: c.g, p: name, s: solid || undefined });
    return true;
  }

  /** Scatter single-cell props over cells whose ground is in `on`, inside `area`. */
  sprinkle(
    area: Rect,
    names: string[],
    chance: number,
    on: string[],
    seed: number,
    opts: { solid?: boolean; spacing?: number } = {},
  ) {
    const r = rng(seed);
    const [x0, y0, x1, y1] = area;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (r() >= chance) continue;
        const c = this.get(x, y);
        if (!c || !on.includes(c.g) || c.p || c.s) continue;
        if (opts.spacing && this.near(x, y, opts.spacing)) continue;
        this.place(names[Math.floor(r() * names.length)]!, x, y, { solid: opts.solid });
      }
  }

  /** Any non-flat prop within `d` cells? */
  near(x: number, y: number, d: number) {
    for (let yy = y - d; yy <= y + d; yy++)
      for (let xx = x - d; xx <= x + d; xx++) {
        const c = this.get(xx, yy);
        if (c?.p && !ALL_PROPS[c.p.split('|')[0]!]?.flat) return true;
      }
    return false;
  }

  /** Straight road of `width` cells along x (horizontal) or y, with dashes in the middle. */
  road(
    axis: 'h' | 'v',
    from: number,
    to: number,
    at: number,
    width: number,
    opts: { sidewalk?: boolean; dashes?: boolean } = {},
  ) {
    const { sidewalk = true, dashes = true } = opts;
    for (let i = from; i <= to; i++)
      for (let k = -1; k <= width; k++) {
        const [x, y] = axis === 'h' ? [i, at + k] : [at + k, i];
        const edge = k === -1 || k === width;
        if (edge) {
          if (sidewalk && this.get(x, y)?.g !== 'asphalt') this.set(x, y, { g: 'sidewalk' });
        } else this.set(x, y, { g: 'asphalt' });
      }
    if (dashes && width >= 2 && width % 2 === 0) {
      const mid = at + width / 2 - 1;
      for (let i = from + 1; i < to; i += 2) {
        const [x, y] = axis === 'h' ? [i, mid] : [mid, i];
        const c = this.get(x, y);
        if (c?.g === 'asphalt' && !c.p)
          this.set(x, y, { g: 'asphalt', p: axis === 'h' ? 'road-dash' : 'road-dash-v' });
      }
    }
  }

  /** Organic blob (lake, grove): cells within radius r of (cx, cy), wobbled by noise. */
  blob(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    seed: number,
    fn: (x: number, y: number) => void,
  ) {
    const nz = noise2(seed, 4);
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++)
      for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
        const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
        if (d <= 0.85 + nz(x, y) * 0.3 && this.in(x, y)) fn(x, y);
      }
  }

  sign(x: number, y: number, title: string, text: string) {
    this.place('sign', x, y, { force: true });
    this.signs.push({ x, y, title, text });
  }

  /** Anchors of every placed prop with this name, top to bottom, left to right. */
  find(name: string): [number, number][] {
    const out: [number, number][] = [];
    this.each((x, y, c) => {
      if (c.p?.split('|').includes(name)) out.push([x, y]);
    });
    return out;
  }

  /**
   * The building anchored at (x, y) gets a door into `target` (an interior map): a mat in front marks it, and
   * small things standing right in front of it (a tree, a lamp, a bench) make way so the door can be seen.
   */
  door([x, y]: [number, number], target: string, name: string) {
    if (!this.get(x, y)?.p)
      throw new Error(`${this.id}: no building at ${x},${y} for door ${target}`);
    for (let yy = y + 1; yy <= y + 2; yy++)
      for (let xx = x - 1; xx <= x + 1; xx++) {
        const c = this.get(xx, yy);
        const art = c?.p ? ALL_PROPS[c.p.split('|')[0]!] : undefined;
        if (c && art && (art.foot ?? [1, 1]).join() === '1,1' && c.p !== 'sign')
          this.set(xx, yy, { g: c.g });
      }
    const front = this.get(x, y + 1);
    if (!front || front.s || front.p) throw new Error(`${this.id}: door to ${target} is blocked`);
    this.set(x, y + 1, { g: front.g, p: 'wycieraczka-wejscie' });
    this.doors.push({ x, y, target, name });
  }

  /** Keeps a rectangle clear (ground `g`, no props, walkable) for future content. */
  plot(r: Rect, id: string, kind: PlotKind, name: string, g?: string) {
    this.rect(r, (x, y) => ({ g: g ?? this.get(x, y)?.g ?? 'grass' }));
    this.plots.push({ r, id, kind, name });
  }

  exit(r: Rect, district: string) {
    this.exits.push({ r, district });
  }

  zone(r: Rect, name: string) {
    this.zones.push({ r, name });
  }

  // ---------- validation ----------

  walkable(x: number, y: number) {
    const c = this.get(x, y);
    return !!c && !c.s;
  }

  /** Cells reachable on foot from the spawn point. */
  reach() {
    const seen = new Set<number>();
    const q: [number, number][] = [this.spawn];
    seen.add(this.spawn[1] * this.w + this.spawn[0]);
    while (q.length) {
      const [x, y] = q.pop()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const k = ny * this.w + nx;
        if (!this.walkable(nx, ny) || seen.has(k)) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    return seen;
  }

  validate() {
    const errors: string[] = [];
    if (!this.walkable(...this.spawn)) errors.push(`spawn ${this.spawn} is blocked`);
    const seen = this.reach();
    for (const e of this.exits) {
      const [x0, y0, x1, y1] = e.r;
      let ok = false;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) if (seen.has(y * this.w + x)) ok = true;
      if (!ok) errors.push(`exit to ${e.district} is unreachable`);
    }
    for (const z of this.zones) {
      const [x0, y0, x1, y1] = z.r;
      let ok = false;
      for (let y = y0; y <= y1 && !ok; y++)
        for (let x = x0; x <= x1 && !ok; x++) if (seen.has(y * this.w + x)) ok = true;
      if (!ok) errors.push(`zone ${z.name} has no reachable cell`);
    }
    for (const s of this.signs) {
      if (this.get(s.x, s.y)?.p !== 'sign') errors.push(`sign "${s.title}" was painted over`);
      const ok = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ].some(([dx, dy]) => seen.has((s.y + dy!) * this.w + s.x + dx!));
      if (!ok) errors.push(`sign "${s.title}" can't be reached`);
    }
    for (const d of this.doors)
      if (!seen.has((d.y + 1) * this.w + d.x)) errors.push(`door to ${d.target} can't be reached`);
    for (const p of this.plots) {
      const [x0, y0, x1, y1] = p.r;
      let open = true;
      let reached = false;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const c = this.get(x, y);
          if (!c || c.s || c.p) open = false;
          if (seen.has(y * this.w + x)) reached = true;
        }
      if (!open) errors.push(`plot ${p.id} is not clear`);
      if (!reached) errors.push(`plot ${p.id} can't be reached`);
    }
    if (this.kind !== 'district' && !this.exits.some((e) => e.district === this.outside))
      errors.push(`interior has no way out to ${this.outside}`);
    if (errors.length) throw new Error(`${this.id}:\n  ${errors.join('\n  ')}`);
    let walk = 0;
    this.each((x, y) => this.walkable(x, y) && walk++);
    return { reachable: seen.size, walkable: walk };
  }

  // ---------- output ----------

  toText(): string {
    const keyOf = (c: Cell) => `${c.g}${c.p ? ` + ${c.p}` : ''}${c.s ? ' !' : ''}`;
    const chars = new Map<string, string>();
    const used = new Set<string>();
    const pool = [...POOL];
    const charFor = (c: Cell) => {
      const key = keyOf(c);
      let ch = chars.get(key);
      if (ch) return ch;
      const pref = !c.p && !c.s ? PREFERRED[c.g] : undefined;
      ch = pref && !used.has(pref) ? pref : pool.find((p) => !used.has(p));
      if (!ch) throw new Error('ran out of legend characters');
      used.add(ch);
      chars.set(key, ch);
      return ch;
    };
    const rows = this.cells.map((row) => row.map(charFor).join(''));
    const legend = [...chars.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, ch]) => `${ch} = ${key}`);
    const out: string[] = [
      `// ${this.name} — generated by tools/world/maps/${this.source ?? `${this.id}.ts`} (edit the script or this file; the game reads this file)`,
      '[district]',
      `id = ${this.id}`,
      `name = ${this.name}`,
      `base = ${this.base}`,
      `spawn = ${this.spawn[0]},${this.spawn[1]}`,
      ...(this.kind !== 'district' ? [`kind = ${this.kind}`, `outside = ${this.outside}`] : []),
      '',
      '[legend]',
      ...legend,
      '',
      '[ground]',
      ...this.ground.map(
        (g) =>
          `${g.name} : ${g.kinds} : ${g.radius} : ${g.bands.map(([t, c]) => `${t} ${c}`).join(', ')}`,
      ),
      '',
      '[scatter]',
      ...this.scatter.map((s) => `${s.ground} : ${s.chance} : ${s.props}`),
      '',
      '[signs]',
      ...this.signs.map((s) => `${s.x},${s.y} | ${s.title} | ${s.text}`),
      '',
      '[exits]',
      ...this.exits.map((e) => `${e.r.join(',')} | ${e.district}`),
      '',
      '[zones]',
      ...this.zones.map((z) => `${z.r.join(',')} | ${z.name}`),
      '',
      '[doors]',
      ...this.doors.map((d) => `${d.x},${d.y} | ${d.target} | ${d.name}`),
      '',
      '[plots]',
      ...this.plots.map((p) => `${p.r.join(',')} | ${p.id} | ${p.kind} | ${p.name}`),
      '',
      '[grid]',
      ...rows,
      '',
    ];
    return out.join('\n');
  }
}
