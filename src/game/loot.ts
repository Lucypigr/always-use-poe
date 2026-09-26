import type { RNG } from '../core/rng';
import { createCurrency, createGem, randomCurrency, randomEquipment, randomGem, randomMapDrop, rollRarity } from '../items/generate';
import type { Item } from '../items/types';
import type { MonsterRarity } from './monster';

/**
 * Drop tables. Quantity scales how many items drop, rarity scales how good they are —
 * both come from gear, map mods and monster rarity, exactly as in Path of Exile.
 */

export interface LootContext {
  areaLevel: number;
  itemQuantity: number;
  itemRarity: number;
  isBoss: boolean;
  firstBossKill?: boolean;
}

const BASE_DROPS: Record<MonsterRarity, number> = { normal: 0.16, magic: 0.55, rare: 2.6, unique: 6 };
const RARITY_BONUS: Record<MonsterRarity, number> = { normal: 0, magic: 60, rare: 250, unique: 600 };

export function rollDrops(rarity: MonsterRarity, ctx: LootContext, rng: RNG): Item[] {
  const out: Item[] = [];
  let expected = BASE_DROPS[rarity] * (1 + ctx.itemQuantity / 100);
  if (ctx.isBoss) expected = 7 * (1 + ctx.itemQuantity / 100);
  let count = Math.floor(expected);
  if (rng.chance(expected - count)) count++;
  const itemRarity = ctx.itemRarity + RARITY_BONUS[ctx.isBoss ? 'unique' : rarity];
  const level = ctx.areaLevel;
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    if (roll < 0.34) out.push(randomCurrency(level, rng, ctx.itemQuantity));
    else if (roll < 0.38) out.push(randomGem(level, rng));
    else if (roll < 0.41 && level >= 36) {
      const map = randomMapDrop(level, rng);
      if (map) out.push(map);
    } else {
      const r = rollRarity(rng, { itemRarity, bonusRare: ctx.isBoss ? 30 : 0 });
      out.push(randomEquipment(level, r, rng));
    }
  }
  if (ctx.isBoss) {
    // Bosses always drop at least one rare and some currency
    out.push(randomEquipment(level, rng.chance(0.25) ? 'unique' : 'rare', rng));
    out.push(randomCurrency(level, rng));
    if (ctx.firstBossKill) {
      out.push(randomGem(level + 4, rng));
      out.push(createCurrency('alchemy', 1));
    }
  }
  return out;
}

/** Items the first act guarantees so new characters get supports early (like PoE's quest rewards). */
export function questReward(areaId: string, rng: RNG): Item[] {
  switch (areaId) {
    case 'shore':
      return [createGem(rng.pick(['lesser_volley', 'added_fire', 'added_cold', 'brutal_force', 'life_leech_support', 'faster_attacks', 'efficiency']))];
    case 'mudflats':
      return [createCurrency('transmute', 5), createCurrency('augment', 3)];
    case 'ashwood':
      return [createGem(rng.pick(['leap_slam', 'dash_strike', 'flame_step'])), createCurrency('fusing', 2)];
    default:
      return [createCurrency(rng.pick(['chaos', 'regal', 'alchemy']), 1)];
  }
}
