import { angleTo, type Vec2 } from '../core/math';
import type { RNG } from '../core/rng';
import { AREA_BY_ID, MAP_LAYOUTS, THEMES, type AreaDef, type Theme } from '../data/areas';
import { NPCS } from '../data/quests';
import { HEIST_SITES, HEIST_STRONGBOXES, HEIST_TARGETS, type HeistContract } from '../data/activities';
import { getMod } from '../data/affixes';
import { modStats } from '../items/item';
import { mapStats } from '../items/tooltip';
import type { Item } from '../items/types';
import { resistPenalty } from '../data/scaling';
import { inc, type StatMod } from '../stats/stats';
import type { AreaEffect, GroundItem, Interactable, Projectile } from './entities';
import { newEntityId } from './entities';
import { generateArea, generateTown } from './mapgen';
import { Monster, monsterDef, type MonsterRarity } from './monster';
import { FlowField } from './path';
import type { TileMap } from './tilemap';

let instanceCounter = 1;

/** A live instance of an area (town, story zone or map) with all of its entities. */
export class AreaInstance {
  readonly uid = instanceCounter++;
  monsters: Monster[] = [];
  projectiles: Projectile[] = [];
  effects: AreaEffect[] = [];
  groundItems: GroundItem[] = [];
  interactables: Interactable[] = [];
  flow: FlowField;
  bossId = 0;
  bossDead = false;
  quant = 0;
  rarity = 0;
  playerMods: StatMod[] = [];
  resPenalty: number;
  portalPos: Vec2 | null = null;
  nextPack = 1;
  /** Heist state (heist areas only). */
  heist: HeistState | null = null;

  constructor(
    readonly name: string,
    readonly level: number,
    readonly map: TileMap,
    readonly town: boolean,
    readonly def: AreaDef | null,
    readonly mapItem: Item | null,
  ) {
    this.flow = new FlowField(map, 70);
    this.resPenalty = town ? 0 : resistPenalty(level);
  }

  get theme(): Theme {
    return this.map.theme;
  }

  addInteractable(kind: Interactable['kind'], pos: Vec2, label: string, radius = 0.9): Interactable {
    const it: Interactable = { id: newEntityId(), kind, pos: { ...pos }, label, radius };
    this.interactables.push(it);
    return it;
  }

  living(): Monster[] {
    return this.monsters.filter((m) => !m.dead);
  }
}

export function createTown(rng: RNG): AreaInstance {
  const layout = generateTown(rng);
  const inst = new AreaInstance('暮港', 1, layout.map, true, null, null);
  inst.addInteractable('stash', layout.stash, '倉庫', 1);
  inst.addInteractable('vendor', layout.vendor, '商人瑪拉', 0.8);
  inst.addInteractable('waypoint', layout.waypoint, '傳送點', 1.2);
  inst.addInteractable('map_device', layout.mapDevice, '地圖裝置', 1.2);
  for (const n of NPCS) inst.addInteractable('npc', layout.map.nearestFloor(n.pos), n.name, 0.8).npc = n.id;
  inst.addInteractable('bench', layout.map.nearestFloor({ x: 27.5, y: 16.5 }), '工藝台', 0.9);
  inst.addInteractable('heist', layout.map.nearestFloor({ x: 17.5, y: 30 }), '劫盜頭目 阿蒂亞', 0.8);
  inst.portalPos = layout.portalSpot;
  return inst;
}

interface SpawnSpec {
  pool: string[];
  boss?: string;
  monsterMods: StatMod[];
  packSizeInc: number;
}

function spawnPack(inst: AreaInstance, spec: SpawnSpec, at: Vec2, rng: RNG): void {
  const roll = rng.next();
  const rarity: MonsterRarity = roll < 0.12 ? 'rare' : roll < 0.3 ? 'magic' : 'normal';
  const types = [rng.pick(spec.pool)];
  if (rng.chance(0.4)) types.push(rng.pick(spec.pool));
  const early = inst.level < 8;
  let size = rarity === 'rare' ? rng.int(2, early ? 3 : 5) : rarity === 'magic' ? rng.int(early ? 2 : 3, early ? 3 : 5) : rng.int(early ? 2 : 3, early ? 5 : 7);
  size = Math.round(size * (1 + spec.packSizeInc / 100));
  const pack = inst.nextPack++;
  const place = (i: number): Vec2 => {
    const a = (i / Math.max(1, size)) * Math.PI * 2 + rng.float(-0.3, 0.3);
    const r = i === 0 ? 0 : rng.float(1, 2.6);
    return inst.map.nearestFloor({ x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r });
  };
  if (rarity === 'rare') {
    const leader = new Monster(monsterDef(types[0]), inst.level, 'rare', place(0), 'enemy', rng, spec.monsterMods);
    leader.pack = pack;
    inst.monsters.push(leader);
  }
  for (let i = rarity === 'rare' ? 1 : 0; i <= size; i++) {
    const m = new Monster(monsterDef(rng.pick(types)), inst.level, rarity === 'magic' ? 'magic' : 'normal', place(i), 'enemy', rng, spec.monsterMods);
    m.pack = pack;
    m.facing = rng.float(0, Math.PI * 2);
    inst.monsters.push(m);
  }
}

