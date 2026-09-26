import { angleDiff, angleTo, dist, fromAngle, normalize, type Vec2 } from '../core/math';
import type { RNG } from '../core/rng';
import type { BehaviourId } from '../data/gems';
import type { Actor, Team } from '../game/actor';
import type { AreaEffect, Projectile, ProjectileVisual, VfxEvent } from '../game/entities';
import type { TileMap } from '../game/tilemap';
import type { SkillStats } from './skills';

/**
 * Skill behaviours shared by the player, minions and monsters. A behaviour turns a
 * SkillStats snapshot + parameters into hits, projectiles and area effects via the host.
 */

export interface SkillHost {
  map: TileMap;
  rng: RNG;
  /** Living actors hostile to `team`. */
  hostiles(team: Team): Actor[];
  hit(target: Actor, stats: SkillStats, source: Actor, mult?: number): void;
  addProjectile(p: Omit<Projectile, 'id' | 'dead' | 'traveled' | 'erraticTimer' | 'hitIds'> & { hitIds?: Set<number> }): void;
  addEffect(e: Omit<AreaEffect, 'id' | 'done' | 'totalDelay'>): void;
  vfx(e: VfxEvent): void;
  /** Move an actor over time (leap/dash/charge). `onArrive` fires at the destination. */
  travel(actor: Actor, to: Vec2, duration: number, opts: { arc?: number; onArrive?: () => void; onPass?: (a: Actor) => void; width?: number }): void;
  teleport(actor: Actor, to: Vec2): void;
}

export interface SkillContext {
  caster: Actor;
  stats: SkillStats;
  params: Record<string, number>;
  target: Vec2;
  targetActor?: Actor;
  color: string;
  visual?: ProjectileVisual;
  /** Monster telegraph time (delays area effects and shows a warning). */
  telegraph?: number;
}

const DEG = Math.PI / 180;

/** Actors hostile to `team` (the caster's team) within a circle. */
export function actorsInCircle(host: SkillHost, team: Team, c: Vec2, r: number): Actor[] {
  return host.hostiles(team).filter((a) => dist(a.pos, c) <= r + a.radius);
}

export function actorsInCone(host: SkillHost, team: Team, origin: Vec2, dir: number, halfAngle: number, length: number): Actor[] {
  return host.hostiles(team).filter((a) => {
    const d = dist(a.pos, origin);
    if (d > length + a.radius) return false;
    if (d < a.radius + 0.3) return true;
    return Math.abs(angleDiff(dir, angleTo(origin, a.pos))) <= halfAngle + Math.atan2(a.radius, d);
  });
}

/** Pick the melee target: the requested actor if in reach, otherwise the closest enemy in front. */
function meleeTarget(host: SkillHost, ctx: SkillContext, reach: number): Actor | undefined {
  const c = ctx.caster;
  const t = ctx.targetActor;
  if (t && !t.dead && dist(c.pos, t.pos) <= reach + t.radius + 0.35) return t;
  const cands = actorsInCone(host, c.team, c.pos, c.facing, 50 * DEG, reach + 0.3);
  cands.sort((a, b) => dist(a.pos, c.pos) - dist(b.pos, c.pos));
  return cands[0];
}

function projectileVisual(ctx: SkillContext): ProjectileVisual {
  return ctx.visual ?? 'orb';
}

/** Spawn a fan of projectiles toward the target point. */
export function fireProjectiles(host: SkillHost, ctx: SkillContext, origin: Vec2, count: number, spreadDeg: number, opts: Partial<Projectile> = {}): void {
  const { caster, stats, params } = ctx;
  const base = angleTo(origin, ctx.target);
  const spread = count > 1 ? Math.max(spreadDeg, 12 * (count - 1)) * DEG : 0;
  for (let i = 0; i < count; i++) {
    const a = count > 1 ? base - spread / 2 + (spread * i) / (count - 1) : base;
    host.addProjectile({
      owner: caster,
      team: caster.team,
      pos: { ...origin },
      dir: fromAngle(a),
      speed: (params.speed ?? 20) * stats.projSpeedMult,
      radius: params.size ?? 0.3,
      range: params.range ?? 14,
      life: params.duration ? params.duration * stats.durationMult : 99,
      stats,
      pierce: stats.pierce,
      chain: stats.chain,
      fork: stats.fork,
      forked: false,
      explodeRadius: (params.explodeRadius ?? params.explode ?? 0) * stats.areaMult,
      strikes: params.strikes ?? 0,
      strikeRadius: (params.strikeRadius ?? 0) * stats.areaMult,
      erratic: !!params.erratic,
      closeQuarters: stats.closeQuarters,
      visual: projectileVisual(ctx),
      color: ctx.color,
      ...opts,
    });
  }
}

