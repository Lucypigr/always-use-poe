import type { ModKind, StatKey } from '../stats/stats';
import { defineMod, modStat, registerMods, tier, type ModDef } from './affixes';
import { F, I, type Fx } from './fx';

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

// ---------------------------------------------------------------------------------------------
// Radius jewels: boost the allocated passives around the socket
// ---------------------------------------------------------------------------------------------

/** World-space radius (in passive tree units) of radius jewels. */
export const JEWEL_RADIUS = 320;

/** Radius effect id → which kind of passive nodes it boosts. */
export const RADIUS_MODS: Record<string, 'small' | 'attr' | 'notable'> = { jr_small: 'small', jr_attr: 'attr', jr_notable: 'notable' };

registerMods([
  defineMod({ id: 'jr_small', type: 'unique', text: '半徑內已配置的小天賦，效果提高 {0}%', stats: [], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'jr_attr', type: 'unique', text: '半徑內已配置的屬性天賦，效果提高 {0}%', stats: [], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'jr_notable', type: 'unique', text: '半徑內已配置的顯著天賦，效果提高 {0}%', stats: [], spawn: [], tiers: [tier(1, 0, 0)] }),
]);

// ---------------------------------------------------------------------------------------------
// Cluster jewels: a bundle of small passives and notables
// ---------------------------------------------------------------------------------------------

export interface ClusterTheme {
  id: string;
  name: string;
  small: Fx[];
  notables: { name: string; fx: Fx[] }[];
}

export const CLUSTER_THEMES: ClusterTheme[] = [
  { id: 'vitality', name: '活力', small: [I('life', 4)], notables: [
    { name: '勃發生機', fx: [I('life', 10), F('life_regen_pct', 0.4)] },
    { name: '血脈沸騰', fx: [I('life', 8), I('damage', 8)] },
    { name: '堅毅之心', fx: [I('life', 12), I('damage_taken', -3)] },
    { name: '蓄血', fx: [I('life', 8), F('life_on_kill', 8)] },
  ] },
  { id: 'fortress', name: '堡壘', small: [I('armour', 15)], notables: [
    { name: '鐵壁', fx: [I('armour', 35), F('phys_damage_reduction', 2)] },
    { name: '拒敵於外', fx: [F('block', 4), I('armour', 25)] },
    { name: '抵禦元素', fx: [F('all_ele_res', 6), I('armour', 20)] },
    { name: '無畏', fx: [I('life', 6), I('armour', 25)] },
  ] },
  { id: 'duelist', name: '決鬥', small: [I('melee_damage', 8)], notables: [
    { name: '利刃共鳴', fx: [I('melee_damage', 18), I('attack_speed', 4)] },
    { name: '破甲', fx: [I('phys_damage', 18), F('crit_multi', 10)] },
    { name: '嗜血', fx: [F('life_leech', 0.3), I('attack_damage', 10)] },
    { name: '連擊大師', fx: [I('attack_speed', 6), I('accuracy', 20)] },
  ] },
  { id: 'arcane', name: '奧術', small: [I('spell_damage', 8)], notables: [
    { name: '法力奔流', fx: [I('spell_damage', 18), I('mana', 8)] },
    { name: '咒文加速', fx: [I('cast_speed', 6), I('spell_damage', 10)] },
    { name: '奧術精通', fx: [I('spell_crit_chance', 30), F('crit_multi', 10)] },
    { name: '護盾共鳴', fx: [I('energy_shield', 15), I('es_recharge', 20)] },
  ] },
  { id: 'elements', name: '元素', small: [I('elemental_damage', 8)], notables: [
    { name: '烈焰之舞', fx: [I('fire_damage', 20), F('ignite_chance', 10)] },
    { name: '冰封千里', fx: [I('cold_damage', 20), F('freeze_chance', 10)] },
    { name: '雷鳴', fx: [I('lightning_damage', 20), F('shock_chance', 10)] },
    { name: '元素穿透', fx: [F('fire_pen', 4), F('cold_pen', 4), F('lightning_pen', 4)] },
  ] },
  { id: 'assassin', name: '暗殺', small: [I('crit_chance', 12)], notables: [
    { name: '致命洞察', fx: [I('crit_chance', 28), F('crit_multi', 12)] },
    { name: '一擊必殺', fx: [F('crit_multi', 25)] },
    { name: '迅影', fx: [I('movement_speed', 3), I('evasion', 20)] },
    { name: '淬毒', fx: [F('poison_chance', 10), I('poison_damage', 15)] },
  ] },
  { id: 'necro', name: '亡靈', small: [I('minion_damage', 8)], notables: [
    { name: '亡者之力', fx: [I('minion_damage', 18), I('minion_life', 15)] },
    { name: '疾行亡靈', fx: [I('minion_speed', 10), I('minion_life', 12)] },
    { name: '軍團統領', fx: [I('minion_damage', 12), I('life', 5)] },
    { name: '骸骨之盾', fx: [I('minion_life', 25)] },
  ] },
  { id: 'wild', name: '荒野', small: [I('evasion', 15)], notables: [
    { name: '獵手本能', fx: [I('projectile_damage', 15), I('accuracy', 25)] },
    { name: '輕盈', fx: [I('evasion', 30), I('movement_speed', 3)] },
    { name: '藥師', fx: [I('flask_charges', 15), I('flask_recovery', 10)] },
    { name: '百步穿楊', fx: [I('projectile_damage', 20), I('projectile_speed', 10)] },
  ] },
];

