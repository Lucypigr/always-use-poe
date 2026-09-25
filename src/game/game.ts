import { EventBus } from '../core/events';
import { angleTo, dist, fromAngle, normalize, type Vec2 } from '../core/math';
import { RNG } from '../core/rng';
import { AREA_BY_ID } from '../data/areas';
import { CURRENCY_BY_ID, type CurrencyId } from '../data/currency';
import type { GemDef, SkillTag } from '../data/gems';
import { canRefund, passiveStats, pathToNode, PASSIVE_TREE } from '../data/passives';
import { MAX_LEVEL, monsterDamage, monsterLife, resistPenalty, xpMultiplier, xpToNext } from '../data/scaling';
import { applyCurrency, type CraftResult } from '../items/craft';
import { addItem, countCurrency, removeItem, spendCurrency } from '../items/grid';
import { currencyId, displayName, flaskProps } from '../items/item';
import type { EquipSlot, Item } from '../items/types';
import { executeBehaviour, type SkillContext, type SkillHost } from '../skills/behaviours';
import { addGemXp, levelGem } from '../skills/gemUtil';
import { computeMinionStats, computeSkillStats, resolveSkills, type SkillStats } from '../skills/skills';
import { computeCharacterStats } from '../stats/character';
import type { StatMod } from '../stats/stats';
import type { Actor, Team } from './actor';
import { AreaInstance, createMapArea, createStoryArea, createTown } from './area';
import { equippedGems, passivePointsUnspent, SKILL_SLOTS, type CharacterData } from './character';
import { applyHit, rollHit } from './combat';
import { newEntityId, type AreaEffect, type GroundItem, type Interactable, type Projectile, type ProjectileVisual, type VfxEvent } from './entities';
import { questReward, rollDrops } from './loot';
import { makeMinion, Monster, monsterDef } from './monster';
import { findPath } from './path';
import { Player } from './player';
import type { AccountData, Settings } from './save';
import { evaluateSale, vendorStock, type VendorOffer } from './vendor';

export interface GameEvents extends Record<string, unknown> {
  log: { text: string; color?: string };
  levelup: { level: number };
  area: { name: string; level: number; town: boolean };
  inventory: null;
  stats: null;
  panel: { panel: 'stash' | 'vendor' | 'waypoint' | 'map_device' };
  death: null;
  save: null;
  drop: { item: Item };
  pickup: { item: Item };
}

export interface InputState {
  cursor: Vec2;
  hoverMonster: Monster | null;
  /** Skill slot currently held (0 = LMB skill). */
  heldSlot: number | null;
  moveHeld: boolean;
  stand: boolean;
}

export const SKILL_COLORS: Record<string, string> = {
  fire: '#ff7a2a', cold: '#8fd8ff', lightning: '#d8e4ff', chaos: '#b07aff', physical: '#e8dcc0',
};

function skillColor(tags: Set<SkillTag> | SkillTag[]): string {
  const t = new Set(tags);
  if (t.has('fire')) return SKILL_COLORS.fire;
  if (t.has('cold')) return SKILL_COLORS.cold;
  if (t.has('lightning')) return SKILL_COLORS.lightning;
  if (t.has('chaos')) return SKILL_COLORS.chaos;
  return SKILL_COLORS.physical;
}

function skillVisual(gem: GemDef): ProjectileVisual {
  const v = gem.active?.params.visual ?? 0;
  if (v === 1) return 'arrow';
  if (v === 2) return 'lightning_arrow';
  if (v === 3) return 'fireball';
  if (v === 4) return 'spark';
  if (gem.tags.includes('cold')) return 'frost';
  if (gem.tags.includes('chaos')) return 'chaos';
  return 'orb';
}

const MELEE_BEHAVIOURS = new Set(['melee', 'strike_projectile']);

export class Game implements SkillHost {
  events = new EventBus<GameEvents>();
  rng = new RNG();
  player: Player;
  area!: AreaInstance;
  town: AreaInstance;
  portalInstance: AreaInstance | null = null;
  input: InputState = { cursor: { x: 0, y: 0 }, hoverMonster: null, heldSlot: null, moveHeld: false, stand: false };
  interactTarget: { kind: 'item'; gi: GroundItem } | { kind: 'object'; obj: Interactable } | null = null;
  vfxQueue: VfxEvent[] = [];
  time = 0;
  vendorOffers: VendorOffer[] = [];
  private vendorLevel = -1;
  private flowTimer = 0;
  private saveTimer = 0;
  /** Held slot on the previous frame (auras toggle on the press edge only). */
  private prevHeld: number | null = null;
  private recalcPending = false;
  deathTimer = 0;
  /** Session statistics. */
  kills = 0;

  constructor(
    public char: CharacterData,
    public account: AccountData,
    public settings: Settings,
  ) {
    this.town = createTown(this.rng);
    this.town.resPenalty = this.townPenalty();
    this.player = new Player(char, this.town.map.spawn);
    this.recalc(true);
    this.enterArea(this.town, this.town.map.spawn);
  }

  get map() {
    return this.area.map;
  }

  // ------------------------------------------------------------------------------------------
  // Stats
  // ------------------------------------------------------------------------------------------

  /** Recompute character stats, skills and aura reservation. */
  recalc(fullHeal = false): void {
    const p = this.player;
    const penalty = this.area ? this.area.resPenalty : 0;
    const temp: StatMod[] = [...p.buffMods(), ...(this.area?.playerMods ?? [])];
    const first = computeCharacterStats(this.char, temp, penalty);
    const skills1 = resolveSkills(this.char, first);
    const auraMods: StatMod[] = [];
    let reservedPct = 0;
    const activeAuras: string[] = [];
    for (const uid of this.char.activeAuras) {
      const sk = skills1.get(uid);
      if (!sk || !sk.usable || sk.gem.active?.behaviour !== 'aura') continue;
      const st = computeSkillStats(sk, first);
      if (reservedPct + st.reservation > 100) continue;
      reservedPct += st.reservation;
      activeAuras.push(uid);
      auraMods.push(...(sk.gem.active.levelStats?.(sk.level) ?? []));
    }
    this.char.activeAuras = activeAuras;
    const stats = computeCharacterStats(this.char, [...temp, ...auraMods], penalty);
    p.cstats = stats;
    p.skills = resolveSkills(this.char, stats);
    p.skillStats.clear();
    for (const [uid, sk] of p.skills) if (sk.gem.active) p.skillStats.set(uid, computeSkillStats(sk, stats));
    p.setStats(stats, !fullHeal);
    if (stats.bloodPact) {
      p.reserved = 0;
      p.reservedLife = Math.round((stats.maxLife * reservedPct) / 100);
    } else {
      p.reserved = Math.round((stats.maxMana * reservedPct) / 100);
      p.reservedLife = 0;
    }
    p.mana = Math.min(p.mana, p.unreservedMana);
    p.life = Math.min(p.life, p.maxLifeUsable);
    for (const slot in this.char.skillBar) {
      const uid = this.char.skillBar[slot];
      if (uid && uid !== 'default_attack' && !p.skills.has(uid)) this.char.skillBar[slot] = null;
    }
    this.autoAssignSkills();
    this.events.emit('stats', null);
  }

