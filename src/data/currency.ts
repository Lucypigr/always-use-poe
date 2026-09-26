/**
 * Currency items. Like Path of Exile, currency is both the crafting system and the
 * trade/economy medium. Names are original; behaviour mirrors the familiar orbs:
 *
 *   identify   – identifies an item                       (≈ Scroll of Wisdom)
 *   transmute  – normal → magic                           (≈ Orb of Transmutation)
 *   augment    – adds a mod to a magic item with one mod  (≈ Orb of Augmentation)
 *   alteration – rerolls a magic item                     (≈ Orb of Alteration)
 *   regal      – magic → rare, adding one mod             (≈ Regal Orb)
 *   alchemy    – normal → rare                            (≈ Orb of Alchemy)
 *   chaos      – rerolls a rare item                      (≈ Chaos Orb)
 *   exalt      – adds a mod to a rare item                (≈ Exalted Orb)
 *   scour      – removes all mods                         (≈ Orb of Scouring)
 *   annul      – removes a random mod                     (≈ Orb of Annulment)
 *   divine     – rerolls mod values                       (≈ Divine Orb)
 *   blessed    – rerolls implicit values                  (≈ Blessed Orb)
 *   chromatic  – rerolls socket colours                   (≈ Chromatic Orb)
 *   jeweller   – rerolls socket count                     (≈ Jeweller's Orb)
 *   fusing     – rerolls socket links                     (≈ Orb of Fusing)
 *   vaal       – corrupts an item                         (≈ Vaal Orb)
 *   chance     – normal → random rarity (may be unique)   (≈ Orb of Chance)
 *   whetstone / armour_scrap / bauble / gcp – quality     (≈ Whetstone / Scrap / Bauble / Prism)
 *   regret     – passive refund point                     (≈ Orb of Regret)
 *   portal     – opens a portal to town                   (≈ Portal Scroll)
 */

export type CurrencyId =
  | 'identify' | 'portal' | 'transmute' | 'augment' | 'alteration' | 'regal' | 'alchemy' | 'chaos' | 'exalt'
  | 'scour' | 'annul' | 'divine' | 'blessed' | 'chromatic' | 'jeweller' | 'fusing' | 'vaal' | 'chance'
  | 'whetstone' | 'armour_scrap' | 'bauble' | 'gcp' | 'regret';

export interface CurrencyDef {
  id: CurrencyId;
  name: string;
  description: string;
  stackSize: number;
  dropWeight: number;
  minLevel: number;
  /** Label tier used for ground label styling and loot beams (0 = common … 3 = very rare). */
  tier: 0 | 1 | 2 | 3;
  /** Colours used by the procedural icon. */
  colors: [string, string];
  /** Used on the character (right-click) rather than applied to an item. */
  selfUse?: boolean;
}

