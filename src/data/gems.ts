import type { WeaponClass } from '../items/types';
import { flag, flat, inc, more, type DamageType, type StatMod } from '../stats/stats';
import { lvl, spellDamage } from './scaling';

/**
 * Skill gems and support gems.
 *
 * Active gems grant a skill while socketed in equipped gear. Support gems modify every
 * active gem they are *linked* to, provided the active skill has a matching tag.
 * Gems level up from experience and have quality, exactly like Path of Exile.
 */

export type SkillTag =
  | 'attack' | 'spell' | 'melee' | 'projectile' | 'area' | 'fire' | 'cold' | 'lightning' | 'physical' | 'chaos'
  | 'duration' | 'movement' | 'aura' | 'minion' | 'bow' | 'strike' | 'slam' | 'chaining' | 'nova';

export type BehaviourId =
  | 'melee' | 'slam' | 'strike_projectile' | 'leap' | 'dash' | 'projectile' | 'nova' | 'chain' | 'rain'
  | 'summon' | 'blink' | 'aura';

export type GemColor = 'R' | 'G' | 'B';

export interface ActiveSkillDef {
  behaviour: BehaviourId;
  /** Spells: base cast time in seconds. */
  castTime?: number;
  /** Attacks: multiplier applied to weapon attack speed. */
  attackSpeedMult?: number;
  /** Attacks: % of base weapon damage dealt at gem level 1 and 20. */
  weaponDamage?: [number, number];
  /** Spells: damage split per type as [minMult, maxMult] of the spell damage curve. */
  baseDamage?: Partial<Record<DamageType, [number, number]>>;
  /** Spells: overall multiplier on the spell damage curve. */
  damageScale?: number;
  /** Spells: added damage effectiveness. */
  effectiveness?: number;
  /** Spells: base critical strike chance (%). */
  crit?: number;
  /** Mana cost at gem level 1 and 20. */
  manaCost: [number, number];
  /** Auras: percentage of maximum mana reserved. */
  reservation?: number;
  /** Behaviour parameters (radius, projectile count, speed…). */
  params: Record<string, number>;
  /** Stats intrinsic to the skill at a given gem level (e.g. aura buffs). */
  levelStats?: (level: number) => StatMod[];
  /** Human readable per-level description lines. */
  levelText?: (level: number) => string[];
  /** Physical damage converted to another type (%). */
  conversion?: Partial<Record<'fire' | 'cold' | 'lightning' | 'chaos', number>>;
  /** Weapon restriction. */
  weapons?: WeaponClass[];
  /** Aura stats also apply to allies (minions). */
  auraAffectsAllies?: boolean;
}

export interface SupportDef {
  anyOf: SkillTag[];
  noneOf?: SkillTag[];
  manaMult: number;
  stats: (level: number) => StatMod[];
  text: (level: number) => string[];
}

export interface GemDef {
  id: string;
  name: string;
  color: GemColor;
  tags: SkillTag[];
  /** Character level required at gem level 1. */
  reqLevel: number;
  description: string;
  active?: ActiveSkillDef;
  support?: SupportDef;
  /** Stats granted per 1% quality. */
  quality: StatMod[];
  qualityText: string;
  /** Relative drop weight. */
  dropWeight?: number;
}

const r = Math.round;
const L = (a: number, b: number) => (level: number) => r(lvl(a, b, level));
const pct = (v: number) => `${v}%`;

const BOW: WeaponClass[] = ['bow'];