  requestRecalc(): void {
    this.recalcPending = true;
  }

  private autoAssignSkills(): void {
    const bar = this.char.skillBar;
    for (const [uid, sk] of this.player.skills) {
      if (uid === 'default_attack' || bar.includes(uid) || !sk.gem.active) continue;
      const free = bar.findIndex((s, i) => i > 0 && !s);
      if (free < 0) break;
      bar[free] = uid;
    }
  }

  // ------------------------------------------------------------------------------------------
  // Areas & travel
  // ------------------------------------------------------------------------------------------

  private enterArea(inst: AreaInstance, pos: Vec2): void {
    this.area = inst;
    const p = this.player;
    p.pos = { ...inst.map.nearestFloor(pos) };
    p.path = [];
    p.action = null;
    p.travel = null;
    p.airborne = 0;
    this.interactTarget = null;
    // minions follow the player through portals
    for (const m of [...(this.lastMinions ?? [])]) {
      if (m.dead) continue;
      m.pos = inst.map.nearestFloor({ x: p.pos.x + this.rng.float(-1.5, 1.5), y: p.pos.y + this.rng.float(-1.5, 1.5) });
      if (!inst.monsters.includes(m)) inst.monsters.push(m);
    }
    this.lastMinions = null;
    if (inst.town) {
      // like PoE, flasks refill in town; we also restore pools for convenience
      for (const slot of ['flask1', 'flask2', 'flask3', 'flask4', 'flask5'] as EquipSlot[]) {
        const f = this.char.equipment[slot];
        const fp = f ? flaskProps(f) : undefined;
        if (f?.flask && fp) f.flask.charges = fp.maxCharges;
      }
      p.life = p.maxLifeUsable;
      p.mana = p.unreservedMana;
      p.ailments = { ignite: null, bleed: null, poison: [], chill: null, freeze: null, shock: null };
      this.town.interactables = this.town.interactables.filter((i) => i.kind !== 'area_portal');
      if (this.portalInstance) this.town.addInteractable('area_portal', this.town.portalPos!, `Portal: ${this.portalInstance.name}`, 1);
    }
    inst.flow.originX = -1;
    inst.flow.update(p.pos);
    this.recalc();
    this.events.emit('area', { name: inst.name, level: inst.level, town: inst.town });
    this.log(inst.town ? `You have entered ${inst.name}.` : `You have entered ${inst.name} (Level ${inst.level}).`, '#d8c8a0');
    this.save();
  }

  private lastMinions: Monster[] | null = null;

  private leaveArea(): void {
    this.lastMinions = this.area.monsters.filter((m) => m.isMinion && !m.dead);
    this.area.monsters = this.area.monsters.filter((m) => !m.isMinion);
  }

  goToTown(): void {
    this.leaveArea();
    this.enterArea(this.town, this.town.map.spawn);
  }

  travelToArea(areaId: string): void {
    if (!this.char.unlockedAreas.includes(areaId)) return;
    this.leaveArea();
    const inst = createStoryArea(areaId, this.rng);
    this.portalInstance = null;
    this.enterArea(inst, inst.map.spawn);
  }

  openMap(mapItem: Item): boolean {
    if (!mapItem.map) return false;
    this.leaveArea();
    const inst = createMapArea(mapItem, this.rng);
    this.portalInstance = inst;
    this.enterArea(inst, inst.map.spawn);
    this.log(`The Map Device hums. ${inst.name} awaits.`, '#c8a8ff');
    return true;
  }

  usePortalScroll(): boolean {
    if (this.area.town) {
      this.log('You cannot open a portal in town.', '#ff8080');
      return false;
    }
    if (!spendCurrency(this.char.inventory, 'portal', 1)) {
      this.log('You have no Portal Scrolls.', '#ff8080');
      return false;
    }
    this.area.interactables = this.area.interactables.filter((i) => i.kind !== 'town_portal');
    const pos = this.map.nearestFloor({ x: this.player.pos.x + Math.cos(this.player.facing) * 1.5, y: this.player.pos.y + Math.sin(this.player.facing) * 1.5 });
    this.area.addInteractable('town_portal', pos, 'Portal to Duskhaven', 1);
    this.area.portalPos = pos;
    this.portalInstance = this.area;
    this.events.emit('inventory', null);
    return true;
  }

  private interact(obj: Interactable): void {
    switch (obj.kind) {
      case 'stash':
        this.events.emit('panel', { panel: 'stash' });
        break;
      case 'vendor':
        this.refreshVendor();
        this.events.emit('panel', { panel: 'vendor' });
        break;
      case 'waypoint':
        this.events.emit('panel', { panel: 'waypoint' });
        break;
      case 'map_device':
        this.events.emit('panel', { panel: 'map_device' });
        break;
      case 'town_portal':
        this.goToTown();
        break;
      case 'area_portal':
        if (this.portalInstance) {
          const inst = this.portalInstance;
          this.leaveArea();
          this.enterArea(inst, inst.portalPos ?? inst.map.spawn);
        }
        break;
      case 'exit':
        this.goToTown();
        break;
    }
  }

  // ------------------------------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------------------------------

  clickGroundItem(gi: GroundItem): void {
    this.interactTarget = { kind: 'item', gi };
    this.player.path = [];
  }

  clickInteractable(obj: Interactable): void {
    this.interactTarget = { kind: 'object', obj };
    this.player.path = [];
  }

  cancelInteract(): void {
    this.interactTarget = null;
  }

  // ------------------------------------------------------------------------------------------
  // Main update
  // ------------------------------------------------------------------------------------------

