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
    id: 'crushing_blow', name: 'Crushing Blow', color: 'R', reqLevel: 1,
    tags: ['attack', 'melee', 'strike', 'physical'],
    description: 'Strikes a single enemy with a devastating blow that knocks it back.',
    active: {
      behaviour: 'melee', weaponDamage: [150, 260], manaCost: [5, 9], params: { arc: 0 },
      levelStats: () => [flag('knockback')],
      levelText: (l) => [`Deals ${L(150, 260)(l)}% of Base Attack Damage`, 'Knocks enemies back on hit'],
    },
    quality: [inc('damage', 1)], qualityText: '{0}% increased Damage',
  },
  {
    id: 'sweeping_cleave', name: 'Sweeping Cleave', color: 'R', reqLevel: 1,
    tags: ['attack', 'melee', 'area', 'physical'],
    description: 'Swings in a wide arc, hitting every enemy in front of you.',
    active: {
      behaviour: 'melee', weaponDamage: [95, 155], attackSpeedMult: 0.95, manaCost: [6, 10], params: { arc: 170, radius: 2.4 },
      levelText: (l) => [`Deals ${L(95, 155)(l)}% of Base Attack Damage`],
    },
    quality: [inc('area_of_effect', 0.5)], qualityText: '{0}% increased Area of Effect',
  },
  {
    id: 'earthshatter', name: 'Earthshatter', color: 'R', reqLevel: 12,
    tags: ['attack', 'melee', 'area', 'slam', 'physical'],
    description: 'Slams the ground, sending a shockwave through enemies in a cone.',
    active: {
      behaviour: 'slam', weaponDamage: [145, 235], attackSpeedMult: 0.8, manaCost: [8, 14], params: { angle: 50, length: 5.5 },
      levelText: (l) => [`Deals ${L(145, 235)(l)}% of Base Attack Damage`],
    },
    quality: [inc('area_damage', 1)], qualityText: '{0}% increased Area Damage',
  },
  {
    id: 'magma_strike', name: 'Magma Strike', color: 'R', reqLevel: 1,
    tags: ['attack', 'melee', 'projectile', 'area', 'fire'],
    description: 'Strikes an enemy, converting some of the damage to fire, and launches molten globules that explode nearby.',
    active: {
      behaviour: 'strike_projectile', weaponDamage: [110, 175], manaCost: [6, 10], conversion: { fire: 60 },
      params: { count: 3, explodeRadius: 1.4, mode: 1 },
      levelStats: (l) => (l >= 10 ? [flat('additional_projectiles', l >= 20 ? 2 : 1)] : []),
      levelText: (l) => [`Deals ${L(110, 175)(l)}% of Base Attack Damage`, '60% of Physical Damage Converted to Fire Damage', `Launches ${3 + (l >= 20 ? 2 : l >= 10 ? 1 : 0)} molten projectiles`],
    },
    quality: [inc('projectile_damage', 1)], qualityText: '{0}% increased Projectile Damage',
  },
  {
    id: 'leap_slam', name: 'Leap Slam', color: 'R', reqLevel: 10,
    tags: ['attack', 'melee', 'area', 'slam', 'movement'],
    description: 'Leaps through the air to the target location, damaging enemies where you land.',
    active: {
      behaviour: 'leap', weaponDamage: [100, 150], attackSpeedMult: 0.8, manaCost: [10, 15], params: { radius: 2.2, maxDist: 9 },
      levelText: (l) => [`Deals ${L(100, 150)(l)}% of Base Attack Damage`],
    },
    quality: [inc('attack_speed', 0.5)], qualityText: '{0}% increased Attack Speed',
  },
  {
    id: 'bulwark', name: 'Bulwark', color: 'R', reqLevel: 24,
    tags: ['aura', 'area'],
    description: 'Casts an aura that fortifies you with additional armour.',
    active: {
      behaviour: 'aura', manaCost: [0, 0], reservation: 50, params: {},
      levelStats: (l) => [flat('armour', L(60, 900)(l)), more('armour', L(20, 32)(l))],
      levelText: (l) => [`+${L(60, 900)(l)} to Armour`, `${L(20, 32)(l)}% more Armour`],
    },
    quality: [inc('armour', 1)], qualityText: '{0}% increased Armour',
  },
  {
    id: 'ashen_fury', name: 'Ashen Fury', color: 'R', reqLevel: 24,
    tags: ['aura', 'area', 'fire'],
    description: 'Casts an aura that adds fire damage to your attacks and spells.',
    active: {
      behaviour: 'aura', manaCost: [0, 0], reservation: 50, params: {}, auraAffectsAllies: true,
      levelStats: (l) => {
        const lo = L(4, 60)(l), hi = L(7, 95)(l);
        return [flat('attack_fire_min', lo), flat('attack_fire_max', hi), flat('spell_fire_min', r(lo * 0.7)), flat('spell_fire_max', r(hi * 0.7))];
      },
      levelText: (l) => [`Adds ${L(4, 60)(l)} to ${L(7, 95)(l)} Fire Damage to Attacks`, `Adds ${r(L(4, 60)(l) * 0.7)} to ${r(L(7, 95)(l) * 0.7)} Fire Damage to Spells`],
    },
    quality: [inc('fire_damage', 0.5)], qualityText: '{0}% increased Fire Damage',
  },

  // ============================================================================ DEXTERITY (green)
  {
    id: 'split_shot', name: 'Split Shot', color: 'G', reqLevel: 1,
    tags: ['attack', 'projectile', 'bow'],
    description: 'Fires a fan of arrows at once.',
    active: {
      behaviour: 'projectile', weaponDamage: [90, 145], manaCost: [6, 9], weapons: BOW,
      params: { count: 5, spread: 40, speed: 24, range: 15, size: 0.25, visual: 1 },
      levelText: (l) => [`Deals ${L(90, 145)(l)}% of Base Attack Damage`, 'Fires 5 arrows'],
    },
    quality: [inc('projectile_damage', 1)], qualityText: '{0}% increased Projectile Damage',
  },
  {
    id: 'storm_arrow', name: 'Storm Arrow', color: 'G', reqLevel: 12,
    tags: ['attack', 'projectile', 'area', 'lightning', 'bow'],
    description: 'Fires a charged arrow. When it hits, lightning strikes additional nearby enemies.',
    active: {
      behaviour: 'projectile', weaponDamage: [100, 165], manaCost: [7, 11], weapons: BOW, conversion: { lightning: 50 },
      params: { count: 1, spread: 0, speed: 28, range: 16, size: 0.3, strikes: 3, strikeRadius: 3.2, visual: 2 },
      levelText: (l) => [`Deals ${L(100, 165)(l)}% of Base Attack Damage`, '50% of Physical Damage Converted to Lightning Damage', 'Strikes 3 nearby enemies on hit'],
    },
    quality: [inc('area_of_effect', 0.5)], qualityText: '{0}% increased Area of Effect',
  },
  {
    id: 'arrow_rain', name: 'Arrow Rain', color: 'G', reqLevel: 24,
    tags: ['attack', 'area', 'bow'],
    description: 'Fires a volley into the sky that rains down on the target area.',
    active: {
      behaviour: 'rain', weaponDamage: [70, 110], manaCost: [10, 15], weapons: BOW,
      params: { radius: 2.6, impacts: 8, impactRadius: 0.9, duration: 0.8, visual: 1 },
      levelText: (l) => [`Deals ${L(70, 110)(l)}% of Base Attack Damage per arrow`],
    },
    quality: [inc('area_damage', 1)], qualityText: '{0}% increased Area Damage',
  },
  {
    id: 'venom_strike', name: 'Venom Strike', color: 'G', reqLevel: 1,
    tags: ['attack', 'melee', 'strike', 'chaos', 'duration'],
    description: 'A poisoned strike that is guaranteed to poison the target.',
    active: {
      behaviour: 'melee', weaponDamage: [100, 160], manaCost: [5, 8], conversion: { chaos: 25 }, params: { arc: 0 },
      levelStats: (l) => [flat('poison_chance', 100), more('poison_damage', L(0, 40)(l))],
      levelText: (l) => [`Deals ${L(100, 160)(l)}% of Base Attack Damage`, '25% of Physical Damage Converted to Chaos Damage', 'Always Poisons on Hit', `${L(0, 40)(l)}% more Damage with Poison`],
    },
    quality: [inc('poison_damage', 1)], qualityText: '{0}% increased Damage with Poison',
  },
  {
    id: 'rime_blades', name: 'Rime Blades', color: 'G', reqLevel: 1,
    tags: ['attack', 'melee', 'projectile', 'cold'],
    description: 'A melee strike that also hurls icy blades from the target.',
    active: {
      behaviour: 'strike_projectile', weaponDamage: [100, 155], manaCost: [6, 9], conversion: { cold: 60 },
      params: { count: 3, spread: 30, speed: 24, range: 9, mode: 0 },
      levelText: (l) => [`Deals ${L(100, 155)(l)}% of Base Attack Damage`, '60% of Physical Damage Converted to Cold Damage', 'Fires 3 icy blades'],
    },
    quality: [inc('projectile_speed', 1)], qualityText: '{0}% increased Projectile Speed',
  },
  {
    id: 'dash_strike', name: 'Dash Strike', color: 'G', reqLevel: 10,
    tags: ['attack', 'melee', 'movement'],
    description: 'Dashes forward, striking every enemy in your path.',
    active: {
      behaviour: 'dash', weaponDamage: [70, 110], attackSpeedMult: 1.5, manaCost: [8, 12], params: { distance: 7, width: 1.3 },
      levelText: (l) => [`Deals ${L(70, 110)(l)}% of Base Attack Damage`],
    },
    quality: [inc('attack_speed', 0.5)], qualityText: '{0}% increased Attack Speed',
  },
  {
    id: 'quickening', name: 'Quickening', color: 'G', reqLevel: 24,
    tags: ['aura', 'area'],
    description: 'Casts an aura that increases attack, cast and movement speed.',
    active: {
      behaviour: 'aura', manaCost: [0, 0], reservation: 50, params: {}, auraAffectsAllies: true,
      levelStats: (l) => [inc('attack_speed', L(6, 14)(l)), inc('cast_speed', L(6, 14)(l)), inc('movement_speed', L(4, 10)(l))],
      levelText: (l) => [`${L(6, 14)(l)}% increased Attack and Cast Speed`, `${L(4, 10)(l)}% increased Movement Speed`],
    },
    quality: [inc('movement_speed', 0.25)], qualityText: '{0}% increased Movement Speed',
  },
  {
    id: 'winters_grasp', name: "Winter's Grasp", color: 'G', reqLevel: 24,
    tags: ['aura', 'area', 'cold'],
    description: 'Casts an aura that causes your physical damage to also deal cold damage.',
    active: {
      behaviour: 'aura', manaCost: [0, 0], reservation: 50, params: {}, auraAffectsAllies: true,
      levelStats: (l) => [flat('phys_as_extra_cold', L(10, 20)(l)), more('cold_damage', L(10, 15)(l))],
      levelText: (l) => [`Gain ${L(10, 20)(l)}% of Physical Damage as Extra Cold Damage`, `${L(10, 15)(l)}% more Cold Damage`],
    },
    quality: [inc('cold_damage', 0.5)], qualityText: '{0}% increased Cold Damage',
  },

  // ============================================================================ INTELLIGENCE (blue)
  {
    id: 'fireball', name: 'Fireball', color: 'B', reqLevel: 1,
    tags: ['spell', 'projectile', 'area', 'fire'],
    description: 'Hurls a ball of fire that explodes on impact.',
    active: {
      behaviour: 'projectile', castTime: 0.8, crit: 6, baseDamage: { fire: [0.8, 1.2] }, damageScale: 1, effectiveness: 1.6,
      manaCost: [6, 22], params: { count: 1, spread: 0, speed: 20, range: 14, size: 0.35, explodeRadius: 1.6, visual: 3 },
      levelStats: (l) => [flat('ignite_chance', L(20, 40)(l))],
      levelText: (l) => [`${L(20, 40)(l)}% chance to Ignite`, 'Explodes on impact'],
    },
    quality: [inc('burning_damage', 1)], qualityText: '{0}% increased Burning Damage',
  },
  {
    id: 'frost_nova', name: 'Frost Nova', color: 'B', reqLevel: 12,
    tags: ['spell', 'area', 'cold', 'nova'],
    description: 'Unleashes a ring of frost around you.',
    active: {
      behaviour: 'nova', castTime: 0.7, crit: 6, baseDamage: { cold: [0.8, 1.2] }, damageScale: 0.85, effectiveness: 1,
      manaCost: [11, 26], params: { radius: 3.3, visual: 1 },
      levelStats: (l) => [inc('area_of_effect', L(0, 20)(l))],
      levelText: (l) => [`${L(0, 20)(l)}% increased Area of Effect`],
    },
    quality: [inc('chill_effect', 1)], qualityText: '{0}% increased Effect of Chill',
  },
  {
    id: 'chain_lightning', name: 'Chain Lightning', color: 'B', reqLevel: 1,
    tags: ['spell', 'lightning', 'chaining'],
    description: 'A bolt of lightning that leaps from enemy to enemy.',
    active: {
      behaviour: 'chain', castTime: 0.7, crit: 5, baseDamage: { lightning: [0.25, 1.75] }, damageScale: 0.75, effectiveness: 0.8,
      manaCost: [7, 24], params: { chains: 4, range: 12, chainRange: 5.5 },
      levelStats: (l) => [flat('shock_chance', 10), flat('chain', l >= 20 ? 2 : l >= 10 ? 1 : 0)],
      levelText: (l) => [`Chains ${4 + (l >= 20 ? 2 : l >= 10 ? 1 : 0)} times`, '10% chance to Shock'],
    },
    quality: [inc('shock_effect', 1)], qualityText: '{0}% increased Effect of Shock',
  },
  {
    id: 'sparkstorm', name: 'Sparkstorm', color: 'B', reqLevel: 1,
    tags: ['spell', 'projectile', 'lightning', 'duration'],
    description: 'Releases a spray of erratic sparks that crackle across the ground.',
    active: {
      behaviour: 'projectile', castTime: 0.65, crit: 5, baseDamage: { lightning: [0.1, 1.9] }, damageScale: 0.45, effectiveness: 0.6,
      manaCost: [5, 16], params: { count: 4, spread: 50, speed: 11, range: 20, size: 0.3, duration: 2, erratic: 1, visual: 4 },
      levelText: () => ['Fires 4 erratic sparks'],
    },
    quality: [inc('projectile_speed', 1)], qualityText: '{0}% increased Projectile Speed',
  },
  {
    id: 'cinderfall', name: 'Cinderfall', color: 'B', reqLevel: 24,
    tags: ['spell', 'area', 'fire', 'duration'],
    description: 'Calls down a storm of burning cinders on the target area.',
    active: {
      behaviour: 'rain', castTime: 0.9, crit: 6, baseDamage: { fire: [0.8, 1.2] }, damageScale: 0.55, effectiveness: 0.5,
      manaCost: [14, 30], params: { radius: 3, impacts: 10, impactRadius: 1.0, duration: 1.4, visual: 2 },
      levelText: () => ['Calls down 10 burning cinders'],
    },
    quality: [inc('skill_duration', 1)], qualityText: '{0}% increased Skill Effect Duration',
  },
  {
    id: 'raise_bones', name: 'Raise Bone Warriors', color: 'B', reqLevel: 1,
    tags: ['spell', 'minion'],
    description: 'Summons skeletal warriors that fight for you.',
    active: {
      behaviour: 'summon', castTime: 0.8, manaCost: [10, 25], params: { count: 2, max: 4 },
      levelText: (l) => ['Summons 2 Bone Warriors', 'Maximum 4 Bone Warriors', `Minions are level ${Math.min(80, 1 + (l - 1) * 3.6) | 0}`],
    },
    quality: [inc('minion_damage', 1)], qualityText: 'Minions deal {0}% increased Damage',
  },
  {
    id: 'flame_step', name: 'Flame Step', color: 'B', reqLevel: 10,
    tags: ['spell', 'movement', 'fire'],
    description: 'Teleports you a short distance in a burst of flame.',
    active: {
      behaviour: 'blink', castTime: 0.4, manaCost: [8, 16], params: { distance: 6.5 },
      levelText: () => ['Teleports to the target location'],
    },
    quality: [inc('cast_speed', 0.5)], qualityText: '{0}% increased Cast Speed',
  },
  {
    id: 'serenity', name: 'Serenity', color: 'B', reqLevel: 8,
    tags: ['aura', 'area'],
    description: 'Casts an aura that regenerates mana for you and your allies.',
    active: {
      behaviour: 'aura', manaCost: [0, 0], reservation: 25, params: {},
      levelStats: (l) => [flat('mana_regen', L(3, 20)(l))],
      levelText: (l) => [`Regenerate ${L(3, 20)(l)} Mana per second`],
    },
    quality: [inc('mana_regen', 1)], qualityText: '{0}% increased Mana Regeneration Rate',
  },

  // ============================================================================ SUPPORTS — red
  {
    id: 'brutal_force', name: 'Brutal Force Support', color: 'R', reqLevel: 8, tags: ['attack', 'melee', 'physical'],
    description: 'Supports melee skills, making their physical damage much stronger.',
    support: {
      anyOf: ['melee'], manaMult: 1.4,
      stats: (l) => [more('phys_damage', L(30, 49)(l))],
      text: (l) => [`${L(30, 49)(l)}% more Physical Damage`],
    },
    quality: [inc('phys_damage', 0.5)], qualityText: '{0}% increased Physical Damage',
  },
  {
    id: 'added_fire', name: 'Added Fire Damage Support', color: 'R', reqLevel: 8, tags: ['fire'],
    description: 'Supports damaging skills, adding fire damage based on their physical damage.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.2,
      stats: (l) => [flat('phys_as_extra_fire', L(20, 39)(l))],
      text: (l) => [`Gain ${L(20, 39)(l)}% of Physical Damage as Extra Fire Damage`],
    },
    quality: [inc('fire_damage', 0.5)], qualityText: '{0}% increased Fire Damage',
  },
  {
    id: 'multistrike', name: 'Multistrike Support', color: 'R', reqLevel: 28, tags: ['attack', 'melee'],
    description: 'Supported melee attacks repeat twice more, at a much faster speed.',
    support: {
      anyOf: ['melee'], noneOf: ['movement'], manaMult: 1.5,
      stats: (l) => [flat('repeats', 2), more('attack_speed', L(44, 63)(l)), more('damage', -20)],
      text: (l) => ['Supported Attacks repeat 2 additional times', `${L(44, 63)(l)}% more Attack Speed`, '20% less Damage'],
    },
    quality: [inc('attack_speed', 0.5)], qualityText: '{0}% increased Attack Speed',
  },
  {
    id: 'life_leech_support', name: 'Bloodletting Support', color: 'R', reqLevel: 1, tags: ['attack'],
    description: 'Supported skills leech life from the damage they deal.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.1,
      stats: (l) => [flat('life_leech', lvl(2, 3, l))],
      text: (l) => [`${lvl(2, 3, l).toFixed(1)}% of Damage Leeched as Life`],
    },
    quality: [inc('damage', 0.5)], qualityText: '{0}% increased Damage',
  },
  {
    id: 'searing_heat', name: 'Searing Heat Support', color: 'R', reqLevel: 12, tags: ['fire'],
    description: 'Supported skills ignite more often and their burning deals far more damage.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.25,
      stats: (l) => [flat('ignite_chance', 15), more('burning_damage', L(30, 49)(l))],
      text: (l) => ['15% chance to Ignite', `${L(30, 49)(l)}% more Burning Damage`],
    },
    quality: [inc('burning_damage', 1)], qualityText: '{0}% increased Burning Damage',
  },
  {
    id: 'melee_splash', name: 'Shockwave Support', color: 'R', reqLevel: 8, tags: ['melee', 'area'],
    description: 'Supported single-target melee skills also damage enemies around the target.',
    support: {
      anyOf: ['melee'], noneOf: ['area'], manaMult: 1.4,
      stats: (l) => [flag('splash'), more('damage', L(-15, 0)(l))],
      text: (l) => ['Melee hits also damage enemies around the target', l < 20 ? `${-L(-15, 0)(l)}% less Damage` : ''].filter(Boolean),
    },
    quality: [inc('area_of_effect', 0.5)], qualityText: '{0}% increased Area of Effect',
  },
  {
    id: 'culling_strike', name: 'Culling Strike Support', color: 'R', reqLevel: 18, tags: [],
    description: 'Supported skills instantly kill enemies on low life.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.1,
      stats: (l) => [flag('culling_strike'), more('damage', L(0, 19)(l))],
      text: (l) => ['Kills Enemies on Hit if they have 10% or less Life', `${L(0, 19)(l)}% more Damage`],
    },
    quality: [inc('damage', 0.5)], qualityText: '{0}% increased Damage',
  },

  // ============================================================================ SUPPORTS — green
  {
    id: 'lesser_volley', name: 'Lesser Volley Support', color: 'G', reqLevel: 8, tags: ['projectile'],
    description: 'Supported projectile skills fire additional projectiles.',
    support: {
      anyOf: ['projectile'], manaMult: 1.3,
      stats: (l) => [flat('additional_projectiles', 2), more('damage', L(-26, -15)(l))],
      text: (l) => ['Skills fire 2 additional Projectiles', `${-L(-26, -15)(l)}% less Damage`],
    },
    quality: [inc('projectile_damage', 0.5)], qualityText: '{0}% increased Projectile Damage',
  },
  {
    id: 'greater_volley', name: 'Greater Volley Support', color: 'G', reqLevel: 38, tags: ['projectile'],
    description: 'Supported projectile skills fire many additional projectiles.',
    support: {
      anyOf: ['projectile'], manaMult: 1.5,
      stats: (l) => [flat('additional_projectiles', 4), more('damage', L(-35, -26)(l))],
      text: (l) => ['Skills fire 4 additional Projectiles', `${-L(-35, -26)(l)}% less Damage`],
    },
    quality: [inc('attack_speed', 0.5), inc('cast_speed', 0.5)], qualityText: '{0}% increased Attack and Cast Speed',
  },
  {
    id: 'piercing_shots', name: 'Piercing Shots Support', color: 'G', reqLevel: 8, tags: ['projectile'],
    description: 'Supported projectiles pierce through enemies.',
    support: {
      anyOf: ['projectile'], manaMult: 1.1,
      stats: (l) => [flat('pierce', L(2, 5)(l)), more('projectile_damage', L(0, 19)(l))],
      text: (l) => [`Projectiles Pierce ${L(2, 5)(l)} additional Targets`, `${L(0, 19)(l)}% more Projectile Damage`],
    },
    quality: [inc('projectile_damage', 0.5)], qualityText: '{0}% increased Projectile Damage',
  },
  {
    id: 'ricochet', name: 'Ricochet Support', color: 'G', reqLevel: 38, tags: ['projectile', 'chaining'],
    description: 'Supported projectiles and chaining skills chain additional times.',
    support: {
      anyOf: ['projectile', 'chaining'], manaMult: 1.5,
      stats: (l) => [flat('chain', 2), more('damage', L(-30, -21)(l))],
      text: (l) => ['Chain +2 additional times', `${-L(-30, -21)(l)}% less Damage`],
    },
    quality: [inc('projectile_speed', 1)], qualityText: '{0}% increased Projectile Speed',
  },
  {
    id: 'forking', name: 'Forking Support', color: 'G', reqLevel: 12, tags: ['projectile'],
    description: 'Supported projectiles split in two when they hit an enemy.',
    support: {
      anyOf: ['projectile'], manaMult: 1.3,
      stats: (l) => [flag('fork'), more('projectile_damage', L(-10, 9)(l))],
      text: (l) => ['Projectiles Fork on hit', `${L(-10, 9)(l)}% more Projectile Damage`],
    },
    quality: [inc('projectile_damage', 0.5)], qualityText: '{0}% increased Projectile Damage',
  },
  {
    id: 'faster_attacks', name: 'Faster Attacks Support', color: 'G', reqLevel: 1, tags: ['attack'],
    description: 'Supported attacks are performed much faster.',
    support: {
      anyOf: ['attack'], manaMult: 1.15,
      stats: (l) => [more('attack_speed', L(25, 44)(l))],
      text: (l) => [`${L(25, 44)(l)}% more Attack Speed`],
    },
    quality: [inc('attack_speed', 0.5)], qualityText: '{0}% increased Attack Speed',
  },
  {
    id: 'velocity', name: 'Velocity Support', color: 'G', reqLevel: 8, tags: ['projectile'],
    description: 'Supported projectiles travel faster and hit harder.',
    support: {
      anyOf: ['projectile'], manaMult: 1.2,
      stats: (l) => [inc('projectile_speed', L(50, 69)(l)), more('projectile_damage', L(10, 29)(l))],
      text: (l) => [`${L(50, 69)(l)}% increased Projectile Speed`, `${L(10, 29)(l)}% more Projectile Damage`],
    },
    quality: [inc('projectile_speed', 1)], qualityText: '{0}% increased Projectile Speed',
  },
  {
    id: 'crit_strikes', name: 'Keen Edge Support', color: 'G', reqLevel: 8, tags: [],
    description: 'Supported skills critically strike far more often.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.2,
      stats: (l) => [inc('crit_chance', L(60, 98)(l)), flat('base_crit_flat', lvl(1, 2, l))],
      text: (l) => [`${L(60, 98)(l)}% increased Critical Strike Chance`, `+${lvl(1, 2, l).toFixed(1)}% to Critical Strike Chance`],
    },
    quality: [inc('crit_chance', 1)], qualityText: '{0}% increased Critical Strike Chance',
  },
  {
    id: 'venom', name: 'Venom Support', color: 'G', reqLevel: 8, tags: ['chaos'],
    description: 'Supported skills poison enemies on hit.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.1,
      stats: (l) => [flat('poison_chance', 40), more('poison_damage', L(0, 29)(l))],
      text: (l) => ['40% chance to Poison on Hit', `${L(0, 29)(l)}% more Damage with Poison`],
    },
    quality: [inc('poison_damage', 1)], qualityText: '{0}% increased Damage with Poison',
  },
  {
    id: 'added_cold', name: 'Added Cold Damage Support', color: 'G', reqLevel: 8, tags: ['cold'],
    description: 'Supported skills deal additional cold damage.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.2,
      stats: (l) => {
        const [lo, hi] = addedRange(8, l, 0.8, 1.2);
        return [flat('attack_cold_min', lo), flat('attack_cold_max', hi), flat('spell_cold_min', lo), flat('spell_cold_max', hi)];
      },
      text: (l) => {
        const [lo, hi] = addedRange(8, l, 0.8, 1.2);
        return [`Adds ${lo} to ${hi} Cold Damage`];
      },
    },
    quality: [inc('cold_damage', 0.5)], qualityText: '{0}% increased Cold Damage',
  },
  {
    id: 'hypothermia', name: 'Deep Freeze Support', color: 'G', reqLevel: 31, tags: ['cold'],
    description: 'Supported skills deal much more damage to chilled enemies and chill more effectively.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.3,
      stats: (l) => [more('damage_vs_chilled', L(20, 39)(l)), inc('chill_effect', 20)],
      text: (l) => [`${L(20, 39)(l)}% more Damage with Hits against Chilled Enemies`, '20% increased Effect of Chill'],
    },
    quality: [inc('chill_effect', 1)], qualityText: '{0}% increased Effect of Chill',
  },

  // ============================================================================ SUPPORTS — blue
  {
    id: 'echoing_spell', name: 'Echoing Spell Support', color: 'B', reqLevel: 38, tags: ['spell'],
    description: 'Supported spells repeat once, cast much faster.',
    support: {
      anyOf: ['spell'], noneOf: ['aura', 'minion', 'movement'], manaMult: 1.4,
      stats: (l) => [flat('repeats', 1), more('cast_speed', L(70, 89)(l)), more('damage', -10)],
      text: (l) => ['Supported Spells repeat an additional time', `${L(70, 89)(l)}% more Cast Speed`, '10% less Damage'],
    },
    quality: [inc('cast_speed', 0.5)], qualityText: '{0}% increased Cast Speed',
  },
  {
    id: 'faster_casting', name: 'Faster Casting Support', color: 'B', reqLevel: 18, tags: ['spell'],
    description: 'Supported spells are cast faster.',
    support: {
      anyOf: ['spell'], noneOf: ['aura'], manaMult: 1.2,
      stats: (l) => [inc('cast_speed', L(20, 39)(l))],
      text: (l) => [`${L(20, 39)(l)}% increased Cast Speed`],
    },
    quality: [inc('cast_speed', 0.5)], qualityText: '{0}% increased Cast Speed',
  },
  {
    id: 'increased_aoe', name: 'Increased Area of Effect Support', color: 'B', reqLevel: 24, tags: ['area'],
    description: 'Supported skills affect a larger area.',
    support: {
      anyOf: ['area'], noneOf: ['aura'], manaMult: 1.4,
      stats: (l) => [inc('area_of_effect', L(20, 39)(l))],
      text: (l) => [`${L(20, 39)(l)}% increased Area of Effect`],
    },
    quality: [inc('area_damage', 0.5)], qualityText: '{0}% increased Area Damage',
  },
  {
    id: 'concentrated_effect', name: 'Concentrated Effect Support', color: 'B', reqLevel: 18, tags: ['area'],
    description: 'Supported skills affect a smaller area but deal much more area damage.',
    support: {
      anyOf: ['area'], noneOf: ['aura'], manaMult: 1.4,
      stats: (l) => [more('area_of_effect', -30), more('area_damage', L(35, 54)(l))],
      text: (l) => ['30% less Area of Effect', `${L(35, 54)(l)}% more Area Damage`],
    },
    quality: [inc('area_damage', 0.5)], qualityText: '{0}% increased Area Damage',
  },
  {
    id: 'elemental_focus', name: 'Elemental Focus Support', color: 'B', reqLevel: 18, tags: [],
    description: 'Supported skills deal much more elemental damage but cannot inflict elemental ailments.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.3,
      stats: (l) => [more('elemental_damage', L(30, 49)(l)), flag('cannot_ailment')],
      text: (l) => [`${L(30, 49)(l)}% more Elemental Damage`, 'Cannot inflict Elemental Ailments'],
    },
    quality: [inc('elemental_damage', 0.5)], qualityText: '{0}% increased Elemental Damage',
  },
  {
    id: 'controlled_ruin', name: 'Controlled Ruin Support', color: 'B', reqLevel: 18, tags: ['spell'],
    description: 'Supported spells deal much more damage but cannot critically strike.',
    support: {
      anyOf: ['spell'], noneOf: ['aura', 'minion'], manaMult: 1.3,
      stats: (l) => [more('spell_damage', L(30, 49)(l)), more('crit_chance', -100)],
      text: (l) => [`${L(30, 49)(l)}% more Spell Damage`, '100% less Critical Strike Chance'],
    },
    quality: [inc('spell_damage', 0.5)], qualityText: '{0}% increased Spell Damage',
  },
  {
    id: 'added_lightning', name: 'Added Lightning Damage Support', color: 'B', reqLevel: 8, tags: ['lightning'],
    description: 'Supported skills deal additional lightning damage.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.2,
      stats: (l) => {
        const [lo, hi] = addedRange(8, l, 0.1, 1.9);
        return [flat('attack_lightning_min', lo), flat('attack_lightning_max', hi), flat('spell_lightning_min', lo), flat('spell_lightning_max', hi)];
      },
      text: (l) => {
        const [lo, hi] = addedRange(8, l, 0.1, 1.9);
        return [`Adds ${lo} to ${hi} Lightning Damage`];
      },
    },
    quality: [inc('lightning_damage', 0.5)], qualityText: '{0}% increased Lightning Damage',
  },
  {
    id: 'critical_wrath', name: 'Critical Wrath Support', color: 'B', reqLevel: 18, tags: [],
    description: 'Supported skills deal far more damage with critical strikes.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.3,
      stats: (l) => [flat('crit_multi', L(70, 99)(l))],
      text: (l) => [`+${L(70, 99)(l)}% to Critical Strike Multiplier`],
    },
    quality: [flat('crit_multi', 0.75)], qualityText: '+{0}% to Critical Strike Multiplier',
  },
  {
    id: 'minion_might', name: 'Minion Might Support', color: 'B', reqLevel: 8, tags: ['minion'],
    description: 'Supported minions deal more damage.',
    support: {
      anyOf: ['minion'], manaMult: 1.3,
      stats: (l) => [more('minion_damage', L(25, 44)(l))],
      text: (l) => [`Minions deal ${L(25, 44)(l)}% more Damage`],
    },
    quality: [inc('minion_damage', 0.75)], qualityText: 'Minions deal {0}% increased Damage',
  },
  {
    id: 'minion_vitality', name: 'Minion Vitality Support', color: 'B', reqLevel: 8, tags: ['minion'],
    description: 'Supported minions have more life.',
    support: {
      anyOf: ['minion'], manaMult: 1.3,
      stats: (l) => [more('minion_life', L(30, 49)(l)), flat('minion_count', l >= 15 ? 1 : 0)],
      text: (l) => [`Minions have ${L(30, 49)(l)}% more maximum Life`, ...(l >= 15 ? ['+1 to maximum number of Minions'] : [])],
    },
    quality: [inc('minion_life', 0.75)], qualityText: 'Minions have {0}% increased maximum Life',
  },
  {
    id: 'efficiency', name: 'Efficiency Support', color: 'B', reqLevel: 1, tags: [],
    description: 'Supported skills cost less mana and reserve less.',
    support: {
      anyOf: ['attack', 'spell', 'aura'], manaMult: 1,
      stats: (l) => [more('mana_cost', L(-10, -30)(l)), more('reservation', L(-8, -20)(l))],
      text: (l) => [`${-L(-10, -30)(l)}% less Mana Cost`, `${-L(-8, -20)(l)}% less Mana Reserved`],
    },
    quality: [inc('mana_cost', -0.5)], qualityText: '{0}% reduced Mana Cost',
  },
  {
    id: 'kindling', name: 'Kindling Support', color: 'B', reqLevel: 8, tags: ['fire'],
    description: 'Supported skills deal more fire damage and ignite often.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.2,
      stats: (l) => [flat('ignite_chance', 30), more('fire_damage', L(10, 25)(l))],
      text: (l) => ['30% chance to Ignite', `${L(10, 25)(l)}% more Fire Damage`],
    },
    quality: [inc('fire_damage', 0.5)], qualityText: '{0}% increased Fire Damage',
  },
  {
    id: 'elemental_penetration', name: 'Elemental Penetration Support', color: 'B', reqLevel: 31, tags: [],
    description: 'Supported skills penetrate enemy elemental resistances.',
    support: {
      anyOf: ['attack', 'spell'], noneOf: ['aura', 'minion'], manaMult: 1.3,
      stats: (l) => [flat('fire_pen', L(10, 19)(l)), flat('cold_pen', L(10, 19)(l)), flat('lightning_pen', L(10, 19)(l))],
      text: (l) => [`Penetrates ${pct(L(10, 19)(l))} Elemental Resistances`],
    },
    quality: [inc('elemental_damage', 0.5)], qualityText: '{0}% increased Elemental Damage',
  },
];

/** Flat added damage for "Added X Damage" supports, derived from the spell damage curve. */
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
