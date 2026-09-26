import type { RNG } from '../core/rng';
import type { Vec2 } from '../core/math';
import { THEMES, type Theme } from '../data/areas';
import { FLOOR, PROP, TileMap, WALL } from './tilemap';

/**
 * Procedural area generation. Three styles:
 *  - outdoor: a winding main path of clearings with side branches (shore, swamp, forest, frost)
 *  - caves:   cellular automata caverns (warrens, caverns)
 *  - rooms:   rooms-and-corridors dungeons (crypt, ruins, temple, throne)
 */

function carveCircle(map: TileMap, cx: number, cy: number, r: number, rng?: RNG): void {
  const rr = Math.ceil(r + 1);
  for (let y = Math.floor(cy - rr); y <= cy + rr; y++) {
    for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
      if (x < 2 || y < 2 || x >= map.w - 2 || y >= map.h - 2) continue;
      const jitter = rng ? rng.float(-0.8, 0.8) : 0;
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= (r + jitter) ** 2) map.set(x, y, FLOOR);
    }
  }
}

function carveLine(map: TileMap, a: Vec2, b: Vec2, r: number, rng: RNG): void {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.ceil(len / 0.8);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wobble = Math.sin(t * Math.PI * 3 + a.x) * 0.8;
    carveCircle(map, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r + wobble, rng);
  }
}

function smooth(map: TileMap, iterations: number): void {
  for (let it = 0; it < iterations; it++) {
    const copy = map.tiles.slice();
    for (let y = 2; y < map.h - 2; y++) {
      for (let x = 2; x < map.w - 2; x++) {
        let walls = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (copy[(y + dy) * map.w + x + dx] !== FLOOR) walls++;
        map.tiles[y * map.w + x] = walls >= 5 ? WALL : FLOOR;
      }
    }
  }
}

/** Fill every floor tile not connected to `from` with walls. Returns remaining floor count. */
function keepConnected(map: TileMap, from: Vec2): number {
  const dist = map.distanceField(from);
  let count = 0;
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] === FLOOR) {
      if (dist[i] < 0) map.tiles[i] = WALL;
      else count++;
    }
  }
  return count;
}

function largestRegionSeed(map: TileMap): Vec2 | undefined {
  const seen = new Uint8Array(map.w * map.h);
  let best: Vec2 | undefined;
  let bestSize = 0;
  for (let i = 0; i < map.tiles.length; i++) {
    if (map.tiles[i] !== FLOOR || seen[i]) continue;
    const p = { x: (i % map.w) + 0.5, y: Math.floor(i / map.w) + 0.5 };
    const dist = map.distanceField(p);
    let size = 0;
    for (let j = 0; j < dist.length; j++) {
      if (dist[j] >= 0) {
        seen[j] = 1;
        size++;
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = p;
    }
  }
  return best;
}

function genOutdoor(map: TileMap, rng: RNG): void {
  const n = rng.int(6, 8);
  const pts: Vec2[] = [];
  let y = rng.int(12, map.h - 12);
  for (let i = 0; i < n; i++) {
    const x = 9 + ((map.w - 18) * i) / (n - 1);
    y = Math.max(10, Math.min(map.h - 10, y + rng.int(-16, 16)));
    pts.push({ x, y });
  }
  for (let i = 0; i < n - 1; i++) carveLine(map, pts[i], pts[i + 1], rng.float(2.4, 3.6), rng);
  for (const p of pts) carveCircle(map, p.x, p.y, rng.float(5, 8.5), rng);
  const branches = rng.int(3, 5);
  for (let b = 0; b < branches; b++) {
    const from = pts[rng.int(1, n - 2)];
    const dir = from.y > map.h / 2 ? -1 : 1;
    const to = { x: from.x + rng.int(-14, 14), y: Math.max(8, Math.min(map.h - 8, from.y + dir * rng.int(12, 24))) };
    carveLine(map, from, to, rng.float(2, 3), rng);
    carveCircle(map, to.x, to.y, rng.float(4, 7), rng);
  }
  smooth(map, 2);
  map.spawn = { x: pts[0].x, y: pts[0].y };
}

function genCaves(map: TileMap, rng: RNG): void {
  for (let attempt = 0; attempt < 6; attempt++) {
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const border = x < 2 || y < 2 || x >= map.w - 2 || y >= map.h - 2;
        map.set(x, y, border || rng.chance(0.45) ? WALL : FLOOR);
      }
    }
    smooth(map, 5);
    const seed = largestRegionSeed(map);
    if (!seed) continue;
    const size = keepConnected(map, seed);
    if (size > map.w * map.h * 0.3) {
      // pick a spawn near the left edge of the cave
      let best = seed;
      for (let i = 0; i < map.tiles.length; i++) {
        if (map.tiles[i] !== FLOOR) continue;
        const x = (i % map.w) + 0.5;
        if (x < best.x) best = { x, y: Math.floor(i / map.w) + 0.5 };
      }
      map.spawn = best;
      return;
    }
  }
  // fallback: open field
  genOutdoor(map, rng);
}

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
}