function populate(inst: AreaInstance, spec: SpawnSpec, rng: RNG): void {
  for (const spot of inst.map.packSpots) spawnPack(inst, spec, spot, rng);
  if (spec.boss) {
    const boss = new Monster(monsterDef(spec.boss), inst.level + (inst.mapItem ? 1 : 2), 'unique', inst.map.bossPos, 'enemy', rng, spec.monsterMods);
    boss.pack = inst.nextPack++;
    boss.facing = angleTo(boss.pos, inst.map.spawn);
    inst.bossId = boss.id;
    inst.monsters.push(boss);
  }
}

export function createStoryArea(areaId: string, rng: RNG): AreaInstance {
  const def = AREA_BY_ID[areaId];
  const map = generateArea(def.theme, def.size, def.packs, rng);
  const inst = new AreaInstance(def.name, def.level, map, false, def, null);
  populate(inst, { pool: def.monsters, boss: def.boss, monsterMods: [], packSizeInc: 0 }, rng);
  return inst;
}

export function createMapArea(mapItem: Item, rng: RNG): AreaInstance {
  const layout = MAP_LAYOUTS[mapItem.map!.layout] ?? MAP_LAYOUTS.crypt;
  const theme = THEMES[layout.theme];
  const size: [number, number] = theme.style === 'outdoor' ? [125, 80] : [100, 100];
  const tier = mapItem.map!.tier;
  const map = generateArea(layout.theme, size, 30 + tier * 2, rng);
  const monsterMods: StatMod[] = [];
  const playerMods: StatMod[] = [];
  for (const roll of [...mapItem.prefixes, ...mapItem.suffixes]) {
    const def = getMod(roll.id);
    const target = def.mapEffect?.target === 'player' ? playerMods : monsterMods;
    target.push(...modStats(roll));
  }
  const ms = mapStats(mapItem);
  // Higher tiers are tougher even without mods
  monsterMods.push(inc('monster_life', tier * 4));
  const name = `${mapItem.name && mapItem.rarity === 'rare' ? mapItem.name + ' — ' : ''}${tier} 階地圖`;
  const inst = new AreaInstance(name, mapItem.ilvl, map, false, null, mapItem);
  inst.quant = ms.quant;
  inst.rarity = ms.rarity;
  inst.playerMods = playerMods;
  populate(inst, { pool: layout.monsters, boss: layout.boss, monsterMods, packSizeInc: ms.pack }, rng);
  return inst;
}

export interface HeistState {
  contract: HeistContract;
  alarm: number;
  lockdown: boolean;
  looted: boolean;
  reinforceTimer: number;
}

/** A heist: guarded rooms, strongboxes that raise the alarm and a vault holding the target. */
export function createHeistArea(contract: HeistContract, rng: RNG): AreaInstance {
  const site = HEIST_SITES[contract.site] ?? HEIST_SITES[0];
  const map = generateArea(site.theme, [95, 95], 20, rng);
  const inst = new AreaInstance(`劫盜：${site.name}`, contract.level, map, false, null, null);
  populate(inst, { pool: ['heist_guard', 'heist_archer', 'heist_guard', 'brute'], monsterMods: [], packSizeInc: 0 }, rng);
  inst.heist = { contract, alarm: 0, lockdown: false, looted: false, reinforceTimer: 0 };
  inst.addInteractable('vault', map.bossPos, `寶庫：${HEIST_TARGETS[contract.target].name}`, 1.1);
  const spots = rng.shuffle(map.packSpots.filter((p) => Math.hypot(p.x - map.spawn.x, p.y - map.spawn.y) > 12));
  for (const p of spots.slice(0, HEIST_STRONGBOXES)) inst.addInteractable('strongbox', map.nearestFloor({ x: p.x + 1.2, y: p.y + 1 }), '保險箱', 0.7);
  inst.addInteractable('exit', map.nearestFloor({ x: map.spawn.x + 1.5, y: map.spawn.y }), '撤離點', 1.2);
  return inst;
}
