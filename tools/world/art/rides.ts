// Rides (pojazdy), training stations and energy drinks.
//   jazda-<kind>-bok / -przod / -tyl   the ride under a bud: side (facing left, drawn behind the bud), front and
//                                      back (drawn in front of the bud). Anchor = the ground point under the bud.
//   trening-<look>                     training stations standing on the map (packages/shared training.ts)
//   icons for the mounts and drinks of the catalog (rides-and-drinks.ts)
import { T, circ, flat, poly, rr, shaded, shadow, stroke, type Prop, type Tone } from './kit';
import type { Icon } from './icons';

const LINE = '#2b2a33';
const TYRE: Tone = ['#3a3d4a', '#262833'];
const METAL: Tone = ['#b7bec9', '#8a929e'];
const GRIP = '#262833';

export const RIDE_KINDS = [
  'deskorolka',
  'hulajnowa',
  'rower',
  'e-hulajnowa',
  'motocykl',
  'quad',
] as const;
export type RideKind = (typeof RIDE_KINDS)[number];

type Ride = { shape: RideKind; body: Tone; accent: string; glow?: string };
/**
 * Every ride by its art id (mount-<id> in the catalog): the six earned shapes, then the premium ones in their own
 * colours with a glow underneath and a glint (packages/shared premium.ts).
 */
const RIDES: Record<string, Ride> = {
  deskorolka: { shape: 'deskorolka', body: ['#a3e635', '#7cc01a'], accent: '#ffc93c' },
  hulajnowa: { shape: 'hulajnowa', body: ['#4cc7ff', '#1b86c9'], accent: '#f6f2e9' },
  rower: { shape: 'rower', body: ['#ff3d50', '#bd1c31'], accent: '#ffc93c' },
  'e-hulajnowa': { shape: 'e-hulajnowa', body: ['#b45cff', '#8a3fd1'], accent: '#a3e635' },
  motocykl: { shape: 'motocykl', body: ['#3a3d4a', '#262833'], accent: '#ff9a1f' },
  quad: { shape: 'quad', body: ['#ffc93c', '#d98a0b'], accent: '#3a3d4a' },
  // premium
  'deskorolka-holo': {
    shape: 'deskorolka',
    body: ['#ff7aa8', '#b45cff'],
    accent: '#4cc7ff',
    glow: '#ff7aa8',
  },
  'hulajnowa-neon': {
    shape: 'hulajnowa',
    body: ['#a3e635', '#5d9a12'],
    accent: '#ff3d7a',
    glow: '#a3e635',
  },
  'rower-chrom': {
    shape: 'rower',
    body: ['#dcd8d1', '#8a929e'],
    accent: '#ffc93c',
    glow: '#ffe27a',
  },
  'motocykl-smok': {
    shape: 'motocykl',
    body: ['#2c8574', '#1d5c50'],
    accent: '#ff3d50',
    glow: '#3fb39b',
  },
  'quad-wulkan': {
    shape: 'quad',
    body: ['#ff3d50', '#8a1626'],
    accent: '#ffc93c',
    glow: '#ff9a1f',
  },
};

const wheel = (x: number, y: number, r: number, hub = '#b7bec9') =>
  shaded(circ(x, y, r), TYRE, LINE, -1.5, -1.5, 2) + flat(circ(x, y, r * 0.42), hub, LINE, 1.5);

/** A wheel seen from the front or back: a narrow upright tyre. */
const tyre = (x: number, y: number, w: number, h: number) =>
  shaded(rr(x - w / 2, y - h, w, h, w / 2), TYRE, LINE, -1, -1, 2);

// ---------- side views (facing left), ground point at (ax, ay) ----------