export function executeBehaviour(host: SkillHost, behaviour: BehaviourId | 'charge', ctx: SkillContext): void {
  const { caster, stats, params } = ctx;
  const team = caster.team;
  const facing = caster.facing;

  switch (behaviour) {
    case 'melee': {
      const reach = stats.range + caster.radius;
      if ((params.arc ?? 0) > 0) {
        const radius = (params.radius ?? 2) * stats.areaMult + caster.radius * 0.5;
        const half = ((params.arc ?? 90) / 2) * DEG;
        for (const a of actorsInCone(host, team, caster.pos, facing, half, radius)) host.hit(a, stats, caster);
        host.vfx({ type: 'swing', pos: caster.pos, angle: facing, arc: half * 2, radius, color: ctx.color });
      } else {
        const t = meleeTarget(host, ctx, reach);
        host.vfx({ type: 'swing', pos: caster.pos, angle: facing, arc: 70 * DEG, radius: reach, color: ctx.color });
        if (t) {
          host.hit(t, stats, caster);
          if (stats.knockback && !t.dead) {
            const d = normalize({ x: t.pos.x - caster.pos.x, y: t.pos.y - caster.pos.y });
            t.knock = { x: d.x * 6, y: d.y * 6 };
          }
          if (stats.splash) {
            const r = 1.6 * stats.areaMult;
            for (const a of actorsInCircle(host, team, t.pos, r)) if (a !== t) host.hit(a, stats, caster, 0.7);
            host.vfx({ type: 'nova', pos: t.pos, radius: r, color: ctx.color });
          }
        }
      }
      break;
    }
    case 'slam': {
      const length = (params.length ?? 4) * stats.areaMult;
      const half = ((params.angle ?? 50) / 2) * DEG;
      if (ctx.telegraph) {
        host.addEffect({ owner: caster, team: caster.team, pos: { ...caster.pos }, radius: length, shape: 'cone', dir: facing, halfAngle: half, delay: ctx.telegraph, stats, dmgMult: 1, color: ctx.color, telegraph: true, vfx: 'slam' });
      } else {
        for (const a of actorsInCone(host, team, caster.pos, facing, half, length)) host.hit(a, stats, caster);
        host.vfx({ type: 'slam', pos: caster.pos, angle: facing, halfAngle: half, length, color: ctx.color });
      }
      break;
    }
    case 'strike_projectile': {
      const reach = stats.range + caster.radius;
      const t = meleeTarget(host, ctx, reach);
      host.vfx({ type: 'swing', pos: caster.pos, angle: facing, arc: 70 * DEG, radius: reach, color: ctx.color });
      if (t) host.hit(t, stats, caster);
      const count = stats.projectiles;
      if ((params.mode ?? 0) === 1) {
        // Molten globules lobbed to random points around the target
        const centre = t ? t.pos : ctx.target;
        for (let i = 0; i < count; i++) {
          const a = host.rng.float(0, Math.PI * 2);
          const r = host.rng.float(0.8, 3.2);
          const p = host.map.nearestFloor({ x: centre.x + Math.cos(a) * r, y: centre.y + Math.sin(a) * r });
          const delay = host.rng.float(0.3, 0.55);
          host.vfx({ type: 'lob', from: caster.pos, to: p, duration: delay, color: ctx.color });
          host.addEffect({ owner: caster, team: caster.team, pos: p, radius: (params.explodeRadius ?? 1.4) * stats.areaMult, shape: 'circle', dir: 0, halfAngle: 0, delay, stats, dmgMult: 0.8, color: ctx.color, telegraph: false, vfx: 'explosion' });
        }
      } else {
        const origin = t ? t.pos : caster.pos;
        const ahead = fromAngle(facing, 10);
        fireProjectiles(host, { ...ctx, target: { x: origin.x + ahead.x, y: origin.y + ahead.y } }, { ...origin }, count, params.spread ?? 30, {
          hitIds: t ? new Set([t.id]) : undefined,
          visual: 'blade',
          speed: (params.speed ?? 24) * stats.projSpeedMult,
          range: params.range ?? 9,
          radius: 0.35,
        });
      }
      break;
    }
    case 'projectile': {
      const origin = { x: caster.pos.x + Math.cos(facing) * caster.radius, y: caster.pos.y + Math.sin(facing) * caster.radius };
      fireProjectiles(host, ctx, origin, stats.projectiles, params.spread ?? 0);
      break;
    }
    case 'nova': {
      const r = (params.radius ?? 3) * stats.areaMult;
      if (ctx.telegraph) {
        host.addEffect({ owner: caster, team: caster.team, pos: { ...caster.pos }, radius: r, shape: 'circle', dir: 0, halfAngle: 0, delay: ctx.telegraph, stats, dmgMult: 1, color: ctx.color, telegraph: true, vfx: 'nova' });
      } else {
        for (const a of actorsInCircle(host, team, caster.pos, r)) host.hit(a, stats, caster);
        host.vfx({ type: 'nova', pos: caster.pos, radius: r, color: ctx.color });
      }
      break;
    }
    case 'chain': {
      const range = params.range ?? 12;
      const chainRange = params.chainRange ?? 5;
      let first: Actor | undefined = ctx.targetActor && !ctx.targetActor.dead && dist(caster.pos, ctx.targetActor.pos) <= range ? ctx.targetActor : undefined;
      if (!first) {
        const cands = host.hostiles(team).filter((a) => dist(caster.pos, a.pos) <= range && dist(a.pos, ctx.target) < 4 && host.map.los(caster.pos, a.pos));
        cands.sort((a, b) => dist(a.pos, ctx.target) - dist(b.pos, ctx.target));
        first = cands[0];
      }
      const points: Vec2[] = [{ ...caster.pos }];
      if (!first) {
        const dir = normalize({ x: ctx.target.x - caster.pos.x, y: ctx.target.y - caster.pos.y });
        const len = Math.min(range * 0.6, host.map.raycast(caster.pos, dir.x, dir.y, range * 0.6));
        points.push({ x: caster.pos.x + dir.x * len, y: caster.pos.y + dir.y * len });
        host.vfx({ type: 'lightning', points, color: ctx.color });
        break;
      }
      const hitSet = new Set<number>();
      let cur: Actor | undefined = first;
      let chains = stats.chain;
      while (cur) {
        hitSet.add(cur.id);
        points.push({ ...cur.pos });
        host.hit(cur, stats, caster);
        if (chains-- <= 0) break;
        const from: Vec2 = cur.pos;
        const next = host.hostiles(team)
          .filter((a) => !hitSet.has(a.id) && dist(from, a.pos) <= chainRange && host.map.los(from, a.pos))
          .sort((a, b) => dist(from, a.pos) - dist(from, b.pos))[0];
        cur = next;
      }
      host.vfx({ type: 'lightning', points, color: ctx.color });
      break;
    }
    case 'rain': {
      const r = (params.radius ?? 3) * stats.areaMult;
      const impacts = params.impacts ?? 8;
      const dur = (params.duration ?? 1) * stats.durationMult;
      const ir = (params.impactRadius ?? 1) * Math.sqrt(stats.areaMult);
      const centre = host.map.nearestFloor(ctx.target);
      for (let i = 0; i < impacts; i++) {
        const a = host.rng.float(0, Math.PI * 2);
        const d = Math.sqrt(host.rng.next()) * r;
        const p = { x: centre.x + Math.cos(a) * d, y: centre.y + Math.sin(a) * d };
        const delay = (ctx.telegraph ?? 0.25) + (dur * i) / impacts;
        host.addEffect({ owner: caster, team: caster.team, pos: p, radius: ir, shape: 'circle', dir: 0, halfAngle: 0, delay, stats, dmgMult: 1, color: ctx.color, telegraph: !!ctx.telegraph, vfx: 'impact' });
      }
      break;
    }
    case 'leap': {
      const maxD = params.maxDist ?? 8;
      const dir = normalize({ x: ctx.target.x - caster.pos.x, y: ctx.target.y - caster.pos.y });
      const d = Math.min(maxD, dist(caster.pos, ctx.target));
      const dest = host.map.nearestFloor({ x: caster.pos.x + dir.x * d, y: caster.pos.y + dir.y * d });
      const r = (params.radius ?? 2) * stats.areaMult;
      host.travel(caster, dest, Math.max(0.25, stats.actionTime * 0.8), {
        arc: 1.6,
        onArrive: () => {
          for (const a of actorsInCircle(host, team, caster.pos, r)) host.hit(a, stats, caster);
          host.vfx({ type: 'slam', pos: caster.pos, angle: 0, halfAngle: Math.PI, length: r, color: ctx.color });
        },
      });
      break;
    }
    case 'dash':
    case 'charge': {
      const maxD = params.distance ?? 7;
      const dir = normalize({ x: ctx.target.x - caster.pos.x, y: ctx.target.y - caster.pos.y });
      const free = host.map.raycast(caster.pos, dir.x, dir.y, maxD);
      const want = behaviour === 'charge' ? maxD : Math.min(maxD, dist(caster.pos, ctx.target) + 1);
      const d = Math.min(free, want);
      const dest = { x: caster.pos.x + dir.x * d, y: caster.pos.y + dir.y * d };
      const hitOnce = new Set<number>();
      host.travel(caster, dest, Math.max(0.15, d / (behaviour === 'charge' ? 16 : 22)), {
        width: params.width ?? 1.2,
        onPass: (a) => {
          if (hitOnce.has(a.id)) return;
          hitOnce.add(a.id);
          host.hit(a, stats, caster);
        },
      });
      break;
    }
    case 'blink': {
      const maxD = params.distance ?? 6;
      const dir = normalize({ x: ctx.target.x - caster.pos.x, y: ctx.target.y - caster.pos.y });
      const d = Math.min(maxD, dist(caster.pos, ctx.target));
      const want = { x: caster.pos.x + dir.x * d, y: caster.pos.y + dir.y * d };
      const dest = host.map.nearestFloor(want);
      if (dist(dest, want) > 2) break;
      host.vfx({ type: 'blink', from: { ...caster.pos }, to: dest, color: ctx.color });
      host.teleport(caster, dest);
      break;
    }
    case 'flicker': {
      // teleport next to an enemy near the cursor (or the closest one) and strike it
      const range = params.range ?? 10;
      const cands = host.hostiles(team).filter((a) => dist(caster.pos, a.pos) <= range && host.map.los(caster.pos, a.pos));
      const pick = ctx.targetActor && !ctx.targetActor.dead && cands.includes(ctx.targetActor) ? ctx.targetActor : cands.sort((a, b) => dist(a.pos, ctx.target) - dist(b.pos, ctx.target))[0];
      if (!pick) {
        host.vfx({ type: 'swing', pos: caster.pos, angle: facing, arc: 70 * DEG, radius: stats.range + caster.radius, color: ctx.color });
        break;
      }
      const back = normalize({ x: caster.pos.x - pick.pos.x, y: caster.pos.y - pick.pos.y });
      const dest = host.map.nearestFloor({ x: pick.pos.x + back.x * (pick.radius + caster.radius + 0.2), y: pick.pos.y + back.y * (pick.radius + caster.radius + 0.2) });
      host.vfx({ type: 'blink', from: { ...caster.pos }, to: dest, color: ctx.color });
      host.teleport(caster, dest);
      caster.facing = angleTo(caster.pos, pick.pos);
      host.vfx({ type: 'swing', pos: caster.pos, angle: caster.facing, arc: 90 * DEG, radius: stats.range + caster.radius, color: ctx.color });
      host.hit(pick, stats, caster);
      if (stats.splash) {
        const r = 1.6 * stats.areaMult;
        for (const a of actorsInCircle(host, team, pick.pos, r)) if (a !== pick) host.hit(a, stats, caster, 0.7);
      }
      break;
    }
    case 'spin': {
      // Cyclone: hit everything around, then drift toward the cursor
      const r = (params.radius ?? 2) * stats.areaMult + caster.radius * 0.5;
      for (const a of actorsInCircle(host, team, caster.pos, r)) host.hit(a, stats, caster);
      host.vfx({ type: 'swing', pos: caster.pos, angle: facing + Math.PI, arc: Math.PI * 2, radius: r, color: ctx.color });
      const step = Math.min(params.step ?? 1, dist(caster.pos, ctx.target));
      if (step > 0.2) {
        const dir = normalize({ x: ctx.target.x - caster.pos.x, y: ctx.target.y - caster.pos.y });
        const d = Math.min(step, host.map.raycast(caster.pos, dir.x, dir.y, step));
        if (d > 0.1) host.travel(caster, { x: caster.pos.x + dir.x * d, y: caster.pos.y + dir.y * d }, Math.max(0.06, stats.actionTime * 0.35), {});
      }
      break;
    }
    case 'summon':
    case 'aura':
      // handled by the game (they create entities / toggle state rather than dealing damage)
      break;
  }
}
