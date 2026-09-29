import type { Vec2 } from '../core/math';
import type { BehaviourId } from '../data/gems';
import type { SkillInstance, SkillStats } from '../skills/skills';
import type { CharacterStats } from '../stats/character';
import { Actor, type Team } from './actor';
import type { CharacterData } from './character';
import type { ProjectileVisual } from './entities';

export interface PlayerAction {
  skillUid: string;
  behaviour: BehaviourId;
  stats: SkillStats;
  params: Record<string, number>;
  target: Vec2;
  targetActor?: Actor;
  duration: number;
  elapsed: number;
  /** Times (seconds into the action) at which each hit fires. */
  hitTimes: number[];
  color: string;
  visual?: ProjectileVisual;
}

export class Player extends Actor {
  team: Team = 'player';
  char: CharacterData;
  cstats!: CharacterStats;
  skills = new Map<string, SkillInstance>();
  skillStats = new Map<string, SkillStats>();
  path: Vec2[] = [];
  pathGoal: Vec2 | null = null;
  pathTimer = 0;
  action: PlayerAction | null = null;
  /** Reserved life (Blood Pact auras). */
  reservedLife = 0;
  /** Seconds the "not enough mana" warning is suppressed for. */
  manaWarn = 0;
  stride = 0;

  constructor(char: CharacterData, pos: Vec2) {
    super(pos, 0.4);
    this.char = char;
  }

  get maxLifeUsable(): number {
    return Math.max(1, this.stats.maxLife - this.reservedLife);
  }

  override heal(amount: number): void {
    if (this.dead) return;
    this.life = Math.min(this.maxLifeUsable, this.life + amount);
  }
}