  update(dt: number): void {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.char.playTime += dt;
    if (this.recalcPending) {
      this.recalcPending = false;
      this.recalc();
    }
    const area = this.area;
    this.updatePlayer(dt);
    this.flowTimer -= dt;
    if (this.flowTimer <= 0) {
      this.flowTimer = 0.2;
      area.flow.update(this.player.pos);
    }
    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    // pools & damage over time
    const hadBuffs = this.player.buffs.length;
    this.player.tickPools(dt);
    this.player.life = Math.min(this.player.life, this.player.maxLifeUsable);
    if (hadBuffs !== this.player.buffs.length) this.requestRecalc();
    for (const m of area.monsters) {
      if (m.dead) continue;
      m.tickPools(dt);
      if (m.dead) this.onKill(m, null);
    }
    if (this.player.dead && this.deathTimer === 0) {
      this.deathTimer = 0.001;
      this.char.deaths++;
      this.log('You have died.', '#ff4040');
      this.events.emit('death', null);
    }
    for (const gi of area.groundItems) gi.age += dt;
    area.monsters = area.monsters.filter((m) => !m.dead || (m.deathTimer += dt) < 4);
    area.map.reveal(this.player.pos, 11);
    this.saveTimer += dt;
    if (this.saveTimer > 30) this.save();
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    if (p.dead) return;
    p.manaWarn -= dt;
    p.pathTimer -= dt;
    if (p.travel) {
      this.updateTravel(p, dt);
      return;
    }
    if (p.frozen) return;
    if (p.action) {
      this.updateAction(dt);
      if (p.action) return;
    }
    const inp = this.input;
    p.moving = false;

    // Skills
    const pressed = inp.heldSlot !== this.prevHeld;
    this.prevHeld = inp.heldSlot;
    if (inp.heldSlot !== null) {
      const uid = this.char.skillBar[inp.heldSlot] ?? (inp.heldSlot === 0 ? 'default_attack' : null);
      if (uid) {
        const handled = this.tryUseSkill(uid, inp.cursor, inp.hoverMonster ?? undefined, dt, pressed);
        if (handled) return;
      }
    }

    // Interaction target (pick up / talk / portal)
    const it = this.interactTarget;
    if (it) {
      const pos = it.kind === 'item' ? it.gi.pos : it.obj.pos;
      const reach = it.kind === 'item' ? 1.1 : 1.1 + it.obj.radius;
      if (it.kind === 'item' && !this.area.groundItems.includes(it.gi)) {
        this.interactTarget = null;
      } else if (dist(p.pos, pos) <= reach) {
        this.interactTarget = null;
        p.path = [];
        if (it.kind === 'item') this.pickup(it.gi);
        else this.interact(it.obj);
        return;
      } else {
        this.moveToward(pos, dt);
        return;
      }
    }

    if (inp.moveHeld) {
      this.moveToward(inp.cursor, dt);
      return;
    }
    if (p.path.length) this.followPath(dt);
  }

  private moveToward(goal: Vec2, dt: number): void {
    const p = this.player;
    if (!p.pathGoal || dist(p.pathGoal, goal) > 0.5 || p.pathTimer <= 0 || !p.path.length) {
      p.pathGoal = { ...goal };
      p.pathTimer = 0.25;
      p.path = findPath(this.map, p.pos, goal, p.radius) ?? [];
    }
    this.followPath(dt);
  }

  private followPath(dt: number): void {
    const p = this.player;
    let budget = p.stats.moveSpeed * (1 - p.chillSlow) * dt;
    while (budget > 0 && p.path.length) {
      const next = p.path[0];
      const d = dist(p.pos, next);
      if (d <= budget) {
        p.pos = { ...next };
        budget -= d;
        p.path.shift();
      } else {
        const dir = normalize({ x: next.x - p.pos.x, y: next.y - p.pos.y });
        p.pos.x += dir.x * budget;
        p.pos.y += dir.y * budget;
        p.facing = Math.atan2(dir.y, dir.x);
        budget = 0;
      }
      p.moving = true;
    }
    p.stride += dt * p.stats.moveSpeed;
    this.map.collide(p.pos, p.radius);
  }

  /** Returns true if the skill input was consumed this frame (used or approaching target). */
  private tryUseSkill(uid: string, cursor: Vec2, hover: Monster | undefined, dt: number, pressed: boolean): boolean {
    const p = this.player;
    const sk = p.skills.get(uid);
    const st = p.skillStats.get(uid);
    if (!sk || !st || !sk.gem.active) return false;
    const a = sk.gem.active;
    if (!sk.usable) {
      if (p.manaWarn <= 0) {
        this.log(`${sk.gem.name}: ${sk.reason}`, '#ff8080');
        p.manaWarn = 1.5;
      }
      return false;
    }
    if (this.area.town && a.behaviour !== 'blink' && a.behaviour !== 'aura') {
      // no combat in town: treat as movement
      return false;
    }
    if (a.behaviour === 'aura') {
      if (pressed) this.toggleAura(uid);
      return true;
    }
    const target = hover && !hover.dead && hover.team === 'enemy' ? hover : undefined;
    // Melee skills walk to their target first, like PoE
    if (MELEE_BEHAVIOURS.has(a.behaviour) && target && !this.input.stand) {
      const reach = st.range + p.radius + target.radius + 0.2;
      if (dist(p.pos, target.pos) > reach) {
        this.moveToward(target.pos, dt);
        return true;
      }
    }
    if (st.manaCost > p.mana || (st.lifeCost > 0 && st.lifeCost >= p.life)) {
      if (p.manaWarn <= 0) {
        this.log('Not enough mana.', '#8fb3ff');
        p.manaWarn = 1;
      }
      return false;
    }
    p.mana -= st.manaCost;
    if (st.lifeCost) p.life -= st.lifeCost;
    const aim = target ? target.pos : cursor;
    p.facing = angleTo(p.pos, aim);
    p.path = [];
    const castPoint = ['leap', 'dash', 'blink', 'summon'].includes(a.behaviour) ? 0.05 : 0.4;
    const hitTimes: number[] = [];
    for (let i = 0; i < st.hitsPerUse; i++) hitTimes.push((st.actionTime * (i + castPoint)) / st.hitsPerUse);
    p.action = {
      skillUid: uid,
      behaviour: a.behaviour,
      stats: st,
      params: a.params,
      target: { ...aim },
      targetActor: target,
      duration: st.actionTime,
      elapsed: 0,
      hitTimes,
      color: skillColor(sk.tags),
      visual: skillVisual(sk.gem),
    };
    p.actionDuration = st.actionTime;
    p.actionTimer = st.actionTime;
    return true;
  }

  private updateAction(dt: number): void {
    const p = this.player;
    const act = p.action!;
    act.elapsed += dt * p.actionSpeed;
    p.actionTimer = Math.max(0, act.duration - act.elapsed);
    while (act.hitTimes.length && act.elapsed >= act.hitTimes[0]) {
      act.hitTimes.shift();
      if (act.behaviour === 'summon') this.summonMinions(act.skillUid);
      else {
        const ctx: SkillContext = {
          caster: p,
          stats: act.stats,
          params: act.params,
          target: act.targetActor && !act.targetActor.dead ? act.targetActor.pos : act.target,
          targetActor: act.targetActor,
          color: act.color,
          visual: act.visual,
        };
        executeBehaviour(this, act.behaviour, ctx);
      }
    }
    if (act.elapsed >= act.duration) p.action = null;
  }