function sideShape(kind: RideKind, { body: c, accent: a }: Ride, ax: number, ay: number): string {
  const x = (v: number) => ax + v;
  const y = (v: number) => ay - v;
  switch (kind) {
    case 'deskorolka':
      return (
        shadow(ax, ay, 32, 5) +
        wheel(x(-19), y(6), 6, a) +
        wheel(x(19), y(6), 6, a) +
        stroke(`M${x(-19)} ${y(9)}V${y(12)}M${x(19)} ${y(9)}V${y(12)}`, METAL[1], 4) +
        shaded(
          `M${x(-34)} ${y(20)}Q${x(-31)} ${y(12)} ${x(-24)} ${y(12)}H${x(24)}Q${x(31)} ${y(12)} ${x(34)} ${y(20)}L${x(30)} ${y(21)}Q${x(27)} ${y(17)} ${x(22)} ${y(18)}H${x(-22)}Q${x(-27)} ${y(17)} ${x(-30)} ${y(21)}Z`,
          c,
          LINE,
          -1,
          -1,
          2.5,
        ) +
        stroke(`M${x(-22)} ${y(18)}H${x(22)}`, '#262833', 2.5)
      );
    case 'hulajnowa':
    case 'e-hulajnowa': {
      const e = kind === 'e-hulajnowa';
      return (
        shadow(ax, ay, 30, 4) +
        wheel(x(-22), y(6), e ? 6 : 5) +
        wheel(x(22), y(6), e ? 6 : 5) +
        shaded(rr(x(-20), y(e ? 14 : 12), 44, e ? 7 : 5, 2.5), c, LINE, -1, -1, 2) +
        (e ? flat(rr(x(-8), y(13), 18, 4, 1.5), a, LINE, 1) : '') +
        stroke(`M${x(-22)} ${y(6)}L${x(-17)} ${y(54)}`, LINE, e ? 6 : 5) +
        stroke(`M${x(-22)} ${y(6)}L${x(-17)} ${y(54)}`, c[0], e ? 3.5 : 2.5) +
        stroke(`M${x(-25)} ${y(54)}H${x(-9)}`, GRIP, 4.5) +
        (e ? flat(circ(x(-19), y(46), 3), '#ffe27a', LINE, 1) : '')
      );
    }
    case 'rower':
      return (
        shadow(ax, ay, 40, 5) +
        wheel(x(-25), y(15), 14) +
        wheel(x(25), y(15), 14) +
        stroke(
          `M${x(25)} ${y(15)}L${x(4)} ${y(15)}L${x(-14)} ${y(36)}L${x(10)} ${y(36)}Z M${x(4)} ${y(15)}L${x(12)} ${y(40)} M${x(-25)} ${y(15)}L${x(-17)} ${y(44)}`,
          LINE,
          5.5,
        ) +
        stroke(
          `M${x(25)} ${y(15)}L${x(4)} ${y(15)}L${x(-14)} ${y(36)}L${x(10)} ${y(36)}Z M${x(4)} ${y(15)}L${x(12)} ${y(40)} M${x(-25)} ${y(15)}L${x(-17)} ${y(44)}`,
          c[0],
          3,
        ) +
        flat(rr(x(6), y(43), 14, 5, 2.5), GRIP, LINE, 1.5) +
        stroke(`M${x(-23)} ${y(46)}H${x(-11)}`, GRIP, 4.5) +
        flat(circ(x(4), y(15), 4), a, LINE, 1.5)
      );
    case 'motocykl':
      return (
        shadow(ax, ay, 46, 5) +
        wheel(x(-30), y(15), 15, '#8a929e') +
        wheel(x(30), y(15), 15, '#8a929e') +
        stroke(`M${x(-30)} ${y(15)}L${x(-22)} ${y(44)}`, METAL[1], 4) +
        shaded(
          `M${x(-20)} ${y(26)}Q${x(-18)} ${y(42)} ${x(-4)} ${y(40)}L${x(14)} ${y(34)}L${x(34)} ${y(32)}Q${x(42)} ${y(30)} ${x(40)} ${y(24)}L${x(18)} ${y(18)}H${x(-10)}Z`,
          c,
          LINE,
          -2,
          -2,
          2,
        ) +
        stroke(`M${x(-14)} ${y(34)}Q${x(-6)} ${y(30)} ${x(4)} ${y(34)}`, a, 3) +
        flat(rr(x(-2), y(23), 18, 8, 2), METAL[1], LINE, 1.5) +
        stroke(`M${x(14)} ${y(14)}L${x(42)} ${y(18)}`, METAL[0], 4) +
        flat(circ(x(-24), y(36), 4), '#ffe27a', LINE, 1.5) +
        stroke(`M${x(-27)} ${y(46)}H${x(-15)}`, GRIP, 4.5)
      );
    case 'quad':
      return (
        shadow(ax, ay, 46, 6) +
        wheel(x(-27), y(16), 16, '#3a3d4a') +
        wheel(x(27), y(16), 16, '#3a3d4a') +
        shaded(
          `M${x(-44)} ${y(30)}Q${x(-40)} ${y(40)} ${x(-24)} ${y(40)}L${x(-12)} ${y(34)}H${x(12)}L${x(24)} ${y(40)}Q${x(40)} ${y(40)} ${x(44)} ${y(30)}L${x(40)} ${y(24)}H${x(-40)}Z`,
          c,
          LINE,
          -2,
          -2,
          2,
        ) +
        flat(rr(x(-10), y(37), 26, 7, 3), a, LINE, 1.5) +
        stroke(`M${x(-36)} ${y(42)}H${x(-28)}M${x(28)} ${y(42)}H${x(36)}`, a, 3) +
        stroke(`M${x(-14)} ${y(36)}L${x(-18)} ${y(48)}`, METAL[1], 4) +
        stroke(`M${x(-23)} ${y(48)}H${x(-11)}`, GRIP, 4.5) +
        flat(circ(x(-40), y(30), 3.5), '#ffe27a', LINE, 1.2)
      );
  }
}

