/**
 * Level-driven scaling curves shared by monsters, skills and experience.
 * Everything grows roughly exponentially with level, which is what makes
 * gear and skill gem upgrades feel necessary as you progress.
 */

export const MAX_LEVEL = 100;

export const monsterLife = (level: number): number => 6 + 11 * 1.07 ** level;
export const monsterDamage = (level: number): number => 2.5 * 1.07 ** level + 0.5 * level;
export const monsterAccuracy = (level: number): number => 12 + level * 6;
export const monsterEvasion = (level: number): number => 30 + level * 22;
export const monsterArmour = (level: number): number => 10 + level * 8;

/** Average damage of a spell whose gem requires `reqLevel`, before any scaling. */
export const spellDamage = (reqLevel: number): number => 10 * 1.07 ** reqLevel;

export const monsterXp = (level: number): number => 3 * 1.085 ** level;

/** Experience needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.round(monsterXp(level) * (15 + 4 * level ** 1.1));
}

/** Path of Exile style experience penalty for fighting monsters far from your level. */
export function xpMultiplier(playerLevel: number, monsterLevel: number): number {
  const safe = 3 + Math.floor(playerLevel / 16);
  const diff = Math.max(0, Math.abs(playerLevel - monsterLevel) - safe);
  const m = ((playerLevel + 5) / (playerLevel + 5 + diff ** 2.5)) ** 1.5;
  return Math.max(0.01, m);
}

/** Required character level for a gem of the given level, given its level 1 requirement. */
export function gemReqLevel(req1: number, gemLevel: number): number {
  if (gemLevel <= 20) return Math.round(req1 + ((gemLevel - 1) * (70 - req1)) / 19);
  return Math.min(MAX_LEVEL, 70 + (gemLevel - 20) * 2);
}

/** Linear interpolation of a per-level value between gem level 1 and 20 (extrapolates above 20). */
export function lvl(a: number, b: number, level: number): number {
  return a + ((b - a) * (level - 1)) / 19;
}

/** Resistance penalty applied by area level (mirrors act progression penalties). */
export function resistPenalty(areaLevel: number): number {
  if (areaLevel >= 40) return -60;
  if (areaLevel >= 28) return -40;
  if (areaLevel >= 15) return -20;
  return 0;
}
