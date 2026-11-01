/**
 * Districts of the Buds world. Each one is a big map: a city centre plus wild outskirts to explore, with
 * quests and fights for XP. Each will also be its own multiplayer room. Full design: docs/districts.md.
 * Mirrored in Unity's `Districts.cs` — change both together.
 */
export type District = {
  id: string;
  name: string;
  /** Player level needed to enter. */
  unlockLevel: number;
  /** `open` = playable now; `soon` = designed, map not built yet. */
  status: 'open' | 'soon';
  /** The quest whose end brings the pass or letter a bud needs to come here (on top of the level). */
  gateQuest?: string;
  blurb: string;
};

export const DISTRICTS = [
  {
    id: 'miasto-ziomkow',
    name: 'Miasto Ziomków',
    unlockLevel: 1,
    status: 'open',
    blurb: 'Tu zaczynasz. Codzienne życie, freestyle i graffiti pod nosem policji.',
  },
  {
    id: 'dzika-puszcza',
    name: 'Dzika Puszcza',
    unlockLevel: 2,
    status: 'open',
    blurb: 'Las bez końca na zachód od miasta: rzeka, jezioro, obozowisko i rozbójnicy w ruinach.',
  },
  {
    id: 'las-palmas',
    name: 'Las Palmas',
    unlockLevel: 3,
    status: 'open',
    gateQuest: 'przepustka-na-wydmy',
    blurb: 'Tropiki: plaże, ocean, hawajskie chatki i egzotyczne zwierzaki.',
  },
  {
    id: 'dwor-carski',
    name: 'Dwór Carski',
    unlockLevel: 5,
    status: 'open',
    gateQuest: 'zaproszenie-na-dwor',
    blurb: 'Cegła, dworek i zagadki. Nieuczciwi urzędnicy w cylindrach.',
  },
  {
    id: 'los-karkos',
    name: 'Los Karkos',
    unlockLevel: 7,
    status: 'open',
    gateQuest: 'tajemnica-dworu',
    blurb: 'Niebezpiecznie. Opuszczone bloki, zaczepki i trening przetrwania.',
  },
  {
    id: 'chinatown',
    name: 'Chinatown',
    unlockLevel: 9,
    status: 'open',
    gateQuest: 'list-do-chinatown',
    blurb:
      'Za Dworem Carskim: lampiony, nocny targ, pagoda i dojo. Tu pamięta się każdą przysługę.',
  },
] as const satisfies readonly District[];

export type DistrictId = (typeof DISTRICTS)[number]['id'];

/** Where every bud lives once the tutorial is done (and respawns after a lost fight). */
export const START_DISTRICT: DistrictId = 'miasto-ziomkow';

/**
 * The tutorial island: every new bud wakes up here, learns the game, and leaves by boat for Miasto Ziomków when
 * the last tutorial quest is done. Not a district (no level gate, no road back). Mirrored in Unity Districts.cs.
 */
export const TUTORIAL_ISLAND = {
  id: 'wyspa-startowa',
  name: 'Wyspa Startowa',
  /** Handing this quest in opens the pier. */
  finalQuest: 'wyspa-rejs',
} as const;

export const districtById = (id: string): District | undefined =>
  DISTRICTS.find((d) => d.id === id);

/** Can a bud of this level enter? (Unknown and unfinished districts are closed.) */
export const canEnterDistrict = (id: string, level: number): boolean => {
  const d = districtById(id);
  return !!d && d.status === 'open' && level >= d.unlockLevel;
};

/** The quest still standing between a bud and this city, or null. */
export const missingGateQuest = (id: string, completed: ReadonlySet<string>): string | null => {
  const gate = districtById(id)?.gateQuest;
  return gate && !completed.has(gate) ? gate : null;
};