// ---------- front and back views (the part in front of the bud) ----------

function frontShape(
  kind: RideKind,
  { body: c, accent: a }: Ride,
  ax: number,
  ay: number,
  back: boolean,
): string {
  const x = (v: number) => ax + v;
  const y = (v: number) => ay - v;
  const light = back ? '#ff3d50' : '#ffe27a';
  switch (kind) {
    case 'deskorolka':
      return (
        tyre(x(-13), y(0), 9, 11) +
        tyre(x(13), y(0), 9, 11) +
        shaded(rr(x(-20), y(18), 40, 8, 4), c, LINE, -1, -1, 2.5)
      );
    case 'hulajnowa':
    case 'e-hulajnowa':
      return back
        ? tyre(x(0), y(0), 7, 12) + shaded(rr(x(-8), y(16), 16, 6, 2.5), c, LINE, -1, -1, 2)
        : tyre(x(0), y(0), 7, 12) +
            stroke(`M${x(0)} ${y(10)}V${y(52)}`, LINE, 5) +
            stroke(`M${x(0)} ${y(10)}V${y(52)}`, c[0], 2.5) +
            stroke(`M${x(-17)} ${y(52)}H${x(17)}`, GRIP, 4.5) +
            (kind === 'e-hulajnowa' ? flat(circ(x(0), y(44), 3.5), light, LINE, 1) : '');
    case 'rower':
      return back
        ? tyre(x(0), y(0), 7, 30) +
            flat(rr(x(-5), y(26), 10, 5, 2), light, LINE, 1) +
            flat(rr(x(-7), y(36), 14, 6, 3), GRIP, LINE, 1.5)
        : tyre(x(0), y(0), 7, 30) +
            stroke(
              `M${x(-3)} ${y(12)}L${x(0)} ${y(42)}M${x(3)} ${y(12)}L${x(0)} ${y(42)}`,
              c[1],
              3,
            ) +
            stroke(`M${x(-20)} ${y(44)}Q${x(0)} ${y(40)} ${x(20)} ${y(44)}`, GRIP, 4) +
            flat(circ(x(0), y(36), 3.5), light, LINE, 1);
    case 'motocykl':
      return back
        ? tyre(x(0), y(0), 11, 30) +
            shaded(rr(x(-12), y(32), 24, 12, 4), c, LINE, -1, -1, 2) +
            flat(rr(x(-6), y(30), 12, 5, 2), light, LINE, 1) +
            flat(rr(x(-5), y(22), 10, 5, 1), '#f6f2e9', LINE, 1)
        : tyre(x(0), y(0), 11, 30) +
            shaded(rr(x(-10), y(30), 20, 12, 5), c, LINE, -1, -1, 2) +
            flat(circ(x(0), y(36), 6), light, LINE, 1.5) +
            stroke(`M${x(-24)} ${y(46)}Q${x(0)} ${y(40)} ${x(24)} ${y(46)}`, GRIP, 4) +
            flat(circ(x(-26), y(52), 3), METAL[0], LINE, 1) +
            flat(circ(x(26), y(52), 3), METAL[0], LINE, 1) +
            stroke(`M${x(-6)} ${y(28)}H${x(6)}`, a, 2.5);
    case 'quad':
      return (
        tyre(x(-30), y(0), 14, 26) +
        tyre(x(30), y(0), 14, 26) +
        shaded(
          `M${x(-32)} ${y(30)}Q${x(-30)} ${y(20)} ${x(-20)} ${y(18)}H${x(20)}Q${x(30)} ${y(20)} ${x(32)} ${y(30)}L${x(26)} ${y(36)}H${x(-26)}Z`,
          c,
          LINE,
          -2,
          -2,
          2,
        ) +
        stroke(`M${x(-22)} ${y(14)}H${x(22)}`, a, 3.5) +
        flat(circ(x(-14), y(28), 3.5), light, LINE, 1.2) +
        flat(circ(x(14), y(28), 3.5), light, LINE, 1.2) +
        (back ? '' : stroke(`M${x(-22)} ${y(46)}Q${x(0)} ${y(40)} ${x(22)} ${y(46)}`, GRIP, 4))
      );
  }
}

