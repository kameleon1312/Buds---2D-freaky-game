// Ground dressing (Unity WorldView.Dressing): small flat details the game lays over open ground of every map by its
// material, so lawns, beaches, dirt yards and roads are never one flat colour from edge to edge: clover and wild flowers
// in the grass, a worn patch where people cut across, pebbles; footprints and driftwood on the sand; tyre ruts, cracks
// and stones in the dirt; patches on the asphalt. All flat (they lie on the ground under everything that stands), soft
// edged and close to the colour of the ground they lie on, so they read as the ground itself, not as objects.
import { circ, fill, n, rng, shaded, stroke, T, type Prop } from './kit';

const flatProp = (w: number, h: number, body: string): Prop => ({
  w,
  h,
  ax: w / 2,
  ay: h / 2,
  flat: true,
  body,
});

function clover(): Prop {
  const w = 0.9 * T;
  const h = 0.6 * T;
  const r = rng(301);
  let s = '';
  for (let i = 0; i < 9; i++) {
    const x = w * 0.15 + r() * w * 0.7;
    const y = h * 0.2 + r() * h * 0.6;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + r();
      s += fill(
        circ(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.2, 2.4),
        k === 0 ? '#5f9e3c' : '#6fae47',
        0.95,
      );
    }
  }
  return flatProp(w, h, s);
}

function wildFlowers(): Prop {
  const w = 0.9 * T;
  const h = 0.6 * T;
  const r = rng(302);
  let s = '';
  const colours = ['#ffffff', '#fff2a0', '#c9b6ff', '#ffffff'];
  for (let i = 0; i < 11; i++) {
    const x = w * 0.12 + r() * w * 0.76;
    const y = h * 0.18 + r() * h * 0.64;
    s += stroke(`M${n(x)} ${n(y + 3)}v-3`, '#4f8f3a', 1.2, 0.8);
    s += fill(circ(x, y, 1.7), colours[i % colours.length]!, 0.95);
  }
  return flatProp(w, h, s);
}

function worn(): Prop {
  const w = 1.6 * T;
  const h = 0.9 * T;
  const r = rng(303);
  let s = `<ellipse cx="${n(w / 2)}" cy="${n(h / 2)}" rx="${n(w * 0.42)}" ry="${n(h * 0.36)}" fill="#b9a46a" opacity="0.32"/>`;
  s += `<ellipse cx="${n(w / 2 + 4)}" cy="${n(h / 2 + 2)}" rx="${n(w * 0.28)}" ry="${n(h * 0.22)}" fill="#a8925a" opacity="0.28"/>`;
  for (let i = 0; i < 14; i++)
    s += fill(circ(w * 0.2 + r() * w * 0.6, h * 0.25 + r() * h * 0.5, 1.2), '#8f7a4a', 0.4);
  return flatProp(w, h, s);
}

function pebbles(tone: [string, string]): Prop {
  const w = 0.7 * T;
  const h = 0.45 * T;
  const r = rng(304 + tone[0].length);
  let s = '';
  for (let i = 0; i < 6; i++) {
    const x = w * 0.15 + r() * w * 0.7;
    const y = h * 0.25 + r() * h * 0.5;
    const rr = 1.8 + r() * 2.2;
    s += shaded(
      `M${n(x - rr)} ${n(y)}a${n(rr)} ${n(rr * 0.75)} 0 1 0 ${n(rr * 2)} 0a${n(rr)} ${n(rr * 0.75)} 0 1 0 ${n(-rr * 2)} 0Z`,
      tone,
      '#5d5853',
      -0.6,
      -0.6,
      0.8,
    );
  }
  return flatProp(w, h, s);
}

function footprints(): Prop {
  const w = 1.2 * T;
  const h = 0.5 * T;
  let s = '';
  for (let i = 0; i < 5; i++) {
    const x = 8 + i * 15;
    const y = h / 2 + (i % 2 ? 5 : -5);
    s += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="4.2" ry="2.4" fill="#c9a96a" opacity="0.45"/>`;
    s += `<ellipse cx="${n(x + 4.5)}" cy="${n(y)}" rx="1.8" ry="1.6" fill="#c9a96a" opacity="0.4"/>`;
  }
  return flatProp(w, h, s);
}

function driftwood(): Prop {
  const w = 1.0 * T;
  const h = 0.4 * T;
  let s = shaded(
    `M${n(8)} ${n(h / 2 + 3)}Q${n(w / 2)} ${n(h / 2 - 5)} ${n(w - 8)} ${n(h / 2)}l-2 4Q${n(w / 2)} ${n(h / 2 + 1)} ${n(10)} ${n(h / 2 + 7)}Z`,
    ['#c7ad86', '#a38a64'],
    '#6f5c40',
    -1,
    -1,
    1.4,
  );
  s += stroke(`M${n(w * 0.55)} ${n(h / 2 - 1)}l6 -6`, '#8f7a58', 2);
  return flatProp(w, h, s);
}

function ruts(): Prop {
  const w = 1.8 * T;
  const h = 0.6 * T;
  const d1 = `M4 ${n(h * 0.35)}Q${n(w / 2)} ${n(h * 0.2)} ${n(w - 4)} ${n(h * 0.4)}`;
  const d2 = `M4 ${n(h * 0.75)}Q${n(w / 2)} ${n(h * 0.6)} ${n(w - 4)} ${n(h * 0.8)}`;
  return flatProp(
    w,
    h,
    stroke(d1, '#6f5a3e', 5, 0.28) +
      stroke(d2, '#6f5a3e', 5, 0.28) +
      stroke(d1, '#b9a07a', 1.4, 0.35) +
      stroke(d2, '#b9a07a', 1.4, 0.35),
  );
}

function cracks(): Prop {
  const w = 1.1 * T;
  const h = 0.7 * T;
  const r = rng(307);
  let d = '';
  for (let i = 0; i < 4; i++) {
    let x = w / 2;
    let y = h / 2;
    d += `M${n(x)} ${n(y)}`;
    const a0 = (i / 4) * Math.PI * 2 + r();
    for (let k = 0; k < 4; k++) {
      const a = a0 + (r() - 0.5) * 0.9;
      x += Math.cos(a) * (6 + r() * 5);
      y += Math.sin(a) * (4 + r() * 3);
      d += `L${n(x)} ${n(y)}`;
    }
  }
  return flatProp(w, h, stroke(d, '#5a4a36', 1.6, 0.45));
}

function asphaltPatch(): Prop {
  const w = 1.4 * T;
  const h = 0.8 * T;
  const s =
    `<path d="M10 14L${n(w - 14)} 8L${n(w - 6)} ${n(h - 16)}L18 ${n(h - 8)}Z" fill="#2f333d" opacity="0.38"/>` +
    stroke(`M10 14L${n(w - 14)} 8L${n(w - 6)} ${n(h - 16)}L18 ${n(h - 8)}Z`, '#5b606b', 1.4, 0.35);
  return flatProp(w, h, s);
}

export const DRESSING_PROPS: Record<string, Prop> = {
  'grunt-koniczyna': clover(),
  'grunt-kwiatki': wildFlowers(),
  'grunt-wydeptane': worn(),
  'grunt-kamyki': pebbles(['#bdb7ae', '#958f87']),
  'grunt-kamyki-ciemne': pebbles(['#8a847c', '#6a655e']),
  'grunt-slady': footprints(),
  'grunt-patyk': driftwood(),
  'grunt-koleiny': ruts(),
  'grunt-pekniecia': cracks(),
  'grunt-latka': asphaltPatch(),
};
