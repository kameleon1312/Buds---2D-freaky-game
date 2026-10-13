export const GENDERS = ['on', 'ona'] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  on: 'Ziomek',
  ona: 'Ziomeczka',
};

export const MOODS = [
  'radosny',
  'wyluzowany',
  'zadziorny',
  'niesmialy',
  'zaspany',
  'tajemniczy',
] as const;
export type Mood = (typeof MOODS)[number];

/** Polish adjectives agree with gender: [masculine, feminine]. */
const MOOD_FORMS: Record<Mood, [string, string]> = {
  radosny: ['Radosny', 'Radosna'],
  wyluzowany: ['Wyluzowany', 'Wyluzowana'],
  zadziorny: ['Zadziorny', 'Zadziorna'],
  niesmialy: ['Nieśmiały', 'Nieśmiała'],
  zaspany: ['Zaspany', 'Zaspana'],
  tajemniczy: ['Tajemniczy', 'Tajemnicza'],
};

export function moodLabel(mood: Mood, gender: Gender): string {
  return MOOD_FORMS[mood][gender === 'on' ? 0 : 1];
}

/** Short flavour line per mood: [masculine, feminine]. */
const MOOD_BLURBS: Record<Mood, [string, string]> = {
  radosny: ['uśmiech od ucha do ucha', 'uśmiech od ucha do ucha'],
  wyluzowany: ['nic go nie rusza', 'nic jej nie rusza'],
  zadziorny: ['zawsze gotowy do akcji', 'zawsze gotowa do akcji'],
  niesmialy: ['rumieni się przy każdym NPC', 'rumieni się przy każdym NPC'],
  zaspany: ['pięć minut jeszcze…', 'pięć minut jeszcze…'],
  tajemniczy: ['grzywka zasłania oko', 'grzywka zasłania oko'],
};

export function moodBlurb(mood: Mood, gender: Gender): string {
  return MOOD_BLURBS[mood][gender === 'on' ? 0 : 1];
}

/** "gotowy" / "gotowa" style agreement for short UI phrases. */
export function byGender(gender: Gender, masculine: string, feminine: string): string {
  return gender === 'on' ? masculine : feminine;
}

/** Skin base tones (design system "Postacie"); the shade tone is derived per tone in vector.ts. Append only. */
export const SKINS = [
  '#f6d5bd',
  '#f3c9a6',
  '#c98d62',
  '#a8704a',
  '#8a5636',
  '#6e4128',
  '#fbe3d1',
  '#523020',
] as const;

// Every list below only ever grows at the end: looks store indexes and style names.

