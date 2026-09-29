import type { CurrencyId } from './currency';

/**
 * Crafting bench recipes (like Path of Exile's crafting bench): pay currency to add one
 * specific mod to an item with a free prefix / suffix. The best tier the item level allows
 * is offered. Mod ids refer to regular affixes, so spawn rules (e.g. armour-only mods) apply.
 */
export interface BenchTier {
  ilvl: number;
  values: [number, number][];
  cost: [CurrencyId, number][];
}

export interface BenchRecipe {
  mod: string;
  tiers: BenchTier[];
}

const t = (ilvl: number, values: [number, number][], ...cost: [CurrencyId, number][]): BenchTier => ({ ilvl, values, cost });

export const BENCH_RECIPES: BenchRecipe[] = [
  // prefixes
  { mod: 'life', tiers: [t(1, [[15, 25]], ['transmute', 4]), t(25, [[40, 50]], ['alteration', 6]), t(45, [[70, 80]], ['chaos', 2])] },
  { mod: 'mana', tiers: [t(1, [[20, 30]], ['transmute', 3]), t(25, [[40, 50]], ['alteration', 4])] },
  { mod: 'local_phys_inc', tiers: [t(1, [[25, 35]], ['transmute', 4]), t(25, [[60, 75]], ['alchemy', 1]), t(50, [[100, 120]], ['chaos', 3])] },
  { mod: 'local_phys_added', tiers: [t(1, [[2, 3], [5, 7]], ['transmute', 5]), t(25, [[8, 11], [16, 20]], ['alchemy', 2]), t(50, [[15, 20], [30, 35]], ['chaos', 3])] },
  { mod: 'spell_damage', tiers: [t(1, [[15, 25]], ['transmute', 4]), t(25, [[35, 45]], ['alchemy', 1]), t(50, [[55, 65]], ['chaos', 2])] },
  { mod: 'local_armour_inc', tiers: [t(1, [[30, 40]], ['transmute', 4]), t(30, [[60, 70]], ['alchemy', 1])] },
  { mod: 'local_evasion_inc', tiers: [t(1, [[30, 40]], ['transmute', 4]), t(30, [[60, 70]], ['alchemy', 1])] },
  { mod: 'local_es_inc', tiers: [t(1, [[30, 40]], ['transmute', 4]), t(30, [[60, 70]], ['alchemy', 1])] },
  { mod: 'movement_speed', tiers: [t(10, [[10, 10]], ['alteration', 5]), t(40, [[20, 20]], ['chaos', 3])] },
  // suffixes
  { mod: 'fire_res', tiers: [t(1, [[15, 20]], ['transmute', 3]), t(25, [[26, 30]], ['alteration', 5]), t(45, [[36, 40]], ['chaos', 1])] },
  { mod: 'cold_res', tiers: [t(1, [[15, 20]], ['transmute', 3]), t(25, [[26, 30]], ['alteration', 5]), t(45, [[36, 40]], ['chaos', 1])] },
  { mod: 'lightning_res', tiers: [t(1, [[15, 20]], ['transmute', 3]), t(25, [[26, 30]], ['alteration', 5]), t(45, [[36, 40]], ['chaos', 1])] },
  { mod: 'chaos_res', tiers: [t(15, [[10, 15]], ['alteration', 6]), t(40, [[21, 25]], ['chaos', 2])] },
  { mod: 'str', tiers: [t(1, [[15, 20]], ['transmute', 3]), t(25, [[26, 30]], ['alteration', 5])] },
  { mod: 'dex', tiers: [t(1, [[15, 20]], ['transmute', 3]), t(25, [[26, 30]], ['alteration', 5])] },
  { mod: 'int', tiers: [t(1, [[15, 20]], ['transmute', 3]), t(25, [[26, 30]], ['alteration', 5])] },
  { mod: 'local_attack_speed', tiers: [t(10, [[8, 10]], ['alteration', 6]), t(40, [[14, 16]], ['chaos', 2])] },
  { mod: 'attack_speed', tiers: [t(10, [[5, 7]], ['alteration', 5])] },
  { mod: 'cast_speed', tiers: [t(10, [[8, 10]], ['alteration', 6]), t(40, [[14, 16]], ['chaos', 2])] },
  { mod: 'crit_chance', tiers: [t(10, [[15, 20]], ['alteration', 5])] },
  { mod: 'mana_regen', tiers: [t(1, [[20, 30]], ['transmute', 4])] },
  { mod: 'life_regen', tiers: [t(1, [[3, 5]], ['transmute', 3]), t(30, [[8, 12]], ['alchemy', 1])] },
  { mod: 'item_rarity', tiers: [t(1, [[10, 15]], ['transmute', 4])] },
  { mod: 'all_attributes', tiers: [t(20, [[6, 8]], ['alteration', 6])] },
];

/** Fusings to link all sockets, by socket count. */
export const LINK_COST: Record<number, number> = { 2: 1, 3: 3, 4: 10, 5: 40, 6: 120 };
/** Jeweller's orbs to set the socket count. */
export const SOCKET_COST: Record<number, number> = { 2: 1, 3: 3, 4: 10, 5: 35, 6: 100 };
/** Chromatic orbs per socket to make every socket one colour. */
export const COLOUR_COST_PER_SOCKET = 3;
