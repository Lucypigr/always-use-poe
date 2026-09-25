import type { RNG } from '../core/rng';
import { clamp } from '../core/math';
import type { SkillStats } from '../skills/skills';
import { DAMAGE_TYPES, type DamageType } from '../stats/stats';
import type { Actor } from './actor';

/**
 * Hit resolution, following Path of Exile's order of operations:
 *   avoidance → evasion (attacks) → block (attacks) → per-type mitigation
 *   (armour for physical, resistances − penetration for elemental/chaos)
 *   → damage taken modifiers → energy shield → life, then ailments and leech.
 */

export interface HitInfo {
  source: Actor | null;
  damage: Record<DamageType, number>;
  crit: boolean;
  isAttack: boolean;
  isSpell: boolean;
  accuracy: number;
  unerring: boolean;
  pen: { fire: number; cold: number; lightning: number };
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
  lifeLeech: number;
  manaLeech: number;
  lifeOnHit: number;
  culling: boolean;
  vsChilledMore: number;
  knockback: number;
}

export interface HitResult {
  dealt: number;
  killed: boolean;
  evaded: boolean;
  blocked: boolean;
  avoided: boolean;
  crit: boolean;
  byType: Record<DamageType, number>;
}

/** Roll a concrete hit from skill statistics. `mult` scales damage (e.g. falloff, splash). */
export function rollHit(s: SkillStats, source: Actor | null, rng: RNG, mult = 1): HitInfo {
  const crit = rng.chance(s.critChance / 100);
  const damage = {} as Record<DamageType, number>;
  const m = mult * (crit ? s.critMulti : 1);
  for (const t of DAMAGE_TYPES) {
    const [lo, hi] = s.damage[t];
    damage[t] = hi > 0 ? rng.float(lo, hi) * m : 0;
  }
  return {
    source,
    damage,
    crit,
    isAttack: s.isAttack,
    isSpell: s.isSpell,
    accuracy: s.accuracy,
    unerring: source ? source.stats.unerring : false,
    pen: s.pen,
    igniteChance: s.igniteChance,
    freezeChance: s.freezeChance,
    shockChance: s.shockChance,
    bleedChance: s.bleedChance,
    poisonChance: s.poisonChance,
    cannotAilment: s.cannotAilment,
    chillEffect: s.chillEffect,
    shockEffect: s.shockEffect,
    burnMult: s.burnMult,
    poisonMult: s.poisonMult,
    bleedMult: s.bleedMult,
    lifeLeech: s.lifeLeech,
    manaLeech: s.manaLeech,
    lifeOnHit: s.lifeOnHit,
    culling: s.culling,
    vsChilledMore: s.vsChilledMore,
    knockback: s.knockback ? 1 : 0,
  };
}

/** PoE's chance to hit formula. */
export function chanceToHit(accuracy: number, evasion: number): number {
  if (evasion <= 0) return 1;
  return clamp((1.25 * accuracy) / (accuracy + (evasion * 0.2) ** 0.9), 0.05, 1);
}

/** PoE's armour formula: reduction = A / (A + 5·D), capped at 90%. */
export function armourReduction(armour: number, damage: number): number {
  if (armour <= 0 || damage <= 0) return 0;
  return Math.min(0.9, armour / (armour + 5 * damage));
}

