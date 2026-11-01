import type { BudLookInput } from '../bud/look';
import type { Accessory, Gender, Glasses, HairStyle, Outfit, Pants, Shoes } from '../bud/constants';

/**
 * What people wear where they live. Every NPC and opponent is dressed from their city's wardrobe when the content is
 * put together: the same choices every time (from the id), with what a person's job calls for in `ROLES`. Mood,
 * gender and the finer face details stay what the content file gave them. The Chinatown look comes from clothes, hair
 * and skin tones the creators offer anyway: faces are drawn the same for everyone, never a caricature.
 */
type Clothes = {
  outfit: readonly Outfit[];
  pants: readonly Pants[];
  shoes: readonly Shoes[];
  hair: readonly HairStyle[];
};

type Wardrobe = {
  on: Clothes;
  ona: Clothes;
  /** Indexes of OUTFIT_COLORS, PANTS_COLORS, SHOES_COLORS, HAIR_COLORS, SKINS. */
  tops: readonly number[];
  legs: readonly number[];
  feet: readonly number[];
  hairs?: readonly number[];
  skins?: readonly number[];
  accents?: readonly number[];
  glasses?: Glasses;
  accessories?: readonly Accessory[];
};

const WARDROBES = {
  tropik: {
    on: {
      outfit: ['hawajska', 'hawajska', 'hawajska', 'bezrekawnik', 'tshirt'],
      pants: ['szorty'],
      shoes: ['sandaly', 'sandaly', 'trampki'],
      hair: ['slomkowy', 'dredy', 'loki', 'daszek', 'krotkie'],
    },
    ona: {
      outfit: ['hawajska', 'sukienka', 'bezrekawnik', 'sukienka'],
      pants: ['szorty', 'spodnica'],
      shoes: ['sandaly'],
      hair: ['kwiat', 'kwiat', 'slomkowy', 'loki', 'warkocze'],
    },
    tops: [1, 3, 4, 8, 9, 10, 5, 7],
    legs: [2, 3, 7, 9],
    feet: [6, 9, 5, 3],
    skins: [2, 3, 4, 5, 1],
    accents: [3, 7, 8, 9, 4],
    glasses: 'przeciwsloneczne',
  },
  dwor: {
    on: {
      outfit: ['surdut', 'surdut', 'surdut', 'koszula'],
      pants: ['chinosy'],
      shoes: ['mokasyny', 'mokasyny', 'wysokie'],
      hair: ['cylinder', 'krotkie', 'grzywka', 'cylinder'],
    },
    ona: {
      outfit: ['suknia', 'suknia', 'suknia', 'sukienka'],
      pants: ['spodnica'],
      shoes: ['mokasyny', 'kozaki'],
      hair: ['kok', 'loki', 'warkocze', 'kok'],
    },
    tops: [11, 12, 6, 2, 10, 7],
    legs: [1, 2, 6],
    feet: [1, 6],
    accents: [8, 7, 13],
    glasses: 'lenonki',
  },
  zlom: {
    on: {
      outfit: ['kurtka', 'bezrekawnik', 'kamizelka', 'jeansowka', 'flanela'],
      pants: ['bojowki', 'rurki', 'jeansy'],
      shoes: ['glany', 'glany', 'wysokie'],
      hair: ['bandana', 'irokez', 'buzz', 'undercut', 'bandana'],
    },
    ona: {
      outfit: ['kurtka', 'bezrekawnik', 'jeansowka', 'kamizelka'],
      pants: ['bojowki', 'rurki'],
      shoes: ['glany', 'kozaki'],
      hair: ['bandana', 'undercut', 'kucyk', 'dredy'],
    },
    tops: [6, 13, 11, 12, 4],
    legs: [1, 0, 4, 5],
    feet: [1, 6],
    accents: [3, 4, 8],
    glasses: 'sportowe',
    accessories: ['lancuch', 'brak', 'nerka', 'brak'],
  },
  las: {
    on: {
      outfit: ['flanela', 'kamizelka', 'flanela', 'ogrodniczki', 'puchowka'],
      pants: ['bojowki', 'jeansy'],
      shoes: ['kalosze', 'wysokie', 'glany'],
      hair: ['kapelusz', 'czapka', 'kapelusz', 'krotkie'],
    },
    ona: {
      outfit: ['flanela', 'kamizelka', 'ogrodniczki', 'puchowka'],
      pants: ['bojowki', 'jeansy'],
      shoes: ['kalosze', 'wysokie'],
      hair: ['kapelusz', 'warkocze', 'czapka', 'kucyk'],
    },
    tops: [5, 13, 10, 12, 3],
    legs: [4, 5, 7],
    feet: [6, 1, 5],
    accents: [13, 4, 8],
    accessories: ['plecak', 'brak', 'nerka'],
  },
  chinatown: {
    on: {
      outfit: ['tangzhuang', 'tangzhuang', 'tangzhuang', 'kamizelka'],
      pants: ['szerokie'],
      shoes: ['mokasyny', 'mokasyny', 'trampki'],
      hair: ['krotkie', 'grzywka', 'buzz', 'undercut', 'kucyk'],
    },
    ona: {
      outfit: ['qipao', 'qipao', 'tangzhuang'],
      pants: ['szerokie'],
      shoes: ['mokasyny'],
      hair: ['szpilki', 'koczki', 'bob', 'szpilki', 'grzywka'],
    },
    tops: [3, 11, 12, 6, 10, 8, 7],
    legs: [1, 2, 8],
    feet: [1, 2],
    hairs: [0, 0, 0, 1],
    skins: [0, 1, 6],
    accents: [8, 3, 7],
  },
} as const satisfies Record<string, Wardrobe>;

