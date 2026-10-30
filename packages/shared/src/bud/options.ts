import { z } from 'zod';
import {
  ACCESSORIES,
  ACCESSORY_LABELS,
  EYE_COLORS,
  FACE_MARKS_BY_GENDER,
  FACE_MARK_LABELS,
  GENDERS,
  GLASSES,
  GLASSES_LABELS,
  GENDER_LABELS,
  HAIR_BY_GENDER,
  HAIR_COLORS,
  HAIR_LABELS,
  MOODS,
  OUTFITS_BY_GENDER,
  OUTFIT_COLORS,
  OUTFIT_LABELS,
  PANTS_BY_GENDER,
  PANTS_COLORS,
  PANTS_LABELS,
  PRINTS,
  PRINT_LABELS,
  SHOES_BY_GENDER,
  SHOES_COLORS,
  SHOES_LABELS,
  SKINS,
  moodLabel,
} from './constants';

/**
 * Everything a creator shows, per gender: each body part's standard catalog (styles with labels) and its colours.
 * The game's creator reads this from the API (`GET /v1/look/options`), so the lists live only here.
 */
const option = z.object({ id: z.string(), label: z.string() });
const part = z.object({ styles: z.array(option), colors: z.array(z.string()) });

export const lookOptionsSchema = z.object({
  genders: z.array(option),
  skins: z.array(z.string()),
  eyes: z.array(z.string()),
  glasses: z.array(option),
  prints: z.array(option),
  accessories: z.array(option),
  accents: z.array(z.string()),
  byGender: z.array(
    z.object({
      gender: z.enum(GENDERS),
      moods: z.array(option),
      hair: part,
      top: part,
      legs: part,
      shoes: part,
      marks: z.array(option),
    }),
  ),
});
export type LookOptions = z.infer<typeof lookOptionsSchema>;

export function lookOptions(): LookOptions {
  const styles = <T extends string>(ids: readonly T[], labels: Record<T, string>) =>
    ids.map((id) => ({ id, label: labels[id] }));
  return {
    genders: GENDERS.map((g) => ({ id: g, label: GENDER_LABELS[g] })),
    skins: [...SKINS],
    eyes: [...EYE_COLORS],
    glasses: styles(GLASSES, GLASSES_LABELS),
    prints: styles(PRINTS, PRINT_LABELS),
    accessories: styles(ACCESSORIES, ACCESSORY_LABELS),
    accents: [...OUTFIT_COLORS],
    byGender: GENDERS.map((gender) => ({
      gender,
      moods: MOODS.map((m) => ({ id: m, label: moodLabel(m, gender) })),
      hair: { styles: styles(HAIR_BY_GENDER[gender], HAIR_LABELS), colors: [...HAIR_COLORS] },
      top: { styles: styles(OUTFITS_BY_GENDER[gender], OUTFIT_LABELS), colors: [...OUTFIT_COLORS] },
      legs: { styles: styles(PANTS_BY_GENDER[gender], PANTS_LABELS), colors: [...PANTS_COLORS] },
      shoes: { styles: styles(SHOES_BY_GENDER[gender], SHOES_LABELS), colors: [...SHOES_COLORS] },
      marks: styles(FACE_MARKS_BY_GENDER[gender], FACE_MARK_LABELS),
    })),
  };
}