  toggleAura(uid: string): void {
    const i = this.char.activeAuras.indexOf(uid);
    if (i >= 0) this.char.activeAuras.splice(i, 1);
    else this.char.activeAuras.push(uid);
    this.recalc();
    const on = this.char.activeAuras.includes(uid);
    const sk = this.player.skills.get(uid);
    if (sk) this.log(`${sk.gem.name} ${on ? 'activated' : i >= 0 ? 'deactivated' : 'cannot be activated (not enough unreserved mana)'}.`, '#c8b8ff');
  }

  private summonMinions(uid: string): void {
    const sk = this.player.skills.get(uid);
    if (!sk) return;
    const ms = computeMinionStats(sk, monsterLife, monsterDamage);
    const mine = this.area.monsters.filter((m) => m.isMinion && !m.dead);
    const count = sk.gem.active?.params.count ?? 1;
    for (let i = 0; i < count; i++) {
      if (mine.length >= ms.max) {
        const oldest = mine.shift()!;
        oldest.dead = true;
      }
      const pos = this.map.nearestFloor({ x: this.player.pos.x + Math.cos(this.player.facing) * 1.5 + this.rng.float(-1, 1), y: this.player.pos.y + Math.sin(this.player.facing) * 1.5 + this.rng.float(-1, 1) });
      const m = new Monster(monsterDef('bone_warrior'), ms.level, 'normal', pos, 'player', this.rng);
      makeMinion(m, ms.life, ms.damage, ms.attackSpeed, ms.moveSpeed, this.player.id);
      this.area.monsters.push(m);
      mine.push(m);
      this.vfx({ type: 'summon', pos });
    }
  }

  // ------------------------------------------------------------------------------------------
  // Monsters & minions
  // ------------------------------------------------------------------------------------------

