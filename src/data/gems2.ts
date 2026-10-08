import type { WeaponClass } from '../items/types';
import { flag, flat, inc, more, type DamageType, type StatMod } from '../stats/stats';
import type { ActiveSkillDef, BehaviourId, GemColor, GemDef, SkillTag } from './gems';
import { lvl } from './scaling';

/**
 * A second batch of active skill gems, built on the existing behaviours (melee, slam, projectile,
 * rain, nova, chain, dash, blink, summon…) so they need no new engine code.
 */

const r = Math.round;
const L = (a: number, b: number) => (level: number) => r(lvl(a, b, level));
const BOW: WeaponClass[] = ['bow'];

interface Spec {
  id: string;
  name: string;
  color: GemColor;
  req: number;
  tags: SkillTag[];
  desc: string;
  behaviour: BehaviourId;
  params: Record<string, number>;
  mana: [number, number];
  /** Attacks: % of weapon damage at gem level 1 / 20. */
  wd?: [number, number];
  aps?: number;
  /** Spells. */
  spell?: { cast: number; crit?: number; dmg: Partial<Record<DamageType, [number, number]>>; scale: number; eff: number };
  conv?: ActiveSkillDef['conversion'];
  weapons?: WeaponClass[];
  minion?: string;
  stats?: (level: number) => StatMod[];
  lines?: (level: number) => string[];
  quality: [StatMod, string];
  weight?: number;
}

function gem(s: Spec): GemDef {
  const dmgLine = s.wd ? (l: number) => [`造成 ${L(s.wd![0], s.wd![1])(l)}% 基礎攻擊傷害`] : () => [] as string[];
  const convLine = Object.entries(s.conv ?? {}).map(([t, v]) => `${v}% 物理傷害轉換為${({ fire: '火焰', cold: '冰冷', lightning: '閃電', chaos: '混沌' } as Record<string, string>)[t]}傷害`);
  const active: ActiveSkillDef = {
    behaviour: s.behaviour,
    manaCost: s.mana,
    params: s.params,
    ...(s.wd ? { weaponDamage: s.wd } : {}),
    ...(s.aps ? { attackSpeedMult: s.aps } : {}),
    ...(s.spell ? { castTime: s.spell.cast, crit: s.spell.crit ?? 6, baseDamage: s.spell.dmg, damageScale: s.spell.scale, effectiveness: s.spell.eff } : {}),
    ...(s.conv ? { conversion: s.conv } : {}),
    ...(s.weapons ? { weapons: s.weapons } : {}),
    ...(s.minion ? { minion: s.minion } : {}),
    ...(s.stats ? { levelStats: s.stats } : {}),
    levelText: (l) => [...dmgLine(l), ...convLine, ...(s.lines?.(l) ?? [])],
  };
  return {
    id: s.id, name: s.name, color: s.color, reqLevel: s.req, tags: s.tags, description: s.desc,
    active, quality: [s.quality[0]], qualityText: s.quality[1], dropWeight: s.weight,
  };
}

const PHYS_BIG: [number, number] = [0.8, 1.2];