export const CLUSTER_THEME_BY_ID = Object.fromEntries(CLUSTER_THEMES.map((t) => [t.id, t])) as Record<string, ClusterTheme>;

/** Cluster jewel sizes: how many small passives and notables they grant. */
export const CLUSTER_SIZES: Record<string, { smalls: number; notables: number }> = {
  jewel_cluster_s: { smalls: 2, notables: 1 },
  jewel_cluster_m: { smalls: 4, notables: 2 },
  jewel_cluster_l: { smalls: 6, notables: 3 },
};

/** Everything a cluster jewel gives: `count` copies of the small stat plus its notables. */
export function clusterEffects(c: { theme: string; notables: string[] }, size: { smalls: number }): { name: string; fx: Fx[] }[] {
  const theme = CLUSTER_THEME_BY_ID[c.theme];
  if (!theme) return [];
  const out: { name: string; fx: Fx[] }[] = [];
  out.push({ name: `${size.smalls} 個小天賦`, fx: theme.small.map((f) => ({ mod: { ...f.mod, value: f.mod.value * size.smalls }, text: scaleText(f, size.smalls) })) });
  for (const n of c.notables) {
    const nd = theme.notables.find((x) => x.name === n);
    if (nd) out.push(nd);
  }
  return out;
}

function scaleText(f: Fx, n: number): string {
  return f.text.replace(/(\d+(?:\.\d+)?)/, (m) => String(Math.round(Number(m) * n * 10) / 10));
}

// ---------------------------------------------------------------------------------------------
// Abyss jewels: socketed into the abyssal sockets of gear
// ---------------------------------------------------------------------------------------------

/** Gear classes that can roll abyssal sockets. */
export const ABYSS_SOCKET_CLASSES = ['helmet', 'body_armour', 'gloves', 'boots', 'belt'];

function ab(
  id: string,
  type: 'prefix' | 'suffix',
  text: string,
  stat: StatKey,
  kind: ModKind,
  ranges: Range3,
  names: [string, string, string],
): ModDef {
  return defineMod({
    id: `ab_${id}`, type, text, stats: [modStat(stat, kind)], spawn: ['abyss_jewel'],
    tiers: ranges.map(([lo, hi], i) => tier(ILVL[i], lo, hi)), names,
  });
}

export const ABYSS_MODS: ModDef[] = [
  ab('life', 'prefix', '+{0} 最大生命', 'life', 'flat', [[12, 18], [25, 35], [40, 55]], ['深邃的', '黑暗的', '無底的']),
  ab('mana', 'prefix', '+{0} 最大魔力', 'mana', 'flat', [[10, 16], [20, 30], [34, 46]], ['幽暗的', '暗湧的', '無光的']),
  ab('armour', 'prefix', '+{0} 護甲', 'armour', 'flat', [[30, 50], [70, 110], [130, 200]], ['堅冷的', '漆黑的', '深淵的']),
  ab('evasion', 'prefix', '+{0} 閃避值', 'evasion', 'flat', [[30, 50], [70, 110], [130, 200]], ['潛伏的', '暗影的', '虛無的']),
  ab('es', 'prefix', '+{0} 最大能量護盾', 'energy_shield', 'flat', [[8, 14], [18, 28], [32, 46]], ['昏光的', '幽光的', '冥光的']),
  ab('attack_speed', 'suffix', '增加 {0}% 攻擊速度', 'attack_speed', 'inc', [[2, 3], [4, 5], [6, 7]], ['之饑渴', '之狂躁', '之貪婪']),
  ab('cast_speed', 'suffix', '增加 {0}% 施放速度', 'cast_speed', 'inc', [[2, 3], [4, 5], [6, 7]], ['之低語', '之呢喃', '之嘶吼']),
  ab('crit_chance', 'suffix', '增加 {0}% 全域暴擊率', 'crit_chance', 'inc', [[8, 12], [13, 17], [18, 22]], ['之陰影', '之刺痛', '之絕望']),
  ab('movement', 'suffix', '增加 {0}% 移動速度', 'movement_speed', 'inc', [[1, 2], [3, 4], [5, 6]], ['之潛行', '之疾行', '之暗影步']),
  ab('life_on_kill', 'suffix', '每擊殺一名敵人獲得 {0} 生命', 'life_on_kill', 'flat', [[3, 5], [6, 9], [10, 14]], ['之吞噬', '之饕餮', '之獻祭']),
  ab('res', 'suffix', '+{0}% 全部元素抗性', 'all_ele_res', 'flat', [[3, 4], [5, 6], [7, 8]], ['之屏障', '之結界', '之帷幕']),
  ab('str', 'suffix', '+{0} 力量', 'str', 'flat', [[8, 12], [14, 18], [20, 26]], ['之蠻荒', '之巨怪', '之泰坦']),
  ab('dex', 'suffix', '+{0} 敏捷', 'dex', 'flat', [[8, 12], [14, 18], [20, 26]], ['之爪牙', '之獵影', '之幽魅']),
  ab('int', 'suffix', '+{0} 智慧', 'int', 'flat', [[8, 12], [14, 18], [20, 26]], ['之禁忌', '之異象', '之玄祕']),
];

registerMods(ABYSS_MODS);
