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

/** Skin base tones (design system "Postacie"); the shade tone is derived per tone in vector.ts. */
export const SKINS = ['#f6d5bd', '#f3c9a6', '#c98d62', '#a8704a', '#8a5636', '#6e4128'] as const;

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
};

/** Styles shown first for each gender — every style is available to everyone. */
export const HAIR_BY_GENDER: Record<Gender, readonly HairStyle[]> = {
  on: [
    'krotkie',
    'daszek',
    'jezyk',
    'czapka',
    'sluchawki',
    'grzywka',
    'afro',
    'dlugie',
    'kucyk',
    'bob',
    'kok',
    'warkocze',
  ],
  ona: [
    'kucyk',
    'dlugie',
    'warkocze',
    'kok',
    'bob',
    'daszek',
    'sluchawki',
    'afro',
    'grzywka',
    'krotkie',
    'czapka',
    'jezyk',
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
] as const;

/** Practical streetwear for everyone (design system: no sexualised outfits, same cut options for both). */
export const OUTFITS = ['bluza', 'tshirt', 'kurtka', 'ogrodniczki'] as const;
export type Outfit = (typeof OUTFITS)[number];

export const OUTFIT_LABELS: Record<Outfit, string> = {
  bluza: 'Bluza',
  tshirt: 'T-shirt',
  kurtka: 'Bomberka',
  ogrodniczki: 'Ogrodniczki',
};

/** Clothing colours taken from the Buds palette (buds, rep, epic, alert, legendary, uncommon, dark, paper). */
export const OUTFIT_COLORS = [
  '#a3e635',
  '#4cc7ff',
  '#b45cff',
  '#ff3d50',
  '#ff9a1f',
  '#5cc84a',
  '#3a3d4a',
  '#f6f2e9',
] as const;

export const PANTS_COLORS = ['#4a5a7a', '#262833', '#e4dccb', '#3d7bd9'] as const;

export const BUD_NAME_MIN = 2;
export const BUD_NAME_MAX = 16;
