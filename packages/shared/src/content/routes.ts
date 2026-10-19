import type { CacheInput } from '../caches';
import { scaledEnemy, type EnemyInput } from '../combat';
import type { BudLookInput } from '../bud/look';
import type { NpcInput, QuestInput } from '../quests';
import { PORTS } from '../travel';

/**
 * The wastelands between the cities (travel.ts ROUTES) and the harbours' ferrymen. On every route people lie in
 * wait off the road, in a nook or a bush (`ambush`), and pick a fight on their own when the bud comes close: some
 * are pushovers, some are a real threat, depending on the route. The route maps (tools/world/maps/routes.ts) carve
 * a hiding place of bushes around each spot listed here, so the content and the maps always agree.
 */

type Who = {
  id: string;
  name: string;
  level: number;
  weapon: EnemyInput['weapon'];
  at: [number, number];
  look: Omit<BudLookInput, 'gender' | 'mood'> & Partial<Pick<BudLookInput, 'gender' | 'mood'>>;
  lines: string[];
  boss?: boolean;
};

const lurker = (route: string, w: Who): EnemyInput =>
  scaledEnemy({
    id: w.id,
    name: w.name,
    district: route,
    level: w.level,
    weapon: w.weapon,
    spots: [{ x: w.at[0], y: w.at[1] }],
    look: { gender: 'on', mood: 'zadziorny', ...w.look } as BudLookInput,
    lines: w.lines,
    boss: w.boss,
    ambush: true,
  });

const OSTEPY = 'pustkowie-ostepy';
const WYDMY = 'pustkowie-wydmy';
const GOSCINIEC = 'pustkowie-gosciniec';
const NIEUZYTKI = 'pustkowie-nieuzytki';

