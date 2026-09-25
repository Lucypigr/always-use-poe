import { RNG } from '../core/rng';
import { flag, flat, inc, more, type StatKey, type StatMod } from '../stats/stats';
import { CLASSES, type ClassId } from './classes';

/**
 * Procedurally laid-out passive skill tree (deterministic seed so saves stay valid).
 *
 * Layout (radial, like Path of Exile's tree):
 *   class starts → three fanned branches → inner attribute ring → spokes & themed clusters
 *   → outer attribute ring → outer notable clusters and keystones.
 * Each region's themes follow the attribute affinity of its angle
 * (Strength bottom-left, Dexterity bottom-right, Intelligence top).
 */

export type PassiveKind = 'start' | 'attr' | 'small' | 'notable' | 'keystone';

export interface PassiveNode {
  id: number;
  x: number;
  y: number;
  kind: PassiveKind;
  name: string;
  stats: StatMod[];
  text: string[];
  links: number[];
  classId?: ClassId;
}

interface Theme {
  id: string;
  angle: number;
  small: { name: string; stats: StatMod[]; text: string[] };
  notables: { name: string; stats: StatMod[]; text: string[] }[];
}

const T = (stat: StatKey, v: number, text: string, kind: 'inc' | 'flat' | 'more' = 'inc') => ({
  mod: kind === 'inc' ? inc(stat, v) : kind === 'flat' ? flat(stat, v) : more(stat, v),
  text,
});
function node(name: string, ...parts: { mod: StatMod; text: string }[]) {
  return { name, stats: parts.map((p) => p.mod), text: parts.map((p) => p.text) };
}