/** Premium rides: a coloured glow on the ground and a little four-point glint. */
const glowUnder = (r: Ride, ax: number, ay: number, rx: number) =>
  r.glow
    ? `<ellipse cx="${ax}" cy="${ay - 2}" rx="${rx}" ry="${rx * 0.2}" fill="${r.glow}" opacity="0.5"/>`
    : '';
const glint = (r: Ride, x: number, y: number) =>
  r.glow
    ? flat(
        `M${x} ${y - 7}Q${x + 1.5} ${y - 1.5} ${x + 7} ${y}Q${x + 1.5} ${y + 1.5} ${x} ${y + 7}Q${x - 1.5} ${y + 1.5} ${x - 7} ${y}Q${x - 1.5} ${y - 1.5} ${x} ${y - 7}Z`,
        '#ffe27a',
        '#d98a0b',
        1.2,
      )
    : '';

function side(ride: string, ax: number, ay: number): string {
  const r = RIDES[ride]!;
  const big = r.shape === 'motocykl' || r.shape === 'quad';
  return (
    glowUnder(r, ax, ay, big ? 46 : 36) +
    sideShape(r.shape, r, ax, ay) +
    glint(r, ax + (big ? 30 : 22), ay - (big ? 44 : 30))
  );
}

function front(ride: string, ax: number, ay: number, back: boolean): string {
  const r = RIDES[ride]!;
  return frontShape(r.shape, r, ax, ay, back);
}

const RIDE_W = 2 * T;
const RIDE_H = 1.2 * T;
const rideProp = (draw: (ax: number, ay: number) => string): Prop => ({
  w: RIDE_W,
  h: RIDE_H,
  ax: RIDE_W / 2,
  ay: RIDE_H - 4,
  body: draw(RIDE_W / 2, RIDE_H - 4),
});

export const RIDE_PROPS: Record<string, Prop> = Object.fromEntries(
  Object.keys(RIDES).flatMap((k) => [
    [`jazda-${k}-bok`, rideProp((ax, ay) => side(k, ax, ay))],
    [`jazda-${k}-przod`, rideProp((ax, ay) => front(k, ax, ay, false))],
    [`jazda-${k}-tyl`, rideProp((ax, ay) => front(k, ax, ay, true))],
  ]),
);

// ---------- training stations ----------

const station = (
  tilesW: number,
  tilesH: number,
  body: (ax: number, ay: number) => string,
): Prop => {
  const w = tilesW * T + 16;
  const h = tilesH * T;
  return { w, h, ax: w / 2, ay: h - 6, foot: [1, 1], body: body(w / 2, h - 6) };
};