export const CURRENCY: CurrencyDef[] = [
  { id: 'identify', name: '洞察卷軸', description: '鑑定一件物品', stackSize: 40, dropWeight: 1500, minLevel: 1, tier: 0, colors: ['#d9c9a3', '#8a6d3b'] },
  { id: 'portal', name: '傳送卷軸', description: '開啟通往城鎮的傳送門', stackSize: 40, dropWeight: 450, minLevel: 1, tier: 0, colors: ['#9fc7ff', '#34598f'], selfUse: true },
  { id: 'transmute', name: '蛻變石', description: '將普通物品升級為魔法物品', stackSize: 40, dropWeight: 800, minLevel: 1, tier: 0, colors: ['#8fb3ff', '#2d4a9a'] },
  { id: 'augment', name: '增幅石', description: '為魔法物品附加一條新的隨機詞綴', stackSize: 30, dropWeight: 400, minLevel: 1, tier: 0, colors: ['#9ad7ff', '#1d6f9e'] },
  { id: 'alteration', name: '改造石', description: '以新的隨機詞綴重鑄魔法物品', stackSize: 20, dropWeight: 450, minLevel: 1, tier: 0, colors: ['#c0e0ff', '#5a7bb0'] },
  { id: 'whetstone', name: '磨刀石', description: '提升武器的品質', stackSize: 20, dropWeight: 300, minLevel: 1, tier: 0, colors: ['#bfbfbf', '#5a5a5a'] },
  { id: 'armour_scrap', name: '護甲片', description: '提升護甲的品質', stackSize: 40, dropWeight: 350, minLevel: 1, tier: 0, colors: ['#c7b299', '#6b563f'] },
  { id: 'bauble', name: '玻璃彈珠', description: '提升藥劑的品質', stackSize: 20, dropWeight: 200, minLevel: 1, tier: 0, colors: ['#bdf5f0', '#2d8f86'] },
  { id: 'chromatic', name: '幻色石', description: '重鑄物品插槽的顏色', stackSize: 20, dropWeight: 300, minLevel: 1, tier: 1, colors: ['#ff6b6b', '#6bd46b'] },
  { id: 'jeweller', name: '工匠石', description: '重鑄物品插槽的數量', stackSize: 20, dropWeight: 250, minLevel: 1, tier: 1, colors: ['#e6d48a', '#8f7a2d'] },
  { id: 'fusing', name: '連結石', description: '重鑄物品插槽之間的連結', stackSize: 20, dropWeight: 120, minLevel: 6, tier: 1, colors: ['#f0a5ff', '#7a2d8f'] },
  { id: 'chance', name: '機會石', description: '將普通物品升級為隨機稀有度', stackSize: 20, dropWeight: 120, minLevel: 1, tier: 1, colors: ['#f5f5dc', '#8f8f5a'] },
  { id: 'alchemy', name: '點金石', description: '將普通物品升級為稀有物品', stackSize: 10, dropWeight: 90, minLevel: 8, tier: 1, colors: ['#ffd36b', '#9a6b1d'] },
  { id: 'scour', name: '重鑄石', description: '移除物品上的所有詞綴', stackSize: 30, dropWeight: 80, minLevel: 8, tier: 1, colors: ['#e8e8ff', '#6b6b9a'] },
  { id: 'regal', name: '富豪石', description: '將魔法物品升級為稀有物品，並附加一條詞綴', stackSize: 10, dropWeight: 70, minLevel: 12, tier: 2, colors: ['#8ab4ff', '#ffd36b'] },
  { id: 'blessed', name: '祝福石', description: '隨機重骰物品固定詞綴的數值', stackSize: 20, dropWeight: 50, minLevel: 12, tier: 1, colors: ['#fff2b3', '#b39b2d'] },
  { id: 'chaos', name: '混沌石', description: '以新的隨機詞綴重鑄稀有物品', stackSize: 10, dropWeight: 45, minLevel: 12, tier: 2, colors: ['#ffcc66', '#b3261e'] },
  { id: 'regret', name: '後悔石', description: '獲得 1 點天賦重置點數', stackSize: 40, dropWeight: 40, minLevel: 8, tier: 1, colors: ['#d0ffd0', '#2d7a2d'], selfUse: true },
  { id: 'gcp', name: '寶石匠的稜鏡', description: '提升寶石的品質', stackSize: 20, dropWeight: 25, minLevel: 12, tier: 2, colors: ['#e6f7ff', '#4ab0d9'] },
  { id: 'vaal', name: '深淵石', description: '汙染一件物品，並以無法預期的方式改變它', stackSize: 10, dropWeight: 25, minLevel: 15, tier: 2, colors: ['#ff3b3b', '#2a0000'] },
  { id: 'annul', name: '剝離石', description: '移除物品上的一條隨機詞綴', stackSize: 20, dropWeight: 10, minLevel: 25, tier: 3, colors: ['#ffffff', '#9aa0b0'] },
  { id: 'divine', name: '神聖石', description: '隨機重骰物品隨機詞綴的數值', stackSize: 10, dropWeight: 6, minLevel: 30, tier: 3, colors: ['#fffbe0', '#e0b030'] },
  { id: 'exalt', name: '崇高石', description: '為稀有物品附加一條新的隨機詞綴', stackSize: 10, dropWeight: 4, minLevel: 30, tier: 3, colors: ['#ffe9a8', '#d98c1d'] },
];

export const CURRENCY_BY_ID = Object.fromEntries(CURRENCY.map((c) => [c.id, c])) as Record<CurrencyId, CurrencyDef>;
