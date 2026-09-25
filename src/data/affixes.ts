import type { ModKind, StatKey } from '../stats/stats';

/**
 * Affix (mod) definitions.
 *
 * Mirrors Path of Exile's modifier model:
 *  - each mod is a prefix, suffix, implicit, corrupted implicit or unique mod
 *  - mods belong to a group; an item can only carry one mod per group
 *  - tiers are gated by item level and each tier has its own weight
 *  - spawn tags restrict which item bases can roll the mod
 *  - "local" stats modify the item they're on (weapon damage, armour values…)
 */

export type ModType = 'prefix' | 'suffix' | 'implicit' | 'corrupted' | 'unique';

export interface ModStat {
  stat: StatKey;
  kind: ModKind;
  /** Which rolled value feeds this stat (default 0). Ignored for flags / fixed values. */
  idx?: number;
  /** Multiplier applied to the rolled value (e.g. -1 for "reduced"). */
  mult?: number;
  /** Fixed value instead of a rolled one. */
  value?: number;
}

export interface ModTierDef {
  ilvl: number;
  values: [number, number][];
  weight?: number;
}

export interface MapEffect {
  target: 'monster' | 'player';
  quant: number;
  rarity: number;
  packSize?: number;
}

export interface ModDef {
  id: string;
  type: ModType;
  group: string;
  /** One template per line; {0}, {1}… are replaced with rolled values. */
  text: string[];
  stats: ModStat[];
  tiers: ModTierDef[];
  /** Item tags that allow this mod to spawn. */
  spawn: string[];
  /** Base spawn weight (default 1000). */
  weight?: number;
  /** Value multipliers by item tag (e.g. two-handed weapons roll bigger flat damage). */
  scale?: Record<string, number>;
  /** Affix names, lowest tier first. */
  names?: string[];
  /** Number of decimals for rolled values (default 0). */
  decimals?: number;
  mapEffect?: MapEffect;
}

const t = (ilvl: number, lo: number, hi: number, weight?: number): ModTierDef => ({ ilvl, values: [[lo, hi]], weight });
const t2 = (ilvl: number, a: [number, number], b: [number, number]): ModTierDef => ({ ilvl, values: [a, b] });
const s = (stat: StatKey, kind: ModKind = 'flat', idx = 0, mult = 1): ModStat => ({ stat, kind, idx, mult });
const fl = (stat: StatKey): ModStat => ({ stat, kind: 'flag', value: 1 });

type ModInput = Omit<ModDef, 'group' | 'text'> & { group?: string; text: string | string[] };
const mod = (m: ModInput): ModDef => ({ ...m, group: m.group ?? m.id, text: Array.isArray(m.text) ? m.text : [m.text] });

// Shared tier tables -------------------------------------------------------------------------

const ARMOUR_ARMOUR = [t(1, 6, 15), t(11, 16, 40), t(18, 41, 70), t(26, 71, 110), t(35, 111, 160), t(44, 161, 220), t(54, 221, 290), t(63, 291, 360), t(72, 361, 440)];
const DEF_INC = [t(3, 15, 26), t(17, 27, 42), t(29, 43, 55), t(42, 56, 67), t(56, 68, 79), t(70, 80, 92), t(78, 93, 100)];
const RES = [t(1, 6, 11), t(12, 12, 17), t(24, 18, 23), t(36, 24, 29), t(48, 30, 35), t(60, 36, 41), t(72, 42, 45), t(80, 46, 48)];
const ATTR = [t(1, 8, 12), t(11, 13, 17), t(22, 18, 22), t(33, 23, 27), t(44, 28, 32), t(55, 33, 37), t(66, 38, 42), t(74, 43, 50)];
const PCT_DMG = [t(2, 10, 19), t(12, 20, 29), t(24, 30, 39), t(36, 40, 49), t(48, 50, 59), t(60, 60, 69), t(72, 70, 79)];
const ADDED_ATTACK = [t2(1, [1, 2], [3, 4]), t2(12, [3, 5], [7, 8]), t2(20, [5, 7], [10, 12]), t2(28, [6, 9], [13, 16]), t2(35, [8, 11], [16, 19]), t2(44, [10, 13], [20, 23]), t2(52, [12, 16], [24, 28]), t2(64, [15, 20], [30, 35]), t2(75, [18, 24], [36, 42])];
const ADDED_LIGHTNING = [t2(1, [1, 1], [4, 6]), t2(13, [1, 2], [10, 14]), t2(19, [1, 3], [18, 24]), t2(28, [2, 4], [28, 36]), t2(35, [2, 5], [38, 46]), t2(44, [3, 6], [50, 58]), t2(52, [3, 8], [62, 72]), t2(64, [4, 9], [76, 88]), t2(75, [5, 11], [92, 106])];
const ADDED_LOCAL = [t2(1, [1, 2], [3, 4]), t2(12, [3, 5], [7, 9]), t2(20, [5, 7], [11, 14]), t2(28, [8, 11], [16, 20]), t2(35, [10, 14], [21, 25]), t2(44, [13, 18], [27, 32]), t2(52, [17, 22], [34, 40]), t2(64, [21, 28], [42, 50]), t2(75, [26, 35], [52, 62])];
const ADDED_COLD_LOCAL = ADDED_LOCAL.map((x) => ({ ...x, values: x.values.map(([a, b]) => [Math.max(1, Math.round(a * 0.85)), Math.max(1, Math.round(b * 0.85))] as [number, number]) }));
const ADDED_LIGHTNING_LOCAL = ADDED_LIGHTNING.map((x) => ({ ...x, values: x.values.map(([a, b]) => [Math.max(1, Math.round(a * 1.1)), Math.round(b * 1.1)] as [number, number]) }));

const ARMOUR_ALL = ['armour'];
const JEWELLERY = ['ring', 'amulet', 'belt'];
const CASTER = ['wand', 'sceptre', 'staff', 'dagger'];
const TWO_HAND_SCALE = { two_hand: 1.75, wand: 0.75 };
const STAFF_SCALE = { staff: 1.5 };

