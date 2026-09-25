import type { ArmourClass, Attr, DefenceType, ItemBase, ItemClass, WeaponClass } from '../items/types';
import { flat, inc, more, type StatMod } from '../stats/stats';

/**
 * Item base types. Armour and weapon bases are generated from compact tables so the
 * progression (drop level → base stats → attribute requirements) stays consistent.
 */

const round = Math.round;
const attrReq = (level: number, share: number): number => (level <= 2 ? 0 : round((8 + level * 2.2) * share));

// ---------------------------------------------------------------------------------------------
// Armour
// ---------------------------------------------------------------------------------------------

const ARMOUR_TIER_LEVELS = [1, 12, 25, 38, 52, 66];

const MATERIALS: Record<DefenceType, string[]> = {
  str: ['Rusted', 'Iron', 'Steel', 'Tempered', 'Runed', 'Titanic'],
  dex: ['Tattered', 'Leather', 'Studded', 'Shagreen', 'Wyrmhide', 'Shadowweave'],
  int: ['Twine', 'Linen', 'Silk', 'Moonsilk', 'Astral', 'Seraphic'],
  str_dex: ['Crude', 'Riveted', 'Chain', 'Scaled', 'Drakescale', "Warlord's"],
  str_int: ['Pilgrim', 'Bone', 'Gilded', 'Crusader', 'Sanctified', 'Hallowed'],
  dex_int: ['Frayed', 'Sleek', 'Shade', 'Ghostly', 'Nightveil', 'Umbral'],
};

const NOUNS: Record<ArmourClass, Record<DefenceType, string>> = {
  helmet: { str: 'Helm', dex: 'Hood', int: 'Circlet', str_dex: 'Visor', str_int: 'Crown', dex_int: 'Mask' },
  body_armour: { str: 'Plate', dex: 'Jerkin', int: 'Robe', str_dex: 'Brigandine', str_int: 'Hauberk', dex_int: 'Garb' },
  gloves: { str: 'Gauntlets', dex: 'Gloves', int: 'Wraps', str_dex: 'Bracers', str_int: 'Grips', dex_int: 'Mitts' },
  boots: { str: 'Greaves', dex: 'Boots', int: 'Slippers', str_dex: 'Sabatons', str_int: 'Treads', dex_int: 'Shoes' },
  shield: {
    str: 'Tower Shield', dex: 'Buckler', int: 'Spirit Shield', str_dex: 'Round Shield', str_int: 'Kite Shield', dex_int: 'Spiked Shield',
  },
};

const SLOT_SIZE: Record<ArmourClass, [number, number]> = {
  helmet: [2, 2], body_armour: [2, 3], gloves: [2, 2], boots: [2, 2], shield: [2, 3],
};
const SLOT_MULT: Record<ArmourClass, number> = { helmet: 0.45, body_armour: 1, gloves: 0.3, boots: 0.35, shield: 0.7 };
const SHIELD_BLOCK: Record<DefenceType, number> = { str: 24, dex: 26, int: 20, str_dex: 25, str_int: 23, dex_int: 24 };

function defenceAttrs(d: DefenceType): Attr[] {
  return d.split('_') as Attr[];
}