function genRooms(map: TileMap, rng: RNG): void {
  const rooms: Room[] = [];
  const target = Math.floor((map.w * map.h) / 190);
  for (let a = 0; a < 600 && rooms.length < target; a++) {
    const w = rng.int(7, 15);
    const h = rng.int(7, 14);
    const x = rng.int(3, map.w - w - 3);
    const y = rng.int(3, map.h - h - 3);
    if (rooms.some((r) => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) continue;
    rooms.push({ x, y, w, h });
  }
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.set(x, y, FLOOR);
  const centre = (r: Room) => ({ x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) });
  const corridor = (a: Room, b: Room) => {
    const p = centre(a);
    const q = centre(b);
    const horizFirst = rng.chance(0.5);
    const mid = horizFirst ? { x: q.x, y: p.y } : { x: p.x, y: q.y };
    for (const [s, e] of [[p, mid], [mid, q]] as [Vec2, Vec2][]) {
      const minX = Math.min(s.x, e.x);
      const maxX = Math.max(s.x, e.x);
      const minY = Math.min(s.y, e.y);
      const maxY = Math.max(s.y, e.y);
      for (let y = minY - 1; y <= maxY + 1; y++) for (let x = minX - 1; x <= maxX + 1; x++) map.set(x, y, FLOOR);
    }
  };
  // Prim's MST over room centres + a few extra loops
  const inTree = new Set([0]);
  const edges: [number, number][] = [];
  while (inTree.size < rooms.length) {
    let best: [number, number] | undefined;
    let bestD = Infinity;
    for (const i of inTree) {
      for (let j = 0; j < rooms.length; j++) {
        if (inTree.has(j)) continue;
        const a = centre(rooms[i]);
        const b = centre(rooms[j]);
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < bestD) {
          bestD = d;
          best = [i, j];
        }
      }
    }
    if (!best) break;
    edges.push(best);
    inTree.add(best[1]);
  }
  for (let k = 0; k < Math.ceil(rooms.length * 0.25); k++) edges.push([rng.int(0, rooms.length - 1), rng.int(0, rooms.length - 1)]);
  for (const [i, j] of edges) if (i !== j) corridor(rooms[i], rooms[j]);
  // pillars in big rooms
  for (const r of rooms) {
    if (r.w >= 11 && r.h >= 10 && rng.chance(0.7)) {
      for (const [px, py] of [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]]) {
        map.set(px, py, PROP);
        map.decor.push({ x: px + 0.5, y: py + 0.5, kind: 'pillar', scale: 1, rot: 0, blocking: true });
      }
    }
  }
  const start = rooms.reduce((a, b) => (centre(b).x < centre(a).x ? b : a), rooms[0]);
  const c = centre(start);
  map.spawn = { x: c.x + 0.5, y: c.y + 0.5 };
}

const BLOCKING_DECOR: Record<Theme['decor'], string[]> = {
  trees: ['tree', 'tree', 'pine'],
  dead_trees: ['dead_tree', 'dead_tree', 'rock'],
  rocks: ['rock', 'rock', 'wreck'],
  pillars: ['rubble', 'rock'],
  crystals: ['crystal', 'rock', 'stalagmite'],
  bones: ['coffin', 'rubble'],
  braziers: ['brazier', 'rubble'],
};
const SMALL_DECOR: Record<Theme['decor'], string[]> = {
  trees: ['grass', 'grass', 'stone', 'mushroom'],
  dead_trees: ['grass', 'stone', 'bones'],
  rocks: ['stone', 'grass', 'shell'],
  pillars: ['stone', 'bones', 'debris'],
  crystals: ['stone', 'shard'],
  bones: ['bones', 'bones', 'candle', 'debris'],
  braziers: ['debris', 'bones', 'candle'],
};

function wallNeighbours(map: TileMap, x: number, y: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && map.get(x + dx, y + dy) !== FLOOR) n++;
  return n;
}

