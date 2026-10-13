import type { CacheInput } from '../caches';
import type { EnemyInput } from '../combat';
import type { NpcInput, QuestInput } from '../quests';

/**
 * Wyspa Startowa — the tutorial. Every new bud wakes up on the beach and learns, one quest at a time: walking and
 * running (reach the lighthouse), picking things up, a hidden cache on the way, a training duel, and finally the
 * boat to Miasto Ziomków (handing in `wyspa-rejs` opens the pier). Map: tools/world/maps/wyspa-startowa.ts.
 */
const D = 'wyspa-startowa';

export const WYSPA_STARTOWA: {
  npcs: NpcInput[];
  quests: QuestInput[];
  caches: CacheInput[];
  enemies: EnemyInput[];
} = {
  npcs: [
    {
      id: 'bosman',
      name: 'Kapitan Bosman',
      district: D,
      x: 36,
      y: 31,
      look: {
        gender: 'on',
        mood: 'radosny',
        skin: 3,
        hair: 'czapka',
        hairColor: 5,
        outfit: 'sweter',
        outfitColor: 12,
        pants: 'chinosy',
        pantsColor: 0,
        shoes: 'glany',
        shoesColor: 1,
      },
      lines: [
        'Morze dziś spokojne. Dobry dzień na naukę.',
        'Każdy ziomek zaczynał kiedyś na tej plaży.',
      ],
    },
    {
      id: 'rybak-staszek',
      name: 'Rybak Staszek',
      district: D,
      x: 36,
      y: 39,
      look: {
        gender: 'on',
        mood: 'zaspany',
        skin: 1,
        hair: 'daszek',
        hairColor: 2,
        outfit: 'kamizelka',
        outfitColor: 4,
        pants: 'bojowki',
        pantsColor: 4,
        shoes: 'sandaly',
        shoesColor: 6,
      },
      lines: ['Ryby biorą, ale ja wolę kokosy.', 'Na wyspie nic się nie marnuje.'],
    },
    {
      id: 'trenerka-ewa',
      name: 'Trenerka Ewa',
      district: D,
      x: 56,
      y: 35,
      look: {
        gender: 'ona',
        mood: 'zadziorny',
        skin: 4,
        hair: 'kitki',
        hairColor: 0,
        outfit: 'polo',
        outfitColor: 3,
        pants: 'legginsy',
        pantsColor: 1,
        shoes: 'wysokie',
        shoesColor: 0,
      },
      lines: ['Garda wyżej!', 'Najpierw technika, potem siła.'],
    },
    {
      id: 'sternik-jozek',
      name: 'Sternik Józek',
      district: D,
      x: 74,
      y: 31,
      look: {
        gender: 'on',
        mood: 'wyluzowany',
        skin: 2,
        hair: 'buzz',
        hairColor: 0,
        outfit: 'koszula',
        outfitColor: 7,
        pants: 'szorty',
        pantsColor: 0,
        shoes: 'mokasyny',
        shoesColor: 6,
      },
      lines: ['Łódź gotowa, czekamy na zgodę kapitana.', 'Miasto Ziomków jest tuż za horyzontem.'],
    },
  ],
  quests: [
    {
      id: 'wyspa-powitanie',
      title: 'Pierwsze kroki',
      district: D,
      giver: 'bosman',
      xp: 25,
      intro:
        'Ahoj, witaj na Wyspie Startowej! Najpierw rozruszaj nogi: wejdź na wzgórze przy latarni i wróć do mnie. Spróbuj biegu, trzymając Shift albo mocno wychylając palec.',
      done: 'Ale tempo! A skrytkę przy latarni widzisz? Na wyspie jest jedna, wystarczy podejść blisko.',
      steps: [{ kind: 'reach', x: 18, y: 16, radius: 2, label: 'Wzgórze Latarni' }],
    },
    {
      id: 'wyspa-kokosy',
      title: 'Kokosy dla rybaka',
      district: D,
      giver: 'rybak-staszek',
      xp: 25,
      requires: ['wyspa-powitanie'],
      intro: 'Kokosy spadły z palm w wiosce. Przynieś mi trzy, wystarczy po nie podejść.',
      done: 'Pyszne! Zbieranie rzeczy przyda ci się w każdej dzielnicy.',
      steps: [
        {
          kind: 'collect',
          item: 'kokos',
          label: 'Kokosy',
          spots: [
            { x: 27, y: 35 },
            { x: 51, y: 25 },
            { x: 29, y: 23 },
          ],
        },
      ],
    },
    {
      id: 'wyspa-trening',
      title: 'Trening na ringu',
      district: D,
      giver: 'trenerka-ewa',
      xp: 40,
      requires: ['wyspa-powitanie'],
      intro:
        'Na ringu czeka manekin. Podejdź, przyjmij wyzwanie i wybieraj ruchy klawiszami 1–4. Garda chroni, kopniak boli. Dam ci potem kij, z bronią masz inne ciosy.',
      done: 'Dobra robota! Kij jest twój: załóż go w panelu Buda, w miejscu „W ręku”.',
      steps: [{ kind: 'duel', enemy: 'manekin-treningowy', label: 'Pokonaj manekina' }],
      rewardItem: 'kij-od-szczotki',
    },
    {
      id: 'wyspa-rejs',
      title: 'Rejs do miasta',
      district: D,
      giver: 'bosman',
      xp: 40,
      requires: ['wyspa-kokosy', 'wyspa-trening'],
      intro:
        'Czas na Miasto Ziomków. Powiedz Sternikowi Józkowi na pomoście, że masz moją zgodę, i wróć po pożegnalny prezent.',
      done: 'Płyń śmiało! Te trampki są na drogę. Łódź czeka na końcu pomostu.',
      steps: [
        {
          kind: 'talk',
          npc: 'sternik-jozek',
          text: 'Zgoda kapitana? To płyniemy! Wróć tylko po prezent od niego.',
        },
      ],
      rewardItem: 'buty-trampki',
    },
  ],
  caches: [
    {
      id: 'wyspa-skrytka',
      district: D,
      x: 18,
      y: 14,
      look: 'worek',
      coins: 30,
      xp: 10,
      text: 'Twoja pierwsza skrytka! Worek z monetami, schowany przy latarni. Takich skrytek jest więcej w każdej dzielnicy.',
    },
  ],
  enemies: [
    {
      // a straw dummy: can't really hurt, exists to learn the moves
      id: 'manekin-treningowy',
      name: 'Manekin treningowy',
      district: D,
      spots: [{ x: 53, y: 42 }],
      level: 1,
      hp: 24,
      attack: 0,
      armor: 0,
      speed: 0,
      luck: 0,
      weapon: 'piesci',
      xp: 15,
      coins: [3, 6],
      lootTier: 1,
      lootChance: 0,
      look: {
        gender: 'on',
        mood: 'zaspany',
        skin: 6,
        hair: 'buzz',
        hairColor: 3,
        outfit: 'tshirt',
        outfitColor: 13,
        pants: 'jeansy',
        pantsColor: 2,
        shoes: 'trampki',
        shoesColor: 9,
      },
      lines: ['…', 'Manekin patrzy na ciebie pustym wzrokiem.'],
    },
  ],
};