const WOOD: Tone = ['#c48a52', '#9a6537'];
const WOOD_LINE = '#5a3a22';

/** A little lime pennant: every training station has one, so players learn to spot them. */
const pennant = (x: number, y: number) =>
  stroke(`M${x} ${y}V${y - 34}`, '#5d5853', 2.5) +
  flat(`M${x} ${y - 34}L${x + 16} ${y - 29}L${x} ${y - 24}Z`, '#a3e635', '#5f9a3a', 1.5);

export const TRAINING_PROPS: Record<string, Prop> = {
  'trening-worek': station(
    1.4,
    2.4,
    (ax, ay) =>
      shadow(ax, ay, 30, 5) +
      stroke(`M${ax - 26} ${ay}V${ay - 140}H${ax + 4}`, '#5d5853', 5) +
      stroke(`M${ax - 34} ${ay}H${ax - 18}`, '#5d5853', 5) +
      stroke(`M${ax + 2} ${ay - 140}V${ay - 118}`, '#8a929e', 2.5) +
      shaded(rr(ax - 16, ay - 120, 36, 86, 15), ['#ff3d50', '#bd1c31'], '#8a1626', -4, -3) +
      flat(rr(ax - 16, ay - 94, 36, 9, 0), '#262833', '#8a1626', 1.5) +
      pennant(ax + 30, ay),
  ),
  'trening-scena': station(
    1.6,
    2,
    (ax, ay) =>
      shadow(ax, ay, 46, 6) +
      shaded(rr(ax - 46, ay - 18, 92, 18, 3), WOOD, WOOD_LINE, -2, -2, 2.5) +
      stroke(`M${ax - 40} ${ay - 9}H${ax + 40}`, WOOD[1], 1.5) +
      stroke(`M${ax - 10} ${ay - 18}V${ay - 82}`, '#3a3d4a', 3) +
      stroke(`M${ax - 20} ${ay - 18}L${ax - 10} ${ay - 30}L${ax}  ${ay - 18}`, '#3a3d4a', 3) +
      flat(rr(ax - 15, ay - 96, 10, 16, 5), '#262833', '#121218', 1.5) +
      shaded(rr(ax + 12, ay - 64, 28, 46, 4), ['#3a3d4a', '#262833'], '#121218', -2, -2, 2) +
      flat(circ(ax + 26, ay - 50, 8), '#5d5853', '#121218', 1.5) +
      flat(circ(ax + 26, ay - 30, 5), '#5d5853', '#121218', 1.2) +
      flat(circ(ax + 26, ay - 50, 3), '#a3e635', '#121218', 1) +
      pennant(ax - 38, ay - 18),
  ),
  'trening-sciana': station(
    1.6,
    2,
    (ax, ay) =>
      shadow(ax, ay, 48, 5) +
      shaded(rr(ax - 48, ay - 96, 96, 92, 3), ['#d9cbb6', '#bfae96'], '#8a7a62', -3, -3, 2.5) +
      [0, 1, 2, 3, 4]
        .map((r) => stroke(`M${ax - 48} ${ay - 96 + 18 * r + 18}H${ax + 48}`, '#bfae96', 1.5))
        .join('') +
      stroke(`M${ax - 36} ${ay - 40}q10 -34 22 -6t20 -10t18 4`, '#b45cff', 7) +
      stroke(`M${ax - 32} ${ay - 64}q14 -14 30 0`, '#4cc7ff', 5) +
      stroke(`M${ax + 10} ${ay - 76}l14 30`, '#ff3d50', 5) +
      stroke(`M${ax - 26} ${ay - 34}v12M${ax + 6} ${ay - 38}v16`, '#b45cff', 3, 0.8) +
      shaded(rr(ax + 30, ay - 22, 12, 22, 3), ['#a3e635', '#7cc01a'], '#3f6326', -1, -1, 1.5) +
      flat(rr(ax + 32, ay - 26, 8, 5, 1), '#f6f2e9', '#3f6326', 1) +
      pennant(ax - 44, ay),
  ),
  'trening-deska': station(
    1.2,
    2.2,
    (ax, ay) =>
      shadow(ax, ay, 24, 5) +
      flat(`M${ax - 26} ${ay}Q${ax} ${ay - 12} ${ax + 26} ${ay}Z`, '#e8cf96', '#c9ad73', 1.5) +
      shaded(
        `M${ax} ${ay - 128}Q${ax + 18} ${ay - 100} ${ax + 16} ${ay - 40}Q${ax + 14} ${ay - 6} ${ax} ${ay - 4}Q${ax - 14} ${ay - 6} ${ax - 16} ${ay - 40}Q${ax - 18} ${ay - 100} ${ax} ${ay - 128}Z`,
        ['#4cc7ff', '#1b86c9'],
        '#145f8f',
        -3,
        -3,
      ) +
      stroke(`M${ax} ${ay - 120}V${ay - 10}`, '#ffc93c', 3) +
      stroke(`M${ax - 12} ${ay - 70}h24`, '#f6f2e9', 4) +
      pennant(ax + 26, ay),
  ),
  'trening-szachy': station(
    1.6,
    1.6,
    (ax, ay) =>
      shadow(ax, ay, 40, 6) +
      shaded(rr(ax - 44, ay - 26, 14, 18, 4), WOOD, WOOD_LINE, -1, -1, 2) +
      shaded(rr(ax + 30, ay - 26, 14, 18, 4), WOOD, WOOD_LINE, -1, -1, 2) +
      stroke(`M${ax} ${ay - 40}V${ay}M${ax - 12} ${ay}H${ax + 12}`, WOOD_LINE, 4) +
      shaded(rr(ax - 26, ay - 50, 52, 14, 3), WOOD, WOOD_LINE, -2, -2, 2) +
      [0, 1, 2, 3, 4, 5]
        .map((i) =>
          flat(
            rr(ax - 24 + i * 8, ay - 49 + (i % 2) * 5, 8, 5, 0),
            i % 2 ? '#f6f2e9' : '#262833',
            '#262833',
            0.5,
          ),
        )
        .join('') +
      flat(rr(ax - 18, ay - 64, 6, 14, 2), '#f6f2e9', '#5d5853', 1.2) +
      flat(circ(ax - 15, ay - 66, 4), '#f6f2e9', '#5d5853', 1.2) +
      flat(rr(ax + 10, ay - 62, 6, 12, 2), '#262833', '#121218', 1.2) +
      flat(circ(ax + 13, ay - 64, 4), '#262833', '#121218', 1.2) +
      pennant(ax + 40, ay - 26),
  ),
  'trening-tor': station(
    1.6,
    1.8,
    (ax, ay) =>
      shadow(ax, ay, 46, 6) +
      stroke(`M${ax - 40} ${ay}V${ay - 34}M${ax + 18} ${ay}V${ay - 34}`, '#f6f2e9', 4) +
      shaded(rr(ax - 44, ay - 40, 66, 10, 2), ['#ff9a1f', '#d97a0b'], '#8a4a0b', -1, -1, 2) +
      stroke(`M${ax - 28} ${ay - 40}v10M${ax - 8} ${ay - 40}v10`, '#f6f2e9', 4) +
      `<ellipse cx="${ax + 32}" cy="${ay - 10}" rx="16" ry="8" fill="#2a2a30" stroke="#121218" stroke-width="2"/>` +
      `<ellipse cx="${ax + 32}" cy="${ay - 12}" rx="6" ry="3" fill="#5d5853"/>` +
      pennant(ax - 46, ay),
  ),
};

