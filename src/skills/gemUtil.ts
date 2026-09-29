import { getGem, type GemDef, MAX_GEM_LEVEL } from '../data/gems';
import { gemReqLevel, MAX_LEVEL, xpToNext } from '../data/scaling';
import type { Attr, Item } from '../items/types';

const CUM_XP: number[] = (() => {
  const out = [0, 0];
  for (let l = 1; l < MAX_LEVEL; l++) out.push(out[l] + xpToNext(l));
  return out;
})();

/** Total experience needed to reach a character level from level 1. */
export const cumulativeXp = (level: number): number => CUM_XP[Math.max(1, Math.min(MAX_LEVEL, level))];

export const GEM_ATTR: Record<GemDef['color'], Attr> = { R: 'str', G: 'dex', B: 'int' };

export function gemRequirements(def: GemDef, level: number): { level: number; attr: Attr; value: number } {
  const req = gemReqLevel(def.reqLevel, level);
  const mult = def.support ? 0.7 : 1;
  return { level: req, attr: GEM_ATTR[def.color], value: req <= 1 ? 0 : Math.round((8 + 2.1 * req) * mult) };
}

/** Experience a gem needs to go from `level` to `level + 1`. */
export function gemXpToNext(def: GemDef, level: number): number {
  if (level >= 20) return Infinity;
  const a = gemReqLevel(def.reqLevel, level);
  const b = gemReqLevel(def.reqLevel, level + 1);
  return Math.max(60, Math.round((cumulativeXp(b) - cumulativeXp(a)) * 0.9));
}

/**
 * Add experience to a gem item. Like Path of Exile, gems bank experience up to the next
 * level and wait for the player to click "level up" (see canLevelGem / levelGem).
 */
export function addGemXp(gem: Item, amount: number): void {
  if (!gem.gem || gem.gem.level >= 20) return;
  const need = gemXpToNext(getGem(gem.gem.id), gem.gem.level);
  gem.gem.xp = Math.min(need, gem.gem.xp + amount);
}

export function canLevelGem(gem: Item, charLevel: number): boolean {
  if (!gem.gem || gem.gem.level >= 20) return false;
  const def = getGem(gem.gem.id);
  return gem.gem.xp >= gemXpToNext(def, gem.gem.level) && gemRequirements(def, gem.gem.level + 1).level <= charLevel;
}

export function levelGem(gem: Item, charLevel: number): boolean {
  if (!canLevelGem(gem, charLevel)) return false;
  gem.gem!.level = Math.min(MAX_GEM_LEVEL, gem.gem!.level + 1);
  gem.gem!.xp = 0;
  return true;
}
