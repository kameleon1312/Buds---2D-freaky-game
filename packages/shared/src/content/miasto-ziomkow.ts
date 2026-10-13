import type { BudLook } from '../bud/look';
import type { Npc, QuestInput } from '../quests';

/**
 * Miasto Ziomków — starter NPCs and quests (~500 XP: a new player reaches level 3 in the first quarter hour).
 *
 * To change the content edit this file: NPC positions are map cells of
 * apps/unity/Assets/Buds/Resources/Maps/miasto-ziomkow.txt (x right, y down); `pnpm test` and
 * tools/world/export-quests.ts check that every NPC stands on free ground and every target is reachable.
 */

const D = 'miasto-ziomkow';

const look = (l: BudLook) => l;

export const MIASTO_ZIOMKOW: { npcs: Npc[]; quests: QuestInput[] } = {
  npcs: [
    {
      id: 'wiktor',
      name: 'Wiktor',
      district: D,
      x: 61,
      y: 51,
      look: look({
        gender: 'on',
        mood: 'radosny',
        skin: 2,
        hair: 'daszek',
        hairColor: 0,
        outfit: 'kurtka',
        outfitColor: 1,
        pantsColor: 1,
      }),
      lines: [
        'Rynek to serce miasta. Stąd wszędzie blisko.',
        'Jak się zgubisz, wracaj do fontanny.',
      ],
    },
    {
      id: 'halina',
      name: 'Pani Halina',
      district: D,
      x: 69,
      y: 45,
      look: look({
        gender: 'ona',
        mood: 'wyluzowany',
        skin: 0,
        hair: 'kok',
        hairColor: 5,
        outfit: 'kurtka',
        outfitColor: 4,
        pantsColor: 0,
      }),
      lines: ['Za moich czasów to się chodziło piechotą!', 'Ładny dziś dzień, prawda?'],
    },
    {
      id: 'nowak',
      name: 'Sierżant Nowak',
      district: D,
      x: 70,
      y: 57,
      look: look({
        gender: 'on',
        mood: 'zadziorny',
        skin: 1,
        hair: 'czapka',
        hairColor: 0,
        outfit: 'kurtka',
        outfitColor: 6,
        pantsColor: 1,
      }),
      lines: ['Graffiti to wandalizm. Tak przynajmniej mówi regulamin.', 'Mam cię na oku, młody.'],
    },
    {
      id: 'basia',
      name: 'Basia',
      district: D,
      x: 24,
      y: 37,
      look: look({
        gender: 'ona',
        mood: 'radosny',
        skin: 3,
        hair: 'kucyk',
        hairColor: 3,
        outfit: 'tshirt',
        outfitColor: 2,
        pantsColor: 2,
      }),
      lines: ['W parku zawsze coś się dzieje!', 'Widziałeś kaczki na stawie?'],
    },
    {
      id: 'kuba',
      name: 'Kuba Deska',
      district: D,
      x: 97,
      y: 38,
      look: look({
        gender: 'on',
        mood: 'wyluzowany',
        skin: 4,
        hair: 'sluchawki',
        hairColor: 1,
        outfit: 'bluza',
        outfitColor: 0,
        pantsColor: 0,
      }),
      lines: ['Deska, rampa, luz. Tyle mi trzeba.', 'Wkrótce bitwy freestylowe. Będziesz?'],
    },
    {
      id: 'zdzisiek',
      name: 'Pan Zdzisiek',
      district: D,
      x: 31,
      y: 22,
      look: look({
        gender: 'on',
        mood: 'zaspany',
        skin: 1,
        hair: 'czapka',
        hairColor: 6,
        outfit: 'ogrodniczki',
        outfitColor: 7,
        pantsColor: 3,
      }),
      lines: ['Pomidory w tym roku jak malowane.', 'Działka to najlepsza siłownia.'],
    },
    {
      id: 'ola',
      name: 'Ola',
      district: D,
      x: 35,
      y: 84,
      look: look({
        gender: 'ona',
        mood: 'zadziorny',
        skin: 2,
        hair: 'bob',
        hairColor: 7,
        outfit: 'bluza',
        outfitColor: 3,
        pantsColor: 1,
      }),
      lines: ['Ściany w tym mieście są za szare.', 'Psst. Policja patroluje tory po zmroku.'],
    },
    {
      id: 'marek',
      name: 'Listonosz Marek',
      district: D,
      x: 106,
      y: 43,
      look: look({
        gender: 'on',
        mood: 'niesmialy',
        skin: 0,
        hair: 'krotkie',
        hairColor: 2,
        outfit: 'kurtka',
        outfitColor: 4,
        pantsColor: 0,
      }),
      lines: ['Przesyłki same się nie doręczą.', 'Autobus znowu się spóźnia.'],
    },
  ],

  quests: [
    {
      id: 'witaj-w-miescie',
      title: 'Witaj w mieście',
      district: D,
      giver: 'wiktor',
      xp: 60,
      intro:
        'Nowy w mieście? Przywitaj się z sąsiadami: Pani Halina stoi przy fontannie, a Sierżant Nowak pilnuje komisariatu.',
      done: 'Widzę, że już cię tu znają. Witaj w Mieście Ziomków!',
      steps: [
        {
          kind: 'talk',
          npc: 'halina',
          text: 'Dzień dobry, dziecko! Jak będziesz miał chwilę, przyjdź do mnie, mam drobną prośbę.',
        },
        { kind: 'talk', npc: 'nowak', text: 'Nowa twarz, co? Tylko bez głupot na moim rewirze.' },
      ],
    },
    {
      id: 'zakupy-haliny',
      title: 'Zakupy dla sąsiadki',
      district: D,
      giver: 'halina',
      xp: 50,
      requires: ['witaj-w-miescie'],
      intro:
        'Upuściłam siatki z zakupami, jak biegłam na autobus. Leżą gdzieś przy rynku. Pozbierasz?',
      done: 'Wszystko jest! Złote z ciebie dziecko.',
      steps: [
        {
          kind: 'collect',
          item: 'zakupy',
          label: 'Siatki z zakupami',
          spots: [
            { x: 57, y: 39 },
            { x: 72, y: 44 },
            { x: 66, y: 57 },
          ],
        },
      ],
    },
    {
      id: 'zgubiony-pies',
      title: 'Zgubiony pies',
      district: D,
      giver: 'nowak',
      xp: 60,
      requires: ['witaj-w-miescie'],
      intro:
        'Zgłoszenie: zaginął pies Pani Haliny, Burek. Ostatnio widziany przy stawie w parku. Sprawdzisz?',
      done: 'Burek już w domu? Dobra robota. Może będą z ciebie ludzie.',
      steps: [
        { kind: 'reach', x: 22, y: 45, radius: 2, label: 'Staw w Parku Miejskim' },
        {
          kind: 'talk',
          npc: 'basia',
          text: 'Burek? Tak! Pobiegł za mną do domu Pani Haliny. Już jest bezpieczny.',
        },
      ],
    },
    {
      id: 'ulotki-basi',
      title: 'Ulotki na koncert',
      district: D,
      giver: 'basia',
      xp: 50,
      intro:
        'W sobotę gramy koncert w parku! Roznieś ulotki: Kuba na skateparku, Pan Zdzisiek na działkach i listonosz Marek przy przystanku.',
      done: 'Super! Teraz całe miasto przyjdzie.',
      steps: [
        { kind: 'talk', npc: 'kuba', text: 'Koncert? Wpadnę na deskę. Dzięki!' },
        {
          kind: 'talk',
          npc: 'zdzisiek',
          text: 'Koncert w parku? Za moich czasów grało się na akordeonie. Przyjdę.',
        },
        { kind: 'talk', npc: 'marek', text: 'Ulotka? Przypnę na przystanku, wszyscy zobaczą.' },
      ],
    },
    {
      id: 'zbiory-zdzisia',
      title: 'Zbiory na działce',
      district: D,
      giver: 'zdzisiek',
      xp: 70,
      intro: 'Pomidory dojrzały, a mnie strzyka w krzyżu. Zbierzesz pięć z grządek?',
      done: 'Piękne! Weź jednego dla siebie.',
      steps: [
        {
          kind: 'collect',
          item: 'pomidor',
          label: 'Pomidory',
          spots: [
            { x: 11, y: 11 },
            { x: 15, y: 10 },
            { x: 24, y: 18 },
            { x: 26, y: 19 },
            { x: 36, y: 11 },
          ],
        },
      ],
    },
    {
      id: 'puszki-oli',
      title: 'Puszki z farbą',
      district: D,
      giver: 'ola',
      xp: 80,
      minLevel: 2,
      intro:
        'Ktoś rozrzucił moje puszki z farbą przy garażach. Pozbierasz je, zanim zobaczy je patrol?',
      done: 'Dzięki! Weź ten złoty spray — jest wyjątkowy. Niedługo pokażę ci, jak to się robi.',
      rewardItem: 'spray-zloty',
      steps: [
        {
          kind: 'collect',
          item: 'puszka',
          label: 'Puszki z farbą',
          spots: [
            { x: 14, y: 88 },
            { x: 26, y: 89 },
            { x: 40, y: 88 },
            { x: 52, y: 88 },
          ],
        },
      ],
    },
    {
      id: 'paczka-na-wzgorze',
      title: 'Paczka na Wzgórze',
      district: D,
      giver: 'marek',
      xp: 60,
      intro:
        'Mam przesyłkę dla kogoś na Wzgórzu, a autobus nie przyjeżdża. Zaniesiesz ją pod tablicę na górze?',
      done: 'Doręczone? Jesteś lepszy niż poczta!',
      steps: [{ kind: 'reach', x: 72, y: 13, radius: 3, label: 'Tablica na Wzgórzu' }],
    },
    {
      id: 'pierwszy-trik',
      title: 'Pierwszy trik',
      district: D,
      giver: 'kuba',
      xp: 70,
      requires: ['ulotki-basi'],
      intro: 'Chcesz jeździć? Najpierw obejdź wszystkie rampy i zobacz, jak są zbudowane.',
      done: 'Masz to we krwi. Masz tu moją starą deskę — przyda ci się.',
      rewardItem: 'deskorolka',
      steps: [
        { kind: 'reach', x: 91, y: 35, radius: 1, label: 'Pierwsza rampa' },
        { kind: 'reach', x: 95, y: 35, radius: 1, label: 'Druga rampa' },
        { kind: 'reach', x: 101, y: 35, radius: 1, label: 'Trzecia rampa' },
      ],
    },
  ],
};
