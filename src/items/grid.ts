import { currencyId, itemSize, stackable } from './item';
import type { Item } from './types';

/** Tetris-style inventory grid, as in Path of Exile. */

export interface GridItem {
  item: Item;
  x: number;
  y: number;
}

export interface Grid {
  w: number;
  h: number;
  items: GridItem[];
}

export const newGrid = (w: number, h: number): Grid => ({ w, h, items: [] });

export function itemAt(grid: Grid, x: number, y: number): GridItem | undefined {
  return grid.items.find((g) => {
    const [w, h] = itemSize(g.item);
    return x >= g.x && x < g.x + w && y >= g.y && y < g.y + h;
  });
}

/** Items overlapping the rectangle. */
export function overlapping(grid: Grid, x: number, y: number, w: number, h: number): GridItem[] {
  return grid.items.filter((g) => {
    const [gw, gh] = itemSize(g.item);
    return x < g.x + gw && x + w > g.x && y < g.y + gh && y + h > g.y;
  });
}

export function inBounds(grid: Grid, x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x + w <= grid.w && y + h <= grid.h;
}

export function canPlace(grid: Grid, item: Item, x: number, y: number): boolean {
  const [w, h] = itemSize(item);
  return inBounds(grid, x, y, w, h) && overlapping(grid, x, y, w, h).length === 0;
}

export function findSpace(grid: Grid, item: Item): { x: number; y: number } | undefined {
  const [w, h] = itemSize(item);
  for (let x = 0; x <= grid.w - w; x++) {
    for (let y = 0; y <= grid.h - h; y++) {
      if (overlapping(grid, x, y, w, h).length === 0) return { x, y };
    }
  }
  return undefined;
}

/**
 * Add an item, merging currency into existing stacks first.
 * Returns true if the whole item was stored.
 */
export function addItem(grid: Grid, item: Item): boolean {
  const cid = currencyId(item);
  if (cid && item.stack) {
    const max = stackable(item);
    for (const g of grid.items) {
      if (currencyId(g.item) !== cid) continue;
      const room = max - (g.item.stack ?? 1);
      if (room <= 0) continue;
      const moved = Math.min(room, item.stack);
      g.item.stack = (g.item.stack ?? 1) + moved;
      item.stack -= moved;
      if (item.stack <= 0) return true;
    }
  }
  const spot = findSpace(grid, item);
  if (!spot) return false;
  grid.items.push({ item, x: spot.x, y: spot.y });
  return true;
}

export function removeItem(grid: Grid, item: Item): boolean {
  const i = grid.items.findIndex((g) => g.item === item || g.item.uid === item.uid);
  if (i < 0) return false;
  grid.items.splice(i, 1);
  return true;
}

/**
 * Place an item at x,y. If exactly one item is in the way it is swapped out and returned
 * (PoE's "pick up the item underneath" behaviour). Stacks of the same currency merge.
 */
export function placeAt(grid: Grid, item: Item, x: number, y: number): { placed: boolean; swapped?: Item } {
  const [w, h] = itemSize(item);
  if (!inBounds(grid, x, y, w, h)) return { placed: false };
  const hits = overlapping(grid, x, y, w, h);
  if (hits.length === 0) {
    grid.items.push({ item, x, y });
    return { placed: true };
  }
  if (hits.length === 1) {
    const other = hits[0];
    const cid = currencyId(item);
    if (cid && currencyId(other.item) === cid) {
      const max = stackable(item);
      const room = max - (other.item.stack ?? 1);
      const moved = Math.min(room, item.stack ?? 1);
      other.item.stack = (other.item.stack ?? 1) + moved;
      item.stack = (item.stack ?? 1) - moved;
      return item.stack > 0 ? { placed: false, swapped: item } : { placed: true };
    }
    removeItem(grid, other.item);
    grid.items.push({ item, x, y });
    return { placed: true, swapped: other.item };
  }
  return { placed: false };
}

export function countCurrency(grid: Grid, id: string): number {
  let n = 0;
  for (const g of grid.items) if (currencyId(g.item) === id) n += g.item.stack ?? 1;
  return n;
}

/** Remove `n` of a currency from the grid. Returns false if there wasn't enough. */
export function spendCurrency(grid: Grid, id: string, n: number): boolean {
  if (countCurrency(grid, id) < n) return false;
  for (const g of [...grid.items]) {
    if (n <= 0) break;
    if (currencyId(g.item) !== id) continue;
    const take = Math.min(n, g.item.stack ?? 1);
    g.item.stack = (g.item.stack ?? 1) - take;
    n -= take;
    if ((g.item.stack ?? 0) <= 0) removeItem(grid, g.item);
  }
  return true;
}
