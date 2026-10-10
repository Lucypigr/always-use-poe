import { flag, flat, inc, more, type StatKey, type StatMod } from '../stats/stats';

/** Compact modifier DSL that also generates the Traditional Chinese description text. */

// ------------------------------------------------------------------------------------------
// Compact modifier DSL with auto-generated Traditional Chinese text
// ------------------------------------------------------------------------------------------

export type Fx = { mod: StatMod; text: string };

const LABEL: Partial<Record<StatKey, string>> = {
  life: '最大生命', mana: '最大魔力', energy_shield: '最大能量護盾', armour: '護甲', evasion: '閃避值',
  damage: '傷害', phys_damage: '物理傷害', fire_damage: '火焰傷害', cold_damage: '冰冷傷害', lightning_damage: '閃電傷害',
  chaos_damage: '混沌傷害', elemental_damage: '元素傷害', spell_damage: '法術傷害', attack_damage: '攻擊傷害',
  melee_damage: '近戰傷害', projectile_damage: '投射物傷害', area_damage: '範圍傷害', burning_damage: '燃燒傷害',
  bleed_damage: '流血傷害', poison_damage: '中毒傷害', minion_damage: '召喚物傷害', minion_life: '召喚物最大生命',
  minion_speed: '召喚物攻擊與移動速度', attack_speed: '攻擊速度', cast_speed: '施放速度', movement_speed: '移動速度',
  projectile_speed: '投射物速度', crit_chance: '暴擊率', spell_crit_chance: '法術暴擊率', accuracy: '命中值',
  area_of_effect: '效果範圍', damage_taken: '承受傷害', aura_effect: '光環效果', reservation: '魔力保留量',
  mana_regen: '魔力回復速度', es_recharge: '能量護盾充能速度', es_recharge_delay: '能量護盾開始充能的延遲',
  flask_charges: '獲得的藥劑充能', flask_duration: '藥劑效果持續時間', flask_recovery: '藥劑回復量',
  shock_effect: '感電效果', melee_phys_damage: '近戰物理傷害',
  // flat stats
  str: '力量', dex: '敏捷', int: '智慧', crit_multi: '暴擊傷害加成', block: '格擋機率',
  fire_res: '火焰抗性', cold_res: '冰冷抗性', lightning_res: '閃電抗性', chaos_res: '混沌抗性', all_ele_res: '所有元素抗性',
  max_all_ele_res: '所有元素抗性上限', phys_damage_reduction: '額外物理傷害減免',
};

/** Flat stats that are shown as a percentage (`+12%`), and their text where it isn't "+N label". */
const FLAT_PCT = new Set<StatKey>(['crit_multi', 'block', 'fire_res', 'cold_res', 'lightning_res', 'chaos_res', 'all_ele_res', 'max_all_ele_res', 'phys_damage_reduction']);
const FLAT_TEXT: Partial<Record<StatKey, (v: number) => string>> = {
  life_regen_pct: (v) => `每秒回復 ${v}% 最大生命`,
  life_leech: (v) => `${v}% 攻擊傷害轉化為生命偷取`,
  life_on_kill: (v) => `每擊殺一名敵人獲得 ${v} 生命`,
  mana_on_kill: (v) => `每擊殺一名敵人獲得 ${v} 魔力`,
  additional_projectiles: (v) => `額外發射 ${v} 個投射物`,
  pierce: (v) => `投射物可穿透 ${v} 個目標`,
  chain: (v) => `投射物額外連鎖 ${v} 次`,
  minion_count: (v) => `你的召喚物上限 +${v}`,
  poison_chance: (v) => `${v}% 機率使擊中的敵人中毒`,
  bleed_chance: (v) => `${v}% 機率使擊中的敵人流血`,
  ignite_chance: (v) => `${v}% 機率點燃敵人`,
  freeze_chance: (v) => `${v}% 機率冰凍敵人`,
  shock_chance: (v) => `${v}% 機率使敵人感電`,
  fire_pen: (v) => `火焰傷害穿透 ${v}% 火焰抗性`,
  cold_pen: (v) => `冰冷傷害穿透 ${v}% 冰冷抗性`,
  lightning_pen: (v) => `閃電傷害穿透 ${v}% 閃電抗性`,
  phys_as_extra_fire: (v) => `獲得相當於物理傷害 ${v}% 的額外火焰傷害`,
  ele_as_extra_chaos: (v) => `獲得相當於元素傷害 ${v}% 的額外混沌傷害`,
};

export const I = (stat: StatKey, v: number): Fx => ({
  mod: inc(stat, v),
  text: v >= 0 ? `增加 ${v}% ${LABEL[stat]}` : `減少 ${-v}% ${LABEL[stat]}`,
});
export const M = (stat: StatKey, v: number): Fx => ({
  mod: more(stat, v),
  text: v >= 0 ? `總增 ${v}% ${LABEL[stat]}` : `總減 ${-v}% ${LABEL[stat]}`,
});
export const F = (stat: StatKey, v: number): Fx => ({
  mod: flat(stat, v),
  text: FLAT_TEXT[stat]?.(v) ?? (FLAT_PCT.has(stat) ? `+${v}% ${LABEL[stat]}` : `+${v} ${LABEL[stat]}`),
});
export const CULL: Fx = { mod: flag('culling_strike'), text: '擊中使敵人生命低於 10% 時直接擊殺' };