  private updateMonsters(dt: number): void {
    const p = this.player;
    const area = this.area;
    const active: Monster[] = [];
    for (const m of area.monsters) {
      if (m.dead) continue;
      const d = dist(m.pos, p.pos);
      if (d > 32 && !m.aggro && !m.isMinion) continue;
      active.push(m);
      if (m.knock.x || m.knock.y) {
        m.pos.x += m.knock.x * dt;
        m.pos.y += m.knock.y * dt;
        m.knock.x *= 0.85;
        m.knock.y *= 0.85;
        if (Math.hypot(m.knock.x, m.knock.y) < 0.2) m.knock = { x: 0, y: 0 };
        this.map.collide(m.pos, m.radius);
      }
      for (const [k, v] of m.cooldowns) m.cooldowns.set(k, v - dt);
      if (m.travel) {
        this.updateTravel(m, dt);
        continue;
      }
      if (m.frozen) continue;
      if (m.actionTimer > 0) {
        m.actionTimer -= dt * m.actionSpeed;
        const pend = m.pending;
        if (pend && !pend.fired && m.actionTimer <= pend.fireAt) {
          pend.fired = true;
          this.fireMonsterSkill(m, pend.skill, pend.targetActor, pend.target);
        }
        if (m.actionTimer <= 0) m.pending = null;
        continue;
      }
      if (m.isMinion) this.minionAI(m, dt);
      else this.monsterAI(m, d, dt);
    }
    // separation
    for (let i = 0; i < active.length; i++) {
      const a = active[i];
      if (a.def.flying) continue;
      for (let j = i + 1; j < active.length; j++) {
        const b = active[j];
        if (b.def.flying) continue;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (rr - d) / 2;
        a.pos.x -= (dx / d) * push;
        a.pos.y -= (dy / d) * push;
        b.pos.x += (dx / d) * push;
        b.pos.y += (dy / d) * push;
      }
      if (!p.dead && !p.travel && !a.isMinion) {
        const dx = a.pos.x - p.pos.x;
        const dy = a.pos.y - p.pos.y;
        const rr = a.radius + p.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          a.pos.x += (dx / d) * (rr - d) * 0.8;
          a.pos.y += (dy / d) * (rr - d) * 0.8;
          p.pos.x -= (dx / d) * (rr - d) * 0.2;
          p.pos.y -= (dy / d) * (rr - d) * 0.2;
        }
      }
      this.map.collide(a.pos, a.radius);
    }
    this.map.collide(p.pos, p.radius);
  }

  private monsterTarget(m: Monster): Actor | null {
    const p = this.player;
    let best: Actor | null = p.dead ? null : p;
    let bestD = best ? dist(m.pos, p.pos) : Infinity;
    for (const o of this.area.monsters) {
      if (!o.isMinion || o.dead) continue;
      const d = dist(m.pos, o.pos);
      if (d < bestD * 0.6) {
        best = o;
        bestD = d;
      }
    }
    return best;
  }

  private monsterAI(m: Monster, distToPlayer: number, dt: number): void {
    const target = this.monsterTarget(m);
    if (!target) {
      m.moving = false;
      return;
    }
    const d = target === this.player ? distToPlayer : dist(m.pos, target.pos);
    if (!m.aggro) {
      const range = m.def.boss ? 13 : 10.5;
      if (d < range && this.map.los(m.pos, target.pos)) {
        m.aggro = true;
        for (const o of this.area.monsters) if (o.pack === m.pack && !o.dead) o.aggro = true;
      } else {
        m.moving = false;
        return;
      }
    }
    // choose a skill
    const usable = m.def.skills.filter((s) => (m.cooldowns.get(s.id) ?? 0) <= 0 && d <= s.range + target.radius + m.radius && (s.kind === 'melee' || s.kind === 'summon' || this.map.los(m.pos, target.pos)));
    const special = usable.filter((s) => s.kind !== 'melee');
    const pick = this.rng.weighted(special.length && this.rng.chance(0.7) ? special : usable, (s) => s.weight);
    if (pick) {
      m.facing = angleTo(m.pos, target.pos);
      const dur = pick.telegraph ? pick.telegraph + 0.35 : 1 / m.attackSpeed;
      m.actionTimer = dur;
      m.actionDuration = dur;
      m.cooldowns.set(pick.id, pick.cooldown);
      m.moving = false;
      if (pick.telegraph) {
        this.fireMonsterSkill(m, pick, target, { ...target.pos });
        m.pending = null;
      } else {
        m.pending = { skill: pick, target: { ...target.pos }, targetActor: target, fireAt: dur * 0.55, fired: false };
      }
      return;
    }
    // movement
    let dir: Vec2 | null = null;
    if (m.def.kite && d < m.def.kite * 0.7) {
      dir = normalize({ x: m.pos.x - target.pos.x, y: m.pos.y - target.pos.y });
    } else if (m.def.kite && d < m.def.kite && this.map.los(m.pos, target.pos)) {
      dir = null; // in range, waiting for cooldown
    } else if (d < 14 && this.map.wideLos(m.pos, target.pos, m.radius * 0.8)) {
      dir = normalize({ x: target.pos.x - m.pos.x, y: target.pos.y - m.pos.y });
    } else if (target === this.player) {
      dir = this.area.flow.direction(m.pos);
    } else {
      dir = normalize({ x: target.pos.x - m.pos.x, y: target.pos.y - m.pos.y });
    }
    const minRange = Math.min(...m.def.skills.map((s) => s.range));
    if (!dir || (d <= minRange + target.radius + m.radius - 0.1 && !m.def.kite)) {
      m.moving = false;
      if (d < 3) m.facing = angleTo(m.pos, target.pos);
      return;
    }
    const speed = m.stats.moveSpeed * (1 - m.chillSlow) * dt;
    m.pos.x += dir.x * speed;
    m.pos.y += dir.y * speed;
    m.facing = Math.atan2(dir.y, dir.x);
    m.moving = true;
  }

  private minionAI(m: Monster, dt: number): void {
    const owner = this.player;
    if (dist(m.pos, owner.pos) > 22) {
      m.pos = this.map.nearestFloor({ x: owner.pos.x + this.rng.float(-1, 1), y: owner.pos.y + this.rng.float(-1, 1) });
      return;
    }
    let target: Monster | null = null;
    let best = 11;
    for (const e of this.area.monsters) {
      if (e.dead || e.team !== 'enemy') continue;
      const d = dist(e.pos, m.pos);
      if (d < best && dist(e.pos, owner.pos) < 14) {
        best = d;
        target = e;
      }
    }
    let goal: Vec2 | null = null;
    if (target) {
      const reach = 1.2 + m.radius + target.radius;
      if (best <= reach) {
        const skill = m.def.skills[0];
        m.facing = angleTo(m.pos, target.pos);
        m.actionTimer = 1 / m.attackSpeed;
        m.actionDuration = m.actionTimer;
        m.pending = { skill, target: { ...target.pos }, targetActor: target, fireAt: m.actionTimer * 0.5, fired: false };
        m.moving = false;
        return;
      }
      goal = target.pos;
    } else if (dist(m.pos, owner.pos) > 3.5) {
      goal = owner.pos;
    }
    if (!goal) {
      m.moving = false;
      return;
    }
    const dir = normalize({ x: goal.x - m.pos.x, y: goal.y - m.pos.y });
    const speed = m.stats.moveSpeed * (1 - m.chillSlow) * dt;
    m.pos.x += dir.x * speed;
    m.pos.y += dir.y * speed;
    m.facing = Math.atan2(dir.y, dir.x);
    m.moving = true;
  }

  private fireMonsterSkill(m: Monster, skill: Monster['def']['skills'][number], targetActor: Actor | undefined, target: Vec2): void {
    if (m.dead) return;
    if (skill.kind === 'summon') {
      const n = skill.params?.count ?? 2;
      const alive = this.area.monsters.filter((x) => x.pack === m.pack && !x.dead && x !== m).length;
      if (alive > 12) return;
      for (let i = 0; i < n; i++) {
        const pos = this.map.nearestFloor({ x: m.pos.x + this.rng.float(-2.5, 2.5), y: m.pos.y + this.rng.float(-2.5, 2.5) });
        const add = new Monster(monsterDef(skill.summon!), m.level, 'normal', pos, 'enemy', this.rng, []);
        add.pack = m.pack;
        add.aggro = true;
        add.xpValue *= 0.3;
        this.area.monsters.push(add);
        this.vfx({ type: 'summon', pos });
      }
      return;
    }
    const stats: SkillStats = m.skillStats(skill);
    const color = skill.color ?? skillColor(Object.keys(skill.types ?? m.def.types).map((t) => (t === 'phys' ? 'physical' : t)) as SkillTag[]);
    const at = targetActor && !targetActor.dead && !skill.telegraph ? targetActor.pos : target;
    const ctx: SkillContext = {
      caster: m,
      stats,
      params: { ...(skill.params ?? {}), range: skill.range + 4 },
      target: at,
      targetActor,
      color,
      visual: skill.id === 'arrow' ? 'arrow' : skill.types?.fire ? 'fireball' : skill.types?.cold ? 'frost' : skill.types?.chaos ? 'chaos' : 'orb',
      telegraph: skill.telegraph,
    };
    const behaviour = skill.kind === 'melee' ? 'melee' : skill.kind === 'charge' ? 'charge' : skill.kind;
    if (skill.kind === 'melee') ctx.stats = { ...stats, range: skill.range };
    executeBehaviour(this, behaviour, ctx);
  }

  // ------------------------------------------------------------------------------------------
  // Travel (leap/dash/charge)
  // ------------------------------------------------------------------------------------------

  travel(actor: Actor, to: Vec2, duration: number, opts: { arc?: number; onArrive?: () => void; onPass?: (a: Actor) => void; width?: number }): void {
    actor.travel = { from: { ...actor.pos }, to: { ...to }, t: 0, duration, arc: opts.arc ?? 0, width: opts.width ?? 1, onArrive: opts.onArrive, onPass: opts.onPass };
    actor.facing = angleTo(actor.pos, to);
  }

  teleport(actor: Actor, to: Vec2): void {
    actor.pos = { ...to };
    if (actor === this.player) this.player.path = [];
  }

  private updateTravel(actor: Actor, dt: number): void {
    const tr = actor.travel!;
    tr.t += dt;
    const f = Math.min(1, tr.t / tr.duration);
    actor.pos = { x: tr.from.x + (tr.to.x - tr.from.x) * f, y: tr.from.y + (tr.to.y - tr.from.y) * f };
    actor.airborne = tr.arc * Math.sin(Math.PI * f);
    actor.moving = true;
    if (tr.onPass) for (const h of this.hostiles(actor.team)) if (dist(h.pos, actor.pos) <= tr.width / 2 + h.radius) tr.onPass(h);
    if (f >= 1) {
      actor.travel = null;
      actor.airborne = 0;
      this.map.collide(actor.pos, actor.radius);
      tr.onArrive?.();
    }
  }

  // ------------------------------------------------------------------------------------------
  // SkillHost implementation
  // ------------------------------------------------------------------------------------------

  hostiles(team: Team): Actor[] {
    if (team === 'player') return this.area.monsters.filter((m) => m.team === 'enemy' && !m.dead);
    const out: Actor[] = [];
    if (!this.player.dead && !this.player.travel) out.push(this.player);
    for (const m of this.area.monsters) if (m.team === 'player' && !m.dead) out.push(m);
    return out;
  }

  hit(target: Actor, stats: SkillStats, source: Actor, mult = 1): void {
    if (target.dead) return;
    if (this.area.town) return;
    const h = rollHit(stats, source, this.rng, mult);
    const res = applyHit(target, h, this.rng);
    const pos = { x: target.pos.x, y: target.pos.y };
    if (target === this.player) {
      if (res.evaded) this.vfx({ type: 'text', pos, text: 'Evade', color: '#c8c8c8' });
      else if (res.blocked) this.vfx({ type: 'text', pos, text: 'Block', color: '#c8c8c8' });
      else if (res.avoided) this.vfx({ type: 'text', pos, text: 'Avoided', color: '#c8c8c8' });
    } else if (this.settings.showDamageNumbers && source.team === 'player') {
      if (res.evaded) this.vfx({ type: 'text', pos, text: 'Miss', color: '#a0a0a0' });
      else if (res.dealt > 0) this.vfx({ type: 'text', pos, text: String(Math.round(res.dealt)), color: res.crit ? '#ffe070' : '#f0f0f0', big: res.crit });
    }
    if (res.dealt > 0) this.vfx({ type: 'impact', pos, color: res.byType.fire > res.byType.phys ? SKILL_COLORS.fire : res.byType.cold > res.byType.phys ? SKILL_COLORS.cold : res.byType.lightning > res.byType.phys ? SKILL_COLORS.lightning : '#ffdddd' });
    if (res.killed && target instanceof Monster) this.onKill(target, source);
  }

  addProjectile(p: Omit<Projectile, 'id' | 'dead' | 'traveled' | 'erraticTimer' | 'hitIds'> & { hitIds?: Set<number> }): void {
    this.area.projectiles.push({ ...p, id: newEntityId(), dead: false, traveled: 0, erraticTimer: 0.15, hitIds: p.hitIds ?? new Set() });
  }

  addEffect(e: Omit<AreaEffect, 'id' | 'done' | 'totalDelay'>): void {
    this.area.effects.push({ ...e, id: newEntityId(), done: false, totalDelay: e.delay });
  }

  vfx(e: VfxEvent): void {
    if (this.vfxQueue.length < 400) this.vfxQueue.push(e);
  }

  private updateProjectiles(dt: number): void {
    const area = this.area;
    for (const pr of area.projectiles) {
      if (pr.dead) continue;
      if (pr.erratic) {
        pr.erraticTimer -= dt;
        if (pr.erraticTimer <= 0) {
          pr.erraticTimer = this.rng.float(0.1, 0.25);
          const a = Math.atan2(pr.dir.y, pr.dir.x) + this.rng.float(-1.1, 1.1);
          pr.dir = fromAngle(a);
        }
      }
      const step = pr.speed * dt;
      const next = { x: pr.pos.x + pr.dir.x * step, y: pr.pos.y + pr.dir.y * step };
      pr.traveled += step;
      pr.range -= step;
      pr.life -= dt;
      if (!this.map.walkable(next.x, next.y)) {
        if (pr.erratic) {
          pr.dir = { x: -pr.dir.x + this.rng.float(-0.5, 0.5), y: -pr.dir.y + this.rng.float(-0.5, 0.5) };
          pr.dir = normalize(pr.dir);
          continue;
        }
        this.projectileEnd(pr);
        continue;
      }
      pr.pos = next;
      for (const a of this.hostiles(pr.team)) {
        if (pr.hitIds.has(a.id)) continue;
        if (dist(a.pos, pr.pos) > a.radius + pr.radius) continue;
        pr.hitIds.add(a.id);
        const mult = pr.closeQuarters ? Math.max(0.7, Math.min(1.4, 1.4 - pr.traveled * 0.06)) : 1;
        this.hit(a, pr.stats, pr.owner, mult);
        if (pr.explodeRadius > 0) this.explode(pr, a.id);
        if (pr.strikes > 0) {
          const near = this.hostiles(pr.team)
            .filter((o) => o !== a && dist(o.pos, a.pos) <= pr.strikeRadius)
            .sort((x, y) => dist(x.pos, a.pos) - dist(y.pos, a.pos))
            .slice(0, pr.strikes);
          for (const o of near) {
            this.hit(o, pr.stats, pr.owner, 0.8);
            this.vfx({ type: 'lightning', points: [{ x: o.pos.x, y: o.pos.y - 0.01 }, { ...o.pos }], color: pr.color });
          }
          if (near.length) this.vfx({ type: 'nova', pos: a.pos, radius: pr.strikeRadius * 0.5, color: pr.color });
        }
        if (pr.pierce > 0) {
          pr.pierce--;
        } else if (pr.fork && !pr.forked) {
          const base = Math.atan2(pr.dir.y, pr.dir.x);
          for (const off of [-0.45, 0.45]) {
            this.addProjectile({ ...pr, pos: { ...pr.pos }, dir: fromAngle(base + off), forked: true, hitIds: new Set(pr.hitIds), range: Math.max(pr.range, 6) });
          }
          pr.dead = true;
        } else if (pr.chain > 0) {
          const nextT = this.hostiles(pr.team)
            .filter((o) => !pr.hitIds.has(o.id) && dist(o.pos, pr.pos) < 9 && this.map.los(pr.pos, o.pos))
            .sort((x, y) => dist(x.pos, pr.pos) - dist(y.pos, pr.pos))[0];
          if (nextT) {
            pr.dir = normalize({ x: nextT.pos.x - pr.pos.x, y: nextT.pos.y - pr.pos.y });
            pr.chain--;
            pr.range = Math.max(pr.range, 10);
          } else pr.dead = true;
        } else {
          pr.dead = true;
        }
        break;
      }
      if (!pr.dead && (pr.range <= 0 || pr.life <= 0)) this.projectileEnd(pr);
    }
    area.projectiles = area.projectiles.filter((p) => !p.dead);
  }

  private projectileEnd(pr: Projectile): void {
    if (pr.explodeRadius > 0) this.explode(pr);
    pr.dead = true;
  }

  private explode(pr: Projectile, excludeId?: number): void {
    for (const a of this.hostiles(pr.team)) {
      if (a.id === excludeId) continue;
      if (dist(a.pos, pr.pos) <= pr.explodeRadius + a.radius) this.hit(a, pr.stats, pr.owner);
    }
    this.vfx({ type: 'explosion', pos: { ...pr.pos }, radius: pr.explodeRadius, color: pr.color });
  }

  private updateEffects(dt: number): void {
    const area = this.area;
    for (const e of area.effects) {
      e.delay -= dt;
      if (e.delay > 0 || e.done) continue;
      e.done = true;
      if (e.owner.dead && e.owner !== this.player) {
        if (e.telegraph) continue;
      }
      for (const a of this.hostiles(e.team)) {
        if (a.id === e.excludeId) continue;
        const d = dist(a.pos, e.pos);
        if (d > e.radius + a.radius) continue;
        if (e.shape === 'cone' && d > a.radius + 0.3) {
          const diff = Math.abs(((angleTo(e.pos, a.pos) - e.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff > e.halfAngle + Math.atan2(a.radius, d)) continue;
        }
        this.hit(a, e.stats, e.owner, e.dmgMult);
      }
      if (e.vfx === 'nova') this.vfx({ type: 'nova', pos: e.pos, radius: e.radius, color: e.color });
      else if (e.vfx === 'explosion') this.vfx({ type: 'explosion', pos: e.pos, radius: e.radius, color: e.color });
      else if (e.vfx === 'slam') this.vfx({ type: 'slam', pos: e.pos, angle: e.dir, halfAngle: e.halfAngle, length: e.radius, color: e.color });
      else if (e.vfx === 'impact') this.vfx({ type: 'explosion', pos: e.pos, radius: e.radius, color: e.color });
    }
    area.effects = area.effects.filter((e) => !e.done);
  }

  // ------------------------------------------------------------------------------------------
  // Kills, experience, loot
  // ------------------------------------------------------------------------------------------

  private onKill(m: Monster, _source: Actor | null): void {
    const area = this.area;
    this.vfx({ type: 'death', pos: { ...m.pos }, color: m.def.color, big: !!m.def.boss });
    if (m.team !== 'enemy') return;
    this.kills++;
    const p = this.player;
    const cs = p.cstats;
    if (!p.dead) {
      if (cs.sheet.flat('life_on_kill')) p.heal(cs.sheet.flat('life_on_kill'));
      if (cs.sheet.flat('mana_on_kill')) p.restoreMana(cs.sheet.flat('mana_on_kill'));
      const xp = m.xpValue * xpMultiplier(this.char.level, m.level);
      this.addXp(xp);
      const charges = (m.def.boss ? 10 : m.rarity === 'rare' ? 5 : m.rarity === 'magic' ? 2 : 1) * (1 + cs.flaskChargesGained / 100);
      for (const slot of ['flask1', 'flask2', 'flask3', 'flask4', 'flask5'] as EquipSlot[]) {
        const f = this.char.equipment[slot];
        if (!f?.flask) continue;
        const fp = flaskProps(f);
        if (fp) f.flask.charges = Math.min(fp.maxCharges, f.flask.charges + charges);
      }
    }
    const isBoss = m.id === area.bossId;
    const firstKill = isBoss && !!area.def && !this.char.completedAreas.includes(area.def.id);
    const drops = rollDrops(m.def.boss ? 'unique' : m.rarity, {
      areaLevel: area.level,
      itemQuantity: cs.itemQuantity + area.quant,
      itemRarity: cs.itemRarity + area.rarity,
      isBoss,
      firstBossKill: firstKill,
    }, this.rng);
    if (firstKill && area.def) drops.push(...questReward(area.def.id, this.rng));
    for (const it of drops) this.dropItem(it, m.pos);
    if (isBoss) this.onBossKilled(m);
  }

  private onBossKilled(m: Monster): void {
    const area = this.area;
    area.bossDead = true;
    this.log(`${m.name} has been defeated!`, '#ffb050');
    area.addInteractable('exit', area.map.nearestFloor({ x: m.pos.x, y: m.pos.y + 2 }), 'Waypoint to Duskhaven', 1.2);
    if (area.def) {
      if (!this.char.completedAreas.includes(area.def.id)) {
        this.char.completedAreas.push(area.def.id);
        this.char.bonusPassivePoints++;
        this.log('Quest complete! You gained a Passive Skill Point.', '#a0ff80');
        if (area.def.next && !this.char.unlockedAreas.includes(area.def.next)) {
          this.char.unlockedAreas.push(area.def.next);
          this.log(`New area unlocked: ${AREA_BY_ID[area.def.next].name}`, '#a0ff80');
        }
        if (!area.def.next) this.log('The Map Device in Duskhaven can now open Maps. Maps drop in high level areas.', '#c8a8ff');
        this.town.resPenalty = this.townPenalty();
      }
    }
    this.events.emit('stats', null);
  }

  dropItem(it: Item, at: Vec2): void {
    const a = this.rng.float(0, Math.PI * 2);
    const r = this.rng.float(0.3, 1.6);
    const pos = this.map.nearestFloor({ x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r });
    this.area.groundItems.push({ id: newEntityId(), item: it, pos, age: 0 });
    this.events.emit('drop', { item: it });
  }

  addXp(amount: number): void {
    const c = this.char;
    if (c.level >= MAX_LEVEL) return;
    c.xp += amount;
    for (const { gem } of equippedGems(c)) addGemXp(gem, amount);
    let leveled = false;
    while (c.level < MAX_LEVEL && c.xp >= xpToNext(c.level)) {
      c.xp -= xpToNext(c.level);
      c.level++;
      leveled = true;
      this.log(`You have reached level ${c.level}!`, '#ffe070');
      this.events.emit('levelup', { level: c.level });
      this.vfx({ type: 'levelup', pos: { ...this.player.pos } });
    }
    if (leveled) {
      this.recalc();
      this.player.life = this.player.maxLifeUsable;
      this.player.mana = this.player.unreservedMana;
      this.player.es = this.player.stats.maxES;
      this.save();
    }
  }

  pickup(gi: GroundItem): boolean {
    const area = this.area;
    if (!area.groundItems.includes(gi)) return false;
    if (!addItem(this.char.inventory, gi.item)) {
      this.log('Your inventory is full.', '#ff8080');
      return false;
    }
    area.groundItems = area.groundItems.filter((g) => g !== gi);
    this.events.emit('pickup', { item: gi.item });
    this.events.emit('inventory', null);
    return true;
  }

  // ------------------------------------------------------------------------------------------
  // Flasks
  // ------------------------------------------------------------------------------------------

  drinkFlask(index: number): void {
    const slot = `flask${index + 1}` as EquipSlot;
    const f = this.char.equipment[slot];
    const p = this.player;
    if (!f?.flask || p.dead) return;
    const cs = p.cstats;
    const fp = flaskProps(f, cs.flaskRecovery, cs.flaskDuration);
    if (!fp) return;
    if (f.flask.charges < fp.chargesPerUse) {
      this.log("You don't have enough charges.", '#ff8080');
      return;
    }
    const id = `flask:${f.uid}`;
    const utility = fp.effect.length > 0;
    if (utility && p.buffs.some((b) => b.id === id)) return;
    f.flask.charges -= fp.chargesPerUse;
    if (fp.instant) {
      p.heal(fp.life);
      p.restoreMana(fp.mana);
    }
    const duration = Math.max(fp.duration, fp.instant ? 3 : 0.1);
    p.buffs.push({
      id,
      time: duration,
      mods: [...fp.effect, ...fp.during],
      lifePerSec: fp.instant ? 0 : fp.life / Math.max(0.1, fp.duration),
      manaPerSec: fp.instant ? 0 : fp.mana / Math.max(0.1, fp.duration),
      freezeImmune: fp.freezeImmune,
      bleedImmune: fp.bleedImmune,
    });
    if (fp.freezeImmune) {
      p.ailments.freeze = null;
      p.ailments.chill = null;
    }
    if (fp.bleedImmune) p.ailments.bleed = null;
    this.vfx({ type: 'flask', pos: { ...p.pos }, color: fp.life ? '#ff4040' : fp.mana ? '#4080ff' : '#f0e0a0' });
    if (fp.effect.length || fp.during.length) this.recalc();
  }

  // ------------------------------------------------------------------------------------------
  // Items, gems, passives (called by UI)
  // ------------------------------------------------------------------------------------------

  applyCurrencyTo(currencyItem: Item, target: Item): CraftResult {
    const cid = currencyId(currencyItem) as CurrencyId | undefined;
    if (!cid) return { ok: false, message: 'Not a currency item' };
    const res = applyCurrency(cid, target, this.rng);
    if (res.ok) {
      currencyItem.stack = (currencyItem.stack ?? 1) - 1;
      if (currencyItem.stack <= 0) {
        removeItem(this.char.inventory, currencyItem);
        for (const tab of this.account.stash) removeItem(tab, currencyItem);
      }
      if (res.message) this.log(res.message, '#d8c8a0');
      this.requestRecalc();
      this.events.emit('inventory', null);
    } else if (res.message) this.log(res.message, '#ff8080');
    return res;
  }

  useSelfCurrency(item: Item): void {
    const cid = currencyId(item);
    if (cid === 'portal') {
      if (this.area.town) {
        this.log('You cannot open a portal in town.', '#ff8080');
        return;
      }
      this.usePortalScroll();
    } else if (cid === 'regret') {
      item.stack = (item.stack ?? 1) - 1;
      if (item.stack <= 0) removeItem(this.char.inventory, item);
      this.char.refundPoints++;
      this.log('You gained a passive refund point.', '#a0ff80');
      this.events.emit('inventory', null);
    }
  }

  levelUpGem(gem: Item): void {
    if (levelGem(gem, this.char.level)) {
      this.log(`${displayName(gem)} is now level ${gem.gem!.level}.`, '#8fd8ff');
      this.recalc();
    }
  }

  allocatePassive(nodeId: number): boolean {
    const allocated = new Set(this.char.passives);
    const path = pathToNode(PASSIVE_TREE, allocated, nodeId);
    if (!path || !path.length) return false;
    if (path.length > passivePointsUnspent(this.char)) {
      this.log('Not enough passive skill points.', '#ff8080');
      return false;
    }
    this.char.passives.push(...path);
    this.recalc();
    return true;
  }

  refundPassive(nodeId: number): boolean {
    if (this.char.refundPoints <= 0) {
      this.log('You need an Orb of Unlearning to refund passives.', '#ff8080');
      return false;
    }
    const start = PASSIVE_TREE.startOf[this.char.classId];
    if (!canRefund(PASSIVE_TREE, new Set(this.char.passives), nodeId, start)) {
      this.log('That passive cannot be refunded without disconnecting others.', '#ff8080');
      return false;
    }
    this.char.passives = this.char.passives.filter((n) => n !== nodeId);
    this.char.refundPoints--;
    this.recalc();
    return true;
  }

  previewPassives(extra: number[]): StatMod[] {
    return passiveStats(PASSIVE_TREE, extra);
  }

  // ------------------------------------------------------------------------------------------
  // Vendor
  // ------------------------------------------------------------------------------------------

  refreshVendor(force = false): void {
    if (!force && this.vendorLevel === this.char.level && this.vendorOffers.length) return;
    this.vendorLevel = this.char.level;
    this.vendorOffers = vendorStock(this.char.level, this.rng);
  }

  buy(offer: VendorOffer): boolean {
    const have = countCurrency(this.char.inventory, offer.price.currency);
    if (have < offer.price.amount) {
      this.log(`You need ${offer.price.amount}× ${CURRENCY_BY_ID[offer.price.currency].name}.`, '#ff8080');
      return false;
    }
    const copy = JSON.parse(JSON.stringify(offer.item)) as Item;
    copy.uid = `${copy.uid}b${Math.floor(this.rng.next() * 1e9).toString(36)}`;
    if (!addItem(this.char.inventory, copy)) {
      this.log('Your inventory is full.', '#ff8080');
      return false;
    }
    spendCurrency(this.char.inventory, offer.price.currency, offer.price.amount);
    this.events.emit('inventory', null);
    return true;
  }

  sell(items: Item[]): Item[] {
    const sale = evaluateSale(items);
    for (const r of sale.recipes) this.log(`Vendor recipe: ${r}`, '#a0ff80');
    return sale.receive;
  }

  // ------------------------------------------------------------------------------------------
  // Death & misc
  // ------------------------------------------------------------------------------------------

  respawn(): void {
    const p = this.player;
    const lvl = this.area.level;
    if (!this.area.town && lvl >= 28) {
      const loss = Math.floor(xpToNext(this.char.level) * (lvl >= 40 ? 0.1 : 0.05));
      this.char.xp = Math.max(0, this.char.xp - loss);
      this.log(`You lost ${loss.toLocaleString()} experience.`, '#ff8080');
    }
    p.dead = false;
    p.ailments = { ignite: null, bleed: null, poison: [], chill: null, freeze: null, shock: null };
    p.buffs = [];
    this.deathTimer = 0;
    this.portalInstance = null;
    this.leaveArea();
    this.enterArea(this.town, this.town.map.spawn);
    this.recalc(true);
  }

  /** Town shows the resistance penalty of the furthest area completed (like PoE's act penalties). */
  townPenalty(): number {
    const levels = this.char.completedAreas.map((id) => AREA_BY_ID[id]?.level ?? 1);
    return levels.length ? resistPenalty(Math.max(...levels) + 1) : 0;
  }

  log(text: string, color?: string): void {
    this.events.emit('log', { text, color });
  }

  save(): void {
    this.saveTimer = 0;
    this.events.emit('save', null);
  }

  skillSlotUid(slot: number): string | null {
    if (slot < 0 || slot >= SKILL_SLOTS) return null;
    return this.char.skillBar[slot] ?? (slot === 0 ? 'default_attack' : null);
  }
}