export function applyHit(target: Actor, hit: HitInfo, rng: RNG): HitResult {
  const result: HitResult = {
    dealt: 0, killed: false, evaded: false, blocked: false, avoided: false, crit: hit.crit,
    byType: { phys: 0, fire: 0, cold: 0, lightning: 0, chaos: 0 },
  };
  if (target.dead) return result;
  const st = target.stats;
  if (st.avoidChance > 0 && rng.chance(st.avoidChance / 100)) {
    result.avoided = true;
    return result;
  }
  if (hit.isAttack && !hit.unerring && !rng.chance(chanceToHit(hit.accuracy, st.evasion))) {
    result.evaded = true;
    return result;
  }
  if (hit.isAttack && st.block > 0 && rng.chance(st.block / 100)) {
    result.blocked = true;
    return result;
  }

  let takenMult = st.damageTakenMult * target.shockTaken;
  if (target.ailments.chill || target.ailments.freeze) takenMult *= hit.vsChilledMore;

  let total = 0;
  for (const t of DAMAGE_TYPES) {
    const raw = hit.damage[t];
    if (raw <= 0) continue;
    let d = raw;
    if (t === 'phys') {
      d *= 1 - armourReduction(st.armour, raw);
      d *= 1 - st.physReduction / 100;
    } else if (t === 'chaos') {
      if (st.chaosImmune) d = 0;
      else d *= 1 - Math.min(st.res.chaos, 90) / 100;
    } else {
      const res = Math.max(-200, st.res[t] - (st.res[t] > 0 ? Math.min(st.res[t], hit.pen[t]) : 0));
      d *= 1 - Math.min(res, 90) / 100;
    }
    d *= takenMult;
    result.byType[t] = d;
    total += d;
  }

  target.takeDamage(total);
  target.hitFlash = 0.12;
  result.dealt = total;

  if (!target.dead && hit.culling && target.life <= target.stats.maxLife * 0.1) {
    target.takeDamage(target.life + target.es + 1);
  }

  if (!target.dead) applyAilments(target, hit, rng);

  const src = hit.source;
  if (src && !src.dead && total > 0) {
    if (hit.lifeLeech > 0) src.leechPool = Math.min(src.stats.maxLife * 0.3, src.leechPool + total * hit.lifeLeech);
    if (hit.manaLeech > 0) src.restoreMana(total * hit.manaLeech);
    if (hit.lifeOnHit > 0 && hit.isAttack) src.heal(hit.lifeOnHit);
  }
  result.killed = target.dead;
  return result;
}

function applyAilments(target: Actor, hit: HitInfo, rng: RNG): void {
  const st = target.stats;
  const maxLife = Math.max(1, st.maxLife + st.maxES);
  const dur = target.ailmentDurationMult;
  const immuneFreeze = target.buffs.some((b) => b.freezeImmune);
  const immuneBleed = target.buffs.some((b) => b.bleedImmune);
  const { fire, cold, lightning, phys, chaos } = hit.damage;

  if (!hit.cannotAilment) {
    if (fire > 0 && (hit.crit || rng.chance(hit.igniteChance / 100))) {
      const dps = fire * 0.5 * hit.burnMult;
      if (!target.ailments.ignite || target.ailments.ignite.dps < dps) target.ailments.ignite = { dps, time: 4 * dur };
    }
    if (cold > 0 && !immuneFreeze) {
      const ratio = cold / maxLife;
      const effect = clamp(0.05 + 0.25 * Math.min(1, ratio * 4) ** 0.5, 0.05, 0.3) * hit.chillEffect;
      const cur = target.ailments.chill;
      if (!cur || cur.effect <= effect) target.ailments.chill = { effect: Math.min(0.5, effect), time: 2 * dur };
      if (hit.crit || rng.chance(hit.freezeChance / 100)) {
        const t = Math.min(3, 0.25 + ratio * 8) * dur;
        if (t >= 0.3 && (!target.ailments.freeze || target.ailments.freeze.time < t)) target.ailments.freeze = { time: t };
      }
    }
    if (lightning > 0 && (hit.crit || rng.chance(hit.shockChance / 100))) {
      const ratio = lightning / maxLife;
      const effect = clamp(0.5 * (ratio * 2) ** 0.4, 0.05, 0.5) * hit.shockEffect;
      const cur = target.ailments.shock;
      if (!cur || cur.effect <= effect) target.ailments.shock = { effect: Math.min(0.5, effect), time: 2 * dur };
    }
  }
  if (phys > 0 && !immuneBleed && rng.chance(hit.bleedChance / 100)) {
    const dps = phys * 0.7 * hit.bleedMult;
    if (!target.ailments.bleed || target.ailments.bleed.dps < dps) target.ailments.bleed = { dps, time: 5 * dur };
  }
  if ((phys > 0 || chaos > 0) && rng.chance(hit.poisonChance / 100)) {
    target.ailments.poison.push({ dps: (phys + chaos) * 0.3 * hit.poisonMult, time: 2 * dur });
    if (target.ailments.poison.length > 40) target.ailments.poison.shift();
  }
}