// ---------- icons (64×64) ----------

const icon = (body: string): Icon => ({ body });

/** A mount icon: its side view fitted into the icon frame. */
const rideIcon = (ride: string) => {
  const kind = RIDES[ride]!.shape;
  // the skateboard from above, tilted: its side view is only a thin line
  if (kind === 'deskorolka') {
    const { body: c, accent: a } = RIDES[ride]!;
    return icon(
      `<g transform="rotate(-38 32 32)">` +
        [
          [24, 14],
          [40, 14],
          [24, 50],
          [40, 50],
        ]
          .map(([x, y]) => flat(rr(x! - 4, y! - 3, 8, 6, 2), a, LINE, 1.5))
          .join('') +
        shaded(rr(22, 4, 20, 56, 10), c, LINE, -2, -2, 2.5) +
        flat(rr(25, 10, 14, 44, 7), '#262833', LINE, 1) +
        stroke('M28 18h8M28 46h8', '#5d5853', 2) +
        '</g>',
    );
  }
  const scale = kind === 'deskorolka' ? 0.95 : kind === 'motocykl' || kind === 'quad' ? 0.62 : 0.72;
  const lift = kind === 'deskorolka' ? 16 : 6;
  return icon(
    `<g transform="translate(32 ${50 - lift}) scale(${scale}) translate(${-RIDE_W / 2} ${-(RIDE_H - 4) + 30 * (1 - scale)})">${side(ride, RIDE_W / 2, RIDE_H - 4)}</g>`,
  );
};