export const AFFIXES: ModDef[] = [
  // =========================================================================================
  // PREFIXES
  // =========================================================================================
  mod({
    id: 'life', type: 'prefix', text: '+{0} 最大生命', stats: [s('life')],
    spawn: ['helmet', 'body_armour', 'gloves', 'boots', 'shield', 'belt', 'amulet', 'ring', 'quiver'],
    tiers: [t(1, 3, 9), t(5, 10, 19), t(11, 20, 29), t(18, 30, 39), t(24, 40, 49), t(30, 50, 59), t(36, 60, 69), t(44, 70, 79), t(54, 80, 89), t(64, 90, 99), t(73, 100, 109)],
    names: ['強健的', '健壯的', '結實的', '堅定的', '健碩的', '生機的', '充滿活力的', '興旺的', '堅韌', '不屈的', '泰坦的'],
  }),
  mod({
    id: 'mana', type: 'prefix', text: '+{0} 最大魔力', stats: [s('mana')],
    spawn: ['helmet', 'gloves', 'boots', 'ring', 'amulet', ...CASTER],
    tiers: [t(1, 15, 19), t(11, 20, 24), t(17, 25, 29), t(23, 30, 34), t(29, 35, 39), t(35, 40, 44), t(42, 45, 49), t(51, 50, 54), t(60, 55, 59), t(69, 60, 64)],
    names: ['綠柱石的', '鈷藍的', '蔚藍的', '青金的', '天藍的', '水之', '蛋白石的', '龍膽的', '靛青的', '深藍的'],
  }),
  mod({
    id: 'es_flat', type: 'prefix', group: 'es_flat', text: '+{0} 最大能量護盾', stats: [s('energy_shield')],
    spawn: JEWELLERY,
    tiers: [t(3, 1, 4), t(11, 5, 8), t(17, 9, 12), t(23, 13, 15), t(29, 16, 19), t(35, 20, 22), t(42, 23, 26), t(50, 27, 31), t(59, 32, 37), t(68, 38, 43)],
    names: ['閃亮的', '微光的', '閃爍的', '發光的', '輻射的', '脈動的', '沸騰的', '熾焰的', '閃耀的', '熾白的'],
  }),
  mod({
    id: 'es_pct', type: 'prefix', text: '增加 {0}% 最大能量護盾', stats: [s('energy_shield', 'inc')],
    spawn: ['amulet'], weight: 600,
    tiers: [t(3, 2, 4), t(18, 5, 7), t(32, 8, 10), t(50, 11, 13), t(66, 14, 16)],
    names: ['守護的', '護盾的', '神盾', '堡壘', '要塞'],
  }),
  mod({
    id: 'life_pct', type: 'prefix', text: '增加 {0}% 最大生命', stats: [s('life', 'inc')],
    spawn: ['amulet', 'belt'], weight: 300,
    tiers: [t(20, 3, 5), t(40, 6, 8), t(60, 9, 10)],
    names: ['繁衍的', '活潑的', '繁盛的'],
  }),
  mod({
    id: 'local_armour', type: 'prefix', group: 'local_def_flat', text: '+{0} 護甲', stats: [s('local_armour')],
    spawn: ['str_armour', 'str_dex_armour', 'str_int_armour'], tiers: ARMOUR_ARMOUR,
    names: ['上漆的', '鑲釘', '肋紋的', '加強的', '鍍甲的', '甲殼的', '包覆的', '包裹的', '精金的'],
  }),
  mod({
    id: 'local_evasion', type: 'prefix', group: 'local_def_flat2', text: '+{0} 閃避值', stats: [s('local_evasion')],
    spawn: ['dex_armour', 'str_dex_armour', 'dex_int_armour'], tiers: ARMOUR_ARMOUR,
    names: ['靈巧的', '舞者的', '雜技師的', '迅捷的', '模糊的', '相位的', '蒸氣的', '難以捉摸的', '虛無的'],
  }),
  mod({
    id: 'local_es', type: 'prefix', group: 'local_def_flat3', text: '+{0} 最大能量護盾', stats: [s('local_es')],
    spawn: ['int_armour', 'str_int_armour', 'dex_int_armour'],
    tiers: [t(1, 3, 5), t(11, 6, 11), t(17, 12, 17), t(23, 18, 23), t(29, 24, 29), t(35, 30, 35), t(43, 36, 41), t(51, 42, 47), t(60, 48, 53), t(70, 54, 61)],
    names: ['防護的', '堅毅的', '堅決的', '無懼的', '無畏的', '堅定不移的', '不可動搖的', '無懈可擊的', '淡定的', '主宰的'],
  }),
  mod({
    id: 'local_armour_inc', type: 'prefix', group: 'local_def_inc', text: '增加 {0}% 護甲', stats: [s('local_armour_inc', 'inc')],
    spawn: ['str_armour'], tiers: DEF_INC,
    names: ['強化的', '層疊的', '龍蝦甲的', '加固的', '加厚的', '束緊的', '堅不可摧的'],
  }),
  mod({
    id: 'local_evasion_inc', type: 'prefix', group: 'local_def_inc', text: '增加 {0}% 閃避值', stats: [s('local_evasion_inc', 'inc')],
    spawn: ['dex_armour'], tiers: DEF_INC,
    names: ['陰影的', '幽魂的', '幽靈的', '怨靈的', '幻象的', '夢魘的', '海市蜃樓的'],
  }),
  mod({
    id: 'local_es_inc', type: 'prefix', group: 'local_def_inc', text: '增加 {0}% 能量護盾', stats: [s('local_es_inc', 'inc')],
    spawn: ['int_armour'], tiers: DEF_INC,
    names: ['微閃的', '虹彩的', '光澤的', '閃爍的', '閃亮的', '燦爛的', '耀眼的'],
  }),
  mod({
    id: 'local_ae_inc', type: 'prefix', group: 'local_def_inc', text: '增加 {0}% 護甲與閃避', stats: [s('local_def_inc', 'inc')],
    spawn: ['str_dex_armour'], tiers: DEF_INC,
    names: ['爭鬥者的', '鬥士的', '劍客的', '角鬥士的', '決鬥者的', '英雄的', '傳說的'],
  }),
  mod({
    id: 'local_aes_inc', type: 'prefix', group: 'local_def_inc', text: '增加 {0}% 護甲與能量護盾', stats: [s('local_def_inc', 'inc')],
    spawn: ['str_int_armour'], tiers: DEF_INC,
    names: ['嵌入的', '根深的', '浸潤的', '注入的', '灌輸的', '插補的', '不動搖的'],
  }),
  mod({
    id: 'local_ees_inc', type: 'prefix', group: 'local_def_inc', text: '增加 {0}% 閃避與能量護盾', stats: [s('local_def_inc', 'inc')],
    spawn: ['dex_int_armour'], tiers: DEF_INC,
    names: ['陰暗的', '虛無的', '超凡的', '短暫的', '消逝的', '非真的', '虛幻的'],
  }),
  mod({
    id: 'movement_speed', type: 'prefix', text: '增加 {0}% 移動速度', stats: [s('movement_speed', 'inc')],
    spawn: ['boots'], tiers: [t(1, 10, 10), t(15, 15, 15), t(30, 20, 20), t(40, 25, 25), t(55, 30, 30), t(70, 35, 35)],
    names: ['跑者的', '短跑者的', '駿馬的', '羚羊的', '獵豹的', '地獄之'],
  }),
  mod({
    id: 'local_phys_inc', type: 'prefix', text: '增加 {0}% 物理傷害', stats: [s('local_phys_inc', 'inc')],
    spawn: ['attack_weapon', 'bow', 'wand'],
    tiers: [t(1, 40, 49), t(11, 50, 64), t(23, 65, 84), t(35, 85, 109), t(46, 110, 134), t(60, 135, 154), t(73, 155, 179)],
    names: ['沉重的', '鋸齒的', '邪惡的', '惡毒的', '嗜血的', '殘酷的', '暴君的'],
  }),
  mod({
    id: 'local_phys_added', type: 'prefix', text: '附加 {0} - {1} 物理傷害', stats: [s('local_phys_min', 'flat', 0), s('local_phys_max', 'flat', 1)],
    spawn: ['weapon'], scale: TWO_HAND_SCALE,
    tiers: [t2(1, [1, 2], [3, 4]), t2(8, [2, 3], [5, 7]), t2(16, [4, 5], [8, 10]), t2(25, [5, 7], [11, 15]), t2(35, [7, 10], [15, 18]), t2(45, [9, 12], [19, 22]), t2(55, [11, 15], [23, 27]), t2(65, [13, 18], [27, 32]), t2(75, [16, 21], [32, 38])],
    names: ['閃光的', '磨亮的', '拋光的', '磨利的', '閃亮的', '回火的', '鋒利的', '淬鍊的', '閃耀的'],
  }),
  mod({
    id: 'local_fire_added', type: 'prefix', text: '附加 {0} - {1} 火焰傷害', stats: [s('local_fire_min', 'flat', 0), s('local_fire_max', 'flat', 1)],
    spawn: ['weapon'], scale: TWO_HAND_SCALE, tiers: ADDED_LOCAL,
    names: ['熾熱的', '悶燒的', '冒煙的', '燃燒', '燃焰的', '灼燒的', '焚燒的', '爆破的', '焚屍的'],
  }),
  mod({
    id: 'local_cold_added', type: 'prefix', text: '附加 {0} - {1} 冰冷傷害', stats: [s('local_cold_min', 'flat', 0), s('local_cold_max', 'flat', 1)],
    spawn: ['weapon'], scale: TWO_HAND_SCALE, tiers: ADDED_COLD_LOCAL,
    names: ['霜凍的', '冰緩', '冰冷的', '嚴寒的', '凍結的', '冰凍', '冰封的', '極地的', '封墓的'],
  }),
  mod({
    id: 'local_lightning_added', type: 'prefix', text: '附加 {0} - {1} 閃電傷害', stats: [s('local_lightning_min', 'flat', 0), s('local_lightning_max', 'flat', 1)],
    spawn: ['weapon'], scale: TWO_HAND_SCALE, tiers: ADDED_LIGHTNING_LOCAL,
    names: ['嗡嗡的', '嗡鳴的', '啪啪的', '劈啪的', '火花的', '電弧的', '震撼的', '釋放的', '電擊的'],
  }),
  mod({
    id: 'attack_phys_added', type: 'prefix', text: '附加 {0} - {1} 物理傷害（攻擊）', stats: [s('attack_phys_min', 'flat', 0), s('attack_phys_max', 'flat', 1)],
    spawn: ['ring', 'amulet', 'gloves', 'quiver'],
    tiers: [t2(5, [1, 1], [2, 2]), t2(13, [1, 2], [3, 3]), t2(19, [2, 3], [4, 5]), t2(28, [3, 4], [6, 7]), t2(35, [4, 5], [7, 8]), t2(44, [5, 6], [9, 10]), t2(52, [6, 7], [11, 12]), t2(64, [7, 9], [13, 15]), t2(75, [9, 11], [16, 19])],
    names: ['閃光的', '磨亮的', '拋光的', '磨利的', '閃亮的', '回火的', '鋒利的', '淬鍊的', '閃耀的'],
  }),
  mod({
    id: 'attack_fire_added', type: 'prefix', text: '附加 {0} - {1} 火焰傷害（攻擊）', stats: [s('attack_fire_min', 'flat', 0), s('attack_fire_max', 'flat', 1)],
    spawn: ['ring', 'amulet', 'gloves', 'quiver'], tiers: ADDED_ATTACK,
    names: ['熾熱的', '悶燒的', '冒煙的', '燃燒', '燃焰的', '灼燒的', '焚燒的', '爆破的', '焚屍的'],
  }),
  mod({
    id: 'attack_cold_added', type: 'prefix', text: '附加 {0} - {1} 冰冷傷害（攻擊）', stats: [s('attack_cold_min', 'flat', 0), s('attack_cold_max', 'flat', 1)],
    spawn: ['ring', 'amulet', 'gloves', 'quiver'], tiers: ADDED_ATTACK,
    names: ['霜凍的', '冰緩', '冰冷的', '嚴寒的', '凍結的', '冰凍', '冰封的', '極地的', '封墓的'],
  }),
  mod({
    id: 'attack_lightning_added', type: 'prefix', text: '附加 {0} - {1} 閃電傷害（攻擊）', stats: [s('attack_lightning_min', 'flat', 0), s('attack_lightning_max', 'flat', 1)],
    spawn: ['ring', 'amulet', 'gloves', 'quiver'], tiers: ADDED_LIGHTNING,
    names: ['嗡嗡的', '嗡鳴的', '啪啪的', '劈啪的', '火花的', '電弧的', '震撼的', '釋放的', '電擊的'],
  }),
  mod({
    id: 'spell_fire_added', type: 'prefix', text: '附加 {0} - {1} 火焰傷害（法術）', stats: [s('spell_fire_min', 'flat', 0), s('spell_fire_max', 'flat', 1)],
    spawn: CASTER, scale: STAFF_SCALE, tiers: ADDED_ATTACK,
    names: ['熾熱的', '悶燒的', '冒煙的', '燃燒', '燃焰的', '灼燒的', '焚燒的', '爆破的', '焚屍的'],
  }),
  mod({
    id: 'spell_cold_added', type: 'prefix', text: '附加 {0} - {1} 冰冷傷害（法術）', stats: [s('spell_cold_min', 'flat', 0), s('spell_cold_max', 'flat', 1)],
    spawn: CASTER, scale: STAFF_SCALE, tiers: ADDED_ATTACK,
    names: ['霜凍的', '冰緩', '冰冷的', '嚴寒的', '凍結的', '冰凍', '冰封的', '極地的', '封墓的'],
  }),
  mod({
    id: 'spell_lightning_added', type: 'prefix', text: '附加 {0} - {1} 閃電傷害（法術）', stats: [s('spell_lightning_min', 'flat', 0), s('spell_lightning_max', 'flat', 1)],
    spawn: CASTER, scale: STAFF_SCALE, tiers: ADDED_LIGHTNING,
    names: ['嗡嗡的', '嗡鳴的', '啪啪的', '劈啪的', '火花的', '電弧的', '震撼的', '釋放的', '電擊的'],
  }),
  mod({
    id: 'spell_damage', type: 'prefix', text: '增加 {0}% 法術傷害', stats: [s('spell_damage', 'inc')],
    spawn: [...CASTER, 'amulet'], scale: STAFF_SCALE,
    tiers: [t(2, 10, 19), t(11, 20, 29), t(23, 30, 39), t(35, 40, 49), t(46, 50, 59), t(58, 60, 69), t(64, 70, 74), t(75, 75, 79)],
    names: ['學徒的', '熟練者的', '學者的', '教授的', '秘術家的', '咒術師的', '符文的', '符文的'],
  }),
  mod({
    id: 'fire_damage', type: 'prefix', text: '增加 {0}% 火焰傷害', stats: [s('fire_damage', 'inc')],
    spawn: [...CASTER, 'amulet'], scale: STAFF_SCALE, tiers: PCT_DMG,
    names: ['灼熱的', '嘶嘶作響的', '灼熱的', '烙燒的', '火山的', '岩漿的', '火山碎屑的'],
  }),
  mod({
    id: 'cold_damage', type: 'prefix', text: '增加 {0}% 冰冷傷害', stats: [s('cold_damage', 'inc')],
    spawn: [...CASTER, 'amulet'], scale: STAFF_SCALE, tiers: PCT_DMG,
    names: ['苦寒的', '刺骨的', '高山的', '雪白的', '冰雹的', '極地的', '晶瑩的'],
  }),
  mod({
    id: 'lightning_damage', type: 'prefix', text: '增加 {0}% 閃電傷害', stats: [s('lightning_damage', 'inc')],
    spawn: [...CASTER, 'amulet'], scale: STAFF_SCALE, tiers: PCT_DMG,
    names: ['充能的', '嘶鳴的', '迅雷的', '奔流的', '打擊的', '雷鳴的', '馭風者的'],
  }),
  mod({
    id: 'minion_damage', type: 'prefix', text: '召喚物傷害增加 {0}%', stats: [s('minion_damage', 'inc')],
    spawn: ['wand', 'sceptre', 'staff', 'amulet', 'helmet'], weight: 500, scale: STAFF_SCALE,
    tiers: [t(4, 10, 19), t(15, 20, 29), t(30, 30, 39), t(50, 40, 49), t(65, 50, 59)],
    names: ['惡毒的', '惡意的', '邪惡的', '死亡的', '死靈法師的'],
  }),
  mod({
    id: 'life_leech', type: 'prefix', text: '{0}% 攻擊傷害轉化為生命偷取', stats: [s('life_leech')], decimals: 1,
    spawn: ['ring', 'amulet', 'gloves', 'quiver'], weight: 500,
    tiers: [t(9, 0.2, 0.4), t(22, 0.4, 0.6), t(40, 0.6, 0.8), t(60, 0.8, 1.0)],
    names: ['鮣魚的', '七鰓鰻的', '吸血鬼的', '寄生蟲的'],
  }),
  mod({
    id: 'socketed_gem_level', type: 'prefix', text: '+{0} 插槽寶石等級', stats: [s('socketed_gem_level')],
    spawn: ['body_armour', 'helmet', 'shield', 'two_hand'], weight: 150,
    tiers: [t(30, 1, 1), t(75, 2, 2, 200)],
    names: ['楷模的', '典範的'],
  }),
  mod({
    id: 'spell_gem_level', type: 'prefix', text: '+{0} 所有法術技能寶石等級', stats: [s('spell_gem_level')],
    spawn: ['wand', 'sceptre', 'staff', 'amulet'], weight: 200,
    tiers: [t(35, 1, 1), t(78, 2, 2, 200)],
    names: ['大師的', '大法師的'],
  }),

  // =========================================================================================
  // SUFFIXES
  // =========================================================================================
  mod({
    id: 'str', type: 'suffix', text: '+{0} 力量', stats: [s('str')], tiers: ATTR,
    spawn: ['weapon', 'armour', 'amulet', 'ring', 'belt'],
    names: ['之蠻漢', '之摔角手', '之熊', '之獅', '之猩猩', '之巨人', '之利維坦', '之泰坦'],
  }),
  mod({
    id: 'dex', type: 'suffix', text: '+{0} 敏捷', stats: [s('dex')], tiers: ATTR,
    spawn: ['weapon', 'armour', 'amulet', 'ring', 'quiver'],
    names: ['之貓鼬', '之山貓', '之狐', '之獵鷹', '之黑豹', '之花豹', '之美洲豹', '之幻影'],
  }),
  mod({
    id: 'int', type: 'suffix', text: '+{0} 智慧', stats: [s('int')], tiers: ATTR,
    spawn: ['weapon', 'armour', 'amulet', 'ring'],
    names: ['之門徒', '之學生', '之神童', '之占卜師', '之哲人', '之賢者', '之學者', '之大師'],
  }),
  mod({
    id: 'all_attributes', type: 'suffix', text: '+{0} 全屬性', stats: [s('all_attributes')], spawn: ['amulet'], weight: 600,
    tiers: [t(1, 1, 4), t(11, 5, 8), t(22, 9, 12), t(33, 13, 16), t(44, 17, 20), t(55, 21, 24), t(66, 25, 28)],
    names: ['之雲海', '之天空', '之流星', '之彗星', '之天堂', '之銀河', '之宇宙'],
  }),
  mod({
    id: 'fire_res', type: 'suffix', text: '+{0}% 火焰抗性', stats: [s('fire_res')], tiers: RES,
    spawn: [...ARMOUR_ALL, ...JEWELLERY],
    names: ['之雛龍', '之火蜥蜴', '之幼龍', '之窯爐', '之熔爐', '之火山', '之岩漿', '之煉獄'],
  }),
  mod({
    id: 'cold_res', type: 'suffix', text: '+{0}% 冰冷抗性', stats: [s('cold_res')], tiers: RES,
    spawn: [...ARMOUR_ALL, ...JEWELLERY],
    names: ['之冰霜', '之海豹', '之企鵝', '之雪怪', '之海象', '之北極熊', '之寒冰', '之冰川'],
  }),
  mod({
    id: 'lightning_res', type: 'suffix', text: '+{0}% 閃電抗性', stats: [s('lightning_res')], tiers: RES,
    spawn: [...ARMOUR_ALL, ...JEWELLERY],
    names: ['之雲', '之狂風', '之風暴', '之雷雲', '之暴風', '之漩渦', '之閃電', '之鋒面'],
  }),
  mod({
    id: 'all_res', type: 'suffix', text: '+{0}% 全部元素抗性', stats: [s('all_ele_res')],
    spawn: ['ring', 'amulet', 'shield'], weight: 600,
    tiers: [t(12, 3, 5), t(24, 6, 8), t(36, 9, 11), t(48, 12, 14), t(60, 15, 16), t(72, 17, 18)],
    names: ['之水晶', '之稜鏡', '之萬花筒', '之斑斕', '之彩虹', '之跨度'],
  }),
  mod({
    id: 'chaos_res', type: 'suffix', text: '+{0}% 混沌抗性', stats: [s('chaos_res')],
    spawn: [...ARMOUR_ALL, ...JEWELLERY], weight: 250,
    tiers: [t(16, 5, 10), t(30, 11, 15), t(44, 16, 20), t(56, 21, 25), t(68, 26, 30), t(80, 31, 35)],
    names: ['之迷失', '之放逐', '之驅逐', '之驅除', '之守護', '之虛空'],
  }),
  mod({
    id: 'local_attack_speed', type: 'suffix', group: 'attack_speed', text: '增加 {0}% 攻擊速度', stats: [s('local_attack_speed', 'inc')],
    spawn: ['attack_weapon', 'bow', 'wand'],
    tiers: [t(1, 5, 7), t(11, 8, 10), t(22, 11, 13), t(30, 14, 16), t(37, 17, 19), t(45, 20, 22), t(60, 23, 25), t(77, 26, 27)],
    names: ['之技巧', '之輕鬆', '之精通', '之宗師', '之聲望', '之讚譽', '之名望', '之惡名'],
  }),
  mod({
    id: 'attack_speed', type: 'suffix', group: 'attack_speed', text: '增加 {0}% 攻擊速度', stats: [s('attack_speed', 'inc')],
    spawn: ['gloves', 'quiver', 'ring'], weight: 500,
    tiers: [t(1, 5, 7), t(18, 8, 10), t(35, 11, 13), t(55, 14, 16)],
    names: ['之技巧', '之輕鬆', '之精通', '之宗師'],
  }),
  mod({
    id: 'cast_speed', type: 'suffix', text: '增加 {0}% 施法速度', stats: [s('cast_speed', 'inc')],
    spawn: [...CASTER, 'amulet', 'ring'], scale: STAFF_SCALE,
    tiers: [t(2, 5, 8), t(15, 9, 12), t(30, 13, 16), t(40, 17, 20), t(55, 21, 24), t(72, 25, 28)],
    names: ['之天賦', '之敏捷', '之專精', '之戲法', '之魔術', '之占卜'],
  }),
  mod({
    id: 'local_crit', type: 'suffix', group: 'crit_chance', text: '增加 {0}% 暴擊率', stats: [s('local_crit', 'inc')],
    spawn: ['weapon'],
    tiers: [t(1, 10, 14), t(20, 15, 19), t(30, 20, 24), t(44, 25, 29), t(58, 30, 34), t(72, 35, 38)],
    names: ['之針刺', '之螫刺', '之穿透', '之刺穿', '之穿刺', '之切開'],
  }),
  mod({
    id: 'crit_chance', type: 'suffix', group: 'crit_chance', text: '增加 {0}% 全域暴擊率', stats: [s('crit_chance', 'inc')],
    spawn: ['amulet', 'quiver'],
    tiers: [t(5, 10, 14), t(20, 15, 19), t(30, 20, 24), t(44, 25, 29), t(58, 30, 34), t(72, 35, 38)],
    names: ['之針刺', '之螫刺', '之穿透', '之刺穿', '之穿刺', '之切開'],
  }),
  mod({
    id: 'crit_multi', type: 'suffix', text: '+{0}% 全域暴擊傷害加成', stats: [s('crit_multi')],
    spawn: ['weapon', 'amulet', 'quiver'],
    tiers: [t(8, 8, 12), t(21, 13, 19), t(31, 20, 24), t(45, 25, 29), t(59, 30, 34), t(74, 35, 38)],
    names: ['之忿怒', '之憤怒', '之暴怒', '之狂怒', '之兇猛', '之毀滅'],
  }),
  mod({
    id: 'spell_crit', type: 'suffix', text: '增加 {0}% 法術暴擊率', stats: [s('spell_crit_chance', 'inc')],
    spawn: CASTER, scale: STAFF_SCALE,
    tiers: [t(11, 10, 19), t(21, 20, 39), t(28, 40, 59), t(41, 60, 79), t(59, 80, 99), t(76, 100, 109)],
    names: ['之威脅', '之浩劫', '之災難', '之災厄', '之毀壞', '之毀滅'],
  }),
  mod({
    id: 'accuracy', type: 'suffix', text: '+{0} 命中值', stats: [s('accuracy')],
    spawn: ['attack_weapon', 'bow', 'helmet', 'gloves', 'ring', 'quiver', 'amulet'],
    tiers: [t(1, 5, 15), t(12, 16, 60), t(20, 61, 100), t(26, 101, 130), t(33, 131, 165), t(41, 166, 200), t(50, 201, 250), t(63, 251, 320), t(76, 321, 400)],
    names: ['之平靜', '之穩定', '之精準', '之精確', '之狙擊手', '之射手', '之神射手', '之遊俠', '之刺客'],
  }),
  mod({
    id: 'life_regen', type: 'suffix', text: '每秒回復 {0} 生命', stats: [s('life_regen')], decimals: 1,
    spawn: ['amulet', 'ring', 'body_armour', 'helmet', 'shield', 'belt'],
    tiers: [t(1, 1, 2), t(7, 2.1, 8), t(19, 8.1, 16), t(31, 16.1, 24), t(44, 24.1, 32), t(55, 32.1, 48), t(68, 48.1, 64), t(78, 64.1, 80)],
    names: ['之蠑螈', '之蜥蜴', '之扁蟲', '之海星', '之九頭蛇', '之巨魔', '之鳳凰', '之不死'],
  }),
  mod({
    id: 'mana_regen', type: 'suffix', text: '增加 {0}% 魔力回復速度', stats: [s('mana_regen', 'inc')],
    spawn: ['ring', 'amulet', 'shield', ...CASTER], scale: STAFF_SCALE,
    tiers: [t(2, 10, 19), t(18, 20, 29), t(29, 30, 39), t(42, 40, 49), t(55, 50, 59), t(79, 60, 69)],
    names: ['之興奮', '之喜悅', '之興高采烈', '之極樂', '之狂喜', '之涅槃'],
  }),
  mod({
    id: 'life_on_kill', type: 'suffix', text: '每擊殺一名敵人獲得 {0} 生命', stats: [s('life_on_kill')], spawn: ['weapon'],
    tiers: [t(1, 2, 4), t(20, 5, 8), t(40, 9, 14), t(60, 15, 20)],
    names: ['之回春', '之恢復', '之再生', '之滋養'],
  }),
  mod({
    id: 'mana_on_kill', type: 'suffix', text: '每擊殺一名敵人獲得 {0} 魔力', stats: [s('mana_on_kill')], spawn: ['weapon', 'ring'],
    tiers: [t(1, 1, 2), t(20, 3, 4), t(40, 5, 6), t(60, 7, 8)],
    names: ['之吸收', '之滲透', '之吞噬', '之同化'],
  }),
  mod({
    id: 'item_rarity', type: 'suffix', text: '增加 {0}% 物品稀有度', stats: [s('item_rarity', 'inc')],
    spawn: ['helmet', 'gloves', 'boots', 'ring', 'amulet'],
    tiers: [t(2, 6, 10), t(20, 11, 14), t(39, 15, 20), t(53, 21, 26), t(75, 27, 30)],
    names: ['之掠奪', '之突襲', '之考古', '之挖掘', '之橫財'],
  }),
  mod({
    id: 'local_block', type: 'suffix', text: '+{0}% 格擋率', stats: [s('local_block')], spawn: ['shield'],
    tiers: [t(1, 1, 2), t(15, 3, 4), t(30, 5, 6), t(50, 7, 8)],
    names: ['之偏斜', '之招架', '之壁壘', '之要塞'],
  }),
  mod({
    id: 'projectile_speed', type: 'suffix', text: '增加 {0}% 投射物速度', stats: [s('projectile_speed', 'inc')], spawn: ['quiver', 'wand'],
    tiers: [t(10, 10, 17), t(20, 18, 25), t(40, 26, 33), t(60, 34, 40)],
    names: ['之飛翔', '之推進', '之和風', '之疾風'],
  }),
  mod({
    id: 'elemental_damage', type: 'suffix', text: '增加 {0}% 元素傷害', stats: [s('elemental_damage', 'inc')],
    spawn: ['ring', 'amulet', 'belt', 'quiver'],
    tiers: [t(4, 5, 10), t(15, 11, 20), t(30, 21, 30), t(60, 31, 37)],
    names: ['之元素', '之和諧', '之匯聚', '之匯流'],
  }),
  mod({
    id: 'flask_charges_gained', type: 'suffix', text: '增加 {0}% 獲得的藥劑充能', stats: [s('flask_charges', 'inc')], spawn: ['belt'],
    tiers: [t(8, 10, 20), t(30, 21, 30), t(50, 31, 40)],
    names: ['之補充', '之補給', '之豐盛'],
  }),
  mod({
    id: 'ignite_chance', type: 'suffix', group: 'ailment_chance', text: '{0}% 機率點燃', stats: [s('ignite_chance')],
    spawn: ['wand', 'sceptre', 'staff', 'bow', 'dagger'], weight: 500,
    tiers: [t(15, 5, 10), t(35, 11, 15), t(55, 16, 20)], names: ['之點火', '之燃燒', '之大火'],
  }),
  mod({
    id: 'freeze_chance', type: 'suffix', group: 'ailment_chance', text: '{0}% 機率冰凍', stats: [s('freeze_chance')],
    spawn: ['wand', 'sceptre', 'staff', 'bow', 'dagger'], weight: 500,
    tiers: [t(15, 5, 10), t(35, 11, 15), t(55, 16, 20)], names: ['之霜凍', '之白霜', '之冰河'],
  }),
  mod({
    id: 'shock_chance', type: 'suffix', group: 'ailment_chance', text: '{0}% 機率感電', stats: [s('shock_chance')],
    spawn: ['wand', 'sceptre', 'staff', 'bow', 'dagger'], weight: 500,
    tiers: [t(15, 5, 10), t(35, 11, 15), t(55, 16, 20)], names: ['之靜電', '之電壓', '之電刑'],
  }),

  // =========================================================================================
  // FLASK MODS
  // =========================================================================================
  mod({
    id: 'flask_charges_max', type: 'prefix', group: 'flask_charges', text: '+{0} 最大充能', stats: [s('flask_local_charges')],
    spawn: ['flask'], tiers: [t(1, 5, 10), t(20, 11, 15), t(40, 16, 20)], names: ['充沛的', '寬容的', '豐饒的'],
  }),
  mod({
    id: 'flask_charge_use', type: 'prefix', group: 'flask_charges', text: '消耗充能減少 {0}%', stats: [s('flask_local_charge_use', 'inc', 0, -1)],
    spawn: ['flask'], tiers: [t(3, 10, 15), t(20, 16, 20), t(40, 21, 25)], names: ['節儉的', '節省的', '節約的'],
  }),
  mod({
    id: 'flask_duration', type: 'prefix', group: 'flask_main', text: '增加 {0}% 持續時間', stats: [s('flask_local_duration', 'inc')],
    spawn: ['utility_flask'], tiers: [t(5, 15, 20), t(25, 21, 30), t(45, 31, 40)], names: ['延長的', '持續的', '持久的'],
  }),
  mod({
    id: 'flask_instant', type: 'prefix', group: 'flask_main', text: ['立即回復', '回復量減少 {0}%'],
    stats: [fl('flask_local_instant'), s('flask_local_amount', 'inc', 0, -1)],
    spawn: ['recovery_flask'], tiers: [t(10, 25, 25)], names: ['湧動的'],
  }),
  mod({
    id: 'flask_amount', type: 'prefix', group: 'flask_main', text: '增加 {0}% 回復量', stats: [s('flask_local_amount', 'inc')],
    spawn: ['recovery_flask'], tiers: [t(1, 15, 25), t(20, 26, 35), t(40, 36, 45)], names: ['強效的', '濃縮的', '飽和的'],
  }),
  mod({
    id: 'flask_speed', type: 'prefix', group: 'flask_main', text: '增加 {0}% 回復速度', stats: [s('flask_local_speed', 'inc')],
    spawn: ['recovery_flask'], tiers: [t(1, 20, 30), t(22, 31, 45), t(44, 46, 60)], names: ['急速的', '加快的', '加速的'],
  }),
  mod({
    id: 'flask_bleed', type: 'suffix', group: 'flask_suffix', text: '效果期間免疫流血', stats: [fl('flask_local_bleed_immune')],
    spawn: ['flask'], tiers: [{ ilvl: 8, values: [] }], names: ['之止血'],
  }),
  mod({
    id: 'flask_freeze', type: 'suffix', group: 'flask_suffix', text: '效果期間免疫冰凍與冰緩', stats: [fl('flask_local_freeze_immune')],
    spawn: ['flask'], tiers: [{ ilvl: 4, values: [] }], names: ['之解凍'],
  }),
  mod({
    id: 'flask_armour', type: 'suffix', group: 'flask_suffix', text: '增加 {0}% 效果期間的護甲', stats: [s('flask_local_armour', 'inc')],
    spawn: ['flask'], tiers: [t(6, 40, 50), t(30, 51, 60), t(60, 61, 70)], names: ['之鐵膚', '之鋼膚', '之精金皮膚'],
  }),
  mod({
    id: 'flask_evasion', type: 'suffix', group: 'flask_suffix', text: '增加 {0}% 效果期間的閃避值', stats: [s('flask_local_evasion', 'inc')],
    spawn: ['flask'], tiers: [t(6, 40, 50), t(30, 51, 60), t(60, 61, 70)], names: ['之反射', '之本能', '之遠見'],
  }),
  mod({
    id: 'flask_move', type: 'suffix', group: 'flask_suffix', text: '增加 {0}% 效果期間的移動速度', stats: [s('flask_local_move', 'inc')],
    spawn: ['flask'], tiers: [t(5, 6, 8), t(25, 9, 12), t(50, 13, 16)], names: ['之腎上腺素', '之急速', '之迅捷'],
  }),

  // =========================================================================================
  // MAP MODS — make the area harder in exchange for more loot
  // =========================================================================================
  mod({
    id: 'map_life', type: 'prefix', text: '怪物生命總增 {0}%', stats: [s('monster_life', 'more')], spawn: ['map'],
    tiers: [t(1, 30, 40)], names: ['繁衍的'], mapEffect: { target: 'monster', quant: 8, rarity: 4 },
  }),
  mod({
    id: 'map_damage', type: 'prefix', text: '怪物傷害增加 {0}%', stats: [s('monster_damage', 'inc')], spawn: ['map'],
    tiers: [t(1, 20, 30)], names: ['野蠻的'], mapEffect: { target: 'monster', quant: 8, rarity: 5 },
  }),
  mod({
    id: 'map_speed', type: 'prefix', text: '怪物攻擊、施法與移動速度增加 {0}%', stats: [s('monster_speed', 'inc')], spawn: ['map'],
    tiers: [t(1, 15, 20)], names: ['迅捷的'], mapEffect: { target: 'monster', quant: 7, rarity: 4 },
  }),
  mod({
    id: 'map_extra_fire', type: 'prefix', group: 'map_extra', text: '怪物額外造成 {0}% 物理傷害的火焰傷害', stats: [s('phys_as_extra_fire')], spawn: ['map'],
    tiers: [t(1, 40, 50)], names: ['燃燒'], mapEffect: { target: 'monster', quant: 6, rarity: 4 },
  }),
  mod({
    id: 'map_extra_cold', type: 'prefix', group: 'map_extra', text: '怪物額外造成 {0}% 物理傷害的冰冷傷害', stats: [s('phys_as_extra_cold')], spawn: ['map'],
    tiers: [t(1, 40, 50)], names: ['凍結的'], mapEffect: { target: 'monster', quant: 6, rarity: 4 },
  }),
  mod({
    id: 'map_extra_lightning', type: 'prefix', group: 'map_extra', text: '怪物額外造成 {0}% 物理傷害的閃電傷害', stats: [s('phys_as_extra_lightning')], spawn: ['map'],
    tiers: [t(1, 40, 50)], names: ['震撼的'], mapEffect: { target: 'monster', quant: 6, rarity: 4 },
  }),
  mod({
    id: 'map_pack_size', type: 'prefix', text: '+{0}% 怪物群規模', stats: [s('pack_size', 'inc')], spawn: ['map'],
    tiers: [t(1, 15, 25)], names: ['擁擠的'], mapEffect: { target: 'monster', quant: 10, rarity: 0, packSize: 1 },
  }),
  mod({
    id: 'map_armoured', type: 'prefix', text: '怪物 +{0}% 物理傷害減免', stats: [s('phys_damage_reduction')], spawn: ['map'],
    tiers: [t(1, 20, 30)], names: ['重甲'], mapEffect: { target: 'monster', quant: 6, rarity: 3 },
  }),
  mod({
    id: 'map_resistant', type: 'prefix', text: '怪物 +{0}% 全部元素抗性', stats: [s('all_ele_res')], spawn: ['map'],
    tiers: [t(1, 20, 30)], names: ['抗性強化'], mapEffect: { target: 'monster', quant: 6, rarity: 3 },
  }),
  mod({
    id: 'map_exposure', type: 'suffix', text: '玩家 -{0}% 全部元素抗性', stats: [s('all_ele_res', 'flat', 0, -1)], spawn: ['map'],
    tiers: [t(1, 10, 20)], names: ['之曝露'], mapEffect: { target: 'player', quant: 7, rarity: 4 },
  }),
  mod({
    id: 'map_frailty', type: 'suffix', text: '玩家 -{0}% 全部最大元素抗性', stats: [s('max_all_ele_res', 'flat', 0, -1)], spawn: ['map'],
    tiers: [t(1, 5, 10)], names: ['之脆弱'], mapEffect: { target: 'player', quant: 9, rarity: 5 },
  }),
  mod({
    id: 'map_drought', type: 'suffix', text: '玩家獲得的藥劑充能減少 {0}%', stats: [s('flask_charges', 'inc', 0, -1)], spawn: ['map'],
    tiers: [t(1, 30, 50)], names: ['之乾旱'], mapEffect: { target: 'player', quant: 6, rarity: 3 },
  }),
  mod({
    id: 'map_impotence', type: 'suffix', text: '玩家效果範圍總減 {0}%', stats: [s('area_of_effect', 'more', 0, -1)], spawn: ['map'],
    tiers: [t(1, 15, 25)], names: ['之無力'], mapEffect: { target: 'player', quant: 6, rarity: 3 },
  }),
  mod({
    id: 'map_vulnerability', type: 'suffix', text: '玩家承受傷害增加 {0}%', stats: [s('damage_taken', 'inc')], spawn: ['map'],
    tiers: [t(1, 10, 15)], names: ['之易傷'], mapEffect: { target: 'player', quant: 8, rarity: 5 },
  }),
  mod({
    id: 'map_enfeeble', type: 'suffix', text: '玩家傷害總減 {0}%', stats: [s('damage', 'more', 0, -1)], spawn: ['map'],
    tiers: [t(1, 10, 15)], names: ['之衰弱'], mapEffect: { target: 'player', quant: 8, rarity: 5 },
  }),

  // =========================================================================================
  // IMPLICITS (values supplied by the item base)
  // =========================================================================================
  ...(
    [
      ['imp_life', '+{0} 最大生命', [s('life')]],
      ['imp_mana', '+{0} 最大魔力', [s('mana')]],
      ['imp_es', '+{0} 最大能量護盾', [s('energy_shield')]],
      ['imp_fire_res', '+{0}% 火焰抗性', [s('fire_res')]],
      ['imp_cold_res', '+{0}% 冰冷抗性', [s('cold_res')]],
      ['imp_lightning_res', '+{0}% 閃電抗性', [s('lightning_res')]],
      ['imp_chaos_res', '+{0}% 混沌抗性', [s('chaos_res')]],
      ['imp_fire_cold_res', '+{0}% 火焰與冰冷抗性', [s('fire_res'), s('cold_res')]],
      ['imp_all_res', '+{0}% 全部元素抗性', [s('all_ele_res')]],
      ['imp_rarity', '增加 {0}% 物品稀有度', [s('item_rarity', 'inc')]],
      ['imp_crit_chance', '增加 {0}% 全域暴擊率', [s('crit_chance', 'inc')]],
      ['imp_attack_phys', '附加 {0} - {1} 物理傷害（攻擊）', [s('attack_phys_min', 'flat', 0), s('attack_phys_max', 'flat', 1)]],
      ['imp_attack_fire', '附加 {0} - {1} 火焰傷害（攻擊）', [s('attack_fire_min', 'flat', 0), s('attack_fire_max', 'flat', 1)]],
      ['imp_life_regen', '每秒回復 {0} 生命', [s('life_regen')]],
      ['imp_mana_regen', '增加 {0}% 魔力回復速度', [s('mana_regen', 'inc')]],
      ['imp_str', '+{0} 力量', [s('str')]],
      ['imp_dex', '+{0} 敏捷', [s('dex')]],
      ['imp_int', '+{0} 智慧', [s('int')]],
      ['imp_str_int', '+{0} 力量與智慧', [s('str'), s('int')]],
      ['imp_str_dex', '+{0} 力量與敏捷', [s('str'), s('dex')]],
      ['imp_dex_int', '+{0} 敏捷與智慧', [s('dex'), s('int')]],
      ['imp_all_attr', '+{0} 全屬性', [s('all_attributes')]],
      ['imp_phys_damage', '增加 {0}% 全域物理傷害', [s('phys_damage', 'inc')]],
      ['imp_flask_effect', '增加 {0}% 藥劑效果持續時間', [s('flask_duration', 'inc')]],
      ['imp_spell_damage', '增加 {0}% 法術傷害', [s('spell_damage', 'inc')]],
      ['imp_elemental_damage', '增加 {0}% 元素傷害', [s('elemental_damage', 'inc')]],
      ['imp_accuracy', '+{0} 命中值', [s('accuracy')]],
      ['imp_life_on_hit', '每擊中一名敵人獲得 {0} 生命', [s('life_on_hit')]],
      ['imp_block', '+{0}% 攻擊格擋率', [s('block')]],
      ['imp_proj_speed', '增加 {0}% 投射物速度', [s('projectile_speed', 'inc')]],
    ] as [string, string, ModStat[]][]
  ).map(([id, text, stats]) => mod({ id, type: 'implicit', text, stats, spawn: [], tiers: [t(1, 0, 0)] })),

  // =========================================================================================
  // CORRUPTED IMPLICITS
  // =========================================================================================
  mod({ id: 'cor_gem_level', type: 'corrupted', text: '+{0} 插槽寶石等級', stats: [s('socketed_gem_level')], spawn: ['body_armour', 'helmet', 'weapon', 'shield'], tiers: [t(1, 1, 1)] }),
  mod({ id: 'cor_life_pct', type: 'corrupted', text: '增加 {0}% 最大生命', stats: [s('life', 'inc')], spawn: ['amulet', 'belt', 'body_armour'], tiers: [t(1, 4, 7)] }),
  mod({ id: 'cor_max_res', type: 'corrupted', text: '+{0}% 全部最大元素抗性', stats: [s('max_all_ele_res')], spawn: ['shield', 'body_armour'], weight: 300, tiers: [t(1, 1, 2)] }),
  mod({ id: 'cor_attack_speed', type: 'corrupted', text: '增加 {0}% 攻擊速度', stats: [s('attack_speed', 'inc')], spawn: ['gloves', 'quiver', 'weapon'], tiers: [t(1, 6, 10)] }),
  mod({ id: 'cor_move', type: 'corrupted', text: '增加 {0}% 移動速度', stats: [s('movement_speed', 'inc')], spawn: ['boots'], tiers: [t(1, 5, 10)] }),
  mod({ id: 'cor_all_res', type: 'corrupted', text: '+{0}% 全部元素抗性', stats: [s('all_ele_res')], spawn: ['ring', 'amulet', 'belt', 'helmet', 'boots', 'gloves'], tiers: [t(1, 8, 16)] }),
  mod({ id: 'cor_damage', type: 'corrupted', text: '增加 {0}% 傷害', stats: [s('damage', 'inc')], spawn: ['ring', 'amulet', 'weapon'], tiers: [t(1, 10, 20)] }),
  mod({ id: 'cor_crit', type: 'corrupted', text: '增加 {0}% 全域暴擊率', stats: [s('crit_chance', 'inc')], spawn: ['weapon', 'amulet', 'quiver', 'helmet'], tiers: [t(1, 20, 30)] }),
  mod({ id: 'cor_es', type: 'corrupted', text: '+{0} 最大能量護盾', stats: [s('energy_shield')], spawn: ['helmet', 'gloves', 'boots', 'ring'], tiers: [t(1, 20, 40)] }),
  mod({ id: 'cor_phys_red', type: 'corrupted', text: '額外 {0}% 物理傷害減免', stats: [s('phys_damage_reduction')], spawn: ['body_armour', 'shield', 'belt'], tiers: [t(1, 2, 4)] }),
  mod({ id: 'cor_projectiles', type: 'corrupted', text: '技能額外發射 1 個投射物', stats: [s('additional_projectiles')], spawn: ['quiver', 'wand', 'bow'], weight: 200, tiers: [t(1, 1, 1)] }),
  mod({ id: 'cor_aoe', type: 'corrupted', text: '增加 {0}% 效果範圍', stats: [s('area_of_effect', 'inc')], spawn: ['amulet', 'gloves', 'helmet', 'weapon'], tiers: [t(1, 8, 15)] }),
];

const registry = new Map<string, ModDef>();
for (const m of AFFIXES) {
  if (registry.has(m.id)) throw new Error(`Duplicate mod id ${m.id}`);
  registry.set(m.id, m);
}

export function registerMods(mods: ModDef[]): void {
  for (const m of mods) {
    if (registry.has(m.id)) throw new Error(`Duplicate mod id ${m.id}`);
    registry.set(m.id, m);
  }
}

export function getMod(id: string): ModDef {
  const m = registry.get(id);
  if (!m) throw new Error(`Unknown mod: ${id}`);
  return m;
}

export function allMods(): ModDef[] {
  return [...registry.values()];
}

export { mod as defineMod, t as tier, t2 as tier2, s as modStat, fl as modFlag };