export const GEMS_2: GemDef[] = [
  // ============================================================================ red
  gem({
    id: 'heavy_strike', name: '沉重打擊', color: 'R', req: 1, tags: ['attack', 'melee', 'strike', 'physical'],
    desc: '緩慢而沉重的一擊，造成大量傷害並擊退敵人。', behaviour: 'melee', wd: [180, 290], aps: 0.75, mana: [5, 9], params: { arc: 0 },
    stats: () => [flag('knockback')], lines: () => ['擊中時擊退敵人'], quality: [inc('melee_damage', 1), '增加 {0}% 近戰傷害'],
  }),
  gem({
    id: 'reave', name: '掠刃', color: 'R', req: 1, tags: ['attack', 'melee', 'area', 'physical'],
    desc: '快速的圓弧斬擊，命中面前的所有敵人。', behaviour: 'melee', wd: [80, 130], aps: 1.15, mana: [4, 7], params: { arc: 120, radius: 2.5 },
    quality: [inc('attack_speed', 0.5), '增加 {0}% 攻擊速度'],
  }),
  gem({
    id: 'glacial_hammer', name: '冰川之錘', color: 'R', req: 4, tags: ['attack', 'melee', 'strike', 'cold'],
    desc: '以冰封的武器重擊敵人，使其極易凍結。', behaviour: 'melee', wd: [120, 190], aps: 0.9, mana: [6, 10], params: { arc: 0 }, conv: { cold: 50 },
    stats: (l) => [flat('freeze_chance', L(15, 35)(l))], lines: (l) => [`${L(15, 35)(l)}% 機率冰凍`], quality: [inc('cold_damage', 1), '增加 {0}% 冰冷傷害'],
  }),
  gem({
    id: 'fiery_blow', name: '烈焰猛擊', color: 'R', req: 12, tags: ['attack', 'melee', 'slam', 'area', 'fire'],
    desc: '以燃燒的武器揮出寬闊的火焰衝擊，點燃前方的敵人。', behaviour: 'slam', wd: [150, 240], aps: 0.85, mana: [8, 13], params: { angle: 70, length: 4.2 }, conv: { fire: 70 },
    stats: (l) => [flat('ignite_chance', L(20, 40)(l))], lines: (l) => [`${L(20, 40)(l)}% 機率點燃`], quality: [inc('burning_damage', 1), '增加 {0}% 燃燒傷害'],
  }),
  gem({
    id: 'raging_charge', name: '猛烈衝鋒', color: 'R', req: 10, tags: ['attack', 'melee', 'movement'],
    desc: '向前猛衝，撞飛路徑上的所有敵人。', behaviour: 'dash', wd: [90, 140], aps: 1.2, mana: [8, 12], params: { distance: 9, width: 1.7 },
    stats: () => [flag('knockback')], lines: () => ['擊退被撞到的敵人'], quality: [inc('movement_speed', 0.25), '增加 {0}% 移動速度'],
  }),
  gem({
    id: 'sunder', name: '裂地', color: 'R', req: 16, tags: ['attack', 'melee', 'slam', 'area', 'physical'],
    desc: '猛擊地面，沿一條長長的直線製造裂縫。', behaviour: 'slam', wd: [140, 225], aps: 0.75, mana: [8, 14], params: { angle: 22, length: 9.5 },
    lines: () => ['貫穿前方一長條區域'], quality: [inc('area_damage', 1), '增加 {0}% 範圍傷害'],
  }),
  gem({
    id: 'exsanguinate', name: '血祭旋斬', color: 'R', req: 24, tags: ['attack', 'melee', 'area', 'physical', 'duration'],
    desc: '朝四面八方揮出血刃，必定使被擊中的敵人流血。', behaviour: 'melee', wd: [80, 130], aps: 0.9, mana: [8, 13], params: { arc: 360, radius: 2.5 },
    stats: (l) => [flat('bleed_chance', 100), more('bleed_damage', L(10, 50)(l))], lines: (l) => ['擊中必定造成流血', `總增 ${L(10, 50)(l)}% 流血傷害`],
    quality: [inc('bleed_damage', 1), '增加 {0}% 流血傷害'],
  }),
  gem({
    id: 'tectonic_slam', name: '板塊猛擊', color: 'R', req: 28, tags: ['attack', 'melee', 'slam', 'area', 'fire'],
    desc: '以岩漿包覆的武器砸向地面，熔岩向大範圍扇形噴發。', behaviour: 'slam', wd: [190, 300], aps: 0.7, mana: [10, 16], params: { angle: 90, length: 5.5 }, conv: { fire: 50 },
    quality: [inc('fire_damage', 1), '增加 {0}% 火焰傷害'],
  }),

  // ============================================================================ green
  gem({
    id: 'puncture', name: '穿刺', color: 'G', req: 1, tags: ['attack', 'projectile', 'bow', 'physical', 'duration'],
    desc: '射出銳利的箭矢，在目標身上撕開流血的傷口。', behaviour: 'projectile', wd: [95, 150], mana: [6, 9], weapons: BOW,
    params: { count: 1, spread: 0, speed: 30, range: 15, size: 0.22, visual: 1 },
    stats: (l) => [flat('bleed_chance', 100), more('bleed_damage', L(0, 40)(l))], lines: (l) => ['擊中必定造成流血', `總增 ${L(0, 40)(l)}% 流血傷害`],
    quality: [inc('bleed_damage', 1), '增加 {0}% 流血傷害'],
  }),
  gem({
    id: 'explosive_arrow', name: '爆裂箭', color: 'G', req: 8, tags: ['attack', 'projectile', 'area', 'bow', 'fire'],
    desc: '射出裹著火藥的箭矢，命中時引發爆炸並點燃敵人。', behaviour: 'projectile', wd: [90, 145], mana: [7, 11], weapons: BOW, conv: { fire: 50 },
    params: { count: 1, spread: 0, speed: 24, range: 14, size: 0.3, explodeRadius: 2.4, visual: 3 },
    stats: (l) => [flat('ignite_chance', L(25, 45)(l))], lines: (l) => ['命中時爆炸', `${L(25, 45)(l)}% 機率點燃`], quality: [inc('area_of_effect', 1), '增加 {0}% 效果範圍'],
  }),
  gem({
    id: 'shrapnel_shot', name: '霰彈箭', color: 'G', req: 12, tags: ['attack', 'projectile', 'bow', 'physical'],
    desc: '近距離射出一大片散開的箭雨，近身時威力驚人。', behaviour: 'projectile', wd: [55, 90], mana: [8, 12], weapons: BOW,
    params: { count: 7, spread: 60, speed: 26, range: 9, size: 0.22, visual: 1 }, lines: () => ['發射 7 支箭矢'], quality: [inc('projectile_damage', 1), '增加 {0}% 投射物傷害'],
  }),
  gem({
    id: 'lightning_arrow', name: '閃電箭', color: 'G', req: 16, tags: ['attack', 'projectile', 'area', 'bow', 'lightning'],
    desc: '射出閃電箭，穿透敵人並以閃電打擊周圍的目標。', behaviour: 'projectile', wd: [90, 150], mana: [8, 12], weapons: BOW, conv: { lightning: 100 },
    params: { count: 1, spread: 0, speed: 30, range: 16, size: 0.28, strikes: 2, strikeRadius: 5, visual: 2 },
    stats: (l) => [flat('pierce', 1), flat('shock_chance', L(10, 25)(l))], lines: (l) => ['穿透 1 名敵人', '命中時打擊附近 2 名敵人', `${L(10, 25)(l)}% 機率感電`],
    quality: [inc('lightning_damage', 1), '增加 {0}% 閃電傷害'],
  }),
  gem({
    id: 'snipe', name: '狙擊', color: 'G', req: 18, tags: ['attack', 'projectile', 'bow', 'physical'],
    desc: '蓄力後射出一支又快又準的重箭，擁有極高的暴擊率。', behaviour: 'projectile', wd: [230, 370], aps: 0.55, mana: [9, 14], weapons: BOW,
    params: { count: 1, spread: 0, speed: 44, range: 20, size: 0.22, visual: 1 },
    stats: (l) => [inc('crit_chance', L(40, 100)(l))], lines: (l) => [`增加 ${L(40, 100)(l)}% 暴擊率`], quality: [inc('crit_chance', 1), '增加 {0}% 暴擊率'],
  }),
  gem({
    id: 'whirling_blades', name: '旋刃', color: 'G', req: 16, tags: ['attack', 'melee', 'movement', 'physical'],
    desc: '化作旋轉的刀刃疾衝而過，切開路徑上的所有敵人。', behaviour: 'dash', wd: [75, 120], aps: 1.6, mana: [7, 11], params: { distance: 8, width: 1.5 },
    quality: [inc('attack_speed', 0.5), '增加 {0}% 攻擊速度'],
  }),
  gem({
    id: 'ethereal_knives', name: '虛影飛刀', color: 'G', req: 12, tags: ['spell', 'projectile', 'physical'],
    desc: '射出一片虛幻的飛刀，劃傷敵人並使其流血。', behaviour: 'projectile', spell: { cast: 0.6, dmg: { phys: PHYS_BIG }, scale: 0.45, eff: 0.6 }, mana: [8, 20],
    params: { count: 5, spread: 70, speed: 26, range: 11, size: 0.2 },
    stats: () => [flat('bleed_chance', 25)], lines: () => ['發射 5 把飛刀', '25% 機率造成流血'], quality: [inc('projectile_damage', 1), '增加 {0}% 投射物傷害'],
  }),

  // ============================================================================ blue
  gem({
    id: 'arc', name: '電弧', color: 'B', req: 1, tags: ['spell', 'lightning', 'chaining'],
    desc: '一道長長的電弧，在附近的敵人之間連續跳躍。', behaviour: 'chain',
    spell: { cast: 0.65, crit: 5, dmg: { lightning: [0.1, 1.9] }, scale: 0.7, eff: 0.75 }, mana: [6, 20], params: { chains: 5, range: 13, chainRange: 6 },
    stats: () => [flat('shock_chance', 20)], lines: () => ['連鎖 5 次', '20% 機率感電'], quality: [inc('shock_effect', 1), '增加 {0}% 感電效果'],
  }),
  gem({
    id: 'lightning_tendrils', name: '閃電觸手', color: 'B', req: 4, tags: ['spell', 'area', 'lightning', 'nova'],
    desc: '以你為中心迸發緊密的閃電觸手，近身傷害極高。', behaviour: 'nova',
    spell: { cast: 0.5, crit: 6, dmg: { lightning: [0.1, 1.9] }, scale: 1.15, eff: 1 }, mana: [8, 22], params: { radius: 2.4 },
    stats: () => [flat('shock_chance', 15)], lines: () => ['範圍小但傷害較高', '15% 機率感電'], quality: [inc('lightning_damage', 1), '增加 {0}% 閃電傷害'],
  }),
  gem({
    id: 'incinerate', name: '焚燒', color: 'B', req: 12, tags: ['spell', 'projectile', 'fire'],
    desc: '持續噴出穿透敵人的火焰，施放速度極快、消耗極低。', behaviour: 'projectile',
    spell: { cast: 0.3, crit: 5, dmg: { fire: PHYS_BIG }, scale: 0.3, eff: 0.5 }, mana: [3, 9], params: { count: 1, spread: 0, speed: 14, range: 6.5, size: 0.4 },
    stats: (l) => [flat('pierce', 99), flat('ignite_chance', L(15, 30)(l))], lines: (l) => ['射程短，穿透所有敵人', `${L(15, 30)(l)}% 機率點燃`],
    quality: [inc('burning_damage', 1), '增加 {0}% 燃燒傷害'],
  }),
  gem({
    id: 'ice_spear', name: '冰矛', color: 'B', req: 8, tags: ['spell', 'projectile', 'cold'],
    desc: '擲出飛行極快的冰矛，穿透敵人並擁有極高暴擊率。', behaviour: 'projectile',
    spell: { cast: 0.6, crit: 8, dmg: { cold: PHYS_BIG }, scale: 1.05, eff: 1.1 }, mana: [7, 20], params: { count: 1, spread: 0, speed: 34, range: 16, size: 0.3 },
    stats: (l) => [flat('pierce', 1), flat('freeze_chance', L(8, 20)(l))], lines: (l) => ['穿透 1 名敵人', `${L(8, 20)(l)}% 機率冰凍`], quality: [inc('crit_chance', 1), '增加 {0}% 暴擊率'],
  }),
  gem({
    id: 'winter_orb', name: '冬之寶珠', color: 'B', req: 16, tags: ['spell', 'projectile', 'area', 'cold', 'duration'],
    desc: '放出緩慢飄行的冰寶珠，沿途不斷凍傷周圍的敵人。', behaviour: 'projectile',
    spell: { cast: 0.75, crit: 6, dmg: { cold: PHYS_BIG }, scale: 0.6, eff: 0.7 }, mana: [10, 24],
    params: { count: 1, spread: 0, speed: 7, range: 12, size: 0.55, strikes: 3, strikeRadius: 3.2, visual: 4 },
    stats: () => [flat('pierce', 99)], lines: () => ['穿透所有敵人', '命中時凍傷附近 3 名敵人'], quality: [inc('area_of_effect', 1), '增加 {0}% 效果範圍'],
  }),
  gem({
    id: 'storm_call', name: '風暴召喚', color: 'B', req: 20, tags: ['spell', 'area', 'lightning', 'duration'],
    desc: '召喚雷暴，在目標區域降下一連串落雷。', behaviour: 'rain',
    spell: { cast: 0.8, crit: 6, dmg: { lightning: [0.1, 1.9] }, scale: 0.65, eff: 0.6 }, mana: [13, 28], params: { radius: 3.4, impacts: 8, impactRadius: 1.0, duration: 1.2, visual: 2 },
    stats: () => [flat('shock_chance', 20)], lines: () => ['降下 8 道落雷', '20% 機率感電'], quality: [inc('area_damage', 1), '增加 {0}% 範圍傷害'],
  }),
  gem({
    id: 'firestorm', name: '烈焰風暴', color: 'B', req: 20, tags: ['spell', 'area', 'fire', 'duration'],
    desc: '火焰從天而降，持續轟炸目標區域。', behaviour: 'rain',
    spell: { cast: 0.9, crit: 6, dmg: { fire: PHYS_BIG }, scale: 0.5, eff: 0.55 }, mana: [14, 30], params: { radius: 3.4, impacts: 12, impactRadius: 1.1, duration: 1.8, visual: 2 },
    lines: () => ['降下 12 團火焰'], quality: [inc('skill_duration', 1), '增加 {0}% 技能效果持續時間'],
  }),
  gem({
    id: 'elemental_discharge', name: '元素釋放', color: 'B', req: 28, tags: ['spell', 'area', 'fire', 'cold', 'lightning', 'nova'],
    desc: '同時釋放火焰、冰霜與閃電的大型新星。', behaviour: 'nova',
    spell: { cast: 0.9, crit: 6, dmg: { fire: PHYS_BIG, cold: PHYS_BIG, lightning: [0.1, 1.9] }, scale: 0.55, eff: 0.9 }, mana: [14, 32], params: { radius: 4.2 },
    lines: () => ['同時造成火焰、冰冷與閃電傷害'], quality: [inc('elemental_damage', 1), '增加 {0}% 元素傷害'],
  }),
  gem({
    id: 'frostblink', name: '冰霜閃現', color: 'B', req: 10, tags: ['spell', 'movement', 'cold'],
    desc: '化作冰霧，在冰冷的氣息中向前瞬移很遠的距離。', behaviour: 'blink', spell: { cast: 0.35, dmg: {}, scale: 0, eff: 0 }, mana: [8, 14], params: { distance: 9 },
    lines: () => ['傳送至目標位置（最遠 9）'], quality: [inc('cast_speed', 0.5), '增加 {0}% 施法速度'],
  }),
  gem({
    id: 'raise_archers', name: '召喚骷髏弓手', color: 'B', req: 8, tags: ['spell', 'minion'],
    desc: '喚起會從遠處射擊敵人的骷髏弓手。', behaviour: 'summon', spell: { cast: 0.8, dmg: {}, scale: 0, eff: 0 }, mana: [10, 24], minion: 'minion_archer', params: { count: 1, max: 4 },
    lines: (l) => ['召喚 1 名骷髏弓手', '最多 4 名', `召喚物等級 ${Math.min(80, 1 + (l - 1) * 3.6) | 0}`], quality: [inc('minion_damage', 1), '召喚物傷害增加 {0}%'],
  }),
  gem({
    id: 'raise_ice_mage', name: '召喚冰霜術士', color: 'B', req: 16, tags: ['spell', 'minion', 'cold'],
    desc: '喚起會施放冰霜彈的術士，在後方支援你。', behaviour: 'summon', spell: { cast: 0.9, dmg: {}, scale: 0, eff: 0 }, mana: [14, 30], minion: 'minion_ice_mage', params: { count: 1, max: 3 },
    lines: (l) => ['召喚 1 名冰霜術士', '最多 3 名', `召喚物等級 ${Math.min(80, 1 + (l - 1) * 3.6) | 0}`], quality: [inc('minion_life', 1), '召喚物最大生命增加 {0}%'],
  }),
  gem({
    id: 'raise_golem', name: '召喚石魔像', color: 'B', req: 12, tags: ['spell', 'minion'],
    desc: '以大地之力塑出堅不可摧的石魔像，替你擋在最前線。', behaviour: 'summon', spell: { cast: 1, dmg: {}, scale: 0, eff: 0 }, mana: [16, 34], minion: 'minion_golem', params: { count: 1, max: 1 },
    lines: (l) => ['召喚 1 隻石魔像', '最多 1 隻', `召喚物等級 ${Math.min(80, 1 + (l - 1) * 3.6) | 0}`], quality: [inc('minion_life', 1), '召喚物最大生命增加 {0}%'],
  }),
];
