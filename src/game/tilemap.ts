import type { RNG } from '../core/rng';
import type { Vec2 } from '../core/math';
import type { Theme } from '../data/areas';

export const WALL = 0;
export const FLOOR = 1;
/** Blocking decoration (tree, pillar…): not walkable, rendered as a prop instead of a wall block. */
export const PROP = 2;

export interface Decor {
  x: number;
  y: number;
  kind: string;
  scale: number;
  rot: number;
  blocking: boolean;
}

export class TileMap {
  readonly tiles: Uint8Array;
  readonly explored: Uint8Array;
  spawn: Vec2 = { x: 0, y: 0 };
  bossPos: Vec2 = { x: 0, y: 0 };
  packSpots: Vec2[] = [];
  decor: Decor[] = [];
  /** Hazard floor tiles (lava / void glow) — purely visual. */
  hazards: Vec2[] = [];

  constructor(
    readonly w: number,
    readonly h: number,
    readonly theme: Theme,
  ) {
    this.tiles = new Uint8Array(w * h);
    this.explored = new Uint8Array(w * h);
  }

  idx(tx: number, ty: number): number {
    return ty * this.w + tx;
  }

  get(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return WALL;
    return this.tiles[ty * this.w + tx];
  }

  set(tx: number, ty: number, v: number): void {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    this.tiles[ty * this.w + tx] = v;
  }

  walkableTile(tx: number, ty: number): boolean {
    return this.get(tx, ty) === FLOOR;
  }

  walkable(x: number, y: number): boolean {
    return this.walkableTile(Math.floor(x), Math.floor(y));
  }

  /** Push a circle out of blocking tiles. Returns true if a collision happened. */
  collide(pos: Vec2, r: number): boolean {
    let hit = false;
    for (let iter = 0; iter < 2; iter++) {
      const x0 = Math.floor(pos.x - r);
      const x1 = Math.floor(pos.x + r);
      const y0 = Math.floor(pos.y - r);
      const y1 = Math.floor(pos.y + r);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (this.walkableTile(tx, ty)) continue;
          const cx = Math.max(tx, Math.min(pos.x, tx + 1));
          const cy = Math.max(ty, Math.min(pos.y, ty + 1));
          const dx = pos.x - cx;
          const dy = pos.y - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          hit = true;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            pos.x += (dx / d) * (r - d);
            pos.y += (dy / d) * (r - d);
          } else {
            // centre inside the tile: push out along the shallowest axis
            const left = pos.x - tx;
            const right = tx + 1 - pos.x;
            const up = pos.y - ty;
            const down = ty + 1 - pos.y;
            const m = Math.min(left, right, up, down);
            if (m === left) pos.x = tx - r;
            else if (m === right) pos.x = tx + 1 + r;
            else if (m === up) pos.y = ty - r;
            else pos.y = ty + 1 + r;
          }
        }
      }
    }
    return hit;
  }

  /** Line of sight between two points (sampled). */
  los(a: Vec2, b: Vec2, step = 0.25): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const n = Math.ceil(len / step);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (!this.walkable(a.x + dx * t, a.y + dy * t)) return false;
    }
    return true;
  }

  /** LOS that also checks lines offset by a radius (for smoothing paths of wide bodies). */
  wideLos(a: Vec2, b: Vec2, r: number): boolean {
    if (!this.los(a, b)) return false;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * r;
    const ny = (dx / len) * r;
    return this.los({ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }) && this.los({ x: a.x - nx, y: a.y - ny }, { x: b.x - nx, y: b.y - ny });
  }

  /** Distance a ray travels before hitting a wall (max `max`). */
  raycast(from: Vec2, dirX: number, dirY: number, max: number, step = 0.2): number {
    for (let d = step; d <= max; d += step) {
      if (!this.walkable(from.x + dirX * d, from.y + dirY * d)) return Math.max(0, d - step);
    }
    return max;
  }

  randomFloor(rng: RNG): Vec2 {
    for (let i = 0; i < 5000; i++) {
      const tx = rng.int(1, this.w - 2);
      const ty = rng.int(1, this.h - 2);
      if (this.walkableTile(tx, ty)) return { x: tx + 0.5, y: ty + 0.5 };
    }
    return { ...this.spawn };
  }

  /** Nearest walkable tile centre to a point (spiral search). */
  nearestFloor(p: Vec2): Vec2 {
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    if (this.walkableTile(cx, cy)) return p;
    for (let r = 1; r < 30; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.walkableTile(cx + dx, cy + dy)) return { x: cx + dx + 0.5, y: cy + dy + 0.5 };
        }
      }
    }
    return { ...this.spawn };
  }

  /** Mark tiles within radius as explored (for the minimap). */
  reveal(p: Vec2, r: number): void {
    const r2 = r * r;
    for (let ty = Math.floor(p.y - r); ty <= Math.ceil(p.y + r); ty++) {
      for (let tx = Math.floor(p.x - r); tx <= Math.ceil(p.x + r); tx++) {
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
        if ((tx + 0.5 - p.x) ** 2 + (ty + 0.5 - p.y) ** 2 <= r2) this.explored[ty * this.w + tx] = 1;
      }
    }
  }

  /** BFS distance (in tiles) from a point to every walkable tile; -1 = unreachable. */
  distanceField(from: Vec2): Int32Array {
    const dist = new Int32Array(this.w * this.h).fill(-1);
    const sx = Math.floor(from.x);
    const sy = Math.floor(from.y);
    if (!this.walkableTile(sx, sy)) return dist;
    const q = new Int32Array(this.w * this.h);
    let head = 0;
    let tail = 0;
    dist[this.idx(sx, sy)] = 0;
    q[tail++] = this.idx(sx, sy);
    while (head < tail) {
      const cur = q[head++];
      const cx = cur % this.w;
      const cy = (cur / this.w) | 0;
      const d = dist[cur] + 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.walkableTile(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (dist[ni] >= 0) continue;
        dist[ni] = d;
        q[tail++] = ni;
      }
    }
    return dist;
  }
}