const enemies: EnemyInput[] = [
  // Leśne Ostępy: the easy road, levels 2–5
  lurker(OSTEPY, {
    id: 'lesny-rabus',
    name: 'Leśny Rabuś',
    level: 2,
    weapon: 'piesci',
    at: [24, 8],
    look: {
      skin: 1,
      hair: 'czapka',
      hairColor: 2,
      outfit: 'flanela',
      outfitColor: 2,
      pantsColor: 1,
    },
    lines: ['Hop! Zgubiłeś się? Oddawaj kieszonkowe.', 'Z krzaków widać więcej, ziomek.'],
  }),
  lurker(OSTEPY, {
    id: 'klusownik',
    name: 'Kłusownik',
    level: 3,
    weapon: 'procarka',
    at: [52, 39],
    look: {
      skin: 2,
      hair: 'daszek',
      hairColor: 1,
      outfit: 'kamizelka',
      outfitColor: 4,
      pantsColor: 2,
    },
    lines: ['Myślałem, że to sarna. Ale ty też się nadasz.', 'Cicho! Spłoszysz mi zwierzynę.'],
  }),
  lurker(OSTEPY, {
    id: 'zboj-z-krzakow',
    name: 'Zbój z Krzaków',
    level: 4,
    weapon: 'kij',
    at: [86, 9],
    look: {
      skin: 3,
      hair: 'irokez',
      hairColor: 4,
      outfit: 'kurtka',
      outfitColor: 1,
      pantsColor: 0,
    },
    lines: ['Z traktu się nie schodzi. Teraz już za późno.', 'Mój krzak, moje zasady.'],
  }),
  lurker(OSTEPY, {
    id: 'banita',
    name: 'Banita',
    level: 5,
    weapon: 'kij',
    at: [118, 38],
    look: {
      gender: 'ona',
      skin: 0,
      hair: 'warkocze',
      hairColor: 3,
      outfit: 'flanela',
      outfitColor: 5,
      pantsColor: 3,
    },
    lines: [
      'Miasto mnie wygnało. Ty zapłacisz za to myto.',
      'Las mnie ukrywa. Ciebie nie uratuje.',
    ],
  }),

  // Wydmy: sand and wind towards the sea, levels 3–7
  lurker(WYDMY, {
    id: 'piaskowy-szczur',
    name: 'Piaskowy Szczur',
    level: 3,
    weapon: 'piesci',
    at: [8, 24],
    look: { skin: 2, hair: 'buzz', hairColor: 0, outfit: 'tshirt', outfitColor: 3, pantsColor: 2 },
    lines: ['Piasek w butach? Zaraz będzie w zębach.', 'Na wydmach rządzę ja.'],
  }),
  lurker(WYDMY, {
    id: 'surfer-wyrzutek',
    name: 'Surfer Wyrzutek',
    level: 4,
    weapon: 'deska',
    at: [39, 52],
    look: {
      skin: 1,
      hair: 'dlugie',
      hairColor: 5,
      outfit: 'tshirt',
      outfitColor: 6,
      pantsColor: 1,
    },
    lines: ['Wyrzucili mnie z plaży. Ty mi to wynagrodzisz.', 'Fala odpłynęła, ja zostałem.'],
  }),
  lurker(WYDMY, {
    id: 'lowca-muszli',
    name: 'Łowczyni Muszli',
    level: 5,
    weapon: 'procarka',
    at: [9, 88],
    look: {
      gender: 'ona',
      skin: 3,
      hair: 'kitki',
      hairColor: 1,
      outfit: 'polo',
      outfitColor: 2,
      pantsColor: 0,
    },
    lines: ['Każdy, kto tędy idzie, coś zostawia.', 'Muszle zbieram. Ciebie też zbiorę.'],
  }),
  lurker(WYDMY, {
    id: 'krol-wydm',
    name: 'Król Wydm',
    level: 7,
    weapon: 'deska',
    at: [38, 120],
    look: {
      skin: 4,
      hair: 'afro',
      hairColor: 0,
      outfit: 'kamizelka',
      outfitColor: 0,
      pantsColor: 3,
    },
    lines: ['Każda wydma to moje królestwo. Klękaj.', 'Za przejście płaci się koroną.'],
  }),

  // Stary Gościniec: the country road to the manor, levels 4–8
  lurker(GOSCINIEC, {
    id: 'zebrak-z-goscinca',
    name: 'Żebrak z Gościńca',
    level: 4,
    weapon: 'piesci',
    at: [8, 26],
    look: { skin: 2, hair: 'loki', hairColor: 2, outfit: 'sweter', outfitColor: 1, pantsColor: 2 },
    lines: ['Grosik dla biednego? Nie? To siłą.', 'Na gościńcu nic nie jest za darmo.'],
  }),
  lurker(GOSCINIEC, {
    id: 'woznica',
    name: 'Woźnica bez Konia',
    level: 5,
    weapon: 'kij',
    at: [39, 55],
    look: {
      skin: 1,
      hair: 'czapka',
      hairColor: 3,
      outfit: 'koszula',
      outfitColor: 5,
      pantsColor: 1,
    },
    lines: ['Koń uciekł, bat został. Sprawdzimy go na tobie.', 'Wio! Znaczy: walczymy.'],
  }),
  lurker(GOSCINIEC, {
    id: 'falszywy-poborca',
    name: 'Fałszywa Poborczyni',
    level: 6,
    weapon: 'mikrofon',
    at: [9, 90],
    look: {
      gender: 'ona',
      skin: 0,
      hair: 'kok',
      hairColor: 4,
      outfit: 'koszula',
      outfitColor: 3,
      pantsColor: 0,
    },
    lines: ['Myto dworskie! Płacisz albo ci odśpiewam.', 'Mam pieczątkę. Własnej roboty.'],
  }),
  lurker(GOSCINIEC, {
    id: 'herszt-goscinca',
    name: 'Herszt Gościńca',
    level: 8,
    weapon: 'kij',
    at: [38, 122],
    look: { skin: 3, hair: 'jezyk', hairColor: 0, outfit: 'kurtka', outfitColor: 6, pantsColor: 3 },
    lines: ['Cały gościniec jest mój. Ty też.', 'Moi chłopcy już cię widzieli. Teraz ja.'],
  }),

  // Nieużytki: the scrapland to Los Karkos, levels 6–12, the most dangerous road
  lurker(NIEUZYTKI, {
    id: 'zlomiarz-z-traktu',
    name: 'Złomiarz z Traktu',
    level: 6,
    weapon: 'kij',
    at: [22, 9],
    look: {
      skin: 2,
      hair: 'daszek',
      hairColor: 1,
      outfit: 'ogrodniczki',
      outfitColor: 4,
      pantsColor: 1,
    },
    lines: ['Wszystko tu jest na złom. Ty też.', 'Oddaj buty, ładnie by się sprzedały.'],
  }),
  lurker(NIEUZYTKI, {
    id: 'szczur-z-nieuzytkow',
    name: 'Szczur z Nieużytków',
    level: 7,
    weapon: 'piesci',
    at: [48, 38],
    look: { skin: 1, hair: 'buzz', hairColor: 0, outfit: 'bluza', outfitColor: 0, pantsColor: 0 },
    lines: ['Kto tu łazi bez pytania?', 'Nieużytki nie wybaczają.'],
  }),
  lurker(NIEUZYTKI, {
    id: 'wandal-z-hali',
    name: 'Wandalka z Hali',
    level: 8,
    weapon: 'spray',
    at: [76, 8],
    look: {
      gender: 'ona',
      skin: 2,
      hair: 'irokez',
      hairColor: 5,
      outfit: 'kurtka',
      outfitColor: 2,
      pantsColor: 2,
    },
    lines: ['Ta ściana jest moja. Ty będziesz następny.', 'Pomaluję cię na szaro.'],
  }),
  lurker(NIEUZYTKI, {
    id: 'cien-z-ruin',
    name: 'Cień z Ruin',
    level: 10,
    weapon: 'procarka',
    at: [104, 39],
    look: { skin: 4, hair: 'czapka', hairColor: 0, outfit: 'bluza', outfitColor: 6, pantsColor: 3 },
    lines: ['Nie zobaczyłeś mnie. Nikt nie widzi.', 'Za tobą. Zawsze za tobą.'],
  }),
  lurker(NIEUZYTKI, {
    id: 'wielki-zbyszek',
    name: 'Wielki Zbyszek',
    level: 12,
    weapon: 'kij',
    at: [130, 10],
    boss: true,
    look: {
      skin: 3,
      hair: 'irokez',
      hairColor: 2,
      outfit: 'kamizelka',
      outfitColor: 1,
      pantsColor: 0,
    },
    lines: [
      'Na Nieużytkach jest jeden szef. Patrzysz na niego.',
      'Do Karkos? Najpierw przeze mnie.',
    ],
  }),
];

