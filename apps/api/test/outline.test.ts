import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import {
  ACCESSORIES,
  FACINGS,
  GENDERS,
  OUTFITS_BY_GENDER,
  budSvg,
  type BudLook,
} from '@buds/shared';

const WIDTH = 240;
const base: BudLook = {
  gender: 'on',
  mood: 'radosny',
  skin: 0,
  hair: 'krotkie',
  hairColor: 0,
  outfit: 'bluza',
  outfitColor: 0,
  pants: 'jeansy',
  pantsColor: 0,
  shoes: 'trampki',
  shoesColor: 0,
};

/** Coloured pixels right at the edge of the figure: there the outline should be. */
function pixelsOutsideOutline(look: BudLook, facing: (typeof FACINGS)[number]) {
  const svg = budSvg(look, { facing, frame: 1, width: WIDTH });
  const { pixels, width, height } = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
  }).render();
  const alpha = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : pixels[(y * width + x) * 4 + 3]!;
  let found = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3]! < 200) continue;
      if (Math.max(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!) < 60) continue;
      search: for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (alpha(x + dx, y + dy) < 40) {
            found++;
            break search;
          }
    }
  return found;
}

describe('the outline', () => {
  it('holds every colour in, for every top and accessory in every view', () => {
    const looks: BudLook[] = GENDERS.flatMap((gender) => [
      ...OUTFITS_BY_GENDER[gender].map((outfit) => ({ ...base, gender, outfit })),
      ...ACCESSORIES.map((accessory) => ({ ...base, gender, accessory })),
    ]);
    const leaks: string[] = [];
    for (const look of looks)
      for (const facing of FACINGS)
        if (pixelsOutsideOutline(look, facing) > 0)
          leaks.push(`${look.gender} ${look.outfit} ${look.accessory} ${facing}`);
    expect(leaks).toEqual([]);
  }, 120_000);
});
