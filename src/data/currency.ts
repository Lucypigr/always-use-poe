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
  { id: 'identify', name: 'Scroll of Insight', description: 'Identifies an item', stackSize: 40, dropWeight: 1500, minLevel: 1, tier: 0, colors: ['#d9c9a3', '#8a6d3b'] },
  { id: 'portal', name: 'Portal Scroll', description: 'Creates a portal to town', stackSize: 40, dropWeight: 450, minLevel: 1, tier: 0, colors: ['#9fc7ff', '#34598f'], selfUse: true },
  { id: 'transmute', name: 'Orb of Awakening', description: 'Upgrades a normal item to a magic item', stackSize: 40, dropWeight: 800, minLevel: 1, tier: 0, colors: ['#8fb3ff', '#2d4a9a'] },
  { id: 'augment', name: 'Orb of Accretion', description: 'Enchants a magic item with a new random modifier', stackSize: 30, dropWeight: 400, minLevel: 1, tier: 0, colors: ['#9ad7ff', '#1d6f9e'] },
  { id: 'alteration', name: 'Orb of Flux', description: 'Reforges a magic item with new random modifiers', stackSize: 20, dropWeight: 450, minLevel: 1, tier: 0, colors: ['#c0e0ff', '#5a7bb0'] },
  { id: 'whetstone', name: 'Tempering Stone', description: 'Improves the quality of a weapon', stackSize: 20, dropWeight: 300, minLevel: 1, tier: 0, colors: ['#bfbfbf', '#5a5a5a'] },
  { id: 'armour_scrap', name: 'Plating Scrap', description: 'Improves the quality of an armour', stackSize: 40, dropWeight: 350, minLevel: 1, tier: 0, colors: ['#c7b299', '#6b563f'] },
  { id: 'bauble', name: "Glazier's Bead", description: 'Improves the quality of a flask', stackSize: 20, dropWeight: 200, minLevel: 1, tier: 0, colors: ['#bdf5f0', '#2d8f86'] },
  { id: 'chromatic', name: 'Prismatic Orb', description: 'Reforges the colour of sockets on an item', stackSize: 20, dropWeight: 300, minLevel: 1, tier: 1, colors: ['#ff6b6b', '#6bd46b'] },
  { id: 'jeweller', name: "Setter's Orb", description: 'Reforges the number of sockets on an item', stackSize: 20, dropWeight: 250, minLevel: 1, tier: 1, colors: ['#e6d48a', '#8f7a2d'] },
  { id: 'fusing', name: 'Orb of Binding', description: 'Reforges the links between sockets on an item', stackSize: 20, dropWeight: 120, minLevel: 6, tier: 1, colors: ['#f0a5ff', '#7a2d8f'] },
  { id: 'chance', name: "Gambler's Orb", description: 'Upgrades a normal item to a random rarity', stackSize: 20, dropWeight: 120, minLevel: 1, tier: 1, colors: ['#f5f5dc', '#8f8f5a'] },
  { id: 'alchemy', name: 'Orb of Transfiguration', description: 'Upgrades a normal item to a rare item', stackSize: 10, dropWeight: 90, minLevel: 8, tier: 1, colors: ['#ffd36b', '#9a6b1d'] },
  { id: 'scour', name: 'Orb of Purging', description: 'Removes all modifiers from an item', stackSize: 30, dropWeight: 80, minLevel: 8, tier: 1, colors: ['#e8e8ff', '#6b6b9a'] },
  { id: 'regal', name: 'Sovereign Orb', description: 'Upgrades a magic item to a rare item, adding one modifier', stackSize: 10, dropWeight: 70, minLevel: 12, tier: 2, colors: ['#8ab4ff', '#ffd36b'] },
  { id: 'blessed', name: 'Orb of Grace', description: 'Randomises the numeric values of the implicit modifiers on an item', stackSize: 20, dropWeight: 50, minLevel: 12, tier: 1, colors: ['#fff2b3', '#b39b2d'] },
  { id: 'chaos', name: 'Orb of Upheaval', description: 'Reforges a rare item with new random modifiers', stackSize: 10, dropWeight: 45, minLevel: 12, tier: 2, colors: ['#ffcc66', '#b3261e'] },
  { id: 'regret', name: 'Orb of Unlearning', description: 'Grants a passive skill refund point', stackSize: 40, dropWeight: 40, minLevel: 8, tier: 1, colors: ['#d0ffd0', '#2d7a2d'], selfUse: true },
  { id: 'gcp', name: "Lapidary's Prism", description: 'Improves the quality of a gem', stackSize: 20, dropWeight: 25, minLevel: 12, tier: 2, colors: ['#e6f7ff', '#4ab0d9'] },
  { id: 'vaal', name: 'Abyssal Orb', description: 'Corrupts an item, modifying it unpredictably', stackSize: 10, dropWeight: 25, minLevel: 15, tier: 2, colors: ['#ff3b3b', '#2a0000'] },
  { id: 'annul', name: 'Orb of Severance', description: 'Removes a random modifier from an item', stackSize: 20, dropWeight: 10, minLevel: 25, tier: 3, colors: ['#ffffff', '#9aa0b0'] },
  { id: 'divine', name: 'Orb of Providence', description: 'Randomises the numeric values of the random modifiers on an item', stackSize: 10, dropWeight: 6, minLevel: 30, tier: 3, colors: ['#fffbe0', '#e0b030'] },
  { id: 'exalt', name: 'Ascendant Orb', description: 'Enchants a rare item with a new random modifier', stackSize: 10, dropWeight: 4, minLevel: 30, tier: 3, colors: ['#ffe9a8', '#d98c1d'] },
];

export const CURRENCY_BY_ID = Object.fromEntries(CURRENCY.map((c) => [c.id, c])) as Record<CurrencyId, CurrencyDef>;
