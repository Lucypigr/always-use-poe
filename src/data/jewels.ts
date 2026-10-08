import type { ModKind, StatKey } from '../stats/stats';
import { defineMod, modStat, registerMods, tier, type ModDef } from './affixes';

/**
 * Jewel affixes. Jewels are socketed into the jewel sockets of the passive tree and grant
 * their (global) modifiers while that socket is allocated. Magic jewels have 1 prefix and
 * 1 suffix, rare jewels up to 2 + 2. Three tiers, gated by item level.
 */

type Range3 = [[number, number], [number, number], [number, number]];
const ILVL: [number, number, number] = [1, 40, 68];

function jw(
  id: string,
  type: 'prefix' | 'suffix',
  text: string,
  stat: StatKey,
  kind: ModKind,
  ranges: Range3,
  names: [string, string, string],
  decimals = 0,
): ModDef {
  return defineMod({
    id: `jw_${id}`, type, text, stats: [modStat(stat, kind)], spawn: ['jewel'],
    tiers: ranges.map(([lo, hi], i) => tier(ILVL[i], lo, hi)), names, decimals: decimals || undefined,
  });
}

const DMG: Range3 = [[8, 10], [11, 13], [14, 16]];
const DEF: Range3 = [[10, 14], [15, 19], [20, 24]];
const RES: Range3 = [[5, 8], [9, 12], [13, 16]];
const ATTR: Range3 = [[6, 8], [9, 11], [12, 14]];

export const JEWEL_MODS: ModDef[] = [
  // ---- prefixes ----
  jw('phys', 'prefix', '增加 {0}% 物理傷害', 'phys_damage', 'inc', DMG, ['粗獷的', '凶暴的', '殘暴的']),
  jw('fire', 'prefix', '增加 {0}% 火焰傷害', 'fire_damage', 'inc', DMG, ['灼熱的', '燃燒的', '烈焰的']),
  jw('cold', 'prefix', '增加 {0}% 冰冷傷害', 'cold_damage', 'inc', DMG, ['寒涼的', '冰凍的', '極寒的']),
  jw('lightning', 'prefix', '增加 {0}% 閃電傷害', 'lightning_damage', 'inc', DMG, ['帶電的', '放電的', '雷霆的']),
  jw('chaos', 'prefix', '增加 {0}% 混沌傷害', 'chaos_damage', 'inc', DMG, ['腐敗的', '汙穢的', '虛空的']),
  jw('melee', 'prefix', '增加 {0}% 近戰傷害', 'melee_damage', 'inc', DMG, ['好鬥的', '兇猛的', '嗜殺的']),
  jw('projectile', 'prefix', '增加 {0}% 投射物傷害', 'projectile_damage', 'inc', DMG, ['迅疾的', '穿雲的', '貫日的']),
  jw('spell', 'prefix', '增加 {0}% 法術傷害', 'spell_damage', 'inc', DMG, ['奧秘的', '神祕的', '大法師的']),
  jw('minion', 'prefix', '增加 {0}% 召喚物傷害', 'minion_damage', 'inc', DMG, ['馴服的', '忠誠的', '亡者的']),
  jw('life', 'prefix', '增加 {0}% 最大生命', 'life', 'inc', [[3, 4], [5, 6], [7, 8]], ['強壯的', '堅韌的', '不朽的']),
  jw('es', 'prefix', '增加 {0}% 最大能量護盾', 'energy_shield', 'inc', DEF, ['微光的', '閃耀的', '輝煌的']),
  jw('armour', 'prefix', '增加 {0}% 護甲', 'armour', 'inc', DEF, ['堅硬的', '厚重的', '不破的']),
  jw('evasion', 'prefix', '增加 {0}% 閃避值', 'evasion', 'inc', DEF, ['靈巧的', '飄忽的', '虛幻的']),
  // ---- suffixes ----
  jw('attack_speed', 'suffix', '增加 {0}% 攻擊速度', 'attack_speed', 'inc', [[2, 3], [4, 5], [6, 7]], ['之迅捷', '之敏捷', '之疾風']),
  jw('cast_speed', 'suffix', '增加 {0}% 施放速度', 'cast_speed', 'inc', [[2, 3], [4, 5], [6, 7]], ['之專注', '之流暢', '之共鳴']),
  jw('crit_chance', 'suffix', '增加 {0}% 全域暴擊率', 'crit_chance', 'inc', [[8, 12], [13, 17], [18, 22]], ['之針刺', '之穿刺', '之切開']),
  jw('crit_multi', 'suffix', '+{0}% 暴擊傷害加成', 'crit_multi', 'flat', [[6, 8], [9, 11], [12, 14]], ['之痛楚', '之折磨', '之處決']),
  jw('accuracy', 'suffix', '增加 {0}% 命中值', 'accuracy', 'inc', [[6, 9], [10, 14], [15, 20]], ['之穩定', '之精準', '之神射']),
  jw('fire_res', 'suffix', '+{0}% 火焰抗性', 'fire_res', 'flat', RES, ['之餘燼', '之熔爐', '之煉獄']),
  jw('cold_res', 'suffix', '+{0}% 冰冷抗性', 'cold_res', 'flat', RES, ['之霜', '之寒冬', '之永凍']),
  jw('lightning_res', 'suffix', '+{0}% 閃電抗性', 'lightning_res', 'flat', RES, ['之靜電', '之風暴', '之雷霆']),
  jw('chaos_res', 'suffix', '+{0}% 混沌抗性', 'chaos_res', 'flat', [[4, 6], [7, 9], [10, 12]], ['之潔淨', '之淨化', '之聖潔']),
  jw('str', 'suffix', '+{0} 力量', 'str', 'flat', ATTR, ['之力', '之蠻力', '之巨人']),
  jw('dex', 'suffix', '+{0} 敏捷', 'dex', 'flat', ATTR, ['之巧手', '之靈巧', '之迅影']),
  jw('int', 'suffix', '+{0} 智慧', 'int', 'flat', ATTR, ['之學徒', '之睿智', '之全知']),
  jw('life_regen', 'suffix', '每秒回復 {0}% 最大生命', 'life_regen_pct', 'flat', [[0.2, 0.3], [0.4, 0.5], [0.6, 0.7]], ['之癒合', '之再生', '之復甦'], 1),
  jw('mana_regen', 'suffix', '增加 {0}% 魔力回復速度', 'mana_regen', 'inc', [[8, 12], [13, 17], [18, 22]], ['之寧靜', '之湧泉', '之源泉']),
  jw('flask_charges', 'suffix', '增加 {0}% 獲得的藥劑充能', 'flask_charges', 'inc', [[8, 12], [13, 17], [18, 22]], ['之收集', '之煉金', '之豐盛']),
  jw('aoe', 'suffix', '增加 {0}% 效果範圍', 'area_of_effect', 'inc', [[4, 5], [6, 7], [8, 10]], ['之擴散', '之蔓延', '之席捲']),
  jw('ailment_duration', 'suffix', '增加 {0}% 異常狀態持續時間', 'ailment_duration', 'inc', [[5, 7], [8, 10], [11, 14]], ['之纏繞', '之侵蝕', '之折磨']),
  jw('item_rarity', 'suffix', '增加 {0}% 物品稀有度', 'item_rarity', 'inc', [[4, 6], [7, 9], [10, 12]], ['之機運', '之幸運', '之財富']),
];

registerMods(JEWEL_MODS);
