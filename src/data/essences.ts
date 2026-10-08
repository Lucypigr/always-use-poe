import type { CurrencyDef } from './currency';

/**
 * Essences (精髓): used on a normal item to turn it into a rare item that is guaranteed to carry
 * one specific modifier. Stronger essences guarantee a higher tier of that modifier. For each
 * essence the first listed modifier the item can actually roll is the guaranteed one.
 */

export interface EssenceType {
  id: string;
  name: string;
  /** Candidate guaranteed mods, in order of preference. */
  mods: string[];
  colors: [string, string];
}

export const ESSENCE_TYPES: EssenceType[] = [
  { id: 'life', name: '生命', mods: ['life'], colors: ['#ff8a8a', '#a01818'] },
  { id: 'mana', name: '魔力', mods: ['mana'], colors: ['#8ab4ff', '#1838a0'] },
  { id: 'shield', name: '護盾', mods: ['es_flat', 'local_es', 'es_pct'], colors: ['#c8e8ff', '#5a8ab8'] },
  { id: 'fire', name: '烈焰', mods: ['fire_res'], colors: ['#ffb070', '#b83a10'] },
  { id: 'frost', name: '冰霜', mods: ['cold_res'], colors: ['#b0e8ff', '#2878b8'] },
  { id: 'storm', name: '風暴', mods: ['lightning_res'], colors: ['#fff0a0', '#b8a010'] },
  { id: 'decay', name: '腐朽', mods: ['chaos_res'], colors: ['#d0a0ff', '#58208a'] },
  { id: 'sting', name: '螫刺', mods: ['local_crit', 'crit_chance', 'spell_crit'], colors: ['#ffe0a0', '#a07020'] },
  { id: 'haste', name: '疾速', mods: ['local_attack_speed', 'attack_speed', 'cast_speed'], colors: ['#d8ffa0', '#58a020'] },
  { id: 'aim', name: '精準', mods: ['accuracy'], colors: ['#e0e0e0', '#707070'] },
  { id: 'wrath', name: '憤怒', mods: ['local_phys_inc', 'spell_damage', 'attack_phys_added', 'elemental_damage'], colors: ['#ff9a60', '#8a2a10'] },
  { id: 'might', name: '全能', mods: ['all_attributes', 'str', 'dex', 'int'], colors: ['#fff8d8', '#b89830'] },
];

export const ESSENCE_TIERS = [
  { id: 1, name: '微弱的', minLevel: 1, frac: 0.35, weight: 24 },
  { id: 2, name: '穩定的', minLevel: 25, frac: 0.7, weight: 10 },
  { id: 3, name: '強大的', minLevel: 50, frac: 1, weight: 3 },
];

export interface EssenceInfo {
  mods: string[];
  /** How far up the mod's tier list the guaranteed mod rolls (0..1). */
  frac: number;
}

export const ESSENCE_INFO: Record<string, EssenceInfo> = {};

export const ESSENCES: CurrencyDef[] = ESSENCE_TYPES.flatMap((t) =>
  ESSENCE_TIERS.map((tier) => {
    const id = `ess_${t.id}_${tier.id}` as CurrencyDef['id'];
    ESSENCE_INFO[id] = { mods: t.mods, frac: tier.frac };
    return {
      id,
      name: `${tier.name}${t.name}精髓`,
      description: `將普通物品升級為稀有物品，並保證附帶一條${t.name}相關詞綴${tier.id === 3 ? '（最高階）' : tier.id === 2 ? '（中高階）' : '（較低階）'}`,
      stackSize: 10,
      dropWeight: tier.weight,
      minLevel: tier.minLevel,
      tier: (tier.id === 3 ? 3 : tier.id === 2 ? 2 : 1) as 1 | 2 | 3,
      colors: t.colors,
    };
  }),
);

export const isEssence = (id: string): boolean => id in ESSENCE_INFO;