export const HAIR_STYLES = [
  'krotkie',
  'jezyk',
  'grzywka',
  'czapka',
  'dlugie',
  'kucyk',
  'kok',
  'warkocze',
  'bob',
  'afro',
  'daszek',
  'sluchawki',
  'irokez',
  'buzz',
  'loki',
  'kitki',
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const HAIR_LABELS: Record<HairStyle, string> = {
  krotkie: 'Krótkie',
  jezyk: 'Jeżyk',
  grzywka: 'Grzywka',
  czapka: 'Czapka',
  dlugie: 'Długie',
  kucyk: 'Kucyk',
  kok: 'Kok',
  warkocze: 'Warkocze',
  bob: 'Bob',
  afro: 'Afro',
  daszek: 'Czapka z daszkiem',
  sluchawki: 'Słuchawki',
  irokez: 'Irokez',
  buzz: 'Na zero',
  loki: 'Loki',
  kitki: 'Kitki',
};

/** The standard catalog of each gender, in the order the creators show it. Validation accepts any style. */
export const HAIR_BY_GENDER: Record<Gender, readonly HairStyle[]> = {
  on: [
    'krotkie',
    'buzz',
    'daszek',
    'jezyk',
    'irokez',
    'czapka',
    'sluchawki',
    'grzywka',
    'afro',
    'loki',
    'dlugie',
    'kucyk',
  ],
  ona: [
    'kucyk',
    'dlugie',
    'loki',
    'kitki',
    'warkocze',
    'kok',
    'bob',
    'grzywka',
    'afro',
    'daszek',
    'czapka',
    'sluchawki',
  ],
};

export const HAIR_COLORS = [
  '#2a1d16',
  '#5a3820',
  '#a5672f',
  '#e8c46a',
  '#c4502a',
  '#f2efe6',
  '#ff8fc8',
  '#5aa9ff',
  '#7bd389',
  '#8a8f99',
  '#7a2f45',
  '#b45cff',
  '#2fb3a0',
] as const;

/** Tops. Practical streetwear (design system: no sexualised outfits). */
export const OUTFITS = [
  'bluza',
  'tshirt',
  'kurtka',
  'ogrodniczki',
  'koszula',
  'sweter',
  'polo',
  'kamizelka',
  'flanela',
  'sukienka',
] as const;
export type Outfit = (typeof OUTFITS)[number];

export const OUTFIT_LABELS: Record<Outfit, string> = {
  bluza: 'Bluza',
  tshirt: 'T-shirt',
  kurtka: 'Bomberka',
  ogrodniczki: 'Ogrodniczki',
  koszula: 'Koszula',
  sweter: 'Sweter',
  polo: 'Polo',
  kamizelka: 'Kamizelka',
  flanela: 'Flanela',
  sukienka: 'Sukienka',
};

export const OUTFITS_BY_GENDER: Record<Gender, readonly Outfit[]> = {
  on: [
    'bluza',
    'tshirt',
    'kurtka',
    'flanela',
    'koszula',
    'polo',
    'sweter',
    'kamizelka',
    'ogrodniczki',
  ],
  ona: [
    'bluza',
    'tshirt',
    'sukienka',
    'kurtka',
    'sweter',
    'koszula',
    'polo',
    'kamizelka',
    'ogrodniczki',
  ],
};

/** Clothing colours from the Buds palette. */
export const OUTFIT_COLORS = [
  '#a3e635',
  '#4cc7ff',
  '#b45cff',
  '#ff3d50',
  '#ff9a1f',
  '#5cc84a',
  '#3a3d4a',
  '#f6f2e9',
  '#ffc93c',
  '#ff7aa8',
  '#3fb39b',
  '#8a2f3c',
  '#36689f',
  '#c9b593',
] as const;

/** Legs. */
export const PANTS = [
  'jeansy',
  'dresy',
  'szorty',
  'bojowki',
  'chinosy',
  'legginsy',
  'spodnica',
] as const;
export type Pants = (typeof PANTS)[number];

export const PANTS_LABELS: Record<Pants, string> = {
  jeansy: 'Jeansy',
  dresy: 'Dresy',
  szorty: 'Szorty',
  bojowki: 'Bojówki',
  chinosy: 'Chinosy',
  legginsy: 'Legginsy',
  spodnica: 'Spódnica',
};

export const PANTS_BY_GENDER: Record<Gender, readonly Pants[]> = {
  on: ['jeansy', 'dresy', 'bojowki', 'chinosy', 'szorty'],
  ona: ['jeansy', 'legginsy', 'spodnica', 'dresy', 'szorty', 'bojowki'],
};

export const PANTS_COLORS = [
  '#4a5a7a',
  '#262833',
  '#e4dccb',
  '#3d7bd9',
  '#8a8a5a',
  '#6b4229',
  '#5a3a6e',
  '#3a6e5a',
  '#bd1c31',
  '#f6f2e9',
] as const;

/** Feet. */
export const SHOES = ['trampki', 'wysokie', 'glany', 'sandaly', 'mokasyny', 'kozaki'] as const;
export type Shoes = (typeof SHOES)[number];

export const SHOES_LABELS: Record<Shoes, string> = {
  trampki: 'Trampki',
  wysokie: 'Za kostkę',
  glany: 'Glany',
  sandaly: 'Sandały',
  mokasyny: 'Mokasyny',
  kozaki: 'Kozaki',
};

export const SHOES_BY_GENDER: Record<Gender, readonly Shoes[]> = {
  on: ['trampki', 'wysokie', 'glany', 'mokasyny', 'sandaly'],
  ona: ['trampki', 'wysokie', 'kozaki', 'glany', 'sandaly', 'mokasyny'],
};

export const SHOES_COLORS = [
  '#f6f2e9',
  '#3a3d4a',
  '#ff3d50',
  '#4cc7ff',
  '#a3e635',
  '#ffc93c',
  '#8f5e3b',
  '#b45cff',
  '#ff7aa8',
  '#c9b593',
] as const;

export const BUD_NAME_MIN = 2;
export const BUD_NAME_MAX = 16;