export const GEMS: GemDef[] = [
  // ============================================================================ STRENGTH (red)
  {
    id: 'crushing_blow', name: '粉碎重擊', color: 'R', reqLevel: 1,
    tags: ['attack', 'melee', 'strike', 'physical'],
    description: '以毀滅性的一擊打擊單一敵人並將其擊退。',
    active: {
      behaviour: 'melee', weaponDamage: [150, 260], manaCost: [5, 9], params: { arc: 0 },
      levelStats: () => [flag('knockback')],
      levelText: (l) => [`造成 ${L(150, 260)(l)}% 基礎攻擊傷害`, '擊中時擊退敵人'],
    },
    quality: [inc('damage', 1)], qualityText: '增加 {0}% 傷害',
  },
  {
    id: 'sweeping_cleave', name: '橫掃劈砍', color: 'R', reqLevel: 1,
    tags: ['attack', 'melee', 'area', 'physical'],
    description: '大範圍揮擊，命中面前所有敵人。',
    active: {
      behaviour: 'melee', weaponDamage: [95, 155], attackSpeedMult: 0.95, manaCost: [6, 10], params: { arc: 170, radius: 2.4 },
      levelText: (l) => [`造成 ${L(95, 155)(l)}% 基礎攻擊傷害`],
    },
    quality: [inc('area_of_effect', 0.5)], qualityText: '增加 {0}% 效果範圍',
  },
  {
    id: 'earthshatter', name: '震地', color: 'R', reqLevel: 12,
    tags: ['attack', 'melee', 'area', 'slam', 'physical'],
    description: '重擊地面，向錐形範圍的敵人發出衝擊波。',
    active: {
      behaviour: 'slam', weaponDamage: [145, 235], attackSpeedMult: 0.8, manaCost: [8, 14], params: { angle: 50, length: 5.5 },
      levelText: (l) => [`造成 ${L(145, 235)(l)}% 基礎攻擊傷害`],
    },
    quality: [inc('area_damage', 1)], qualityText: '增加 {0}% 範圍傷害',
  },
  {
    id: 'magma_strike', name: '熔岩打擊', color: 'R', reqLevel: 1,
    tags: ['attack', 'melee', 'projectile', 'area', 'fire'],
    description: '打擊敵人並將部分傷害轉為火焰，同時噴出會在附近爆炸的熔岩球。',
    active: {
      behaviour: 'strike_projectile', weaponDamage: [110, 175], manaCost: [6, 10], conversion: { fire: 60 },
      params: { count: 3, explodeRadius: 1.4, mode: 1 },
      levelStats: (l) => (l >= 10 ? [flat('additional_projectiles', l >= 20 ? 2 : 1)] : []),
      levelText: (l) => [`造成 ${L(110, 175)(l)}% 基礎攻擊傷害`, '60% 物理傷害轉換為火焰傷害', `噴出 ${3 + (l >= 20 ? 2 : l >= 10 ? 1 : 0)} 顆熔岩投射物`],
    },
    quality: [inc('projectile_damage', 1)], qualityText: '增加 {0}% 投射物傷害',
  },
  {
    id: 'leap_slam', name: '躍擊', color: 'R', reqLevel: 10,
    tags: ['attack', 'melee', 'area', 'slam', 'movement'],
    description: '躍向目標位置，對落地處的敵人造成傷害。',
    active: {
      behaviour: 'leap', weaponDamage: [100, 150], attackSpeedMult: 0.8, manaCost: [10, 15], params: { radius: 2.2, maxDist: 9 },
      levelText: (l) => [`造成 ${L(100, 150)(l)}% 基礎攻擊傷害`],
    },
    quality: [inc('attack_speed', 0.5)], qualityText: '增加 {0}% 攻擊速度',
  },
  {
    id: 'bulwark', name: '壁壘', color: 'R', reqLevel: 24,
    tags: ['aura', 'area'],
    description: '施放光環，給予你額外護甲。',
    active: {
      behaviour: 'aura', manaCost: [0, 0], reservation: 50, params: {},
      levelStats: (l) => [flat('armour', L(60, 900)(l)), more('armour', L(20, 32)(l))],
      levelText: (l) => [`+${L(60, 900)(l)} 護甲`, `總增 ${L(20, 32)(l)}% 護甲`],
    },
    quality: [inc('armour', 1)], qualityText: '增加 {0}% 護甲',
  },
  {
    id: 'ashen_fury', name: '灰燼之怒', color: 'R', reqLevel: 24,
    tags: ['aura', 'area', 'fire'],
    description: '施放光環，使你的攻擊與法術附加火焰傷害。',
    active: {
      behaviour: 'aura', manaCost: [0, 0], reservation: 50, params: {}, auraAffectsAllies: true,
      levelStats: (l) => {
        const lo = L(4, 60)(l), hi = L(7, 95)(l);
        return [flat('attack_fire_min', lo), flat('attack_fire_max', hi), flat('spell_fire_min', r(lo * 0.7)), flat('spell_fire_max', r(hi * 0.7))];
      },
      levelText: (l) => [`附加 ${L(4, 60)(l)} - ${L(7, 95)(l)} 火焰傷害（攻擊）`, `附加 ${r(L(4, 60)(l) * 0.7)} - ${r(L(7, 95)(l) * 0.7)} 火焰傷害（法術）`],
    },
    quality: [inc('fire_damage', 0.5)], qualityText: '增加 {0}% 火焰傷害',
  },

  // ============================================================================ DEXTERITY (green)
  {
    id: 'split_shot', name: '分裂射擊', color: 'G', reqLevel: 1,
    tags: ['attack', 'projectile', 'bow'],
    description: '一次射出扇形箭矢。',
    active: {
      behaviour: 'projectile', weaponDamage: [90, 145], manaCost: [6, 9], weapons: BOW,
      params: { count: 5, spread: 40, speed: 24, range: 15, size: 0.25, visual: 1 },
      levelText: (l) => [`造成 ${L(90, 145)(l)}% 基礎攻擊傷害`, '發射 5 支箭矢'],
    },
    quality: [inc('projectile_damage', 1)], qualityText: '增加 {0}% 投射物傷害',
  },
  {
    id: 'storm_arrow', name: '風暴箭', color: 'G', reqLevel: 12,
    tags: ['attack', 'projectile', 'area', 'lightning', 'bow'],
    description: '射出充能箭矢，命中時閃電會打擊附近的額外敵人。',
    active: {
      behaviour: 'projectile', weaponDamage: [100, 165], manaCost: [7, 11], weapons: BOW, conversion: { lightning: 50 },
      params: { count: 1, spread: 0, speed: 28, range: 16, size: 0.3, strikes: 3, strikeRadius: 3.2, visual: 2 },
      levelText: (l) => [`造成 ${L(100, 165)(l)}% 基礎攻擊傷害`, '50% 物理傷害轉換為閃電傷害', '命中時打擊附近 3 名敵人'],
    },
    quality: [inc('area_of_effect', 0.5)], qualityText: '增加 {0}% 效果範圍',
  },
  {
    id: 'arrow_rain', name: '箭雨', color: 'G', reqLevel: 24,
    tags: ['attack', 'area', 'bow'],
    description: '向天空射出一輪箭矢，落在目標區域。',
    active: {
      behaviour: 'rain', weaponDamage: [70, 110], manaCost: [10, 15], weapons: BOW,
      params: { radius: 2.6, impacts: 8, impactRadius: 0.9, duration: 0.8, visual: 1 },
      levelText: (l) => [`每支箭造成 ${L(70, 110)(l)}% 基礎攻擊傷害`],
    },
    quality: [inc('area_damage', 1)], qualityText: '增加 {0}% 範圍傷害',
  },
  {
    id: 'venom_strike', name: '劇毒打擊', color: 'G', reqLevel: 1,
    tags: ['attack', 'melee', 'strike', 'chaos', 'duration'],
    description: '必定使目標中毒的淬毒攻擊。',
    active: {
      behaviour: 'melee', weaponDamage: [100, 160], manaCost: [5, 8], conversion: { chaos: 25 }, params: { arc: 0 },
      levelStats: (l) => [flat('poison_chance', 100), more('poison_damage', L(0, 40)(l))],
      levelText: (l) => [`造成 ${L(100, 160)(l)}% 基礎攻擊傷害`, '25% 物理傷害轉換為混沌傷害', '擊中時必定中毒', `總增 ${L(0, 40)(l)}% 中毒傷害`],
    },
    quality: [inc('poison_damage', 1)], qualityText: '增加 {0}% 中毒傷害',
  },
  {
    id: 'rime_blades', name: '霜刃', color: 'G', reqLevel: 1,
    tags: ['attack', 'melee', 'projectile', 'cold'],
    description: '近戰攻擊，並從目標處擲出冰刃。',
    active: {
      behaviour: 'strike_projectile', weaponDamage: [100, 155], manaCost: [6, 9], conversion: { cold: 60 },
      params: { count: 3, spread: 30, speed: 24, range: 9, mode: 0 },
      levelText: (l) => [`造成 ${L(100, 155)(l)}% 基礎攻擊傷害`, '60% 物理傷害轉換為冰冷傷害', '發射 3 把冰刃'],
    },
    quality: [inc('projectile_speed', 1)], qualityText: '增加 {0}% 投射物速度',
  },
  {
    id: 'dash_strike', name: '衝刺打擊', color: 'G', reqLevel: 10,
    tags: ['attack', 'melee', 'movement'],
    description: '向前衝刺，擊中路徑上的所有敵人。',
    active: {
      behaviour: 'dash', weaponDamage: [70, 110], attackSpeedMult: 1.5, manaCost: [8, 12], params: { distance: 7, width: 1.3 },
      levelText: (l) => [`造成 ${L(70, 110)(l)}% 基礎攻擊傷害`],
    },
    quality: [inc('attack_speed', 0.5)], qualityText: '增加 {0}% 攻擊速度',
  },
  {
    id: 'quickening', name: '迅捷光環', color: 'G', reqLevel: 24,
    tags: ['aura', 'area'],
    description: '施放光環，提高攻擊、施法與移動速度。',
    active: {
      behaviour: 'aura', manaCost: [0, 0], reservation: 50, params: {}, auraAffectsAllies: true,
      levelStats: (l) => [inc('attack_speed', L(6, 14)(l)), inc('cast_speed', L(6, 14)(l)), inc('movement_speed', L(4, 10)(l))],
      levelText: (l) => [`增加 ${L(6, 14)(l)}% 攻擊與施法速度`, `增加 ${L(4, 10)(l)}% 移動速度`],
    },
    quality: [inc('movement_speed', 0.25)], qualityText: '增加 {0}% 移動速度',
  },
  {
    id: 'winters_grasp', name: '寒冬之握', color: 'G', reqLevel: 24,
    tags: ['aura', 'area', 'cold'],
    description: '施放光環，使你的物理傷害額外造成冰冷傷害。',
    active: {
      behaviour: 'aura', manaCost: [0, 0], reservation: 50, params: {}, auraAffectsAllies: true,
      levelStats: (l) => [flat('phys_as_extra_cold', L(10, 20)(l)), more('cold_damage', L(10, 15)(l))],
      levelText: (l) => [`獲得 ${L(10, 20)(l)}% 物理傷害的額外冰冷傷害`, `總增 ${L(10, 15)(l)}% 冰冷傷害`],
    },
    quality: [inc('cold_damage', 0.5)], qualityText: '增加 {0}% 冰冷傷害',
  },

  // ============================================================================ INTELLIGENCE (blue)
  {
    id: 'fireball', name: '火球', color: 'B', reqLevel: 1,
    tags: ['spell', 'projectile', 'area', 'fire'],
    description: '擲出一顆命中時爆炸的火球。',
    active: {
      behaviour: 'projectile', castTime: 0.8, crit: 6, baseDamage: { fire: [0.8, 1.2] }, damageScale: 1, effectiveness: 1.6,
      manaCost: [6, 22], params: { count: 1, spread: 0, speed: 20, range: 14, size: 0.35, explodeRadius: 1.6, visual: 3 },
      levelStats: (l) => [flat('ignite_chance', L(20, 40)(l))],
      levelText: (l) => [`${L(20, 40)(l)}% 機率點燃`, '命中時爆炸'],
    },
    quality: [inc('burning_damage', 1)], qualityText: '增加 {0}% 燃燒傷害',
  },
  {
    id: 'frost_nova', name: '冰霜新星', color: 'B', reqLevel: 12,
    tags: ['spell', 'area', 'cold', 'nova'],
    description: '在你周圍釋放一圈冰霜。',
    active: {
      behaviour: 'nova', castTime: 0.7, crit: 6, baseDamage: { cold: [0.8, 1.2] }, damageScale: 0.85, effectiveness: 1,
      manaCost: [11, 26], params: { radius: 3.3, visual: 1 },
      levelStats: (l) => [inc('area_of_effect', L(0, 20)(l))],
      levelText: (l) => [`增加 ${L(0, 20)(l)}% 效果範圍`],
    },
    quality: [inc('chill_effect', 1)], qualityText: '增加 {0}% 冰緩效果',
  },
  {
    id: 'chain_lightning', name: '連鎖閃電', color: 'B', reqLevel: 1,
    tags: ['spell', 'lightning', 'chaining'],
    description: '在敵人之間跳躍的閃電。',
    active: {
      behaviour: 'chain', castTime: 0.7, crit: 5, baseDamage: { lightning: [0.25, 1.75] }, damageScale: 0.75, effectiveness: 0.8,
      manaCost: [7, 24], params: { chains: 4, range: 12, chainRange: 5.5 },
      levelStats: (l) => [flat('shock_chance', 10), flat('chain', l >= 20 ? 2 : l >= 10 ? 1 : 0)],
      levelText: (l) => [`連鎖 ${4 + (l >= 20 ? 2 : l >= 10 ? 1 : 0)} 次`, '10% 機率感電'],
    },
    quality: [inc('shock_effect', 1)], qualityText: '增加 {0}% 感電效果',
  },
  {
    id: 'sparkstorm', name: '火花風暴', color: 'B', reqLevel: 1,
    tags: ['spell', 'projectile', 'lightning', 'duration'],
    description: '釋放一片在地面上劈啪游走的火花。',
    active: {
      behaviour: 'projectile', castTime: 0.65, crit: 5, baseDamage: { lightning: [0.1, 1.9] }, damageScale: 0.45, effectiveness: 0.6,
      manaCost: [5, 16], params: { count: 4, spread: 50, speed: 11, range: 20, size: 0.3, duration: 2, erratic: 1, visual: 4 },
      levelText: () => ['發射 4 道游走火花'],
    },
    quality: [inc('projectile_speed', 1)], qualityText: '增加 {0}% 投射物速度',
  },
  {
    id: 'cinderfall', name: '餘燼墜落', color: 'B', reqLevel: 24,
    tags: ['spell', 'area', 'fire', 'duration'],
    description: '在目標區域降下燃燒的餘燼風暴。',
    active: {
      behaviour: 'rain', castTime: 0.9, crit: 6, baseDamage: { fire: [0.8, 1.2] }, damageScale: 0.55, effectiveness: 0.5,
      manaCost: [14, 30], params: { radius: 3, impacts: 10, impactRadius: 1.0, duration: 1.4, visual: 2 },
      levelText: () => ['召喚 10 顆燃燒餘燼'],
    },
    quality: [inc('skill_duration', 1)], qualityText: '增加 {0}% 技能效果持續時間',
  },
  {
    id: 'raise_bones', name: '召喚骸骨戰士', color: 'B', reqLevel: 1,
    tags: ['spell', 'minion'],
    description: '召喚為你作戰的骸骨戰士。',
    active: {
      behaviour: 'summon', castTime: 0.8, manaCost: [10, 25], params: { count: 2, max: 4 },
      levelText: (l) => ['召喚 2 名骸骨戰士', '最多 4 名骸骨戰士', `召喚物等級 ${Math.min(80, 1 + (l - 1) * 3.6) | 0}`],
    },
    quality: [inc('minion_damage', 1)], qualityText: '召喚物傷害增加 {0}%',
  },
  {
    id: 'flame_step', name: '烈焰步', color: 'B', reqLevel: 10,
    tags: ['spell', 'movement', 'fire'],
    description: '在火焰爆發中短距離傳送。',
    active: {
      behaviour: 'blink', castTime: 0.4, manaCost: [8, 16], params: { distance: 6.5 },
      levelText: () => ['傳送至目標位置'],
    },
    quality: [inc('cast_speed', 0.5)], qualityText: '增加 {0}% 施法速度',
  },
  {
    id: 'serenity', name: '清明光環', color: 'B', reqLevel: 8,
    tags: ['aura', 'area'],
    description: '施放光環，為你與盟友回復魔力。',
    active: {
      behaviour: 'aura', manaCost: [0, 0], reservation: 25, params: {},
      levelStats: (l) => [flat('mana_regen', L(3, 20)(l))],
      levelText: (l) => [`每秒回復 ${L(3, 20)(l)} 魔力`],
    },
    quality: [inc('mana_regen', 1)], qualityText: '增加 {0}% 魔力回復速度',
  },

  // ============================================================================ SUPPORTS — red
  {
    id: 'brutal_force', name: '蠻力（輔）', color: 'R', reqLevel: 8, tags: ['attack', 'melee', 'physical'],
    description: '輔助近戰技能，大幅強化其物理傷害。',
    support: {
      anyOf: ['melee'], manaMult: 1.4,
      stats: (l) => [more('phys_damage', L(30, 49)(l))],
      text: (l) => [`總增 ${L(30, 49)(l)}% 物理傷害`],
    },
    quality: [inc('phys_damage', 0.5)], qualityText: '增加 {0}% 物理傷害',
  },
  {
    id: 'added_fire', name: '附加火焰傷害（輔）', color: 'R', reqLevel: 8, tags: ['fire'],
    description: '輔助傷害技能，依其物理傷害附加火焰傷害。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.2,
      stats: (l) => [flat('phys_as_extra_fire', L(20, 39)(l))],
      text: (l) => [`獲得 ${L(20, 39)(l)}% 物理傷害的額外火焰傷害`],
    },
    quality: [inc('fire_damage', 0.5)], qualityText: '增加 {0}% 火焰傷害',
  },
  {
    id: 'multistrike', name: '多重打擊（輔）', color: 'R', reqLevel: 28, tags: ['attack', 'melee'],
    description: '被輔助的近戰攻擊以更快速度額外重複兩次。',
    support: {
      anyOf: ['melee'], noneOf: ['movement'], manaMult: 1.5,
      stats: (l) => [flat('repeats', 2), more('attack_speed', L(44, 63)(l)), more('damage', -20)],
      text: (l) => ['被輔助的攻擊額外重複 2 次', `總增 ${L(44, 63)(l)}% 攻擊速度`, '總減 20% 傷害'],
    },
    quality: [inc('attack_speed', 0.5)], qualityText: '增加 {0}% 攻擊速度',
  },
  {
    id: 'life_leech_support', name: '放血（輔）', color: 'R', reqLevel: 1, tags: ['attack'],
    description: '被輔助的技能從造成的傷害中偷取生命。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.1,
      stats: (l) => [flat('life_leech', lvl(2, 3, l))],
      text: (l) => [`${lvl(2, 3, l).toFixed(1)}% 傷害轉化為生命偷取`],
    },
    quality: [inc('damage', 0.5)], qualityText: '增加 {0}% 傷害',
  },
  {
    id: 'searing_heat', name: '灼熱（輔）', color: 'R', reqLevel: 12, tags: ['fire'],
    description: '被輔助的技能更常點燃，燃燒傷害大幅提升。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.25,
      stats: (l) => [flat('ignite_chance', 15), more('burning_damage', L(30, 49)(l))],
      text: (l) => ['15% 機率點燃', `總增 ${L(30, 49)(l)}% 燃燒傷害`],
    },
    quality: [inc('burning_damage', 1)], qualityText: '增加 {0}% 燃燒傷害',
  },
  {
    id: 'melee_splash', name: '衝擊波（輔）', color: 'R', reqLevel: 8, tags: ['melee', 'area'],
    description: '被輔助的單體近戰技能也會傷害目標周圍的敵人。',
    support: {
      anyOf: ['melee'], noneOf: ['area'], manaMult: 1.4,
      stats: (l) => [flag('splash'), more('damage', L(-15, 0)(l))],
      text: (l) => ['近戰擊中時同時傷害目標周圍的敵人', l < 20 ? `總減 ${-L(-15, 0)(l)}% 傷害` : ''].filter(Boolean),
    },
    quality: [inc('area_of_effect', 0.5)], qualityText: '增加 {0}% 效果範圍',
  },
  {
    id: 'culling_strike', name: '終結（輔）', color: 'R', reqLevel: 18, tags: [],
    description: '被輔助的技能會立即擊殺低血量敵人。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.1,
      stats: (l) => [flag('culling_strike'), more('damage', L(0, 19)(l))],
      text: (l) => ['擊中生命低於 10% 的敵人時直接擊殺', `總增 ${L(0, 19)(l)}% 傷害`],
    },
    quality: [inc('damage', 0.5)], qualityText: '增加 {0}% 傷害',
  },

  // ============================================================================ SUPPORTS — green
  {
    id: 'lesser_volley', name: '多重投射（輔）', color: 'G', reqLevel: 8, tags: ['projectile'],
    description: '被輔助的投射物技能發射額外投射物。',
    support: {
      anyOf: ['projectile'], manaMult: 1.3,
      stats: (l) => [flat('additional_projectiles', 2), more('damage', L(-26, -15)(l))],
      text: (l) => ['技能額外發射 2 個投射物', `總減 ${-L(-26, -15)(l)}% 傷害`],
    },
    quality: [inc('projectile_damage', 0.5)], qualityText: '增加 {0}% 投射物傷害',
  },
  {
    id: 'greater_volley', name: '大範圍多重投射（輔）', color: 'G', reqLevel: 38, tags: ['projectile'],
    description: '被輔助的投射物技能發射大量額外投射物。',
    support: {
      anyOf: ['projectile'], manaMult: 1.5,
      stats: (l) => [flat('additional_projectiles', 4), more('damage', L(-35, -26)(l))],
      text: (l) => ['技能額外發射 4 個投射物', `總減 ${-L(-35, -26)(l)}% 傷害`],
    },
    quality: [inc('attack_speed', 0.5), inc('cast_speed', 0.5)], qualityText: '增加 {0}% 攻擊與施法速度',
  },
  {
    id: 'piercing_shots', name: '穿透（輔）', color: 'G', reqLevel: 8, tags: ['projectile'],
    description: '被輔助的投射物會穿透敵人。',
    support: {
      anyOf: ['projectile'], manaMult: 1.1,
      stats: (l) => [flat('pierce', L(2, 5)(l)), more('projectile_damage', L(0, 19)(l))],
      text: (l) => [`投射物額外穿透 ${L(2, 5)(l)} 個目標`, `總增 ${L(0, 19)(l)}% 投射物傷害`],
    },
    quality: [inc('projectile_damage', 0.5)], qualityText: '增加 {0}% 投射物傷害',
  },
  {
    id: 'ricochet', name: '連鎖（輔）', color: 'G', reqLevel: 38, tags: ['projectile', 'chaining'],
    description: '被輔助的投射物與連鎖技能額外連鎖。',
    support: {
      anyOf: ['projectile', 'chaining'], manaMult: 1.5,
      stats: (l) => [flat('chain', 2), more('damage', L(-30, -21)(l))],
      text: (l) => ['額外連鎖 2 次', `總減 ${-L(-30, -21)(l)}% 傷害`],
    },
    quality: [inc('projectile_speed', 1)], qualityText: '增加 {0}% 投射物速度',
  },
  {
    id: 'forking', name: '分裂（輔）', color: 'G', reqLevel: 12, tags: ['projectile'],
    description: '被輔助的投射物擊中敵人時一分為二。',
    support: {
      anyOf: ['projectile'], manaMult: 1.3,
      stats: (l) => [flag('fork'), more('projectile_damage', L(-10, 9)(l))],
      text: (l) => ['投射物擊中時分裂', `總增 ${L(-10, 9)(l)}% 投射物傷害`],
    },
    quality: [inc('projectile_damage', 0.5)], qualityText: '增加 {0}% 投射物傷害',
  },
  {
    id: 'faster_attacks', name: '快速攻擊（輔）', color: 'G', reqLevel: 1, tags: ['attack'],
    description: '被輔助的攻擊速度大幅提升。',
    support: {
      anyOf: ['attack'], manaMult: 1.15,
      stats: (l) => [more('attack_speed', L(25, 44)(l))],
      text: (l) => [`總增 ${L(25, 44)(l)}% 攻擊速度`],
    },
    quality: [inc('attack_speed', 0.5)], qualityText: '增加 {0}% 攻擊速度',
  },
  {
    id: 'velocity', name: '極速（輔）', color: 'G', reqLevel: 8, tags: ['projectile'],
    description: '被輔助的投射物飛得更快、打得更重。',
    support: {
      anyOf: ['projectile'], manaMult: 1.2,
      stats: (l) => [inc('projectile_speed', L(50, 69)(l)), more('projectile_damage', L(10, 29)(l))],
      text: (l) => [`增加 ${L(50, 69)(l)}% 投射物速度`, `總增 ${L(10, 29)(l)}% 投射物傷害`],
    },
    quality: [inc('projectile_speed', 1)], qualityText: '增加 {0}% 投射物速度',
  },
  {
    id: 'crit_strikes', name: '鋒利邊緣（輔）', color: 'G', reqLevel: 8, tags: [],
    description: '被輔助的技能更常暴擊。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.2,
      stats: (l) => [inc('crit_chance', L(60, 98)(l)), flat('base_crit_flat', lvl(1, 2, l))],
      text: (l) => [`增加 ${L(60, 98)(l)}% 暴擊率`, `+${lvl(1, 2, l).toFixed(1)}% 暴擊率`],
    },
    quality: [inc('crit_chance', 1)], qualityText: '增加 {0}% 暴擊率',
  },
  {
    id: 'venom', name: '劇毒（輔）', color: 'G', reqLevel: 8, tags: ['chaos'],
    description: '被輔助的技能擊中時使敵人中毒。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.1,
      stats: (l) => [flat('poison_chance', 40), more('poison_damage', L(0, 29)(l))],
      text: (l) => ['40% 機率擊中時使敵人中毒', `總增 ${L(0, 29)(l)}% 中毒傷害`],
    },
    quality: [inc('poison_damage', 1)], qualityText: '增加 {0}% 中毒傷害',
  },
  {
    id: 'added_cold', name: '附加冰冷傷害（輔）', color: 'G', reqLevel: 8, tags: ['cold'],
    description: '被輔助的技能造成額外冰冷傷害。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.2,
      stats: (l) => {
        const [lo, hi] = addedRange(8, l, 0.8, 1.2);
        return [flat('attack_cold_min', lo), flat('attack_cold_max', hi), flat('spell_cold_min', lo), flat('spell_cold_max', hi)];
      },
      text: (l) => {
        const [lo, hi] = addedRange(8, l, 0.8, 1.2);
        return [`附加 ${lo} - ${hi} 冰冷傷害`];
      },
    },
    quality: [inc('cold_damage', 0.5)], qualityText: '增加 {0}% 冰冷傷害',
  },
  {
    id: 'hypothermia', name: '深度冰凍（輔）', color: 'G', reqLevel: 31, tags: ['cold'],
    description: '被輔助的技能對冰緩敵人造成更多傷害，冰緩效果更強。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.3,
      stats: (l) => [more('damage_vs_chilled', L(20, 39)(l)), inc('chill_effect', 20)],
      text: (l) => [`對冰緩敵人的擊中傷害總增 ${L(20, 39)(l)}%`, '增加 20% 冰緩效果'],
    },
    quality: [inc('chill_effect', 1)], qualityText: '增加 {0}% 冰緩效果',
  },

  // ============================================================================ SUPPORTS — blue
  {
    id: 'echoing_spell', name: '法術回響（輔）', color: 'B', reqLevel: 38, tags: ['spell'],
    description: '被輔助的法術重複一次，施放速度大幅提升。',
    support: {
      anyOf: ['spell'], noneOf: ['aura', 'minion', 'movement'], manaMult: 1.4,
      stats: (l) => [flat('repeats', 1), more('cast_speed', L(70, 89)(l)), more('damage', -10)],
      text: (l) => ['被輔助的法術額外重複 1 次', `總增 ${L(70, 89)(l)}% 施法速度`, '總減 10% 傷害'],
    },
    quality: [inc('cast_speed', 0.5)], qualityText: '增加 {0}% 施法速度',
  },
  {
    id: 'faster_casting', name: '快速施法（輔）', color: 'B', reqLevel: 18, tags: ['spell'],
    description: '被輔助的法術施放更快。',
    support: {
      anyOf: ['spell'], noneOf: ['aura'], manaMult: 1.2,
      stats: (l) => [inc('cast_speed', L(20, 39)(l))],
      text: (l) => [`增加 ${L(20, 39)(l)}% 施法速度`],
    },
    quality: [inc('cast_speed', 0.5)], qualityText: '增加 {0}% 施法速度',
  },
  {
    id: 'increased_aoe', name: '增大範圍（輔）', color: 'B', reqLevel: 24, tags: ['area'],
    description: '被輔助的技能影響更大範圍。',
    support: {
      anyOf: ['area'], noneOf: ['aura'], manaMult: 1.4,
      stats: (l) => [inc('area_of_effect', L(20, 39)(l))],
      text: (l) => [`增加 ${L(20, 39)(l)}% 效果範圍`],
    },
    quality: [inc('area_damage', 0.5)], qualityText: '增加 {0}% 範圍傷害',
  },
  {
    id: 'concentrated_effect', name: '集中效應（輔）', color: 'B', reqLevel: 18, tags: ['area'],
    description: '被輔助的技能範圍較小，但範圍傷害大幅提升。',
    support: {
      anyOf: ['area'], noneOf: ['aura'], manaMult: 1.4,
      stats: (l) => [more('area_of_effect', -30), more('area_damage', L(35, 54)(l))],
      text: (l) => ['總減 30% 效果範圍', `總增 ${L(35, 54)(l)}% 範圍傷害`],
    },
    quality: [inc('area_damage', 0.5)], qualityText: '增加 {0}% 範圍傷害',
  },
  {
    id: 'elemental_focus', name: '元素集中（輔）', color: 'B', reqLevel: 18, tags: [],
    description: '被輔助的技能造成更多元素傷害，但無法造成元素異常狀態。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.3,
      stats: (l) => [more('elemental_damage', L(30, 49)(l)), flag('cannot_ailment')],
      text: (l) => [`總增 ${L(30, 49)(l)}% 元素傷害`, '無法造成元素異常狀態'],
    },
    quality: [inc('elemental_damage', 0.5)], qualityText: '增加 {0}% 元素傷害',
  },
  {
    id: 'controlled_ruin', name: '控制毀滅（輔）', color: 'B', reqLevel: 18, tags: ['spell'],
    description: '被輔助的法術造成更多傷害，但無法暴擊。',
    support: {
      anyOf: ['spell'], noneOf: ['aura', 'minion'], manaMult: 1.3,
      stats: (l) => [more('spell_damage', L(30, 49)(l)), more('crit_chance', -100)],
      text: (l) => [`總增 ${L(30, 49)(l)}% 法術傷害`, '總減 100% 暴擊率'],
    },
    quality: [inc('spell_damage', 0.5)], qualityText: '增加 {0}% 法術傷害',
  },
  {
    id: 'added_lightning', name: '附加閃電傷害（輔）', color: 'B', reqLevel: 8, tags: ['lightning'],
    description: '被輔助的技能造成額外閃電傷害。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.2,
      stats: (l) => {
        const [lo, hi] = addedRange(8, l, 0.1, 1.9);
        return [flat('attack_lightning_min', lo), flat('attack_lightning_max', hi), flat('spell_lightning_min', lo), flat('spell_lightning_max', hi)];
      },
      text: (l) => {
        const [lo, hi] = addedRange(8, l, 0.1, 1.9);
        return [`附加 ${lo} - ${hi} 閃電傷害`];
      },
    },
    quality: [inc('lightning_damage', 0.5)], qualityText: '增加 {0}% 閃電傷害',
  },
  {
    id: 'critical_wrath', name: '暴擊之怒（輔）', color: 'B', reqLevel: 18, tags: [],
    description: '被輔助的技能暴擊時造成遠更多的傷害。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.3,
      stats: (l) => [flat('crit_multi', L(70, 99)(l))],
      text: (l) => [`+${L(70, 99)(l)}% 暴擊傷害加成`],
    },
    quality: [flat('crit_multi', 0.75)], qualityText: '+{0}% 暴擊傷害加成',
  },
  {
    id: 'minion_might', name: '召喚物傷害（輔）', color: 'B', reqLevel: 8, tags: ['minion'],
    description: '被輔助的召喚物造成更多傷害。',
    support: {
      anyOf: ['minion'], manaMult: 1.3,
      stats: (l) => [more('minion_damage', L(25, 44)(l))],
      text: (l) => [`召喚物傷害總增 ${L(25, 44)(l)}%`],
    },
    quality: [inc('minion_damage', 0.75)], qualityText: '召喚物傷害增加 {0}%',
  },
  {
    id: 'minion_vitality', name: '召喚物生命（輔）', color: 'B', reqLevel: 8, tags: ['minion'],
    description: '被輔助的召喚物擁有更多生命。',
    support: {
      anyOf: ['minion'], manaMult: 1.3,
      stats: (l) => [more('minion_life', L(30, 49)(l)), flat('minion_count', l >= 15 ? 1 : 0)],
      text: (l) => [`召喚物最大生命總增 ${L(30, 49)(l)}%`, ...(l >= 15 ? ['+1 召喚物最大數量'] : [])],
    },
    quality: [inc('minion_life', 0.75)], qualityText: '召喚物最大生命增加 {0}%',
  },
  {
    id: 'efficiency', name: '效率（輔）', color: 'B', reqLevel: 1, tags: [],
    description: '被輔助的技能消耗與保留更少魔力。',
    support: {
      anyOf: ['attack', 'spell', 'aura'], manaMult: 1,
      stats: (l) => [more('mana_cost', L(-10, -30)(l)), more('reservation', L(-8, -20)(l))],
      text: (l) => [`總減 ${-L(-10, -30)(l)}% 魔力消耗`, `總減 ${-L(-8, -20)(l)}% 魔力保留`],
    },
    quality: [inc('mana_cost', -0.5)], qualityText: '魔力消耗減少 {0}%',
  },
  {
    id: 'kindling', name: '引燃（輔）', color: 'B', reqLevel: 8, tags: ['fire'],
    description: '被輔助的技能造成更多火焰傷害並經常點燃。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.2,
      stats: (l) => [flat('ignite_chance', 30), more('fire_damage', L(10, 25)(l))],
      text: (l) => ['30% 機率點燃', `總增 ${L(10, 25)(l)}% 火焰傷害`],
    },
    quality: [inc('fire_damage', 0.5)], qualityText: '增加 {0}% 火焰傷害',
  },
  {
    id: 'elemental_penetration', name: '元素穿透（輔）', color: 'B', reqLevel: 31, tags: [],
    description: '被輔助的技能穿透敵人的元素抗性。',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.3,
      stats: (l) => [flat('fire_pen', L(10, 19)(l)), flat('cold_pen', L(10, 19)(l)), flat('lightning_pen', L(10, 19)(l))],
      text: (l) => [`穿透 ${pct(L(10, 19)(l))} 元素抗性`],
    },
    quality: [inc('elemental_damage', 0.5)], qualityText: '增加 {0}% 元素傷害',
  },
];

/** Flat added damage for '附加傷害' supports, derived from the spell damage curve. */
export function addedRange(req1: number, level: number, lo: number, hi: number): [number, number] {
  const req = Math.round(req1 + ((Math.min(level, 20) - 1) * (70 - req1)) / 19) + Math.max(0, level - 20) * 2;
  const avg = spellDamage(req) * 0.22;
  return [Math.max(1, r(avg * lo)), Math.max(2, r(avg * hi))];
}

export const GEM_BY_ID: Record<string, GemDef> = Object.fromEntries(GEMS.map((g) => [g.id, g]));

export function getGem(id: string): GemDef {
  const g = GEM_BY_ID[id];
  if (!g) throw new Error(`Unknown gem: ${id}`);
  return g;
}

export const MAX_GEM_LEVEL = 21;
