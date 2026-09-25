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
    id: 'life', angle: 200, small: node('Life', T('life', 6, '6% increased maximum Life')),
    notables: [
      node('Heart of Oak', T('life', 12, '12% increased maximum Life'), T('life_regen_pct', 0.8, 'Regenerate 0.8% of Life per second', 'flat')),
      node('Blood of the Mountain', T('life', 10, '10% increased maximum Life'), T('str', 15, '+15 to Strength', 'flat')),
      node('Unbroken Will', T('life', 12, '12% increased maximum Life'), T('damage_taken', -4, '4% reduced Damage taken')),
      node('Enduring Flesh', T('life', 14, '14% increased maximum Life'), T('life_on_kill', 5, 'Gain 5 Life per Enemy Killed', 'flat')),
    ],
  },
  {
    id: 'armour', angle: 225, small: node('Armour', T('armour', 16, '16% increased Armour')),
    notables: [
      node('Iron Hide', T('armour', 35, '35% increased Armour'), T('life', 5, '5% increased maximum Life')),
      node('Stone Skin', T('armour', 30, '30% increased Armour'), T('phys_damage_reduction', 2, '2% additional Physical Damage Reduction', 'flat')),
      node('Bastion of Iron', T('armour', 40, '40% increased Armour'), T('life_regen_pct', 0.5, 'Regenerate 0.5% of Life per second', 'flat')),
    ],
  },
  {
    id: 'melee', angle: 245, small: node('Melee Damage', T('melee_damage', 12, '12% increased Melee Damage')),
    notables: [
      node('Savage Onslaught', T('melee_damage', 22, '22% increased Melee Damage'), T('attack_speed', 4, '4% increased Attack Speed')),
      node('Bone Breaker', T('phys_damage', 20, '20% increased Physical Damage'), T('melee_damage', 15, '15% increased Melee Damage')),
      node('Crushing Momentum', T('melee_damage', 25, '25% increased Melee Damage'), T('area_of_effect', 6, '6% increased Area of Effect')),
    ],
  },
  {
    id: 'leech', angle: 265, small: node('Life Leech', T('life_leech', 0.2, '0.2% of Attack Damage Leeched as Life', 'flat')),
    notables: [
      node('Crimson Thirst', T('life_leech', 0.6, '0.6% of Attack Damage Leeched as Life', 'flat'), T('attack_damage', 12, '12% increased Attack Damage')),
      node('Sanguine Edge', T('life_on_hit', 4, 'Gain 4 Life per Enemy Hit', 'flat'), T('phys_damage', 15, '15% increased Physical Damage')),
    ],
  },
  {
    id: 'attack_speed', angle: 290, small: node('Attack Speed', T('attack_speed', 4, '4% increased Attack Speed')),
    notables: [
      node('Flurry of Blows', T('attack_speed', 8, '8% increased Attack Speed'), T('accuracy', 100, '+100 to Accuracy Rating', 'flat')),
      node('Blade Dancer', T('attack_speed', 7, '7% increased Attack Speed'), T('movement_speed', 4, '4% increased Movement Speed')),
      node('Eye of the Hawk', T('accuracy', 30, '30% increased Accuracy Rating'), T('attack_damage', 15, '15% increased Attack Damage')),
    ],
  },
  {
    id: 'flask', angle: 280, small: node('Flask Charges', T('flask_charges', 8, '8% increased Flask Charges gained')),
    notables: [
      node('Alchemist\'s Grace', T('flask_duration', 15, '15% increased Flask Effect Duration'), T('flask_recovery', 15, '15% increased Flask Recovery')),
      node('Bottomless Draught', T('flask_charges', 25, '25% increased Flask Charges gained'), T('flask_recovery', 10, '10% increased Flask Recovery')),
    ],
  },
  {
    id: 'evasion', angle: 320, small: node('Evasion', T('evasion', 16, '16% increased Evasion Rating')),
    notables: [
      node('Fleet of Foot', T('evasion', 30, '30% increased Evasion Rating'), T('movement_speed', 5, '5% increased Movement Speed')),
      node('Ghost Dance', T('evasion', 35, '35% increased Evasion Rating'), T('life', 5, '5% increased maximum Life')),
      node('Windborn', T('evasion', 25, '25% increased Evasion Rating'), T('dex', 20, '+20 to Dexterity', 'flat')),
    ],
  },
  {
    id: 'projectile', angle: 345, small: node('Projectile Damage', T('projectile_damage', 12, '12% increased Projectile Damage')),
    notables: [
      node('Deadeye\'s Mark', T('projectile_damage', 22, '22% increased Projectile Damage'), T('projectile_speed', 15, '15% increased Projectile Speed')),
      node('Hail of Arrows', T('projectile_damage', 18, '18% increased Projectile Damage'), T('attack_speed', 6, '6% increased Attack Speed')),
      node('Far Shot', T('projectile_damage', 25, '25% increased Projectile Damage'), T('accuracy', 80, '+80 to Accuracy Rating', 'flat')),
    ],
  },
  {
    id: 'chaos', angle: 10, small: node('Chaos Damage', T('chaos_damage', 12, '12% increased Chaos Damage')),
    notables: [
      node('Toxic Blood', T('poison_chance', 10, '10% chance to Poison on Hit', 'flat'), T('poison_damage', 20, '20% increased Damage with Poison')),
      node('Blight Heart', T('chaos_damage', 22, '22% increased Chaos Damage'), T('chaos_res', 12, '+12% to Chaos Resistance', 'flat')),
    ],
  },
  {
    id: 'crit', angle: 30, small: node('Critical Strikes', T('crit_chance', 15, '15% increased Critical Strike Chance')),
    notables: [
      node('Assassin\'s Focus', T('crit_chance', 30, '30% increased Critical Strike Chance'), T('crit_multi', 20, '+20% to Critical Strike Multiplier', 'flat')),
      node('Killing Intent', T('crit_multi', 30, '+30% to Critical Strike Multiplier', 'flat')),
      node('Razor Mind', T('crit_chance', 35, '35% increased Critical Strike Chance'), T('spell_crit_chance', 20, '20% increased Critical Strike Chance for Spells')),
    ],
  },
  {
    id: 'cold', angle: 50, small: node('Cold Damage', T('cold_damage', 12, '12% increased Cold Damage')),
    notables: [
      node('Heart of Winter', T('cold_damage', 25, '25% increased Cold Damage'), T('freeze_chance', 5, '5% chance to Freeze', 'flat')),
      node('Hoarfrost', T('cold_damage', 20, '20% increased Cold Damage'), T('chill_effect', 15, '15% increased Effect of Chill')),
      node('Glacial Mind', T('cold_damage', 22, '22% increased Cold Damage'), T('cold_pen', 5, 'Damage Penetrates 5% Cold Resistance', 'flat')),
    ],
  },
  {
    id: 'spell', angle: 75, small: node('Spell Damage', T('spell_damage', 10, '10% increased Spell Damage')),
    notables: [
      node('Arcane Potency', T('spell_damage', 22, '22% increased Spell Damage'), T('cast_speed', 5, '5% increased Cast Speed')),
      node('Mind over Flesh', T('spell_damage', 18, '18% increased Spell Damage'), T('mana', 10, '10% increased maximum Mana')),
      node('Spellweaver', T('cast_speed', 10, '10% increased Cast Speed'), T('spell_damage', 12, '12% increased Spell Damage')),
      node('Sorcerous Might', T('spell_damage', 25, '25% increased Spell Damage'), T('spell_crit_chance', 25, '25% increased Critical Strike Chance for Spells')),
    ],
  },
  {
    id: 'mana', angle: 85, small: node('Mana', T('mana', 8, '8% increased maximum Mana'), T('mana_regen', 8, '8% increased Mana Regeneration Rate')),
    notables: [
      node('Wellspring', T('mana', 14, '14% increased maximum Mana'), T('mana_regen', 25, '25% increased Mana Regeneration Rate')),
      node('Frugal Mind', T('mana_cost', -8, '8% reduced Mana Cost of Skills'), T('mana_regen', 20, '20% increased Mana Regeneration Rate')),
    ],
  },
  {
    id: 'es', angle: 100, small: node('Energy Shield', T('energy_shield', 8, '8% increased maximum Energy Shield')),
    notables: [
      node('Aegis of Thought', T('energy_shield', 18, '18% increased maximum Energy Shield'), T('es_recharge', 15, '15% increased Energy Shield Recharge Rate')),
      node('Crystal Mantle', T('energy_shield', 15, '15% increased maximum Energy Shield'), T('int', 20, '+20 to Intelligence', 'flat')),
      node('Unwavering Ward', T('energy_shield', 20, '20% increased maximum Energy Shield'), T('es_recharge_delay', -20, 'Energy Shield Recharge starts 20% faster')),
    ],
  },
  {
    id: 'lightning', angle: 115, small: node('Lightning Damage', T('lightning_damage', 12, '12% increased Lightning Damage')),
    notables: [
      node('Storm Heart', T('lightning_damage', 25, '25% increased Lightning Damage'), T('shock_chance', 10, '10% chance to Shock', 'flat')),
      node('Conductor', T('lightning_damage', 20, '20% increased Lightning Damage'), T('lightning_pen', 6, 'Damage Penetrates 6% Lightning Resistance', 'flat')),
    ],
  },
  {
    id: 'minion', angle: 125, small: node('Minion Damage', T('minion_damage', 12, 'Minions deal 12% increased Damage'), T('minion_life', 6, 'Minions have 6% increased maximum Life')),
    notables: [
      node('Lord of the Dead', T('minion_damage', 25, 'Minions deal 25% increased Damage'), T('minion_life', 15, 'Minions have 15% increased maximum Life')),
      node('Grave Legion', T('minion_count', 1, '+1 to maximum number of Minions', 'flat'), T('minion_life', 10, 'Minions have 10% increased maximum Life')),
      node('Death\'s Swiftness', T('minion_speed', 15, 'Minions have 15% increased Speed'), T('minion_damage', 15, 'Minions deal 15% increased Damage')),
    ],
  },
  {
    id: 'fire', angle: 140, small: node('Fire Damage', T('fire_damage', 12, '12% increased Fire Damage')),
    notables: [
      node('Pyromaniac', T('fire_damage', 25, '25% increased Fire Damage'), T('ignite_chance', 10, '10% chance to Ignite', 'flat')),
      node('Smoldering Soul', T('burning_damage', 30, '30% increased Burning Damage'), T('fire_damage', 15, '15% increased Fire Damage')),
      node('Fire Walker', T('fire_damage', 20, '20% increased Fire Damage'), T('fire_pen', 6, 'Damage Penetrates 6% Fire Resistance', 'flat')),
    ],
  },
  {
    id: 'block', angle: 158, small: node('Block', T('block', 1, '+1% Chance to Block Attack Damage', 'flat'), T('armour', 6, '6% increased Armour')),
    notables: [
      node('Shield Wall', T('block', 4, '+4% Chance to Block Attack Damage', 'flat'), T('life', 5, '5% increased maximum Life')),
      node('Sacred Bulwark', T('block', 3, '+3% Chance to Block Attack Damage', 'flat'), T('all_ele_res', 10, '+10% to all Elemental Resistances', 'flat')),
    ],
  },
  {
    id: 'area', angle: 175, small: node('Area Damage', T('area_damage', 10, '10% increased Area Damage')),
    notables: [
      node('Cataclysm', T('area_of_effect', 12, '12% increased Area of Effect'), T('area_damage', 15, '15% increased Area Damage')),
      node('Earthquake Heart', T('area_damage', 25, '25% increased Area Damage'), T('str', 15, '+15 to Strength', 'flat')),
    ],
  },
  {
    id: 'resist', angle: 185, small: node('Resistances', T('all_ele_res', 6, '+6% to all Elemental Resistances', 'flat')),
    notables: [
      node('Elemental Warding', T('all_ele_res', 15, '+15% to all Elemental Resistances', 'flat'), T('life', 4, '4% increased maximum Life')),
      node('Prismatic Skin', T('max_all_ele_res', 1, '+1% to all maximum Elemental Resistances', 'flat'), T('all_ele_res', 10, '+10% to all Elemental Resistances', 'flat')),
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
  { angle: 330, name: 'Phantom Step', stats: [flag('ks_phantom_step')], text: ['30% chance to avoid all damage from Hits', '50% less Armour and Energy Shield'] },
  { angle: 0, name: 'Close Quarters', stats: [flag('ks_close_quarters')], text: ['Projectiles deal up to 40% more Damage to targets at close range', 'Projectiles deal less Damage to targets far away'] },
  { angle: 30, name: 'Elemental Overload', stats: [flag('ks_elemental_overload')], text: ['40% more Elemental Damage', 'Your Critical Strikes do not deal extra Damage'] },
  { angle: 60, name: 'Arcane Ward', stats: [flag('ks_arcane_ward')], text: ['30% of Damage is taken from Mana before Life'] },
  { angle: 120, name: 'Hollow Vessel', stats: [flag('ks_hollow_vessel')], text: ['Maximum Life becomes 1', 'Immune to Chaos Damage'] },
  { angle: 150, name: 'Wrath of Ages', stats: [flag('ks_wrath_of_ages')], text: ['Deal 30% more Damage', 'Take 15% more Damage'] },
  { angle: 210, name: 'Blood Pact', stats: [flag('ks_blood_pact')], text: ['Removes all Mana', 'Skills cost Life instead of Mana', 'Auras reserve Life instead of Mana'] },
  { angle: 240, name: 'Ironclad', stats: [flag('ks_ironclad')], text: ['Converts all Evasion Rating to Armour', 'Dexterity provides no bonus to Evasion Rating'] },
  { angle: 270, name: 'Unerring Discipline', stats: [flag('ks_unerring')], text: ['Your hits can\'t be Evaded', 'Never deal Critical Strikes'] },
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

const ATTR_LABEL: Record<string, string> = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence' };

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
    return { name: ATTR_LABEL[a], stats: [flat(a, amount)], text: [`+${amount} to ${ATTR_LABEL[a]}`] };
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
    const start = add(250, c.treeAngle, 'start', { name: c.name, stats: [], text: [`${c.name} starting point`] }, c.id);
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