const DRINK_LOOKS: Record<string, [Tone, string, string]> = {
  'napoj-turbo': [['#4cc7ff', '#1b86c9'], '#ffe27a', 'bolt'],
  'napoj-sila': [['#ff3d50', '#bd1c31'], '#f6f2e9', 'fist'],
  'napoj-pancerz': [['#8a929e', '#6f7783'], '#ffc93c', 'shield'],
  'napoj-fart': [['#a3e635', '#7cc01a'], '#ffffff', 'clover'],
  'napoj-skupienie': [['#b45cff', '#8a3fd1'], '#ffe27a', 'eye'],
  'napoj-regeneracja': [['#ff7aa8', '#d95a88'], '#ffffff', 'heart'],
};

const symbol = (kind: string, color: string) => {
  switch (kind) {
    case 'bolt':
      return flat(
        poly([
          [34, 22],
          [24, 38],
          [31, 38],
          [28, 50],
          [40, 32],
          [33, 32],
          [36, 22],
        ]),
        color,
        '#121218',
        1.5,
      );
    case 'fist':
      return (
        flat(rr(24, 28, 16, 16, 5), color, '#121218', 1.5) +
        stroke('M28 28v6M32 28v6M36 28v6', '#121218', 1.2)
      );
    case 'shield':
      return flat('M32 24L42 28Q42 42 32 48Q22 42 22 28Z', color, '#121218', 1.5);
    case 'clover':
      return (
        [
          [28, 32],
          [36, 32],
          [32, 28],
          [32, 36],
        ]
          .map(([x, y]) => flat(circ(x!, y!, 4.5), color, '#121218', 1.2))
          .join('') + stroke('M32 38l3 10', color, 2.5)
      );
    case 'eye':
      return (
        flat('M20 36Q32 24 44 36Q32 48 20 36Z', '#f6f2e9', '#121218', 1.5) +
        flat(circ(32, 36, 5), color, '#121218', 1.2)
      );
    default:
      return flat(
        'M32 48Q20 40 22 32Q24 26 30 28Q32 30 32 31Q32 30 34 28Q40 26 42 32Q44 40 32 48Z',
        color,
        '#121218',
        1.5,
      );
  }
};

const can = ([tone, sym, kind]: [Tone, string, string]) =>
  icon(
    shaded(rr(18, 12, 28, 46, 6), tone, '#121218', -3, -3, 2.5) +
      flat(rr(20, 8, 24, 6, 2), '#b7bec9', '#121218', 1.5) +
      stroke('M30 10h6', '#5d5853', 2) +
      flat(rr(18, 22, 28, 28, 0), '#262833', '#121218', 1) +
      symbol(kind, sym) +
      stroke('M22 16v38', '#ffffff', 2, 0.35),
  );

export const RIDE_ICONS: Record<string, Icon> = {
  ...Object.fromEntries(Object.keys(RIDES).map((k) => [`mount-${k}`, rideIcon(k)])),
  ...Object.fromEntries(Object.entries(DRINK_LOOKS).map(([id, look]) => [id, can(look)])),
};