// one ferryman in every harbour: talking to them opens the timetable (the game's ferry screen)
const FERRYMEN: { name: string; look: BudLookInput }[] = [
  {
    name: 'Staszek',
    look: {
      gender: 'on',
      mood: 'wyluzowany',
      skin: 1,
      hair: 'czapka',
      hairColor: 2,
      outfit: 'sweter',
      outfitColor: 4,
      pantsColor: 1,
    },
  },
  {
    name: 'Bronka',
    look: {
      gender: 'ona',
      mood: 'radosny',
      skin: 2,
      hair: 'warkocze',
      hairColor: 3,
      outfit: 'flanela',
      outfitColor: 2,
      pantsColor: 2,
    },
  },
  {
    name: 'Leo',
    look: {
      gender: 'on',
      mood: 'tajemniczy',
      skin: 3,
      hair: 'daszek',
      hairColor: 0,
      outfit: 'kamizelka',
      outfitColor: 4,
      pantsColor: 0,
    },
  },
  {
    name: 'Józef',
    look: {
      gender: 'on',
      mood: 'zaspany',
      skin: 0,
      hair: 'buzz',
      hairColor: 5,
      outfit: 'koszula',
      outfitColor: 1,
      pantsColor: 3,
    },
  },
  {
    name: 'Rudy',
    look: {
      gender: 'on',
      mood: 'zadziorny',
      skin: 2,
      hair: 'czapka',
      hairColor: 4,
      outfit: 'kurtka',
      outfitColor: 0,
      pantsColor: 1,
    },
  },
];
const npcs: NpcInput[] = PORTS.map((p, i) => ({
  id: `przewoznik-${p.id.replace('port-', '')}`,
  name: `Przewoźnik ${FERRYMEN[i]!.name}`.slice(0, 24),
  look: FERRYMEN[i]!.look,
  district: p.district,
  x: p.x,
  y: p.y,
  lines: [
    'Łódka czeka. Za drobną opłatą zawiozę cię do innego portu.',
    'Woda jest szybsza niż każda droga przez pustkowia.',
  ],
}));

export const ROUTES_CONTENT: {
  npcs: NpcInput[];
  quests: QuestInput[];
  caches: CacheInput[];
  enemies: EnemyInput[];
} = { npcs, quests: [], caches: [], enemies };

/** The ferryman's NPC id for a harbour. */
export const ferrymanOf = (portId: string) => `przewoznik-${portId.replace('port-', '')}`;
