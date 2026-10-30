import { z } from 'zod';
import {
  ACCESSORIES,
  EYE_COLORS,
  FACE_MARKS,
  FACE_MARKS_BY_GENDER,
  GENDERS,
  GLASSES,
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
  PRINTS,
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
  // the finer details: left out, a bud looks as it always did
  eyes: index(EYE_COLORS).optional(),
  mark: z.enum(FACE_MARKS).optional(),
  glasses: z.enum(GLASSES).optional(),
  print: z.enum(PRINTS).optional(),
  accessory: z.enum(ACCESSORIES).optional(),
  /** Trims, prints, hats and accessories: an index of OUTFIT_COLORS; -1 or left out picks one to go with the top. */
  accent: z
    .number()
    .int()
    .min(-1)
    .max(OUTFIT_COLORS.length - 1)
    .optional(),
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
    eyes: pickIndex(EYE_COLORS, random),
    mark: random() < 0.6 ? 'brak' : pick(FACE_MARKS_BY_GENDER[g], random),
    glasses: random() < 0.75 ? 'brak' : pick(GLASSES, random),
    print: random() < 0.5 ? 'gladka' : pick(PRINTS, random),
    accessory: random() < 0.5 ? 'brak' : pick(ACCESSORIES, random),
    accent: pickIndex(OUTFIT_COLORS, random),
  };
}
