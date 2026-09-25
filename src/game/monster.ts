import type { Vec2 } from '../core/math';
import type { RNG } from '../core/rng';
import { MONSTER_BY_ID, RARE_MODS, type MonsterDef, type MonsterSkillDef, type RareMonsterMod } from '../data/monsters';
import { monsterAccuracy, monsterArmour, monsterDamage, monsterEvasion, monsterLife, monsterXp } from '../data/scaling';
import type { SkillTag } from '../data/gems';
import { rareMonsterName } from '../items/names';
import { emptyRange, scaleDamage, type SkillStats } from '../skills/skills';
import type { ActorStats } from '../stats/character';
import { DAMAGE_TYPES, flat, inc, more, StatSheet, type StatMod } from '../stats/stats';
import { Actor, type Team } from './actor';

export type MonsterRarity = 'normal' | 'magic' | 'rare' | 'unique';

const RARITY_LIFE: Record<MonsterRarity, number> = { normal: 1, magic: 2, rare: 5.5, unique: 1 };
const RARITY_DMG: Record<MonsterRarity, number> = { normal: 1, magic: 1.1, rare: 1.3, unique: 1 };
export const RARITY_XP: Record<MonsterRarity, number> = { normal: 1, magic: 2.5, rare: 6, unique: 1 };

export interface PendingAction {
  skill: MonsterSkillDef;
  target: Vec2;
  targetActor?: Actor;
  fireAt: number;
  fired: boolean;
}

export class Monster extends Actor {
  team: Team;
  def: MonsterDef;
  level: number;
  rarity: MonsterRarity;
  name: string;
  mods: RareMonsterMod[];
  sheet: StatSheet;
  baseHit: number;
  attackSpeed: number;
  cooldowns = new Map<string, number>();
  aggro = false;
  pending: PendingAction | null = null;
  home: Vec2;
  isMinion = false;
  ownerId = 0;
  xpValue: number;
  deathTimer = 0;
  /** Pack id for group aggro. */
  pack = 0;
  /** Randomised stride phase for animation. */
  phase: number;
  private skillCache = new Map<string, SkillStats>();

  constructor(def: MonsterDef, level: number, rarity: MonsterRarity, pos: Vec2, team: Team, rng: RNG, extraMods: StatMod[] = []) {
    super(pos, def.radius * (rarity === 'rare' ? 1.15 : 1));
    this.def = def;
    this.level = level;
    this.rarity = rarity;
    this.team = team;
    this.home = { ...pos };
    this.phase = rng.float(0, 10);
    this.mods = [];
    if (rarity === 'magic') this.mods = [rng.pick(RARE_MODS)];
    if (rarity === 'rare') this.mods = rng.shuffle([...RARE_MODS]).slice(0, rng.int(2, 3));
    this.name = rarity === 'rare' ? rareMonsterName(rng) : def.name;

    const sheet = new StatSheet(extraMods);
    for (const mod of this.mods) {
      if (mod.lifeMore) sheet.add(more('monster_life', mod.lifeMore));
      if (mod.damageMore) sheet.add(more('damage', mod.damageMore));
      if (mod.speedInc) sheet.add(inc('monster_speed', mod.speedInc));
      if (mod.attackSpeedInc) sheet.add(inc('attack_speed', mod.attackSpeedInc));
      if (mod.physReduction) sheet.add(flat('phys_damage_reduction', mod.physReduction));
      if (mod.regenPct) sheet.add(flat('life_regen_pct', mod.regenPct));
      if (mod.leech) sheet.add(flat('life_leech', mod.leech * 100));
      if (mod.poison) sheet.add(flat('poison_chance', mod.poison));
      for (const [t, v] of Object.entries(mod.extra ?? {})) sheet.add(flat(`phys_as_extra_${t}` as never, v));
      for (const [t, v] of Object.entries(mod.res ?? {})) sheet.add(flat(`${t}_res` as never, v));
    }
    // map "increased monster damage" feeds the generic damage key
    const mapDmg = sheet.inc('monster_damage');
    if (mapDmg) sheet.add(inc('damage', mapDmg));
    this.sheet = sheet;

    const life = monsterLife(level) * def.life * RARITY_LIFE[rarity] * sheet.more('monster_life') * (1 + sheet.inc('monster_life') / 100);
    const speedInc = sheet.inc('monster_speed');
    this.baseHit = monsterDamage(level) * def.damage * RARITY_DMG[rarity];
    this.attackSpeed = def.attackSpeed * (1 + (speedInc + sheet.inc('attack_speed')) / 100);
    const allEle = sheet.flat('all_ele_res');
    const res = {
      fire: (def.res.fire ?? 0) + sheet.flat('fire_res') + allEle,
      cold: (def.res.cold ?? 0) + sheet.flat('cold_res') + allEle,
      lightning: (def.res.lightning ?? 0) + sheet.flat('lightning_res') + allEle,
      chaos: (def.res.chaos ?? 0) + sheet.flat('chaos_res'),
    };
    const maxLife = Math.max(1, Math.round(life));
    const stats: ActorStats = {
      sheet,
      level,
      maxLife,
      maxMana: 0,
      maxES: 0,
      armour: monsterArmour(level) * def.armour,
      evasion: monsterEvasion(level) * def.evasion,
      block: 0,
      res: { fire: Math.min(75, res.fire), cold: Math.min(75, res.cold), lightning: Math.min(75, res.lightning), chaos: Math.min(75, res.chaos) },
      maxRes: { fire: 75, cold: 75, lightning: 75, chaos: 75 },
      physReduction: Math.min(75, sheet.flat('phys_damage_reduction')),
      damageTakenMult: 1,
      avoidChance: 0,
      manaFirst: 0,
      chaosImmune: false,
      lifeRegen: (maxLife * sheet.flat('life_regen_pct')) / 100,
      manaRegen: 0,
      esRecharge: 0,
      esDelay: 99,
      moveSpeed: def.speed * (1 + speedInc / 100),
      accuracy: monsterAccuracy(level),
      unerring: false,
    };
    this.setStats(stats, false);
    if (def.boss) this.ailmentDurationMult = 0.4;
    else if (rarity === 'rare') this.ailmentDurationMult = 0.8;
    this.xpValue = monsterXp(level) * def.xp * RARITY_XP[rarity];
  }