function decorate(map: TileMap, rng: RNG): void {
  const theme = map.theme;
  const blockKinds = BLOCKING_DECOR[theme.decor];
  const smallKinds = SMALL_DECOR[theme.decor];
  for (let y = 2; y < map.h - 2; y++) {
    for (let x = 2; x < map.w - 2; x++) {
      if (map.get(x, y) !== FLOOR) continue;
      const nearSpawn = Math.hypot(x + 0.5 - map.spawn.x, y + 0.5 - map.spawn.y) < 5;
      const wn = wallNeighbours(map, x, y);
      if (!nearSpawn && wn >= 3 && wn <= 5 && rng.chance(0.12)) {
        map.set(x, y, PROP);
        map.decor.push({ x: x + 0.5, y: y + 0.5, kind: rng.pick(blockKinds), scale: rng.float(0.8, 1.3), rot: rng.float(0, Math.PI * 2), blocking: true });
      } else if (rng.chance(0.03)) {
        map.decor.push({ x: x + rng.float(0.2, 0.8), y: y + rng.float(0.2, 0.8), kind: rng.pick(smallKinds), scale: rng.float(0.6, 1.2), rot: rng.float(0, Math.PI * 2), blocking: false });
      }
      if (theme.hazard && wn === 0 && rng.chance(0.025)) map.hazards.push({ x: x + 0.5, y: y + 0.5 });
    }
  }
}

function placePoints(map: TileMap, packs: number, rng: RNG): void {
  const dist = map.distanceField(map.spawn);
  let far = 0;
  let farIdx = 0;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > far) {
      far = dist[i];
      farIdx = i;
    }
  }
  map.bossPos = { x: (farIdx % map.w) + 0.5, y: Math.floor(farIdx / map.w) + 0.5 };
  const candidates: Vec2[] = [];
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < 12) continue;
    const p = { x: (i % map.w) + 0.5, y: Math.floor(i / map.w) + 0.5 };
    if (Math.hypot(p.x - map.bossPos.x, p.y - map.bossPos.y) < 8) continue;
    if (wallNeighbours(map, i % map.w, Math.floor(i / map.w)) > 2) continue;
    candidates.push(p);
  }
  rng.shuffle(candidates);
  const spots: Vec2[] = [];
  for (const c of candidates) {
    if (spots.length >= packs) break;
    if (spots.every((s) => Math.hypot(s.x - c.x, s.y - c.y) >= 7)) spots.push(c);
  }
  map.packSpots = spots;
}

export function generateArea(themeId: Theme['id'], size: [number, number], packs: number, rng: RNG): TileMap {
  const theme = THEMES[themeId];
  const map = new TileMap(size[0], size[1], theme);
  if (theme.style === 'caves') genCaves(map, rng);
  else if (theme.style === 'rooms') genRooms(map, rng);
  else genOutdoor(map, rng);
  map.spawn = map.nearestFloor(map.spawn);
  keepConnected(map, map.spawn);
  decorate(map, rng);
  keepConnected(map, map.spawn);
  placePoints(map, packs, rng);
  return map;
}

export interface TownLayout {
  map: TileMap;
  stash: Vec2;
  vendor: Vec2;
  waypoint: Vec2;
  mapDevice: Vec2;
  portalSpot: Vec2;
}

export function generateTown(rng: RNG): TownLayout {
  const map = new TileMap(46, 36, THEMES.town);
  for (let y = 3; y < 33; y++) for (let x = 3; x < 43; x++) map.set(x, y, FLOOR);
  // buildings around the edges
  const building = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) map.set(x, y, WALL);
  };
  building(3, 3, 9, 6);
  building(34, 3, 9, 7);
  building(3, 26, 7, 7);
  building(36, 27, 7, 6);
  building(20, 3, 6, 4);
  const props: [number, number, string][] = [
    [14, 12, 'brazier'], [31, 12, 'brazier'], [14, 24, 'brazier'], [31, 24, 'brazier'],
    [8, 16, 'crate'], [9, 17, 'crate'], [38, 18, 'barrel'], [37, 19, 'barrel'], [22, 30, 'tree'], [27, 31, 'tree'], [5, 21, 'tree'],
  ];
  for (const [x, y, kind] of props) {
    map.set(x, y, PROP);
    map.decor.push({ x: x + 0.5, y: y + 0.5, kind, scale: 1, rot: rng.float(0, 6), blocking: true });
  }
  for (let i = 0; i < 40; i++) {
    const p = map.randomFloor(rng);
    map.decor.push({ x: p.x, y: p.y, kind: rng.pick(['stone', 'debris', 'grass']), scale: rng.float(0.6, 1), rot: rng.float(0, 6), blocking: false });
  }
  map.spawn = { x: 23, y: 20 };
  map.explored.fill(1);
  return {
    map,
    stash: { x: 17.5, y: 11.5 },
    vendor: { x: 29.5, y: 11 },
    waypoint: { x: 23, y: 26.5 },
    mapDevice: { x: 34, y: 22 },
    portalSpot: { x: 20, y: 22 },
  };
}