const THEMES: Theme[] = [
  {
    id: 'life', angle: 200, small: node('生命', T('life', 6, '增加 6% 最大生命')),
    notables: [
      node('橡木之心', T('life', 12, '增加 12% 最大生命'), T('life_regen_pct', 0.8, '每秒回復 0.8% 生命', 'flat')),
      node('群山之血', T('life', 10, '增加 10% 最大生命'), T('str', 15, '+15 力量', 'flat')),
      node('不屈意志', T('life', 12, '增加 12% 最大生命'), T('damage_taken', -4, '減少 4% 承受傷害')),
      node('堅韌血肉', T('life', 14, '增加 14% 最大生命'), T('life_on_kill', 5, '每擊殺一名敵人獲得 5 生命', 'flat')),
    ],
  },
  {
    id: 'armour', angle: 225, small: node('護甲', T('armour', 16, '增加 16% 護甲')),
    notables: [
      node('鋼鐵之皮', T('armour', 35, '增加 35% 護甲'), T('life', 5, '增加 5% 最大生命')),
      node('石膚', T('armour', 30, '增加 30% 護甲'), T('phys_damage_reduction', 2, '額外 2% 物理傷害減免', 'flat')),
      node('鋼鐵堡壘', T('armour', 40, '增加 40% 護甲'), T('life_regen_pct', 0.5, '每秒回復 0.5% 生命', 'flat')),
    ],
  },
  {
    id: 'melee', angle: 245, small: node('近戰傷害', T('melee_damage', 12, '增加 12% 近戰傷害')),
    notables: [
      node('野蠻猛攻', T('melee_damage', 22, '增加 22% 近戰傷害'), T('attack_speed', 4, '增加 4% 攻擊速度')),
      node('碎骨者', T('phys_damage', 20, '增加 20% 物理傷害'), T('melee_damage', 15, '增加 15% 近戰傷害')),
      node('粉碎之勢', T('melee_damage', 25, '增加 25% 近戰傷害'), T('area_of_effect', 6, '增加 6% 效果範圍')),
    ],
  },
  {
    id: 'leech', angle: 265, small: node('生命偷取', T('life_leech', 0.2, '0.2% 攻擊傷害轉化為生命偷取', 'flat')),
    notables: [
      node('緋紅渴望', T('life_leech', 0.6, '0.6% 攻擊傷害轉化為生命偷取', 'flat'), T('attack_damage', 12, '增加 12% 攻擊傷害')),
      node('血刃', T('life_on_hit', 4, '每擊中一名敵人獲得 4 生命', 'flat'), T('phys_damage', 15, '增加 15% 物理傷害')),
    ],
  },
  {
    id: 'attack_speed', angle: 290, small: node('攻擊速度', T('attack_speed', 4, '增加 4% 攻擊速度')),
    notables: [
      node('連打', T('attack_speed', 8, '增加 8% 攻擊速度'), T('accuracy', 100, '+100 命中值', 'flat')),
      node('劍舞者', T('attack_speed', 7, '增加 7% 攻擊速度'), T('movement_speed', 4, '增加 4% 移動速度')),
      node('鷹之眼', T('accuracy', 30, '增加 30% 命中值'), T('attack_damage', 15, '增加 15% 攻擊傷害')),
    ],
  },
  {
    id: 'flask', angle: 280, small: node('藥劑充能', T('flask_charges', 8, '增加 8% 獲得的藥劑充能')),
    notables: [
      node('鍊金師之恩', T('flask_duration', 15, '增加 15% 藥劑效果持續時間'), T('flask_recovery', 15, '增加 15% 藥劑回復量')),
      node('無底之飲', T('flask_charges', 25, '增加 25% 獲得的藥劑充能'), T('flask_recovery', 10, '增加 10% 藥劑回復量')),
    ],
  },
  {
    id: 'evasion', angle: 320, small: node('閃避', T('evasion', 16, '增加 16% 閃避值')),
    notables: [
      node('健步如飛', T('evasion', 30, '增加 30% 閃避值'), T('movement_speed', 5, '增加 5% 移動速度')),
      node('幽魂之舞', T('evasion', 35, '增加 35% 閃避值'), T('life', 5, '增加 5% 最大生命')),
      node('風之子', T('evasion', 25, '增加 25% 閃避值'), T('dex', 20, '+20 敏捷', 'flat')),
    ],
  },
  {
    id: 'projectile', angle: 345, small: node('投射物傷害', T('projectile_damage', 12, '增加 12% 投射物傷害')),
    notables: [
      node('銳眼標記', T('projectile_damage', 22, '增加 22% 投射物傷害'), T('projectile_speed', 15, '增加 15% 投射物速度')),
      node('箭雨', T('projectile_damage', 18, '增加 18% 投射物傷害'), T('attack_speed', 6, '增加 6% 攻擊速度')),
      node('遠射', T('projectile_damage', 25, '增加 25% 投射物傷害'), T('accuracy', 80, '+80 命中值', 'flat')),
    ],
  },
  {
    id: 'chaos', angle: 10, small: node('混沌傷害', T('chaos_damage', 12, '增加 12% 混沌傷害')),
    notables: [
      node('毒血', T('poison_chance', 10, '10% 機率擊中時使敵人中毒', 'flat'), T('poison_damage', 20, '增加 20% 中毒傷害')),
      node('凋零之心', T('chaos_damage', 22, '增加 22% 混沌傷害'), T('chaos_res', 12, '+12% 混沌抗性', 'flat')),
    ],
  },
  {
    id: 'crit', angle: 30, small: node('暴擊', T('crit_chance', 15, '增加 15% 暴擊率')),
    notables: [
      node('刺客專注', T('crit_chance', 30, '增加 30% 暴擊率'), T('crit_multi', 20, '+20% 暴擊傷害加成', 'flat')),
      node('殺意', T('crit_multi', 30, '+30% 暴擊傷害加成', 'flat')),
      node('銳利心智', T('crit_chance', 35, '增加 35% 暴擊率'), T('spell_crit_chance', 20, '增加 20% 法術暴擊率')),
    ],
  },
  {
    id: 'cold', angle: 50, small: node('冰冷傷害', T('cold_damage', 12, '增加 12% 冰冷傷害')),
    notables: [
      node('寒冬之心', T('cold_damage', 25, '增加 25% 冰冷傷害'), T('freeze_chance', 5, '5% 機率冰凍', 'flat')),
      node('白霜', T('cold_damage', 20, '增加 20% 冰冷傷害'), T('chill_effect', 15, '增加 15% 冰緩效果')),
      node('冰河心智', T('cold_damage', 22, '增加 22% 冰冷傷害'), T('cold_pen', 5, '傷害穿透 5% 冰冷抗性', 'flat')),
    ],
  },
  {
    id: 'spell', angle: 75, small: node('法術傷害', T('spell_damage', 10, '增加 10% 法術傷害')),
    notables: [
      node('秘法之力', T('spell_damage', 22, '增加 22% 法術傷害'), T('cast_speed', 5, '增加 5% 施法速度')),
      node('心勝於體', T('spell_damage', 18, '增加 18% 法術傷害'), T('mana', 10, '增加 10% 最大魔力')),
      node('法術編織者', T('cast_speed', 10, '增加 10% 施法速度'), T('spell_damage', 12, '增加 12% 法術傷害')),
      node('巫術之力', T('spell_damage', 25, '增加 25% 法術傷害'), T('spell_crit_chance', 25, '增加 25% 法術暴擊率')),
    ],
  },
  {
    id: 'mana', angle: 85, small: node('魔力', T('mana', 8, '增加 8% 最大魔力'), T('mana_regen', 8, '增加 8% 魔力回復速度')),
    notables: [
      node('泉源', T('mana', 14, '增加 14% 最大魔力'), T('mana_regen', 25, '增加 25% 魔力回復速度')),
      node('節儉心智', T('mana_cost', -8, '減少 8% 技能魔力消耗'), T('mana_regen', 20, '增加 20% 魔力回復速度')),
    ],
  },
  {
    id: 'es', angle: 100, small: node('能量護盾', T('energy_shield', 8, '增加 8% 最大能量護盾')),
    notables: [
      node('思緒之盾', T('energy_shield', 18, '增加 18% 最大能量護盾'), T('es_recharge', 15, '增加 15% 能量護盾充能速度')),
      node('水晶斗篷', T('energy_shield', 15, '增加 15% 最大能量護盾'), T('int', 20, '+20 智慧', 'flat')),
      node('不移護衛', T('energy_shield', 20, '增加 20% 最大能量護盾'), T('es_recharge_delay', -20, '能量護盾充能提早 20% 開始')),
    ],
  },
  {
    id: 'lightning', angle: 115, small: node('閃電傷害', T('lightning_damage', 12, '增加 12% 閃電傷害')),
    notables: [
      node('風暴之心', T('lightning_damage', 25, '增加 25% 閃電傷害'), T('shock_chance', 10, '10% 機率感電', 'flat')),
      node('導體', T('lightning_damage', 20, '增加 20% 閃電傷害'), T('lightning_pen', 6, '傷害穿透 6% 閃電抗性', 'flat')),
    ],
  },
  {
    id: 'minion', angle: 125, small: node('召喚物傷害', T('minion_damage', 12, '召喚物傷害增加 12%'), T('minion_life', 6, '召喚物最大生命增加 6%')),
    notables: [
      node('亡者之王', T('minion_damage', 25, '召喚物傷害增加 25%'), T('minion_life', 15, '召喚物最大生命增加 15%')),
      node('墓穴軍團', T('minion_count', 1, '+1 召喚物最大數量', 'flat'), T('minion_life', 10, '召喚物最大生命增加 10%')),
      node('死神迅捷', T('minion_speed', 15, '召喚物速度增加 15%'), T('minion_damage', 15, '召喚物傷害增加 15%')),
    ],
  },
  {
    id: 'fire', angle: 140, small: node('火焰傷害', T('fire_damage', 12, '增加 12% 火焰傷害')),
    notables: [
      node('縱火狂', T('fire_damage', 25, '增加 25% 火焰傷害'), T('ignite_chance', 10, '10% 機率點燃', 'flat')),
      node('悶燒之魂', T('burning_damage', 30, '增加 30% 燃燒傷害'), T('fire_damage', 15, '增加 15% 火焰傷害')),
      node('行火者', T('fire_damage', 20, '增加 20% 火焰傷害'), T('fire_pen', 6, '傷害穿透 6% 火焰抗性', 'flat')),
    ],
  },
  {
    id: 'block', angle: 158, small: node('格擋', T('block', 1, '+1% 攻擊格擋率', 'flat'), T('armour', 6, '增加 6% 護甲')),
    notables: [
      node('盾牆', T('block', 4, '+4% 攻擊格擋率', 'flat'), T('life', 5, '增加 5% 最大生命')),
      node('神聖壁壘', T('block', 3, '+3% 攻擊格擋率', 'flat'), T('all_ele_res', 10, '+10% 全部元素抗性', 'flat')),
    ],
  },
  {
    id: 'area', angle: 175, small: node('範圍傷害', T('area_damage', 10, '增加 10% 範圍傷害')),
    notables: [
      node('災變', T('area_of_effect', 12, '增加 12% 效果範圍'), T('area_damage', 15, '增加 15% 範圍傷害')),
      node('地震之心', T('area_damage', 25, '增加 25% 範圍傷害'), T('str', 15, '+15 力量', 'flat')),
    ],
  },
  {
    id: 'resist', angle: 185, small: node('抗性', T('all_ele_res', 6, '+6% 全部元素抗性', 'flat')),
    notables: [
      node('元素護衛', T('all_ele_res', 15, '+15% 全部元素抗性', 'flat'), T('life', 4, '增加 4% 最大生命')),
      node('稜彩之膚', T('max_all_ele_res', 1, '+1% 全部最大元素抗性', 'flat'), T('all_ele_res', 10, '+10% 全部元素抗性', 'flat')),
    ],
  },
];

