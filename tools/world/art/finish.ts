// The finishing pass every standing prop gets when it is exported: the same light as the duel stage, so the street
// and the fight look like one world. A warm light from the top-left fades down the prop, the part by the ground sinks
// into a cool contact shade (ambient occlusion), and a fine grain clipped to the silhouette gives paint, plaster,
// bark and metal a surface instead of flat fills. Flat props (markings, flowers) stay as they are.
import { n, type Prop } from './kit';

/** Light from the top-left: how strong the warm wash at the top and the cool shade by the ground are. */
const LIGHT = { warm: '#fff4d6', warmOpacity: 0.2, cool: '#16203a', coolOpacity: 0.34 };
/** Grain: frequency in SVG units⁻¹ and strength (0 = off). */
const GRAIN = { frequency: 0.55, strength: 0.32 };

let seed = 1;

/** Wraps a prop's body in the finishing light and grain. */
export function finish(p: Prop): string {
  if (p.flat) return p.body;
  const id = `fin${seed++}`;
  const w = n(p.w);
  const h = n(p.h);
  // the shade reaches up about a tile from the ground point, whatever the prop's height
  const groundShade = Math.max(0.55, Math.min(0.9, 1 - 70 / Math.max(1, p.ay)));
  const s = GRAIN.strength;
  return (
    `<defs>` +
    `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${n(p.ay)}">` +
    `<stop offset="0" stop-color="${LIGHT.warm}" stop-opacity="${LIGHT.warmOpacity}"/>` +
    `<stop offset="0.42" stop-color="${LIGHT.warm}" stop-opacity="0"/>` +
    `<stop offset="${n(groundShade)}" stop-color="${LIGHT.cool}" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="${LIGHT.cool}" stop-opacity="${LIGHT.coolOpacity}"/>` +
    `</linearGradient>` +
    `<rect id="${id}r" width="${w}" height="${h}" fill="url(#${id}g)"/>` +
    `<filter id="${id}" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
    `<feImage href="#${id}r" result="light"/>` +
    `<feComposite in="light" in2="SourceAlpha" operator="in" result="lit"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="${GRAIN.frequency}" numOctaves="2" seed="${seed % 97}" result="noise"/>` +
    // dark specks where the noise is low, light ones where it is high: a surface, not dirt
    `<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.08  0 0 0 0 0.09  0 0 0 0 0.13  0 0 0 ${n(-s)} ${n(s * 0.47)}" result="dark"/>` +
    `<feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 0.98  0 0 0 0 0.92  0 0 0 ${n(s * 0.8)} ${n(-s * 0.46)}" result="bright"/>` +
    `<feComposite in="dark" in2="SourceAlpha" operator="in" result="darkIn"/>` +
    `<feComposite in="bright" in2="SourceAlpha" operator="in" result="brightIn"/>` +
    `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="lit"/><feMergeNode in="darkIn"/><feMergeNode in="brightIn"/></feMerge>` +
    `</filter>` +
    `</defs>` +
    `<g filter="url(#${id})">${p.body}</g>`
  );
}
