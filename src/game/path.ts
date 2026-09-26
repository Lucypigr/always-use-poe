import type { Vec2 } from '../core/math';
import type { TileMap } from './tilemap';

/**
 * A* over the tile grid (8-directional, no corner cutting), followed by line-of-sight
 * smoothing so paths look natural. Used for click-to-move.
 */
export function findPath(map: TileMap, from: Vec2, to: Vec2, radius = 0.4, maxNodes = 8000): Vec2[] | null {
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  const target = map.nearestFloor(to);
  const tx = Math.floor(target.x);
  const ty = Math.floor(target.y);
  if (!map.walkableTile(sx, sy)) return null;
  if (sx === tx && sy === ty) return [target];
  if (map.wideLos(from, target, radius)) return [target];

  const w = map.w;
  const g = new Float32Array(map.w * map.h).fill(Infinity);
  const came = new Int32Array(map.w * map.h).fill(-1);
  const closed = new Uint8Array(map.w * map.h);
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = (): [number, number] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - tx);
    const dy = Math.abs(y - ty);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  const start = sy * w + sx;
  const goal = ty * w + tx;
  g[start] = 0;
  push(h(sx, sy), start);
  let expanded = 0;
  let found = false;
  while (heap.length && expanded < maxNodes) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded++;
    if (cur === goal) {
      found = true;
      break;
    }
    const cx = cur % w;
    const cy = (cur / w) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (!map.walkableTile(nx, ny)) continue;
        if (dx && dy && (!map.walkableTile(cx + dx, cy) || !map.walkableTile(cx, cy + dy))) continue;
        const ni = ny * w + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          push(ng + h(nx, ny), ni);
        }
      }
    }
  }
  if (!found) return null;
  const tiles: Vec2[] = [];
  for (let c = goal; c !== -1 && c !== start; c = came[c]) tiles.push({ x: (c % w) + 0.5, y: ((c / w) | 0) + 0.5 });
  tiles.reverse();
  tiles[tiles.length - 1] = target;
  // string-pulling smoothing
  const out: Vec2[] = [];
  let anchor = from;
  let i = 0;
  while (i < tiles.length) {
    let j = tiles.length - 1;
    while (j > i && !map.wideLos(anchor, tiles[j], radius)) j--;
    out.push(tiles[j]);
    anchor = tiles[j];
    i = j + 1;
  }
  return out;
}

/**
 * Flow field: BFS distances from the player's tile over walkable tiles, limited in range.
 * Monsters that lack line of sight follow decreasing distances.
 */
export class FlowField {
  dist: Int32Array;
  originX = -1;
  originY = -1;

  constructor(private map: TileMap, private maxDist = 60) {
    this.dist = new Int32Array(map.w * map.h).fill(-1);
  }

  update(p: Vec2): void {
    const ox = Math.floor(p.x);
    const oy = Math.floor(p.y);
    if (ox === this.originX && oy === this.originY) return;
    this.originX = ox;
    this.originY = oy;
    const map = this.map;
    const dist = this.dist.fill(-1);
    if (!map.walkableTile(ox, oy)) return;
    const q = new Int32Array(map.w * map.h);
    let head = 0;
    let tail = 0;
    const s = oy * map.w + ox;
    dist[s] = 0;
    q[tail++] = s;
    while (head < tail) {
      const cur = q[head++];
      const d = dist[cur];
      if (d >= this.maxDist) continue;
      const cx = cur % map.w;
      const cy = (cur / map.w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (!map.walkableTile(nx, ny)) continue;
          if (dx && dy && (!map.walkableTile(cx + dx, cy) || !map.walkableTile(cx, cy + dy))) continue;
          const ni = ny * map.w + nx;
          if (dist[ni] >= 0) continue;
          dist[ni] = d + 1;
          q[tail++] = ni;
        }
      }
    }
  }

  /** Direction to step from `p` toward the origin, or null if unreachable. */
  direction(p: Vec2): Vec2 | null {
    const map = this.map;
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    const here = this.dist[cy * map.w + cx];
    if (here < 0) return null;
    let best = here;
    let bx = 0;
    let by = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        if (dx && dy && (!map.walkableTile(cx + dx, cy) || !map.walkableTile(cx, cy + dy))) continue;
        const d = this.dist[ny * map.w + nx];
        if (d >= 0 && d < best) {
          best = d;
          bx = dx;
          by = dy;
        }
      }
    }
    if (!bx && !by) return null;
    const tx = cx + bx + 0.5 - p.x;
    const ty = cy + by + 0.5 - p.y;
    const l = Math.hypot(tx, ty) || 1;
    return { x: tx / l, y: ty / l };
  }

  distanceAt(p: Vec2): number {
    return this.dist[Math.floor(p.y) * this.map.w + Math.floor(p.x)] ?? -1;
  }
}
