import type { Vec2 } from '../core/math';
import type { NpcId } from '../data/quests';
import type { Item } from '../items/types';
import type { SkillStats } from '../skills/skills';
import type { Actor, Team } from './actor';

export type ProjectileVisual = 'arrow' | 'fireball' | 'frost' | 'spark' | 'chaos' | 'orb' | 'blade' | 'lightning_arrow';

export interface Projectile {
  id: number;
  owner: Actor;
  team: Team;
  pos: Vec2;
  dir: Vec2;
  speed: number;
  radius: number;
  /** Remaining travel distance. */
  range: number;
  /** Remaining lifetime (seconds) for duration-based projectiles. */
  life: number;
  traveled: number;
  stats: SkillStats;
  pierce: number;
  chain: number;
  fork: boolean;
  forked: boolean;
  hitIds: Set<number>;
  explodeRadius: number;
  strikes: number;
  strikeRadius: number;
  erratic: boolean;
  erraticTimer: number;
  closeQuarters: boolean;
  visual: ProjectileVisual;
  color: string;
  dead: boolean;
}

export type EffectShape = 'circle' | 'cone';

/** A (possibly delayed) area of effect. Delayed effects render a telegraph until they land. */
export interface AreaEffect {
  id: number;
  owner: Actor;
  team: Team;
  pos: Vec2;
  radius: number;
  shape: EffectShape;
  /** Cone direction (radians) and half-angle (radians). */
  dir: number;
  halfAngle: number;
  delay: number;
  totalDelay: number;
  stats: SkillStats;
  dmgMult: number;
  color: string;
  /** Show a warning marker while waiting (monster telegraphs). */
  telegraph: boolean;
  excludeId?: number;
  vfx: 'nova' | 'explosion' | 'impact' | 'slam' | 'none';
  done: boolean;
}

export interface GroundItem {
  id: number;
  item: Item;
  pos: Vec2;
  age: number;
}

export type InteractKind = 'stash' | 'vendor' | 'waypoint' | 'map_device' | 'town_portal' | 'area_portal' | 'exit' | 'npc' | 'quest';

export interface Interactable {
  id: number;
  kind: InteractKind;
  pos: Vec2;
  label: string;
  radius: number;
  /** Town NPC (kind 'npc'). */
  npc?: NpcId;
  /** Quest object (kind 'quest'): quest id and object index. */
  questId?: string;
  questIndex?: number;
}

let nextEntityId = 1;
export const newEntityId = (): number => nextEntityId++;

export type VfxEvent =
  | { type: 'swing'; pos: Vec2; angle: number; arc: number; radius: number; color: string }
  | { type: 'slam'; pos: Vec2; angle: number; halfAngle: number; length: number; color: string }
  | { type: 'nova'; pos: Vec2; radius: number; color: string }
  | { type: 'explosion'; pos: Vec2; radius: number; color: string }
  | { type: 'lightning'; points: Vec2[]; color: string }
  | { type: 'impact'; pos: Vec2; color: string }
  | { type: 'blink'; from: Vec2; to: Vec2; color: string }
  | { type: 'lob'; from: Vec2; to: Vec2; duration: number; color: string }
  | { type: 'levelup'; pos: Vec2 }
  | { type: 'death'; pos: Vec2; color: string; big: boolean }
  | { type: 'text'; pos: Vec2; text: string; color: string; big?: boolean }
  | { type: 'flask'; pos: Vec2; color: string }
  | { type: 'summon'; pos: Vec2 };
