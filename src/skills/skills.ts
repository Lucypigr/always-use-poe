import { getBase } from '../data/bases';
import { getGem, type GemDef, type SkillTag } from '../data/gems';
import { lvl, spellDamage, gemReqLevel } from '../data/scaling';
import type { CharacterData } from '../game/character';
import { localSheet, weaponProps } from '../items/item';
import type { Item } from '../items/types';
import { type CharacterStats, UNARMED } from '../stats/character';
import { DAMAGE_TYPES, type DamageType, type StatKey, StatSheet, type StatMod } from '../stats/stats';
import { gemRequirements } from './gemUtil';

/**
 * Resolving skills: every active gem in equipped gear becomes a SkillInstance that carries
 * the linked support gems that can support it, plus a stat sheet combining the character's
 * global stats with the skill-local modifiers (gem level stats, quality, supports).
 */

export interface SupportInstance {
  def: GemDef;
  level: number;
  quality: number;
  item: Item;
}

export interface SkillInstance {
  uid: string;
  gem: GemDef;
  item?: Item;
  host?: Item;
  level: number;
  quality: number;
  supports: SupportInstance[];
  tags: Set<SkillTag>;
  sheet: StatSheet;
  usable: boolean;
  reason?: string;
}

export const DEFAULT_ATTACK: GemDef = {
  id: 'default_attack', name: 'Default Attack', color: 'R', reqLevel: 1, tags: ['attack', 'melee'],
  description: 'Attack with your weapon.',
  active: { behaviour: 'melee', weaponDamage: [100, 100], manaCost: [0, 0], params: { arc: 0 } },
  quality: [], qualityText: '',
};

export const DEFAULT_RANGED: GemDef = {
  id: 'default_attack', name: 'Default Attack', color: 'G', reqLevel: 1, tags: ['attack', 'projectile'],
  description: 'Attack with your weapon.',
  active: { behaviour: 'projectile', weaponDamage: [100, 100], manaCost: [0, 0], params: { count: 1, spread: 0, speed: 24, range: 14, size: 0.25, visual: 1 } },
  quality: [], qualityText: '',
};

export function supportCompatible(support: GemDef, tags: Set<SkillTag>): boolean {
  const s = support.support;
  if (!s) return false;
  if (s.noneOf?.some((t) => tags.has(t))) return false;
  return s.anyOf.some((t) => tags.has(t));
}

function weaponCheck(gem: GemDef, weapon?: Item): string | undefined {
  const a = gem.active;
  if (!a || !gem.tags.includes('attack')) return undefined;
  const base = weapon ? getBase(weapon.baseId) : undefined;
  if (a.weapons && (!base || !a.weapons.includes(base.cls as never))) return `Requires a ${a.weapons.join(' or ')}`;
  if (gem.tags.includes('melee') && base && !base.tags.includes('melee')) return 'Requires a melee weapon';
  return undefined;
}

function meetsGemReq(def: GemDef, level: number, char: CharacterData, stats: CharacterStats): string | undefined {
  const req = gemRequirements(def, level);
  if (req.level > char.level) return `Requires level ${req.level}`;
  const have = stats[req.attr];
  if (have < req.value) return `Requires ${req.value} ${req.attr === 'str' ? 'Strength' : req.attr === 'dex' ? 'Dexterity' : 'Intelligence'}`;
  return undefined;
}

function gemLevelBonus(def: GemDef, host: Item | undefined, stats: CharacterStats): number {
  let bonus = 0;
  if (host) bonus += localSheet(host).flat('socketed_gem_level');
  if (def.tags.includes('spell')) bonus += stats.sheet.flat('spell_gem_level');
  bonus += stats.sheet.flat('gem_level');
  return bonus;
}

function skillLocalMods(def: GemDef, level: number, quality: number): StatMod[] {
  const out: StatMod[] = [];
  if (def.active?.levelStats) out.push(...def.active.levelStats(level));
  for (const q of def.quality) out.push({ ...q, value: q.value * quality });
  return out;
}

