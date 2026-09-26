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
  str: ['生鏽', '鐵', '鋼', '淬鍊的', '符文', '泰坦'],
  dex: ['破爛', '皮革', '鑲釘', '鮫皮', '龍皮', '影織'],
  int: ['麻繩', '亞麻', '絲綢', '月絲', '星界', '熾天使'],
  str_dex: ['粗製', '鉚接', '連鎖', '鱗甲', '龍鱗', '督軍'],
  str_int: ['朝聖者', '骨', '鍍金', '十字軍', '聖化', '神聖'],
  dex_int: ['磨損的', '光滑', '暗影', '鬼魅的', '夜幕', '暗影'],
};

const NOUNS: Record<ArmourClass, Record<DefenceType, string>> = {
  helmet: { str: '頭盔', dex: '兜帽', int: '頭環', str_dex: '面甲', str_int: '王冠', dex_int: '面具' },
  body_armour: { str: '板甲', dex: '皮背心', int: '長袍', str_dex: '鎖子甲', str_int: '鎖甲衫', dex_int: '服' },
  gloves: { str: '護手', dex: '手套', int: '裹布', str_dex: '護腕', str_int: '握套', dex_int: '連指手套' },
  boots: { str: '脛甲', dex: '鞋子', int: '拖鞋', str_dex: '鐵靴', str_int: '踏靴', dex_int: '便鞋' },
  shield: {
    str: '塔盾', dex: '小圓盾', int: '靈盾', str_dex: '圓盾', str_int: '鳶盾', dex_int: '尖刺盾',
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
          name: `${MATERIALS[d][tier]}${NOUNS[cls][d]}`,
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
    names: ['骨爪', '鐵鉤', '耙爪', '破腹者', '飛龍之爪', '開膛者'],
    aps: 1.6, crit: 6.3, range: 1.1, dps: 0.85, spread: 0.45, req: { dex: 0.6, int: 0.6 }, size: [2, 2],
    tags: ['weapon', 'one_hand', 'melee', 'claw', 'attack_weapon'],
    implicit: (t) => ({ mod: 'imp_life_on_hit', values: [[2 + t * 2, 4 + t * 3]] }),
  },
  dagger: {
    names: ['生鏽匕首', '剝皮刀', '細劍', '短劍', '波刃短劍', '穿心刃'],
    aps: 1.45, crit: 6.5, range: 1.0, dps: 0.85, spread: 0.55, req: { dex: 0.6, int: 0.6 }, size: [1, 3],
    tags: ['weapon', 'one_hand', 'melee', 'dagger', 'caster_weapon', 'attack_weapon'],
    implicit: () => ({ mod: 'imp_crit_chance', values: [[30, 40]] }),
  },
  wand: {
    names: ['柳木法杖', '骨製法杖', '蝕刻法杖', '水晶法杖', '符文法杖', '星落法杖'],
    aps: 1.4, crit: 7.5, range: 7, dps: 0.65, spread: 0.4, req: { int: 1 }, size: [1, 3],
    tags: ['weapon', 'one_hand', 'ranged', 'wand', 'caster_weapon'],
    implicit: (t) => ({ mod: 'imp_spell_damage', values: [[8 + t * 2, 12 + t * 3]] }),
  },
  one_hand_sword: {
    names: ['生鏽短劍', '銅劍', '武裝劍', '軍刀', '騎士劍', '閃耀之刃'],
    aps: 1.5, crit: 5, range: 1.25, dps: 1, spread: 0.4, req: { str: 0.6, dex: 0.6 }, size: [1, 3],
    tags: ['weapon', 'one_hand', 'melee', 'sword', 'attack_weapon'],
    implicit: (t) => ({ mod: 'imp_accuracy', values: [[30 + t * 40, 60 + t * 50]] }),
  },
  one_hand_axe: {
    names: ['短斧', '手斧', '鬍鬚斧', '劈刀', '戰斧', '符文短斧'],
    aps: 1.35, crit: 5, range: 1.25, dps: 1.05, spread: 0.5, req: { str: 0.6, dex: 0.6 }, size: [2, 3],
    tags: ['weapon', 'one_hand', 'melee', 'axe', 'attack_weapon'],
  },
  one_hand_mace: {
    names: ['浮木棍棒', '石鎚', '尖刺棍棒', '凸緣釘錘', '晨星錘', '翼錘'],
    aps: 1.3, crit: 5, range: 1.25, dps: 1.05, spread: 0.35, req: { str: 1 }, size: [2, 3],
    tags: ['weapon', 'one_hand', 'melee', 'mace', 'attack_weapon'],
  },
  sceptre: {
    names: ['橡木權杖', '青銅權杖', '石英權杖', '儀式權杖', '水晶權杖', '虛空權杖'],
    aps: 1.3, crit: 6, range: 1.25, dps: 0.9, spread: 0.35, req: { str: 0.6, int: 0.6 }, size: [2, 3],
    tags: ['weapon', 'one_hand', 'melee', 'sceptre', 'caster_weapon', 'attack_weapon'],
    implicit: (t) => ({ mod: 'imp_elemental_damage', values: [[10 + t * 2, 16 + t * 3]] }),
  },
  bow: {
    names: ['粗製弓', '短弓', '狩獵弓', '複合弓', '反曲弓', '先驅之弓'],
    aps: 1.35, crit: 5.5, range: 9, dps: 1.45, spread: 0.5, req: { dex: 1 }, size: [2, 4], twoHanded: true,
    tags: ['weapon', 'two_hand', 'ranged', 'bow', 'attack_weapon'],
  },
  staff: {
    names: ['扭曲枝杖', '木棍', '鐵杖', '蛇紋長杖', '盤繞長杖', '日蝕長杖'],
    aps: 1.25, crit: 6.5, range: 1.4, dps: 1.4, spread: 0.4, req: { str: 0.6, int: 0.6 }, size: [2, 4], twoHanded: true,
    tags: ['weapon', 'two_hand', 'melee', 'staff', 'caster_weapon', 'attack_weapon'],
    implicit: () => ({ mod: 'imp_block', values: [[14, 16]] }),
  },
  two_hand_sword: {
    names: ['腐蝕之刃', '長劍', '雙手劍', '巨劍', '高地之刃', '處刑者之劍'],
    aps: 1.35, crit: 5, range: 1.45, dps: 1.75, spread: 0.4, req: { str: 0.6, dex: 0.6 }, size: [2, 4], twoHanded: true,
    tags: ['weapon', 'two_hand', 'melee', 'sword', 'attack_weapon'],
    implicit: (t) => ({ mod: 'imp_accuracy', values: [[60 + t * 60, 100 + t * 80]] }),
  },
  two_hand_axe: {
    names: ['石斧', '劈木斧', '長柄斧', '雙刃斧', '劊子手之斧', '雙頭斧'],
    aps: 1.25, crit: 5, range: 1.45, dps: 1.8, spread: 0.5, req: { str: 0.6, dex: 0.6 }, size: [2, 4], twoHanded: true,
    tags: ['weapon', 'two_hand', 'melee', 'axe', 'attack_weapon'],
  },
  two_hand_mace: {
    names: ['浮木巨槌', '部族巨槌', '木槌', '大鐵鎚', '巨型木槌', '巨像之槌'],
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
  { id: 'ring_iron', name: '鐵戒指', cls: 'ring', w: 1, h: 1, level: 1, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_attack_phys', values: [[1, 1], [4, 4]] }] },
  { id: 'ring_coral', name: '珊瑚戒指', cls: 'ring', w: 1, h: 1, level: 3, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_life', values: [[20, 30]] }] },
  { id: 'ring_paua', name: '鮑魚殼戒指', cls: 'ring', w: 1, h: 1, level: 5, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_mana', values: [[20, 25]] }] },
  { id: 'ring_ruby', name: '紅玉戒指', cls: 'ring', w: 1, h: 1, level: 8, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_fire_res', values: [[20, 30]] }] },
  { id: 'ring_sapphire', name: '藍玉戒指', cls: 'ring', w: 1, h: 1, level: 12, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_cold_res', values: [[20, 30]] }] },
  { id: 'ring_topaz', name: '黃玉戒指', cls: 'ring', w: 1, h: 1, level: 16, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_lightning_res', values: [[20, 30]] }] },
  { id: 'ring_gold', name: '黃金戒指', cls: 'ring', w: 1, h: 1, level: 20, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_rarity', values: [[6, 15]] }] },
  { id: 'ring_moonstone', name: '月光石戒指', cls: 'ring', w: 1, h: 1, level: 24, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_es', values: [[15, 25]] }] },
  { id: 'ring_diamond', name: '鑽石戒指', cls: 'ring', w: 1, h: 1, level: 30, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_crit_chance', values: [[20, 30]] }] },
  { id: 'ring_amethyst', name: '紫晶戒指', cls: 'ring', w: 1, h: 1, level: 36, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_chaos_res', values: [[17, 23]] }] },
  { id: 'ring_twostone', name: '雙石戒指', cls: 'ring', w: 1, h: 1, level: 40, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_fire_cold_res', values: [[12, 16]] }] },
  { id: 'ring_prismatic', name: '稜彩戒指', cls: 'ring', w: 1, h: 1, level: 48, req: {}, tags: ['jewellery', 'ring'], implicits: [{ mod: 'imp_all_res', values: [[8, 10]] }] },
  // Amulets
  { id: 'amulet_coral', name: '珊瑚護身符', cls: 'amulet', w: 1, h: 1, level: 1, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_life_regen', values: [[2, 4]] }] },
  { id: 'amulet_paua', name: '鮑魚殼護身符', cls: 'amulet', w: 1, h: 1, level: 3, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_mana_regen', values: [[20, 30]] }] },
  { id: 'amulet_amber', name: '琥珀護身符', cls: 'amulet', w: 1, h: 1, level: 5, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_str', values: [[20, 30]] }] },
  { id: 'amulet_jade', name: '翠玉護身符', cls: 'amulet', w: 1, h: 1, level: 5, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_dex', values: [[20, 30]] }] },
  { id: 'amulet_lapis', name: '青金石護身符', cls: 'amulet', w: 1, h: 1, level: 5, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_int', values: [[20, 30]] }] },
  { id: 'amulet_gold', name: '黃金護身符', cls: 'amulet', w: 1, h: 1, level: 20, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_rarity', values: [[12, 20]] }] },
  { id: 'amulet_agate', name: '瑪瑙護身符', cls: 'amulet', w: 1, h: 1, level: 16, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_str_int', values: [[16, 24]] }] },
  { id: 'amulet_citrine', name: '黃晶護身符', cls: 'amulet', w: 1, h: 1, level: 16, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_str_dex', values: [[16, 24]] }] },
  { id: 'amulet_turquoise', name: '綠松石護身符', cls: 'amulet', w: 1, h: 1, level: 16, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_dex_int', values: [[16, 24]] }] },
  { id: 'amulet_onyx', name: '縞瑪瑙護身符', cls: 'amulet', w: 1, h: 1, level: 30, req: {}, tags: ['jewellery', 'amulet'], implicits: [{ mod: 'imp_all_attr', values: [[10, 16]] }] },
  // Belts
  { id: 'belt_chain', name: '鍊條腰帶', cls: 'belt', w: 2, h: 1, level: 1, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_es', values: [[9, 20]] }] },
  { id: 'belt_leather', name: '皮革腰帶', cls: 'belt', w: 2, h: 1, level: 8, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_life', values: [[25, 40]] }] },
  { id: 'belt_heavy', name: '重型腰帶', cls: 'belt', w: 2, h: 1, level: 8, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_str', values: [[25, 35]] }] },
  { id: 'belt_sash', name: '樸素腰帶', cls: 'belt', w: 2, h: 1, level: 1, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_phys_damage', values: [[12, 24]] }] },
  { id: 'belt_studded', name: '鑲釘腰帶', cls: 'belt', w: 2, h: 1, level: 20, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_flask_effect', values: [[10, 15]] }] },
  { id: 'belt_crystal', name: '水晶腰帶', cls: 'belt', w: 2, h: 1, level: 45, req: {}, tags: ['jewellery', 'belt'], implicits: [{ mod: 'imp_es', values: [[60, 80]] }] },
  // Quivers
  { id: 'quiver_hunter', name: '獵人箭袋', cls: 'quiver', w: 2, h: 3, level: 1, req: {}, tags: ['quiver'], implicits: [{ mod: 'imp_life', values: [[20, 30]] }] },
  { id: 'quiver_serrated', name: '鋸齒箭袋', cls: 'quiver', w: 2, h: 3, level: 5, req: {}, tags: ['quiver'], implicits: [{ mod: 'imp_attack_phys', values: [[1, 2], [3, 4]] }] },
  { id: 'quiver_ember', name: '餘燼箭袋', cls: 'quiver', w: 2, h: 3, level: 14, req: {}, tags: ['quiver'], implicits: [{ mod: 'imp_attack_fire', values: [[2, 3], [5, 6]] }] },
  { id: 'quiver_barbed', name: '倒鉤箭袋', cls: 'quiver', w: 2, h: 3, level: 26, req: {}, tags: ['quiver'], implicits: [{ mod: 'imp_crit_chance', values: [[20, 30]] }] },
  { id: 'quiver_keen', name: '銳利箭袋', cls: 'quiver', w: 2, h: 3, level: 40, req: {}, tags: ['quiver'], implicits: [{ mod: 'imp_proj_speed', values: [[20, 30]] }] },
];

// ---------------------------------------------------------------------------------------------
// Flasks
// ---------------------------------------------------------------------------------------------

const LIFE_FLASKS: [string, number, number][] = [
  ['小', 1, 70], ['中', 4, 150], ['大', 9, 260], ['大型', 15, 380], ['宏偉', 22, 540],
  ['巨大', 30, 720], ['巨型', 38, 920], ['神聖', 47, 1150], ['神聖', 56, 1450], ['神聖', 65, 1800],
];

function makeFlaskBases(): ItemBase[] {
  const out: ItemBase[] = [];
  LIFE_FLASKS.forEach(([size, level, amount], i) => {
    out.push({
      id: `life_flask_${i}`, name: `${size}生命藥劑`, cls: 'life_flask', w: 1, h: 2, level, req: {},
      tags: ['flask', 'life_flask', 'recovery_flask'],
      flask: { kind: 'life', life: amount, duration: 3.5, maxCharges: 21 + (i % 3) * 3, chargesPerUse: 7 + (i % 2) },
    });
    out.push({
      id: `mana_flask_${i}`, name: `${size}魔力藥劑`, cls: 'mana_flask', w: 1, h: 2, level: level + 1, req: {},
      tags: ['flask', 'mana_flask', 'recovery_flask'],
      flask: { kind: 'mana', mana: round(amount * 0.55), duration: 4, maxCharges: 24 + (i % 3) * 3, chargesPerUse: 6 + (i % 2) },
    });
    if (i % 2 === 1) {
      out.push({
        id: `hybrid_flask_${i}`, name: `${size}複合藥劑`, cls: 'hybrid_flask', w: 1, h: 2, level: level + 2, req: {},
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
    util('flask_quicksilver', '水銀藥劑', 4, [inc('movement_speed', 40)], ['增加 40% 移動速度']),
    util('flask_granite', '花崗岩藥劑', 18, [flat('armour', 1500)], ['+1500 護甲'], 5),
    util('flask_jade', '翠玉藥劑', 22, [flat('evasion', 1500)], ['+1500 閃避值'], 5),
    util('flask_ruby', '紅玉藥劑', 16, [flat('fire_res', 50), flat('max_fire_res', 5)], ['+50% 火焰抗性', '+5% 最大火焰抗性']),
    util('flask_sapphire', '藍玉藥劑', 16, [flat('cold_res', 50), flat('max_cold_res', 5)], ['+50% 冰冷抗性', '+5% 最大冰冷抗性']),
    util('flask_topaz', '黃玉藥劑', 16, [flat('lightning_res', 50), flat('max_lightning_res', 5)], ['+50% 閃電抗性', '+5% 最大閃電抗性']),
    util('flask_amethyst', '紫晶藥劑', 30, [flat('chaos_res', 35)], ['+35% 混沌抗性']),
    util('flask_diamond', '鑽石藥劑', 27, [inc('crit_chance', 100)], ['增加 100% 暴擊率']),
    util('flask_silver', '白銀藥劑', 22, [inc('attack_speed', 20), inc('cast_speed', 20), inc('movement_speed', 20)], ['猛攻：攻擊、施法與移動速度增加 20%']),
    util('flask_basalt', '玄武岩藥劑', 36, [more('damage_taken', -15)], ['總減 15% 承受傷害'], 5),
  );
  return out;
}

// ---------------------------------------------------------------------------------------------
// Special bases (currency, gems and maps are represented as items too)
// ---------------------------------------------------------------------------------------------

const SPECIAL: ItemBase[] = [
  { id: 'gem', name: '寶石', cls: 'gem', w: 1, h: 1, level: 1, req: {}, tags: ['gem'] },
  { id: 'map', name: '地圖', cls: 'map', w: 1, h: 1, level: 40, req: {}, tags: ['map'] },
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
  claw: '爪', dagger: '匕首', wand: '法杖', one_hand_sword: '單手劍', one_hand_axe: '單手斧',
  one_hand_mace: '單手錘', sceptre: '權杖', bow: '弓', staff: '長杖', two_hand_sword: '雙手劍',
  two_hand_axe: '雙手斧', two_hand_mace: '雙手錘', helmet: '頭盔', body_armour: '胸甲',
  gloves: '手套', boots: '鞋子', shield: '盾牌', quiver: '箭袋', amulet: '護身符', ring: '戒指', belt: '腰帶',
  life_flask: '生命藥劑', mana_flask: '魔力藥劑', hybrid_flask: '複合藥劑', utility_flask: '功能藥劑',
  currency: '通貨', gem: '寶石', map: '地圖',
};

/** Bases that can drop as random equipment (excludes gems/maps/currency). */
export const EQUIPMENT_BASES = BASES.filter((b) => !['gem', 'map', 'currency'].includes(b.cls));