type Style = keyof typeof WARDROBES;

/** Cities, and the wastelands on the road to them. Miasto Ziomków and the island keep their street clothes. */
const STYLE_OF: Readonly<Record<string, Style>> = {
  'las-palmas': 'tropik',
  'pustkowie-wydmy': 'tropik',
  'dwor-carski': 'dwor',
  'pustkowie-gosciniec': 'dwor',
  'los-karkos': 'zlom',
  'pustkowie-nieuzytki': 'zlom',
  'dzika-puszcza': 'las',
  'pustkowie-ostepy': 'las',
  chinatown: 'chinatown',
  'pustkowie-ryzowe': 'chinatown',
};

/** What a job calls for, over the wardrobe. */
const ROLES: Readonly<Record<string, Partial<BudLookInput>>> = {
  // Las Palmas
  profesor: {
    outfit: 'koszula',
    outfitColor: 7,
    pants: 'chinosy',
    pantsColor: 2,
    hair: 'slomkowy',
    glasses: 'okulary',
  },
  tomasz: { outfit: 'kamizelka', pants: 'szorty', hair: 'slomkowy' },
  'nurek-bruno': { outfit: 'bezrekawnik', outfitColor: 12, glasses: 'sportowe' },
  'odkrywca-igor': {
    outfit: 'koszula',
    outfitColor: 13,
    pants: 'bojowki',
    shoes: 'wysokie',
    hair: 'kapelusz',
  },
  'zeglarka-marina': {
    outfit: 'polo',
    outfitColor: 7,
    pants: 'szorty',
    pantsColor: 9,
    hair: 'kucyk',
  },
  'wodz-makoa': { outfit: 'hawajska', outfitColor: 3, hair: 'kwiat' },
  'sprzedawca-lodow': { outfit: 'hawajska', outfitColor: 9 },
  // Dwór Carski: not everyone at the manor lives upstairs
  feliks: {
    outfit: 'ogrodniczki',
    outfitColor: 5,
    pants: 'bojowki',
    pantsColor: 4,
    shoes: 'kalosze',
    hair: 'kapelusz',
  },
  'pomocnik-ogrodnika': {
    outfit: 'ogrodniczki',
    outfitColor: 13,
    pants: 'jeansy',
    shoes: 'kalosze',
    hair: 'czapka',
  },
  jozef: {
    outfit: 'kamizelka',
    outfitColor: 13,
    pants: 'bojowki',
    pantsColor: 5,
    shoes: 'wysokie',
    hair: 'krotkie',
  },
  'dzokejka-roza': {
    outfit: 'kurtka',
    outfitColor: 11,
    pants: 'legginsy',
    pantsColor: 9,
    shoes: 'kozaki',
    hair: 'kucyk',
  },
  'hania-mlynarzowna': {
    outfit: 'sukienka',
    outfitColor: 7,
    pants: 'spodnica',
    shoes: 'mokasyny',
    hair: 'warkocze',
  },
  'zielarka-bogna': {
    outfit: 'sukienka',
    outfitColor: 5,
    pants: 'spodnica',
    shoes: 'mokasyny',
    hair: 'warkocze',
  },
  'goniec-witek': { outfit: 'kurtka', outfitColor: 12, pants: 'chinosy', hair: 'daszek' },
  'malarka-iza': { outfit: 'sweter', outfitColor: 2, pants: 'spodnica', hair: 'bob' },
  alfred: { outfit: 'surdut', outfitColor: 6, pantsColor: 1, hair: 'krotkie' },
  // Los Karkos
  'gornik-stefan': { outfit: 'kurtka', outfitColor: 6, hair: 'czapka' },
  'motocyklistka-iga': { outfit: 'kurtka', outfitColor: 6, pants: 'rurki', hair: 'kucyk' },
  bogdan: { outfit: 'dresowka', outfitColor: 3, pants: 'dresy', shoes: 'biegowe', hair: 'buzz' },
  // Dzika Puszcza
  'harcerka-zosia': {
    outfit: 'koszula',
    outfitColor: 5,
    pants: 'szorty',
    pantsColor: 4,
    hair: 'warkocze',
    accessory: 'szalik',
  },
  'harcerz-tomek': {
    outfit: 'koszula',
    outfitColor: 5,
    pants: 'szorty',
    pantsColor: 4,
    hair: 'krotkie',
    accessory: 'szalik',
  },
  'harcerz-olek': {
    outfit: 'koszula',
    outfitColor: 5,
    pants: 'szorty',
    pantsColor: 4,
    hair: 'jezyk',
    accessory: 'szalik',
  },
  'lesniczy-bartek': {
    outfit: 'kurtka',
    outfitColor: 5,
    pants: 'bojowki',
    pantsColor: 4,
    hair: 'kapelusz',
    shoes: 'wysokie',
  },
  // Chinatown
  bao: { outfit: 'tangzhuang', outfitColor: 7, hair: 'kucharska' },
  mei: { outfit: 'tangzhuang', outfitColor: 3, pants: 'szerokie', hair: 'kucyk' },
  lan: { outfit: 'tangzhuang', outfitColor: 2, hair: 'kok', hairColor: 9 },
  'stary-wei': { outfit: 'tangzhuang', outfitColor: 12, hair: 'krotkie', hairColor: 5 },
  tao: { outfit: 'kurtka', outfitColor: 3, pants: 'bojowki', shoes: 'trampki', hair: 'daszek' },
  'tragarz-ping': { outfit: 'bezrekawnik', outfitColor: 7, hair: 'buzz' },
};

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A person of the content files, dressed for where they are. Anyone from elsewhere stays as they were. */
export function dressed<T extends { id: string; district: string; look: BudLookInput }>(
  person: T,
): T {
  const name = STYLE_OF[person.district];
  if (!name) return person;
  const w: Wardrobe = WARDROBES[name];
  const gender: Gender = person.look.gender;
  const clothes = w[gender];
  // a different draw per choice, so what someone wears on top says nothing about their shoes
  const pick = <V>(list: readonly V[], salt: string): V =>
    list[hashOf(person.id + salt) % list.length] as V;
  const look: BudLookInput = {
    ...person.look,
    // dyed colours are for the street and the scrapyard
    ...(name !== 'zlom' && person.look.hairColor > 5
      ? { hairColor: pick([0, 1, 2], 'hair colour') }
      : {}),
    outfit: pick(clothes.outfit, 'top'),
    outfitColor: pick(w.tops, 'top colour'),
    pants: pick(clothes.pants, 'legs'),
    pantsColor: pick(w.legs, 'legs colour'),
    shoes: pick(clothes.shoes, 'feet'),
    shoesColor: pick(w.feet, 'feet colour'),
    hair: pick(clothes.hair, 'hair'),
    print: 'gladka',
    accent: w.accents ? pick(w.accents, 'accent') : -1,
    ...(w.hairs ? { hairColor: pick(w.hairs, 'hair colour') } : {}),
    ...(w.skins ? { skin: pick(w.skins, 'skin') } : {}),
    ...(w.glasses && hashOf(person.id + 'glasses') % 3 === 0 ? { glasses: w.glasses } : {}),
    ...(w.accessories ? { accessory: pick(w.accessories, 'accessory') } : {}),
    ...ROLES[person.id],
  };
  return { ...person, look };
}

/** The styles a district's people are dressed from, or null where the content's own clothes stay. */
export const wardrobeOf = (district: string) => {
  const name = STYLE_OF[district];
  return name ? WARDROBES[name] : null;
};
