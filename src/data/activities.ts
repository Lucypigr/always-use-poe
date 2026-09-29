import type { ThemeId } from './areas';

/**
 * League-style activities.
 *
 * Mercenaries (like PoE's "Mercenaries of Trarthus"): a hostile mercenary sometimes waits in an
 * area. Beat them and choose to hire them as a companion or take their gear.
 *
 * Heist (like PoE's "Heist"): the ring leader in town offers contracts. Break into a guarded
 * vault, loot strongboxes while the alarm rises, grab the target and escape the lockdown.
 */

export type MercArchetype = 'merc_blade' | 'merc_archer' | 'merc_mage';

export const MERC_ARCHETYPES: { id: MercArchetype; name: string; desc: string }[] = [
  { id: 'merc_blade', name: '劍客', desc: '近戰，生命與護甲較高，會擋在你前面。' },
  { id: 'merc_archer', name: '弓手', desc: '遠程射擊，會與敵人保持距離。' },
  { id: 'merc_mage', name: '術士', desc: '施放火球，傷害高但比較脆弱。' },
];

export const MERC_NAMES = ['「鐵拳」布倫', '「影箭」莉拉', '「灰燼」索恩', '「孤狼」凱德', '「霜語」伊芙', '「血刃」瓦羅', '「雷鳴」托爾克', '「毒牙」希絲', '「白鴉」艾倫', '「斷劍」馬洛'];

/** Chance that a story area / map contains a mercenary encounter. */
export const MERC_CHANCE = 0.3;

export interface MercenaryData {
  name: string;
  archetype: MercArchetype;
}

export type HeistTarget = 'currency' | 'unique' | 'gems' | 'jewellery' | 'maps';

export const HEIST_TARGETS: Record<HeistTarget, { name: string; desc: string; minLevel?: number }> = {
  currency: { name: '通貨金庫', desc: '大量高階通貨' },
  unique: { name: '傳奇藏品', desc: '兩件傳奇裝備' },
  gems: { name: '寶石收藏', desc: '三顆 20% 品質的寶石' },
  jewellery: { name: '珠寶匣', desc: '三件高物品等級的稀有飾品' },
  maps: { name: '地圖集', desc: '三張高階地圖', minLevel: 38 },
};

export const HEIST_SITES: { theme: ThemeId; name: string }[] = [
  { theme: 'ruins', name: '富商宅邸' },
  { theme: 'crypt', name: '帝國地下金庫' },
  { theme: 'caves', name: '走私者倉庫' },
  { theme: 'inferno', name: '餘燼聖物庫' },
  { theme: 'void', name: '虛空寶庫' },
];

export interface HeistContract {
  id: string;
  site: number;
  target: HeistTarget;
  level: number;
}

export interface HeistData {
  contracts: HeistContract[];
  completed: number;
}

/** Heists unlock once the first act is done (or at level 12). */
export const HEIST_UNLOCK_LEVEL = 12;
/** Alarm per second while inside, per strongbox, and the lockdown threshold. */
export const HEIST_ALARM = { perSecond: 0.55, perChest: 12, lockdown: 100 };
export const HEIST_STRONGBOXES = 6;