interface KeystoneDef {
  angle: number;
  name: string;
  stats: StatMod[];
  text: string[];
}

export const KEYSTONES: KeystoneDef[] = [
  { angle: 330, name: '幻影步', stats: [flag('ks_phantom_step')], text: ['30% 機率迴避擊中的所有傷害', '總減 50% 護甲與能量護盾'] },
  { angle: 0, name: '近身作戰', stats: [flag('ks_close_quarters')], text: ['投射物對近距離目標最多總增 40% 傷害', '投射物對遠處目標造成較少傷害'] },
  { angle: 30, name: '元素超載', stats: [flag('ks_elemental_overload')], text: ['總增 40% 元素傷害', '你的暴擊不會造成額外傷害'] },
  { angle: 60, name: '秘法護衛', stats: [flag('ks_arcane_ward')], text: ['30% 承受傷害先由魔力扣除'] },
  { angle: 120, name: '空虛之器', stats: [flag('ks_hollow_vessel')], text: ['最大生命變為 1', '免疫混沌傷害'] },
  { angle: 150, name: '萬古之怒', stats: [flag('ks_wrath_of_ages')], text: ['造成總增 30% 傷害', '承受總增 15% 傷害'] },
  { angle: 210, name: '血之契約', stats: [flag('ks_blood_pact')], text: ['移除所有魔力', '技能改為消耗生命而非魔力', '光環改為保留生命而非魔力'] },
  { angle: 240, name: '鋼鐵意志', stats: [flag('ks_ironclad')], text: ['所有閃避值轉換為護甲', '敏捷不再提供閃避值加成'] },
  { angle: 270, name: '堅定紀律', stats: [flag('ks_unerring')], text: ['你的擊中無法被閃避', '永遠不會暴擊'] },
];

