import { z } from 'zod';
import {
  GENDERS,
  HAIR_BY_GENDER,
  HAIR_COLORS,
  HAIR_STYLES,
  MOODS,
  OUTFITS,
  OUTFITS_BY_GENDER,
  OUTFIT_COLORS,
  PANTS,
  PANTS_BY_GENDER,
  PANTS_COLORS,
  SHOES,
  SHOES_BY_GENDER,
  SHOES_COLORS,
  SKINS,
  type Gender,
} from './constants';

const index = (list: readonly unknown[]) =>
  z
    .number()
    .int()
    .min(0)
    .max(list.length - 1);

/**
 * How a bud looks, head to toe. Fields added later have defaults, so looks stored before them still parse
 * (and keep looking the same: jeans and white trainers were what every bud wore).
 */
export const budLookSchema = z.object({
  gender: z.enum(GENDERS),
  mood: z.enum(MOODS),
  skin: index(SKINS),
  hair: z.enum(HAIR_STYLES),
  hairColor: index(HAIR_COLORS),
  outfit: z.enum(OUTFITS),
  outfitColor: index(OUTFIT_COLORS),
  pants: z.enum(PANTS).default('jeansy'),
  pantsColor: index(PANTS_COLORS),
  shoes: z.enum(SHOES).default('trampki'),
  shoesColor: index(SHOES_COLORS).default(0),
});
export type BudLook = z.infer<typeof budLookSchema>;
export type BudLookInput = z.input<typeof budLookSchema>;

const pick = <T>(list: readonly T[], random: () => number): T =>
  list[Math.floor(random() * list.length)] as T;
const pickIndex = (list: readonly unknown[], random: () => number) =>
  Math.floor(random() * list.length);

/** Random but tasteful: every part comes from the gender's standard catalog, hair colours mostly natural. */
export function randomLook(gender?: Gender, random: () => number = Math.random): BudLook {
  const g = gender ?? pick(GENDERS, random);
  return {
    gender: g,
    mood: pick(MOODS, random),
    skin: pickIndex(SKINS, random),
    hair: pick(HAIR_BY_GENDER[g], random),
    hairColor: random() < 0.75 ? Math.floor(random() * 5) : pickIndex(HAIR_COLORS, random),
    outfit: pick(OUTFITS_BY_GENDER[g], random),
    outfitColor: pickIndex(OUTFIT_COLORS, random),
    pants: pick(PANTS_BY_GENDER[g], random),
    pantsColor: pickIndex(PANTS_COLORS, random),
    shoes: pick(SHOES_BY_GENDER[g], random),
    shoesColor: pickIndex(SHOES_COLORS, random),
  };
}
