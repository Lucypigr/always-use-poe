/** Small, fast, seedable PRNG (mulberry32) with helpers used throughout the game. */
export class RNG {
  private state: number;

  constructor(seed: number = (Math.random() * 2 ** 32) >>> 0) {
    this.state = seed >>> 0;
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted pick. Returns undefined when the total weight is zero. */
  weighted<T>(items: readonly T[], weight: (t: T) => number): T | undefined {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return undefined;
    let roll = this.next() * total;
    for (const it of items) {
      const w = Math.max(0, weight(it));
      if (roll < w) return it;
      roll -= w;
    }
    return items[items.length - 1];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/** Shared RNG for gameplay rolls. Tests may reseed it for determinism. */
export let rng = new RNG();

export function reseed(seed: number): void {
  rng = new RNG(seed);
}

let uidCounter = 0;
export function uid(prefix = 'i'): string {
  uidCounter = (uidCounter + 1) % 1e9;
  return `${prefix}${Date.now().toString(36)}${uidCounter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
