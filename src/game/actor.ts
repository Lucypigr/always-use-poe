import type { Vec2 } from '../core/math';
import type { ActorStats } from '../stats/character';
import type { StatMod } from '../stats/stats';

export type Team = 'player' | 'enemy';

export interface DotInstance {
  dps: number;
  time: number;
}

export interface Ailments {
  ignite: DotInstance | null;
  bleed: DotInstance | null;
  poison: DotInstance[];
  chill: { effect: number; time: number } | null;
  freeze: { time: number } | null;
  shock: { effect: number; time: number } | null;
}

export interface Buff {
  id: string;
  time: number;
  mods: StatMod[];
  /** Life/mana recovered per second while active (flasks). */
  lifePerSec?: number;
  manaPerSec?: number;
  freezeImmune?: boolean;
  bleedImmune?: boolean;
}

export interface TravelState {
  from: Vec2;
  to: Vec2;
  t: number;
  duration: number;
  arc: number;
  width: number;
  onArrive?: () => void;
  onPass?: (a: Actor) => void;
}

let nextId = 1;

/**
 * Anything that fights: the player, monsters and minions.
 * Holds pools (life/mana/ES), ailments and timers; combat rules live in combat.ts.
 */
export abstract class Actor {
  readonly id = nextId++;
  abstract team: Team;
  pos: Vec2;
  radius: number;
  facing = 0;
  stats!: ActorStats;
  life = 1;
  mana = 0;
  es = 0;
  /** Time since last damage (for ES recharge). */
  esTimer = 99;
  leechPool = 0;
  dead = false;
  ailments: Ailments = { ignite: null, bleed: null, poison: [], chill: null, freeze: null, shock: null };
  buffs: Buff[] = [];
  /** Remaining time locked in the current skill/attack animation. */
  actionTimer = 0;
  /** Normalised progress of the current action (for animation). */
  actionDuration = 0;
  knock: Vec2 = { x: 0, y: 0 };
  /** Visual hit flash timer. */
  hitFlash = 0;
  /** Resistance of this actor to ailment duration (unique bosses resist). */
  ailmentDurationMult = 1;
  moving = false;
  reserved = 0;
  /** Scripted movement (leap, dash, charge). */
  travel: TravelState | null = null;
  /** Height offset while leaping (visual). */
  airborne = 0;

  constructor(pos: Vec2, radius: number) {
    this.pos = { ...pos };
    this.radius = radius;
  }

  setStats(stats: ActorStats, preserveRatio = true): void {
    const old = this.stats;
    this.stats = stats;
    if (!old || !preserveRatio) {
      this.life = stats.maxLife;
      this.mana = stats.maxMana;
      this.es = stats.maxES;
      return;
    }
    const lr = old.maxLife > 0 ? this.life / old.maxLife : 1;
    this.life = Math.min(stats.maxLife, Math.max(this.life > 0 ? 1 : 0, Math.round(lr * stats.maxLife)));
    this.mana = Math.min(this.mana, stats.maxMana);
    this.es = Math.min(this.es, stats.maxES);
  }

  get unreservedMana(): number {
    return Math.max(0, this.stats.maxMana - this.reserved);
  }

  get chillSlow(): number {
    return this.ailments.chill ? this.ailments.chill.effect : 0;
  }

  get frozen(): boolean {
    return !!this.ailments.freeze;
  }

  /** Multiplier to action speed from chill (PoE: chill slows action speed). */
  get actionSpeed(): number {
    return this.frozen ? 0 : 1 - this.chillSlow;
  }

  get shockTaken(): number {
    return this.ailments.shock ? 1 + this.ailments.shock.effect : 1;
  }

  heal(amount: number): void {
    if (this.dead) return;
    this.life = Math.min(this.stats.maxLife, this.life + amount);
  }

  restoreMana(amount: number): void {
    this.mana = Math.min(this.unreservedMana, this.mana + amount);
  }

  /** Update regen, ES recharge, leech and damage over time. Returns DoT damage taken. */
  tickPools(dt: number): number {
    if (this.dead) return 0;
    const s = this.stats;
    // Buff recovery (flasks)
    let lifeRecover = s.lifeRegen;
    let manaRecover = s.manaRegen;
    for (const b of this.buffs) {
      lifeRecover += b.lifePerSec ?? 0;
      manaRecover += b.manaPerSec ?? 0;
    }
    // Leech drains a pool at up to 10% of max life per second
    if (this.leechPool > 0) {
      const drain = Math.min(this.leechPool, s.maxLife * 0.1 * dt);
      this.leechPool -= drain;
      this.life = Math.min(s.maxLife, this.life + drain);
    }
    this.life = Math.min(s.maxLife, this.life + lifeRecover * dt);
    this.mana = Math.min(this.unreservedMana, this.mana + manaRecover * dt);
    this.esTimer += dt;
    if (this.esTimer >= s.esDelay && this.es < s.maxES) this.es = Math.min(s.maxES, this.es + s.maxES * s.esRecharge * dt);

    // Damage over time
    let dot = 0;
    const a = this.ailments;
    if (a.ignite) {
      dot += a.ignite.dps * (1 - Math.min(s.res.fire, 90) / 100) * dt;
      a.ignite.time -= dt;
      if (a.ignite.time <= 0) a.ignite = null;
    }
    if (a.bleed) {
      dot += a.bleed.dps * (this.moving ? 2 : 1) * dt;
      a.bleed.time -= dt;
      if (a.bleed.time <= 0) a.bleed = null;
    }
    if (a.poison.length) {
      const chaosMult = s.chaosImmune ? 0 : 1 - Math.min(s.res.chaos, 90) / 100;
      for (const p of a.poison) {
        dot += p.dps * chaosMult * dt;
        p.time -= dt;
      }
      a.poison = a.poison.filter((p) => p.time > 0);
    }
    if (dot > 0) this.takeDamage(dot * s.damageTakenMult * this.shockTaken, false);

    for (const k of ['chill', 'freeze', 'shock'] as const) {
      const x = a[k];
      if (x) {
        x.time -= dt;
        if (x.time <= 0) a[k] = null;
      }
    }
    for (const b of this.buffs) b.time -= dt;
    this.buffs = this.buffs.filter((b) => b.time > 0);
    if (this.hitFlash > 0) this.hitFlash -= dt;
    return dot;
  }

  /** Apply mitigated damage to energy shield, mana (Arcane Ward) and life. */
  takeDamage(amount: number, resetEs = true): void {
    if (this.dead || amount <= 0) return;
    if (resetEs) this.esTimer = 0;
    let rest = amount;
    if (this.es > 0) {
      const absorbed = Math.min(this.es, rest);
      this.es -= absorbed;
      rest -= absorbed;
    }
    if (rest > 0 && this.stats.manaFirst > 0 && this.mana > 0) {
      const fromMana = Math.min(this.mana, rest * this.stats.manaFirst);
      this.mana -= fromMana;
      rest -= fromMana;
    }
    this.life -= rest;
    if (this.life <= 0) {
      this.life = 0;
      this.dead = true;
    }
  }

  buffMods(): StatMod[] {
    const out: StatMod[] = [];
    for (const b of this.buffs) out.push(...b.mods);
    return out;
  }
}