export function buildSkill(
  gem: GemDef,
  char: CharacterData,
  stats: CharacterStats,
  opts: { item?: Item; host?: Item; supports?: SupportInstance[] } = {},
): SkillInstance {
  const baseLevel = opts.item?.gem?.level ?? 1;
  const level = Math.min(30, baseLevel + gemLevelBonus(gem, opts.host, stats));
  const quality = opts.item?.quality ?? 0;
  const tags = new Set<SkillTag>(gem.tags);
  const supports = (opts.supports ?? []).filter((s) => supportCompatible(s.def, tags));
  const sheet = stats.sheet.clone();
  sheet.addAll(skillLocalMods(gem, level, quality));
  for (const s of supports) {
    sheet.addAll(s.def.support!.stats(s.level));
    for (const q of s.def.quality) sheet.add({ ...q, value: q.value * s.quality });
  }
  let reason = opts.item ? meetsGemReq(gem, baseLevel, char, stats) : undefined;
  reason ??= weaponCheck(gem, char.equipment.weapon);
  return { uid: opts.item?.uid ?? gem.id, gem, item: opts.item, host: opts.host, level, quality, supports, tags, sheet, usable: !reason, reason };
}

/** Resolve all active skills granted by equipped gear, plus the default attack. */
export function resolveSkills(char: CharacterData, stats: CharacterStats): Map<string, SkillInstance> {
  const out = new Map<string, SkillInstance>();
  const weapon = char.equipment.weapon;
  const wbase = weapon ? getBase(weapon.baseId) : undefined;
  const ranged = !!wbase && (wbase.cls === 'bow' || wbase.cls === 'wand');
  out.set('default_attack', buildSkill(ranged ? DEFAULT_RANGED : DEFAULT_ATTACK, char, stats));

  for (const [slot, host] of Object.entries(char.equipment)) {
    if (!host || slot.startsWith('flask')) continue;
    for (const socket of host.sockets) {
      const gemItem = socket.gem;
      if (!gemItem?.gem) continue;
      const def = getGem(gemItem.gem.id);
      if (!def.active) continue;
      const supports: SupportInstance[] = [];
      for (const other of host.sockets) {
        if (other === socket || other.group !== socket.group || !other.gem?.gem) continue;
        const sdef = getGem(other.gem.gem.id);
        if (!sdef.support) continue;
        const sl = Math.min(30, other.gem.gem.level + gemLevelBonus(sdef, host, stats));
        if (meetsGemReq(sdef, other.gem.gem.level, char, stats)) continue;
        supports.push({ def: sdef, level: sl, quality: other.gem.quality, item: other.gem });
      }
      out.set(gemItem.uid, buildSkill(def, char, stats, { item: gemItem, host, supports }));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Damage & skill statistics
// ---------------------------------------------------------------------------------------------

export type DamageRange = Record<DamageType, [number, number]>;

export interface SkillStats {
  isAttack: boolean;
  isSpell: boolean;
  damage: DamageRange;
  critChance: number;
  critMulti: number;
  /** Uses per second (a "use" includes all repeats). */
  usesPerSecond: number;
  /** Seconds a single use locks the caster for. */
  actionTime: number;
  hitsPerUse: number;
  manaCost: number;
  lifeCost: number;
  reservation: number;
  accuracy: number;
  areaMult: number;
  projectiles: number;
  pierce: number;
  chain: number;
  fork: boolean;
  durationMult: number;
  projSpeedMult: number;
  igniteChance: number;
  freezeChance: number;
  shockChance: number;
  bleedChance: number;
  poisonChance: number;
  cannotAilment: boolean;
  chillEffect: number;
  shockEffect: number;
  burnMult: number;
  poisonMult: number;
  bleedMult: number;
  pen: { fire: number; cold: number; lightning: number };
  lifeLeech: number;
  manaLeech: number;
  lifeOnHit: number;
  culling: boolean;
  knockback: boolean;
  splash: boolean;
  vsChilledMore: number;
  closeQuarters: boolean;
  range: number;
  averageHit: number;
  dps: number;
}

const TYPE_KEY: Record<DamageType, StatKey> = {
  phys: 'phys_damage', fire: 'fire_damage', cold: 'cold_damage', lightning: 'lightning_damage', chaos: 'chaos_damage',
};
const ELEMENTAL = new Set<DamageType>(['fire', 'cold', 'lightning']);

export function emptyRange(): DamageRange {
  return { phys: [0, 0], fire: [0, 0], cold: [0, 0], lightning: [0, 0], chaos: [0, 0] };
}

interface Component {
  type: DamageType;
  min: number;
  max: number;
  from: DamageType[];
}

/** Keys (for both "increased" and "more") that apply to a damage component. */
export function scalingKeys(from: DamageType[], tags: Set<SkillTag>, extra: StatKey[] = []): StatKey[] {
  const keys: StatKey[] = ['damage', ...extra];
  const set = new Set(from);
  for (const t of set) keys.push(TYPE_KEY[t]);
  if ([...set].some((t) => ELEMENTAL.has(t))) keys.push('elemental_damage');
  if (tags.has('attack')) keys.push('attack_damage');
  if (tags.has('spell')) keys.push('spell_damage');
  if (tags.has('melee')) {
    keys.push('melee_damage');
    if (set.has('phys')) keys.push('melee_phys_damage');
  }
  if (tags.has('projectile')) keys.push('projectile_damage');
  if (tags.has('area')) keys.push('area_damage');
  if (tags.has('bow')) keys.push('bow_damage');
  return keys;
}

/**
 * Apply conversion, "gained as extra", and increased/more scaling to base damage.
 * Shared by player skills, minions and monsters.
 */
export function scaleDamage(base: DamageRange, sheet: StatSheet, tags: Set<SkillTag>, conversion: Partial<Record<DamageType, number>> = {}, extraKeys: StatKey[] = []): DamageRange {
  const comps: Component[] = [];
  const [pmin, pmax] = base.phys;
  const conv = {
    fire: (conversion.fire ?? 0) + sheet.flat('phys_to_fire'),
    cold: (conversion.cold ?? 0) + sheet.flat('phys_to_cold'),
    lightning: (conversion.lightning ?? 0) + sheet.flat('phys_to_lightning'),
    chaos: (conversion.chaos ?? 0) + sheet.flat('phys_to_chaos'),
  };
  const convTotal = conv.fire + conv.cold + conv.lightning + conv.chaos;
  const convScale = convTotal > 100 ? 100 / convTotal : 1;
  let remaining = 1;
  for (const t of ['fire', 'cold', 'lightning', 'chaos'] as const) {
    const f = (conv[t] * convScale) / 100;
    if (f > 0) {
      comps.push({ type: t, min: pmin * f, max: pmax * f, from: ['phys', t] });
      remaining -= f;
    }
  }
  const physLeft: [number, number] = [pmin * remaining, pmax * remaining];
  if (physLeft[1] > 0) comps.push({ type: 'phys', min: physLeft[0], max: physLeft[1], from: ['phys'] });
  for (const t of ['fire', 'cold', 'lightning', 'chaos'] as const) {
    const [a, b] = base[t];
    if (b > 0) comps.push({ type: t, min: a, max: b, from: [t] });
  }
  // Gained as extra (based on physical damage before conversion, like PoE's "of Physical as Extra")
  const extras: [DamageType, StatKey][] = [['fire', 'phys_as_extra_fire'], ['cold', 'phys_as_extra_cold'], ['lightning', 'phys_as_extra_lightning'], ['chaos', 'phys_as_extra_chaos']];
  for (const [t, key] of extras) {
    const f = sheet.flat(key) / 100;
    if (f > 0 && pmax > 0) comps.push({ type: t, min: pmin * f, max: pmax * f, from: ['phys', t] });
  }
  const out = emptyRange();
  for (const c of comps) {
    const keys = scalingKeys(c.from, tags, extraKeys);
    const mult = Math.max(0, 1 + sheet.inc(...keys) / 100) * sheet.more(...keys);
    out[c.type][0] += c.min * mult;
    out[c.type][1] += c.max * mult;
  }
  // Elemental "gained as extra chaos"
  const eleChaos = sheet.flat('ele_as_extra_chaos') / 100;
  if (eleChaos > 0) {
    for (const t of ['fire', 'cold', 'lightning'] as const) {
      out.chaos[0] += out[t][0] * eleChaos;
      out.chaos[1] += out[t][1] * eleChaos;
    }
  }
  for (const t of DAMAGE_TYPES) out[t] = [Math.round(out[t][0]), Math.round(out[t][1])];
  return out;
}

export function avgDamage(d: DamageRange): number {
  let t = 0;
  for (const k of DAMAGE_TYPES) t += (d[k][0] + d[k][1]) / 2;
  return t;
}

/** Compute everything the game needs to execute a skill and display its numbers. */
export function computeSkillStats(skill: SkillInstance, stats: CharacterStats): SkillStats {
  const s = skill.sheet;
  const a = skill.gem.active!;
  const tags = skill.tags;
  const isAttack = tags.has('attack');
  const isSpell = tags.has('spell');
  const level = skill.level;

  const base = emptyRange();
  let baseCrit = 0;
  let speed = 0;
  let range = 1.2;
  if (isAttack) {
    const wp = stats.weapon ? weaponProps(stats.weapon) : undefined;
    const w = wp ?? { ...UNARMED, ele: { fire: [0, 0], cold: [0, 0], lightning: [0, 0], chaos: [0, 0] } };
    const eff = lvl(a.weaponDamage?.[0] ?? 100, a.weaponDamage?.[1] ?? 100, level) / 100;
    const add = (t: DamageType, lo: number, hi: number) => {
      base[t][0] += lo * eff;
      base[t][1] += hi * eff;
    };
    add('phys', w.phys[0] + s.flat('attack_phys_min'), w.phys[1] + s.flat('attack_phys_max'));
    for (const t of ['fire', 'cold', 'lightning', 'chaos'] as const) {
      const key = t as 'fire' | 'cold' | 'lightning' | 'chaos';
      add(t, w.ele[key][0] + s.flat(`attack_${t}_min` as StatKey), w.ele[key][1] + s.flat(`attack_${t}_max` as StatKey));
    }
    baseCrit = w.crit;
    speed = w.aps * (a.attackSpeedMult ?? 1) * Math.max(0.1, 1 + s.inc('attack_speed') / 100) * s.more('attack_speed');
    range = w.range;
  } else if (isSpell) {
    const req = gemReqLevel(skill.gem.reqLevel, Math.min(level, 20)) + Math.max(0, level - 20) * 2;
    const avg = spellDamage(req) * (a.damageScale ?? 1);
    for (const [t, [lo, hi]] of Object.entries(a.baseDamage ?? {}) as [DamageType, [number, number]][]) {
      base[t][0] += avg * lo;
      base[t][1] += avg * hi;
    }
    const eff = a.effectiveness ?? 1;
    for (const t of DAMAGE_TYPES) {
      base[t][0] += s.flat(`spell_${t}_min` as StatKey) * eff;
      base[t][1] += s.flat(`spell_${t}_max` as StatKey) * eff;
    }
    baseCrit = a.crit ?? 5;
    speed = (1 / (a.castTime ?? 0.8)) * Math.max(0.1, 1 + s.inc('cast_speed') / 100) * s.more('cast_speed');
  }

  const hasDamage = !!(a.baseDamage || a.weaponDamage);
  const damage = hasDamage ? scaleDamage(base, s, tags, a.conversion as Partial<Record<DamageType, number>>) : emptyRange();

  let critChance = (baseCrit + s.flat('base_crit_flat')) * Math.max(0, 1 + (s.inc('crit_chance') + (isSpell ? s.inc('spell_crit_chance') : 0)) / 100) * s.more('crit_chance');
  if (stats.unerring || !hasDamage) critChance = 0;
  critChance = Math.min(100, Math.max(0, critChance));
  const critMulti = s.has('ks_elemental_overload') ? 1 : (150 + s.flat('crit_multi')) / 100;

  const repeats = Math.max(0, Math.round(s.flat('repeats')));
  const hitsPerUse = 1 + repeats;
  const actionTime = speed > 0 ? hitsPerUse / speed : 0.4;
  const usesPerSecond = 1 / actionTime;

  const supportMult = skill.supports.reduce((m, sp) => m * sp.def.support!.manaMult, 1);
  const rawCost = lvl(a.manaCost[0], a.manaCost[1], level) * supportMult * Math.max(0, 1 + s.inc('mana_cost') / 100) * s.more('mana_cost');
  const cost = Math.round(rawCost);
  const reservation = a.reservation ? Math.min(100, Math.round(a.reservation * supportMult * Math.max(0, 1 + s.inc('reservation') / 100) * s.more('reservation'))) : 0;

  const cannotAilment = s.has('cannot_ailment');
  const avg = avgDamage(damage);
  const effCrit = critChance / 100;
  const avgHit = avg * (1 - effCrit + effCrit * critMulti);

  return {
    isAttack,
    isSpell,
    damage,
    critChance,
    critMulti,
    usesPerSecond,
    actionTime,
    hitsPerUse,
    manaCost: stats.bloodPact ? 0 : cost,
    lifeCost: stats.bloodPact ? cost : 0,
    reservation,
    accuracy: stats.accuracy,
    areaMult: Math.sqrt(Math.max(0.1, (1 + s.inc('area_of_effect') / 100) * s.more('area_of_effect'))),
    projectiles: Math.max(1, (a.params.count ?? 1) + s.flat('additional_projectiles')),
    pierce: s.flat('pierce'),
    chain: (a.params.chains ?? 0) + s.flat('chain'),
    fork: s.has('fork'),
    durationMult: Math.max(0.1, 1 + s.inc('skill_duration') / 100),
    projSpeedMult: Math.max(0.2, 1 + s.inc('projectile_speed') / 100),
    igniteChance: cannotAilment ? 0 : s.flat('ignite_chance'),
    freezeChance: cannotAilment ? 0 : s.flat('freeze_chance'),
    shockChance: cannotAilment ? 0 : s.flat('shock_chance'),
    bleedChance: s.flat('bleed_chance'),
    poisonChance: s.flat('poison_chance'),
    cannotAilment,
    chillEffect: 1 + s.inc('chill_effect') / 100,
    shockEffect: 1 + s.inc('shock_effect') / 100,
    burnMult: Math.max(0, 1 + s.inc('burning_damage', 'dot_damage') / 100) * s.more('burning_damage', 'dot_damage'),
    poisonMult: Math.max(0, 1 + s.inc('poison_damage', 'dot_damage', 'chaos_damage') / 100) * s.more('poison_damage', 'dot_damage'),
    bleedMult: Math.max(0, 1 + s.inc('bleed_damage', 'dot_damage', 'phys_damage') / 100) * s.more('bleed_damage', 'dot_damage'),
    pen: { fire: s.flat('fire_pen'), cold: s.flat('cold_pen'), lightning: s.flat('lightning_pen') },
    lifeLeech: s.flat('life_leech') / 100,
    manaLeech: s.flat('mana_leech') / 100,
    lifeOnHit: s.flat('life_on_hit'),
    culling: s.has('culling_strike'),
    knockback: s.has('knockback'),
    splash: s.has('splash'),
    vsChilledMore: s.more('damage_vs_chilled'),
    closeQuarters: s.has('ks_close_quarters'),
    range,
    averageHit: avgHit,
    dps: avgHit * usesPerSecond * hitsPerUse,
  };
}

/** Minion stats derived from the summoning skill. */
export interface MinionStats {
  level: number;
  life: number;
  damage: [number, number];
  attackSpeed: number;
  moveSpeed: number;
  max: number;
}

export function computeMinionStats(skill: SkillInstance, monsterLife: (l: number) => number, monsterDamage: (l: number) => number): MinionStats {
  const s = skill.sheet;
  const level = Math.min(80, Math.max(1, Math.round(1 + (skill.level - 1) * 3.6)));
  const lifeMult = Math.max(0.1, 1 + s.inc('minion_life') / 100) * s.more('minion_life');
  const dmgMult = Math.max(0.1, 1 + s.inc('minion_damage') / 100) * s.more('minion_damage');
  const speedMult = Math.max(0.2, 1 + s.inc('minion_speed') / 100);
  const avg = monsterDamage(level) * 1.5 * dmgMult;
  return {
    level,
    life: Math.round(monsterLife(level) * 3 * lifeMult),
    damage: [Math.round(avg * 0.8), Math.round(avg * 1.2)],
    attackSpeed: 1.3 * speedMult,
    moveSpeed: 5.2 * speedMult,
    max: (skill.gem.active?.params.max ?? 4) + s.flat('minion_count'),
  };
}