function makeArmourBases(): ItemBase[] {
  const out: ItemBase[] = [];
  for (const cls of Object.keys(NOUNS) as ArmourClass[]) {
    for (const d of Object.keys(MATERIALS) as DefenceType[]) {
      ARMOUR_TIER_LEVELS.forEach((level, tier) => {
        const m = SLOT_MULT[cls];
        const attrs = defenceAttrs(d);
        const share = attrs.length === 1 ? 1 : 0.6;
        const hybrid = attrs.length === 2 ? 0.55 : 1;
        const armourVal = round(m * (18 + level * 7.5) * hybrid);
        const esVal = round(m * (7 + level * 1.5) * hybrid);
        const armour: ItemBase['armour'] = {};
        if (attrs.includes('str')) armour.armour = armourVal;
        if (attrs.includes('dex')) armour.evasion = armourVal;
        if (attrs.includes('int')) armour.es = esVal;
        if (cls === 'shield') armour.block = SHIELD_BLOCK[d];
        const req: Partial<Record<Attr, number>> = {};
        for (const a of attrs) req[a] = attrReq(level, share);
        const tags = ['armour', cls, `${d}_armour`];
        const implicits: ItemBase['implicits'] = [];
        if (cls === 'shield' && d === 'int') implicits.push({ mod: 'imp_spell_damage', values: [[5 + tier * 2, 10 + tier * 2]] });
        if (cls === 'shield' && d === 'str') implicits.push({ mod: 'imp_life', values: [[10 + tier * 8, 20 + tier * 8]] });
        if (cls === 'boots' && tier >= 4) implicits.push({ mod: 'imp_all_res', values: [[4, 8]] });
        const [w, h] = SLOT_SIZE[cls];
        out.push({
          id: `${cls}_${d}_${tier}`,
          name: `${MATERIALS[d][tier]} ${NOUNS[cls][d]}`,
          cls,
          w,
          h,
          level,
          req,
          tags,
          armour,
          defence: d,
          implicits: implicits.length ? implicits : undefined,
        });
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------------------------

interface WeaponClassSpec {
  names: string[];
  aps: number;
  crit: number;
  range: number;
  /** DPS multiplier relative to the one-hand baseline. */
  dps: number;
  /** Damage spread: min = avg*(1-spread), max = avg*(1+spread). */
  spread: number;
  req: Partial<Record<Attr, number>>;
  size: [number, number];
  twoHanded?: boolean;
  tags: string[];
  implicit?: (tier: number) => { mod: string; values: [number, number][] } | undefined;
}

const WEAPON_TIER_LEVELS = [1, 10, 21, 33, 46, 60];

const WEAPONS: Record<WeaponClass, WeaponClassSpec> = {
  claw: {
    names: ['Bone Talon', 'Iron Hook', 'Raker', 'Gutripper', 'Wyrm Talon', 'Eviscerator'],
    aps: 1.6, crit: 6.3, range: 1.1, dps: 0.85, spread: 0.45, req: { dex: 0.6, int: 0.6 }, size: [2, 2],
    tags: ['weapon', 'one_hand', 'melee', 'claw', 'attack_weapon'],
    implicit: (t) => ({ mod: 'imp_life_on_hit', values: [[2 + t * 2, 4 + t * 3]] }),
  },
  dagger: {
    names: ['Rusty Shiv', 'Skinning Knife', 'Stiletto', 'Poignard', 'Kris', 'Heartpiercer'],
    aps: 1.45, crit: 6.5, range: 1.0, dps: 0.85, spread: 0.55, req: { dex: 0.6, int: 0.6 }, size: [1, 3],
    tags: ['weapon', 'one_hand', 'melee', 'dagger', 'caster_weapon', 'attack_weapon'],
    implicit: () => ({ mod: 'imp_crit_chance', values: [[30, 40]] }),
  },
  wand: {
    names: ['Willow Wand', 'Bone Wand', 'Etched Wand', 'Crystal Wand', 'Runed Wand', 'Starfall Wand'],
    aps: 1.4, crit: 7.5, range: 7, dps: 0.65, spread: 0.4, req: { int: 1 }, size: [1, 3],
    tags: ['weapon', 'one_hand', 'ranged', 'wand', 'caster_weapon'],
    implicit: (t) => ({ mod: 'imp_spell_damage', values: [[8 + t * 2, 12 + t * 3]] }),
  },
  one_hand_sword: {
    names: ['Rusted Shortsword', 'Copper Sword', 'Arming Sword', 'Sabre', 'Knight Sword', 'Gleaming Blade'],
    aps: 1.5, crit: 5, range: 1.25, dps: 1, spread: 0.4, req: { str: 0.6, dex: 0.6 }, size: [1, 3],
    tags: ['weapon', 'one_hand', 'melee', 'sword', 'attack_weapon'],
    implicit: (t) => ({ mod: 'imp_accuracy', values: [[30 + t * 40, 60 + t * 50]] }),
  },
  one_hand_axe: {
    names: ['Hatchet', 'Hand Axe', 'Bearded Axe', 'Cleaver', 'Tomahawk', 'Runic Hatchet'],
    aps: 1.35, crit: 5, range: 1.25, dps: 1.05, spread: 0.5, req: { str: 0.6, dex: 0.6 }, size: [2, 3],
    tags: ['weapon', 'one_hand', 'melee', 'axe', 'attack_weapon'],
  },
  one_hand_mace: {
    names: ['Driftwood Club', 'Stone Hammer', 'Spiked Club', 'Flanged Mace', 'Morning Star', 'Pernach'],
    aps: 1.3, crit: 5, range: 1.25, dps: 1.05, spread: 0.35, req: { str: 1 }, size: [2, 3],
    tags: ['weapon', 'one_hand', 'melee', 'mace', 'attack_weapon'],
  },
  sceptre: {
    names: ['Oak Sceptre', 'Bronze Sceptre', 'Quartz Sceptre', 'Ritual Sceptre', 'Crystal Sceptre', 'Void Sceptre'],
    aps: 1.3, crit: 6, range: 1.25, dps: 0.9, spread: 0.35, req: { str: 0.6, int: 0.6 }, size: [2, 3],
    tags: ['weapon', 'one_hand', 'melee', 'sceptre', 'caster_weapon', 'attack_weapon'],
    implicit: (t) => ({ mod: 'imp_elemental_damage', values: [[10 + t * 2, 16 + t * 3]] }),
  },
  bow: {
    names: ['Crude Bow', 'Short Bow', 'Hunting Bow', 'Composite Bow', 'Recurve Bow', 'Harbinger Bow'],
    aps: 1.35, crit: 5.5, range: 9, dps: 1.45, spread: 0.5, req: { dex: 1 }, size: [2, 4], twoHanded: true,
    tags: ['weapon', 'two_hand', 'ranged', 'bow', 'attack_weapon'],
  },
  staff: {
    names: ['Gnarled Branch', 'Quarterstaff', 'Iron Staff', 'Serpentine Staff', 'Coiled Staff', 'Eclipse Staff'],
    aps: 1.25, crit: 6.5, range: 1.4, dps: 1.4, spread: 0.4, req: { str: 0.6, int: 0.6 }, size: [2, 4], twoHanded: true,
    tags: ['weapon', 'two_hand', 'melee', 'staff', 'caster_weapon', 'attack_weapon'],
    implicit: () => ({ mod: 'imp_block', values: [[14, 16]] }),
  },
  two_hand_sword: {
    names: ['Corroded Blade', 'Longsword', 'Bastard Sword', 'Greatsword', 'Highland Blade', 'Executioner Sword'],
    aps: 1.35, crit: 5, range: 1.45, dps: 1.75, spread: 0.4, req: { str: 0.6, dex: 0.6 }, size: [2, 4], twoHanded: true,
    tags: ['weapon', 'two_hand', 'melee', 'sword', 'attack_weapon'],
    implicit: (t) => ({ mod: 'imp_accuracy', values: [[60 + t * 60, 100 + t * 80]] }),
  },
  two_hand_axe: {
    names: ['Stone Axe', 'Woodsplitter', 'Poleaxe', 'Double Axe', 'Headsman Axe', 'Labrys'],
    aps: 1.25, crit: 5, range: 1.45, dps: 1.8, spread: 0.5, req: { str: 0.6, dex: 0.6 }, size: [2, 4], twoHanded: true,
    tags: ['weapon', 'two_hand', 'melee', 'axe', 'attack_weapon'],
  },
  two_hand_mace: {
    names: ['Driftwood Maul', 'Tribal Maul', 'Mallet', 'Sledgehammer', 'Great Mallet', 'Colossus Mallet'],
    aps: 1.15, crit: 5, range: 1.45, dps: 1.85, spread: 0.35, req: { str: 1 }, size: [2, 4], twoHanded: true,
    tags: ['weapon', 'two_hand', 'melee', 'mace', 'attack_weapon'],
  },
};

/** Baseline one-hand physical DPS at a given base level. */
const baseDps = (level: number): number => 10 + level * 2.4;

function makeWeaponBases(): ItemBase[] {
  const out: ItemBase[] = [];
  for (const cls of Object.keys(WEAPONS) as WeaponClass[]) {
    const s = WEAPONS[cls];
    WEAPON_TIER_LEVELS.forEach((level, tier) => {
      const avg = (baseDps(level) * s.dps) / s.aps;
      const min = Math.max(1, round(avg * (1 - s.spread)));
      const max = Math.max(min + 1, round(avg * (1 + s.spread)));
      const req: Partial<Record<Attr, number>> = {};
      for (const [a, share] of Object.entries(s.req) as [Attr, number][]) req[a] = attrReq(level, share);
      const imp = s.implicit?.(tier);
      out.push({
        id: `${cls}_${tier}`,
        name: s.names[tier],
        cls,
        w: s.size[0],
        h: s.size[1],
        level,
        req,
        tags: s.tags,
        weapon: { phys: [min, max], aps: s.aps, crit: s.crit, range: s.range },
        twoHanded: s.twoHanded,
        implicits: imp ? [imp] : undefined,
      });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Quivers, jewellery
// ---------------------------------------------------------------------------------------------

const JEWELLERY: ItemBase[] = [
  // Rings
  { id: 'ring_iron', name: 'Iron Ring', cls: 'ring', w: 1, h: 1, level: 1, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_attack_phys', values: [[1, 1], [4, 4]] }] },
  { id: 'ring_coral', name: 'Coral Ring', cls: 'ring', w: 1, h: 1, level: 3, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_life', values: [[20, 30]] }] },
  { id: 'ring_paua', name: 'Paua Ring', cls: 'ring', w: 1, h: 1, level: 5, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_mana', values: [[20, 25]] }] },
  { id: 'ring_ruby', name: 'Ruby Ring', cls: 'ring', w: 1, h: 1, level: 8, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_fire_res', values: [[20, 30]] }] },
  { id: 'ring_sapphire', name: 'Sapphire Ring', cls: 'ring', w: 1, h: 1, level: 12, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_cold_res', values: [[20, 30]] }] },
  { id: 'ring_topaz', name: 'Topaz Ring', cls: 'ring', w: 1, h: 1, level: 16, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_lightning_res', values: [[20, 30]] }] },
  { id: 'ring_gold', name: 'Gold Ring', cls: 'ring', w: 1, h: 1, level: 20, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_rarity', values: [[6, 15]] }] },
  { id: 'ring_moonstone', name: 'Moonstone Ring', cls: 'ring', w: 1, h: 1, level: 24, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_es', values: [[15, 25]] }] },
  { id: 'ring_diamond', name: 'Diamond Ring', cls: 'ring', w: 1, h: 1, level: 30, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_crit_chance', values: [[20, 30]] }] },
  { id: 'ring_amethyst', name: 'Amethyst Ring', cls: 'ring', w: 1, h: 1, level: 36, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_chaos_res', values: [[17, 23]] }] },
  { id: 'ring_twostone', name: 'Twin Stone Ring', cls: 'ring', w: 1, h: 1, level: 40, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_fire_cold_res', values: [[12, 16]] }] },
  { id: 'ring_prismatic', name: 'Prismatic Ring', cls: 'ring', w: 1, h: 1, level: 48, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_all_res', values: [[8, 10]] }] },
  // Amulets
  { id: 'amulet_coral', name: 'Coral Amulet', cls: 'amulet', w: 1, h: 1, level: 1, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_life_regen', values: [[2, 4]] }] },
  { id: 'amulet_paua', name: 'Paua Amulet', cls: 'amulet', w: 1, h: 1, level: 3, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_mana_regen', values: [[20, 30]] }] },
  { id: 'amulet_amber', name: 'Amber Amulet', cls: 'amulet', w: 1, h: 1, level: 5, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_str', values: [[20, 30]] }] },
  { id: 'amulet_jade', name: 'Jade Amulet', cls: 'amulet', w: 1, h: 1, level: 5, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_dex', values: [[20, 30]] }] },
  { id: 'amulet_lapis', name: 'Lapis Amulet', cls: 'amulet', w: 1, h: 1, level: 5, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_int', values: [[20, 30]] }] },
  { id: 'amulet_gold', name: 'Gold Amulet', cls: 'amulet', w: 1, h: 1, level: 20, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_rarity', values: [[12, 20]] }] },
  { id: 'amulet_agate', name: 'Agate Amulet', cls: 'amulet', w: 1, h: 1, level: 16, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_str_int', values: [[16, 24]] }] },
  { id: 'amulet_citrine', name: 'Citrine Amulet', cls: 'amulet', w: 1, h: 1, level: 16, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_str_dex', values: [[16, 24]] }] },
  { id: 'amulet_turquoise', name: 'Turquoise Amulet', cls: 'amulet', w: 1, h: 1, level: 16, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_dex_int', values: [[16, 24]] }] },
  { id: 'amulet_onyx', name: 'Onyx Amulet', cls: 'amulet', w: 1, h: 1, level: 30, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_all_attr', values: [[10, 16]] }] },
  // Belts
  { id: 'belt_chain', name: 'Chain Belt', cls: 'belt', w: 2, h: 1, level: 1, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_es', values: [[9, 20]] }] },
  { id: 'belt_leather', name: 'Leather Belt', cls: 'belt', w: 2, h: 1, level: 8, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_life', values: [[25, 40]] }] },
  { id: 'belt_heavy', name: 'Heavy Belt', cls: 'belt', w: 2, h: 1, level: 8, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_str', values: [[25, 35]] }] },
  { id: 'belt_sash', name: 'Rustic Sash', cls: 'belt', w: 2, h: 1, level: 1, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_phys_damage', values: [[12, 24]] }] },
  { id: 'belt_studded', name: 'Studded Belt', cls: 'belt', w: 2, h: 1, level: 20, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_flask_effect', values: [[10, 15]] }] },
  { id: 'belt_crystal', name: 'Crystal Belt', cls: 'belt', w: 2, h: 1, level: 45, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_es', values: [[60, 80]] }] },
  // Quivers
  { id: 'quiver_hunter', name: "Hunter's Quiver", cls: 'quiver', w: 2, h: 3, level: 1, req: {}, tags: ['quiver'], implicits: [{ mod: 'imp_life', values: [[20, 30]] }] },
  { id: 'quiver_serrated', name: 'Serrated Quiver', cls: 'quiver', w: 2, h: 3, level: 5, req: {}, tags: ['quiver'], implicits: [{ mod: 'imp_attack_phys', values: [[1, 2], [3, 4]] }] },
  { id: 'quiver_ember', name: 'Ember Quiver', cls: 'quiver', w: 2, h: 3, level: 14, req: {}, tags: ['quiver'], implicits: [{ mod: 'imp_attack_fire', values: [[2, 3], [5, 6]] }] },
  { id: 'quiver_barbed', name: 'Barbed Quiver', cls: 'quiver', w: 2, h: 3, level: 26, req: {}, tags: ['quiver'], implicits: [{ mod: 'imp_crit_chance', values: [[20, 30]] }] },
  { id: 'quiver_keen', name: 'Keen Quiver', cls: 'quiver', w: 2, h: 3, level: 40, req: {}, tags: ['quiver'], implicits: [{ mod: 'imp_proj_speed', values: [[20, 30]] }] },
];

// ---------------------------------------------------------------------------------------------
// Flasks
// ---------------------------------------------------------------------------------------------

const LIFE_FLASKS: [string, number, number][] = [
  ['Small', 1, 70], ['Medium', 4, 150], ['Large', 9, 260], ['Greater', 15, 380], ['Grand', 22, 540],
  ['Giant', 30, 720], ['Colossal', 38, 920], ['Sacred', 47, 1150], ['Hallowed', 56, 1450], ['Divine', 65, 1800],
];

function makeFlaskBases(): ItemBase[] {
  const out: ItemBase[] = [];
  LIFE_FLASKS.forEach(([size, level, amount], i) => {
    out.push({
      id: `life_flask_${i}`, name: `${size} Life Flask`, cls: 'life_flask', w: 1, h: 2, level, req: {},
      tags: ['flask', 'life_flask', 'recovery_flask'],
      flask: { kind: 'life', life: amount, duration: 3.5, maxCharges: 21 + (i % 3) * 3, chargesPerUse: 7 + (i % 2) },
    });
    out.push({
      id: `mana_flask_${i}`, name: `${size} Mana Flask`, cls: 'mana_flask', w: 1, h: 2, level: level + 1, req: {},
      tags: ['flask', 'mana_flask', 'recovery_flask'],
      flask: { kind: 'mana', mana: round(amount * 0.55), duration: 4, maxCharges: 24 + (i % 3) * 3, chargesPerUse: 6 + (i % 2) },
    });
    if (i % 2 === 1) {
      out.push({
        id: `hybrid_flask_${i}`, name: `${size} Hybrid Flask`, cls: 'hybrid_flask', w: 1, h: 2, level: level + 2, req: {},
        tags: ['flask', 'hybrid_flask', 'recovery_flask'],
        flask: { kind: 'hybrid', life: round(amount * 0.6), mana: round(amount * 0.3), duration: 5, maxCharges: 30, chargesPerUse: 10 },
      });
    }
  });
  const util = (id: string, name: string, level: number, effect: StatMod[], effectText: string[], duration = 4): ItemBase => ({
    id, name, cls: 'utility_flask', w: 1, h: 2, level, req: {}, tags: ['flask', 'utility_flask'],
    flask: { kind: 'utility', duration, maxCharges: 60, chargesPerUse: 30, effect, effectText },
  });
  out.push(
    util('flask_quicksilver', 'Quicksilver Flask', 4, [inc('movement_speed', 40)], ['40% increased Movement Speed']),
    util('flask_granite', 'Granite Flask', 18, [flat('armour', 1500)], ['+1500 to Armour'], 5),
    util('flask_jade', 'Jade Flask', 22, [flat('evasion', 1500)], ['+1500 to Evasion Rating'], 5),
    util('flask_ruby', 'Ruby Flask', 16, [flat('fire_res', 50), flat('max_fire_res', 5)], ['+50% to Fire Resistance', '+5% to maximum Fire Resistance']),
    util('flask_sapphire', 'Sapphire Flask', 16, [flat('cold_res', 50), flat('max_cold_res', 5)], ['+50% to Cold Resistance', '+5% to maximum Cold Resistance']),
    util('flask_topaz', 'Topaz Flask', 16, [flat('lightning_res', 50), flat('max_lightning_res', 5)], ['+50% to Lightning Resistance', '+5% to maximum Lightning Resistance']),
    util('flask_amethyst', 'Amethyst Flask', 30, [flat('chaos_res', 35)], ['+35% to Chaos Resistance']),
    util('flask_diamond', 'Diamond Flask', 27, [inc('crit_chance', 100)], ['100% increased Critical Strike Chance']),
    util('flask_silver', 'Silver Flask', 22, [inc('attack_speed', 20), inc('cast_speed', 20), inc('movement_speed', 20)], ['Onslaught: 20% increased Attack, Cast and Movement Speed']),
    util('flask_basalt', 'Basalt Flask', 36, [more('damage_taken', -15)], ['15% less Damage taken'], 5),
  );
  return out;
}

// ---------------------------------------------------------------------------------------------
// Special bases (currency, gems and maps are represented as items too)
// ---------------------------------------------------------------------------------------------

const SPECIAL: ItemBase[] = [
  { id: 'gem', name: 'Gem', cls: 'gem', w: 1, h: 1, level: 1, req: {}, tags: ['gem'] },
  { id: 'map', name: 'Map', cls: 'map', w: 1, h: 1, level: 40, req: {}, tags: ['map'] },
];

export const BASES: ItemBase[] = [
  ...makeWeaponBases(),
  ...makeArmourBases(),
  ...JEWELLERY,
  ...makeFlaskBases(),
  ...SPECIAL,
];

export const BASE_BY_ID: Record<string, ItemBase> = Object.fromEntries(BASES.map((b) => [b.id, b]));

export function getBase(id: string): ItemBase {
  const b = BASE_BY_ID[id];
  if (!b) throw new Error(`Unknown item base: ${id}`);
  return b;
}

export const WEAPON_CLASSES = Object.keys(WEAPONS) as WeaponClass[];

export const CLASS_LABEL: Record<ItemClass, string> = {
  claw: 'Claw', dagger: 'Dagger', wand: 'Wand', one_hand_sword: 'One Hand Sword', one_hand_axe: 'One Hand Axe',
  one_hand_mace: 'One Hand Mace', sceptre: 'Sceptre', bow: 'Bow', staff: 'Staff', two_hand_sword: 'Two Hand Sword',
  two_hand_axe: 'Two Hand Axe', two_hand_mace: 'Two Hand Mace', helmet: 'Helmet', body_armour: 'Body Armour',
  gloves: 'Gloves', boots: 'Boots', shield: 'Shield', quiver: 'Quiver', amulet: 'Amulet', ring: 'Ring', belt: 'Belt',
  life_flask: 'Life Flask', mana_flask: 'Mana Flask', hybrid_flask: 'Hybrid Flask', utility_flask: 'Utility Flask',
  currency: 'Currency', gem: 'Gem', map: 'Map',
};

/** Bases that can drop as random equipment (excludes gems/maps/currency). */
export const EQUIPMENT_BASES = BASES.filter((b) => !['gem', 'map', 'currency'].includes(b.cls));
