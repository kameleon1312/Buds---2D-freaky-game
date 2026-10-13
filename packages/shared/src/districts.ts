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
    id: 'las-palmos',
    name: 'Las Palmos',
    unlockLevel: 4,
    status: 'soon',
    blurb: 'Tropiki: plaże, ocean, hawajskie chatki i egzotyczne zwierzaki.',
  },
  {
    id: 'dwor-carski',
    name: 'Dwór Carski',
    unlockLevel: 8,
    status: 'soon',
    blurb: 'Cegła, dworek i zagadki. Nieuczciwi urzędnicy w cylindrach.',
  },
  {
    id: 'los-karkos',
    name: 'Los Karkos',
    unlockLevel: 12,
    status: 'soon',
    blurb: 'Niebezpiecznie. Opuszczone bloki, zaczepki i trening przetrwania.',
  },
] as const satisfies readonly District[];

export type DistrictId = (typeof DISTRICTS)[number]['id'];

/** Where every new bud spawns (and respawns after a lost fight). */
export const START_DISTRICT: DistrictId = 'miasto-ziomkow';

export const districtById = (id: string): District | undefined =>
  DISTRICTS.find((d) => d.id === id);

/** Can a bud of this level enter? (Unknown and unfinished districts are closed.) */
export const canEnterDistrict = (id: string, level: number): boolean => {
  const d = districtById(id);
  return !!d && d.status === 'open' && level >= d.unlockLevel;
};