const ATTR_PEAKS: [StatKey, number][] = [['str', 210], ['dex', 330], ['int', 90]];

function angDist(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  return d;
}

function attrFor(angle: number): StatKey {
  let best: StatKey = 'str';
  let bestD = 999;
  for (const [a, peak] of ATTR_PEAKS) {
    const d = angDist(angle, peak);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

const ATTR_LABEL: Record<string, string> = { str: '力量', dex: '敏捷', int: '智慧' };

function pickTheme(rng: RNG, angle: number, spread = 40): Theme {
  const cands = THEMES.filter((t) => angDist(t.angle, angle) <= spread);
  const list = cands.length ? cands : THEMES;
  return rng.weighted(list, (t) => 1 + (spread - angDist(t.angle, angle))) ?? list[0];
}

export interface PassiveTree {
  nodes: PassiveNode[];
  byId: Map<number, PassiveNode>;
  startOf: Record<ClassId, number>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export function buildPassiveTree(): PassiveTree {
  const rng = new RNG(0xa11ce);
  const nodes: PassiveNode[] = [];
  const polar = (r: number, deg: number) => ({ x: r * Math.cos((deg * Math.PI) / 180), y: -r * Math.sin((deg * Math.PI) / 180) });
  const add = (r: number, deg: number, kind: PassiveKind, data: { name: string; stats: StatMod[]; text: string[] }, classId?: ClassId): number => {
    const p = polar(r, deg);
    const id = nodes.length;
    nodes.push({ id, x: p.x, y: p.y, kind, name: data.name, stats: data.stats, text: data.text.filter(Boolean), links: [], classId });
    return id;
  };
  const link = (a: number, b: number) => {
    if (a === b || nodes[a].links.includes(b)) return;
    nodes[a].links.push(b);
    nodes[b].links.push(a);
  };
  const attrNode = (deg: number, amount = 10) => {
    const a = attrFor(deg);
    return { name: ATTR_LABEL[a], stats: [flat(a, amount)], text: [`+${amount} ${ATTR_LABEL[a]}`] };
  };
  const smallOf = (theme: Theme) => theme.small;
  const usedNotables = new Set<string>();
  const notableOf = (theme: Theme) => {
    const free = theme.notables.filter((n) => !usedNotables.has(n.name));
    const n = free.length ? rng.pick(free) : rng.pick(theme.notables);
    usedNotables.add(n.name);
    return n;
  };

  // 1. Class starts + fanned branches
  const startOf = {} as Record<ClassId, number>;
  const branchEnds: { id: number; deg: number }[] = [];
  for (const c of CLASSES) {
    const start = add(250, c.treeAngle, 'start', { name: c.name, stats: [], text: [`${c.name}的起點`] }, c.id);
    startOf[c.id] = start;
    for (const off of [-16, 0, 16]) {
      let prev = start;
      [330, 410, 490].forEach((r, i) => {
        const deg = c.treeAngle + off * (0.55 + 0.45 * (i / 2));
        const theme = pickTheme(rng, deg, 30);
        const id = add(r, deg, 'small', smallOf(theme));
        link(prev, id);
        prev = id;
      });
      branchEnds.push({ id: prev, deg: c.treeAngle + off });
    }
  }

  // 2. Inner attribute ring
  const ring = (r: number, step: number): { id: number; deg: number }[] => {
    const out: { id: number; deg: number }[] = [];
    for (let deg = 0; deg < 360; deg += step) {
      const id = add(r, deg, 'attr', attrNode(deg));
      if (out.length) link(out[out.length - 1].id, id);
      out.push({ id, deg });
    }
    link(out[0].id, out[out.length - 1].id);
    return out;
  };
  const nearest = (list: { id: number; deg: number }[], deg: number) =>
    list.reduce((best, n) => (angDist(n.deg, deg) < angDist(best.deg, deg) ? n : best), list[0]);

  const ring1 = ring(580, 6);
  for (const end of branchEnds) link(end.id, nearest(ring1, end.deg).id);

  // 3. Outer attribute ring
  const ring2 = ring(960, 5);

  // 4. Spokes between rings every 30°
  for (let deg = 0; deg < 360; deg += 30) {
    let prev = nearest(ring1, deg).id;
    for (const r of [680, 770, 860]) {
      const id = add(r, deg, 'small', smallOf(pickTheme(rng, deg, 25)));
      link(prev, id);
      prev = id;
    }
    link(prev, nearest(ring2, deg).id);
  }

  // 5. Mid clusters between spokes: loop of small nodes around a notable
  for (let k = 0; k < 12; k++) {
    const deg = k * 30 + 15;
    const theme = pickTheme(rng, deg, 30);
    const entry = add(650, deg, 'small', smallOf(theme));
    link(nearest(ring1, deg).id, entry);
    const left = add(720, deg - 5, 'small', smallOf(theme));
    const right = add(720, deg + 5, 'small', smallOf(theme));
    const left2 = add(800, deg - 6, 'small', smallOf(theme));
    const right2 = add(800, deg + 6, 'small', smallOf(theme));
    const notable = add(850, deg, 'notable', notableOf(theme));
    link(entry, left);
    link(entry, right);
    link(left, left2);
    link(right, right2);
    link(left2, notable);
    link(right2, notable);
    if (k % 2 === 0) link(notable, nearest(ring2, deg).id);
  }

  // 6. Outer clusters (dead ends with two notables)
  for (let k = 0; k < 12; k++) {
    const deg = k * 30 + 15;
    const theme = pickTheme(rng, deg, 35);
    const entry = add(1040, deg, 'small', smallOf(theme));
    link(nearest(ring2, deg).id, entry);
    const a = add(1110, deg - 4, 'small', smallOf(theme));
    const b = add(1110, deg + 4, 'small', smallOf(theme));
    const n1 = add(1190, deg - 5, 'notable', notableOf(theme));
    const theme2 = pickTheme(rng, deg, 35);
    const n2 = add(1190, deg + 5, 'notable', notableOf(theme2));
    link(entry, a);
    link(entry, b);
    link(a, n1);
    link(b, n2);
  }

  // 7. Keystones
  for (const ks of KEYSTONES) {
    let prev = nearest(ring2, ks.angle).id;
    for (const r of [1040, 1115]) {
      const id = add(r, ks.angle, 'attr', attrNode(ks.angle, 10));
      link(prev, id);
      prev = id;
    }
    const id = add(1210, ks.angle, 'keystone', { name: ks.name, stats: ks.stats, text: ks.text });
    link(prev, id);
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  return {
    nodes,
    byId,
    startOf,
    bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
  };
}

export const PASSIVE_TREE = buildPassiveTree();

/** Shortest path (by node count) from any allocated node to `target`, excluding already allocated nodes. */
export function pathToNode(tree: PassiveTree, allocated: Set<number>, target: number): number[] | null {
  if (allocated.has(target)) return [];
  const prev = new Map<number, number>();
  const queue: number[] = [];
  for (const id of allocated) {
    queue.push(id);
    prev.set(id, -1);
  }
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === target) break;
    for (const nb of tree.byId.get(cur)!.links) {
      if (prev.has(nb)) continue;
      const n = tree.byId.get(nb)!;
      if (n.kind === 'start' && !allocated.has(nb)) continue; // cannot path through other class starts
      prev.set(nb, cur);
      queue.push(nb);
    }
  }
  if (!prev.has(target)) return null;
  const path: number[] = [];
  let cur = target;
  while (cur !== -1 && !allocated.has(cur)) {
    path.unshift(cur);
    cur = prev.get(cur)!;
  }
  return path;
}

/** Whether a node can be refunded without disconnecting other allocated nodes from the start. */
export function canRefund(tree: PassiveTree, allocated: Set<number>, nodeId: number, startId: number): boolean {
  if (nodeId === startId || !allocated.has(nodeId)) return false;
  const remaining = new Set(allocated);
  remaining.delete(nodeId);
  const seen = new Set<number>([startId]);
  const stack = [startId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const nb of tree.byId.get(cur)!.links) {
      if (remaining.has(nb) && !seen.has(nb)) {
        seen.add(nb);
        stack.push(nb);
      }
    }
  }
  return seen.size === remaining.size;
}

export function passiveStats(tree: PassiveTree, allocated: Iterable<number>): StatMod[] {
  const out: StatMod[] = [];
  for (const id of allocated) {
    const n = tree.byId.get(id);
    if (n) out.push(...n.stats);
  }
  return out;
}
