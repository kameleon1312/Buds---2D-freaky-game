import { z } from 'zod';
import {
  GENDERS,
  HAIR_BY_GENDER,
  HAIR_COLORS,
  HAIR_STYLES,
  MOODS,
  OUTFITS,
  OUTFIT_COLORS,
  PANTS_COLORS,
  SKINS,
  type Gender,
} from './constants';

const index = (list: readonly unknown[]) =>
  z
    .number()
    .int()
    .min(0)
    .max(list.length - 1);

export const budLookSchema = z.object({
  gender: z.enum(GENDERS),
  mood: z.enum(MOODS),
  skin: index(SKINS),
  hair: z.enum(HAIR_STYLES),
  hairColor: index(HAIR_COLORS),
  outfit: z.enum(OUTFITS),
  outfitColor: index(OUTFIT_COLORS),
  pantsColor: index(PANTS_COLORS),
});
export type BudLook = z.infer<typeof budLookSchema>;

const pick = <T>(list: readonly T[], random: () => number): T =>
  list[Math.floor(random() * list.length)] as T;
const pickIndex = (list: readonly unknown[], random: () => number) =>
  Math.floor(random() * list.length);

/** Random but tasteful: hair is drawn from the gender's first picks most of the time. */
export function randomLook(gender?: Gender, random: () => number = Math.random): BudLook {
  const g = gender ?? pick(GENDERS, random);
  const favourites = HAIR_BY_GENDER[g].slice(0, 7);
  return {
    gender: g,
    mood: pick(MOODS, random),
    skin: pickIndex(SKINS, random),
    hair: random() < 0.85 ? pick(favourites, random) : pick(HAIR_STYLES, random),
    hairColor: random() < 0.75 ? Math.floor(random() * 5) : pickIndex(HAIR_COLORS, random),
    outfit: pick(OUTFITS, random),
    outfitColor: pickIndex(OUTFIT_COLORS, random),
    pantsColor: pickIndex(PANTS_COLORS, random),
  };
}
