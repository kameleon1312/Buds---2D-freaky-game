export type LevelInfo = {
  level: number;
  xp: number;
  /** XP at which the current level started */
  floorXp: number;
  /** XP needed for the next level */
  nextXp: number;
  /** 0..1 progress within the current level */
  progress: number;
};

/** XP for level n is 100·(n−1)² — early levels come quickly, later ones need real play. */
export const XP_CURVE = 100;

export function levelFromXp(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = Math.floor(Math.sqrt(safeXp / XP_CURVE)) + 1;
  const floorXp = XP_CURVE * (level - 1) ** 2;
  const nextXp = XP_CURVE * level ** 2;
  return { level, xp: safeXp, floorXp, nextXp, progress: (safeXp - floorXp) / (nextXp - floorXp) };
}