  get displayName(): string {
    return this.name;
  }

  /** Skill statistics for one of this monster's skills (cached). */
  skillStats(skill: MonsterSkillDef): SkillStats {
    const cached = this.skillCache.get(skill.id);
    if (cached) return cached;
    const split = skill.types ?? this.def.types;
    const avg = this.baseHit * skill.dmg;
    const base = emptyRange();
    for (const t of DAMAGE_TYPES) {
      const f = split[t] ?? 0;
      if (f > 0) base[t] = [avg * f * 0.8, avg * f * 1.2];
    }
    const tags = new Set<SkillTag>([skill.spell ? 'spell' : 'attack']);
    const damage = scaleDamage(base, this.sheet, tags);
    const avgHit = DAMAGE_TYPES.reduce((s, t) => s + (damage[t][0] + damage[t][1]) / 2, 0);
    const stats: SkillStats = {
      isAttack: !skill.spell,
      isSpell: !!skill.spell,
      damage,
      critChance: 5,
      critMulti: 1.5,
      usesPerSecond: this.attackSpeed,
      actionTime: 1 / this.attackSpeed,
      hitsPerUse: 1,
      manaCost: 0,
      lifeCost: 0,
      reservation: 0,
      accuracy: this.stats.accuracy,
      areaMult: 1,
      projectiles: skill.params?.count ?? 1,
      pierce: 0,
      chain: 0,
      fork: false,
      durationMult: 1,
      projSpeedMult: 1,
      igniteChance: 0,
      freezeChance: 0,
      shockChance: 0,
      bleedChance: 0,
      poisonChance: this.sheet.flat('poison_chance') + ((split.chaos ?? 0) > 0.3 ? 25 : 0),
      cannotAilment: false,
      chillEffect: 1,
      shockEffect: 1,
      burnMult: 1,
      poisonMult: 1,
      bleedMult: 1,
      pen: { fire: 0, cold: 0, lightning: 0 },
      lifeLeech: this.sheet.flat('life_leech') / 100,
      manaLeech: 0,
      lifeOnHit: 0,
      culling: false,
      knockback: false,
      splash: false,
      vsChilledMore: 1,
      closeQuarters: false,
      range: skill.range,
      averageHit: avgHit,
      dps: avgHit * this.attackSpeed,
    };
    this.skillCache.set(skill.id, stats);
    return stats;
  }
}

export function monsterDef(id: string): MonsterDef {
  const d = MONSTER_BY_ID[id];
  if (!d) throw new Error(`Unknown monster ${id}`);
  return d;
}

/** Minion stats override after creation (Bone Warriors scale with the gem, not the area). */
export function makeMinion(m: Monster, life: number, dmg: [number, number], attackSpeed: number, moveSpeed: number, ownerId: number): void {
  m.isMinion = true;
  m.ownerId = ownerId;
  m.aggro = true;
  m.stats = { ...m.stats, maxLife: life, moveSpeed, accuracy: 99999 };
  m.life = life;
  m.attackSpeed = attackSpeed;
  m.baseHit = (dmg[0] + dmg[1]) / 2;
  m.xpValue = 0;
}
