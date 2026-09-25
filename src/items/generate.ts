import { rng as defaultRng, uid, type RNG } from '../core/rng';
import { allMods, getMod, type ModDef, type ModType } from '../data/affixes';
import { EQUIPMENT_BASES, getBase } from '../data/bases';
import { CURRENCY, CURRENCY_BY_ID, type CurrencyId } from '../data/currency';
import { GEMS, getGem } from '../data/gems';
import { UNIQUES, UNIQUE_BY_ID, type UniqueDef } from '../data/uniques';
import { explicitMods } from './item';
import { rareName } from './names';
import type { Attr, Item, ItemBase, ModRoll, Rarity, Socket, SocketColor } from './types';

// ---------------------------------------------------------------------------------------------
// Construction helpers
// ---------------------------------------------------------------------------------------------

function blank(baseId: string, ilvl: number): Item {
  return {
    uid: uid(),
    baseId,
    rarity: 'normal',
    ilvl,
    identified: true,
    corrupted: false,
    quality: 0,
    implicits: [],
    prefixes: [],
    suffixes: [],
    sockets: [],
  };
}

export function createCurrency(id: CurrencyId, count = 1): Item {
  const it = blank(`currency:${id}`, 1);
  it.stack = Math.min(count, CURRENCY_BY_ID[id].stackSize);
  return it;
}

export function createGem(id: string, level = 1, quality = 0): Item {
  getGem(id); // validate
  const it = blank('gem', 1);
  it.gem = { id, level, xp: 0 };
  it.quality = quality;
  return it;
}

const MAP_LAYOUTS = ['crypt', 'caves', 'forest', 'ruins', 'inferno', 'frost', 'void', 'shore'];

export function createMap(tier: number, r: RNG = defaultRng): Item {
  const it = blank('map', mapAreaLevel(tier));
  it.map = { tier, layout: r.pick(MAP_LAYOUTS) };
  return it;
}

export const mapAreaLevel = (tier: number): number => 40 + tier * 2;

/** Create an item of a given base, rolling implicits, sockets and (optionally) rarity. */
export function createItem(baseId: string, ilvl: number, rarity: Rarity = 'normal', r: RNG = defaultRng): Item {
  const base = getBase(baseId);
  const it = blank(baseId, ilvl);
  rollImplicits(it, r);
  if (maxSockets(it) > 0) rollSockets(it, r, 'drop');
  if (base.flask) it.flask = { charges: base.flask.maxCharges };
  if (rarity !== 'normal') applyRarity(it, rarity, r);
  return it;
}

export function rollImplicits(it: Item, r: RNG = defaultRng): void {
  const base = getBase(it.baseId);
  it.implicits = (base.implicits ?? []).map((imp) => ({
    id: imp.mod,
    tier: 0,
    values: imp.values.map(([lo, hi]) => r.int(lo, hi)),
  }));
}

// ---------------------------------------------------------------------------------------------
// Sockets
// ---------------------------------------------------------------------------------------------

export function maxSockets(it: Item): number {
  if (it.gem || it.map || it.stack !== undefined) return 0;
  const b = getBase(it.baseId);
  let classMax = 0;
  if (b.cls === 'body_armour' || b.twoHanded) classMax = 6;
  else if (b.cls === 'helmet' || b.cls === 'gloves' || b.cls === 'boots') classMax = 4;
  else if (b.weapon || b.cls === 'shield') classMax = 3;
  if (classMax === 0) return 0;
  const lvlMax = it.ilvl < 2 ? 2 : it.ilvl < 25 ? 3 : it.ilvl < 35 ? 4 : it.ilvl < 50 ? 5 : 6;
  return Math.min(classMax, lvlMax);
}

const SOCKET_COUNT_WEIGHTS = [0, 50, 32, 16, 7, 2, 0.5];

function rollSocketCount(it: Item, r: RNG): number {
  const max = maxSockets(it);
  const counts = Array.from({ length: max }, (_, i) => i + 1);
  return r.weighted(counts, (n) => SOCKET_COUNT_WEIGHTS[n]) ?? 1;
}

function colorWeights(base: ItemBase): Record<'R' | 'G' | 'B', number> {
  const req = base.req;
  const has = (a: Attr) => a in req;
  const any = has('str') || has('dex') || has('int');
  const w = (a: Attr) => (!any ? 20 : has(a) ? (req[a] ?? 0) + 30 : 8);
  return { R: w('str'), G: w('dex'), B: w('int') };
}

function rollColor(base: ItemBase, r: RNG): SocketColor {
  const w = colorWeights(base);
  return r.weighted(['R', 'G', 'B'] as const, (c) => w[c]) ?? 'R';
}

const LINK_CHANCE = 0.32;

function rollLinks(sockets: Socket[], r: RNG): void {
  let group = 0;
  sockets.forEach((s, i) => {
    if (i > 0 && !r.chance(LINK_CHANCE)) group++;
    s.group = group;
  });
}

export function rollSockets(it: Item, r: RNG = defaultRng, _mode: 'drop' | 'craft' = 'drop'): void {
  const base = getBase(it.baseId);
  const n = rollSocketCount(it, r);
  it.sockets = Array.from({ length: n }, () => ({ color: rollColor(base, r), group: 0 }));
  rollLinks(it.sockets, r);
}

export function rerollSocketColors(it: Item, r: RNG = defaultRng, whiteChance = 0): void {
  const base = getBase(it.baseId);
  for (const s of it.sockets) s.color = r.chance(whiteChance) ? 'W' : rollColor(base, r);
}

export function rerollSocketCount(it: Item, r: RNG = defaultRng): void {
  const base = getBase(it.baseId);
  const n = rollSocketCount(it, r);
  const keep = it.sockets.slice(0, n).map((s) => ({ color: s.color, group: 0 }));
  while (keep.length < n) keep.push({ color: rollColor(base, r), group: 0 });
  it.sockets = keep;
  rollLinks(it.sockets, r);
}

export function rerollLinks(it: Item, r: RNG = defaultRng): void {
  rollLinks(it.sockets, r);
}

/** Size of the largest linked group. */
export function maxLinks(it: Item): number {
  const counts = new Map<number, number>();
  for (const s of it.sockets) counts.set(s.group, (counts.get(s.group) ?? 0) + 1);
  return Math.max(0, ...counts.values());
}

// ---------------------------------------------------------------------------------------------
// Affix rolling
// ---------------------------------------------------------------------------------------------

export function itemTags(it: Item): Set<string> {
  if (it.map) return new Set(['map']);
  return new Set(getBase(it.baseId).tags);
}

function valueScale(def: ModDef, tags: Set<string>): number {
  if (!def.scale) return 1;
  for (const [tag, m] of Object.entries(def.scale)) if (tags.has(tag)) return m;
  return 1;
}

export function rollValues(def: ModDef, tierIdx: number, it: Item, r: RNG = defaultRng): number[] {
  const tier = def.tiers[tierIdx];
  const scale = valueScale(def, itemTags(it));
  const dec = def.decimals ?? 0;
  return tier.values.map(([lo, hi]) => {
    if (dec > 0) {
      const m = 10 ** dec;
      return Math.round(r.float(lo * scale, hi * scale) * m) / m;
    }
    const a = Math.round(lo * scale);
    const b = Math.max(a, Math.round(hi * scale));
    return r.int(a, b);
  });
}

interface Candidate {
  def: ModDef;
  tier: number;
  weight: number;
}

export function modCandidates(it: Item, type: ModType): Candidate[] {
  const tags = itemTags(it);
  const groups = new Set(explicitMods(it).map((m) => getMod(m.id).group));
  const out: Candidate[] = [];
  for (const def of allMods()) {
    if (def.type !== type) continue;
    if (!def.spawn.some((t) => tags.has(t))) continue;
    if (groups.has(def.group)) continue;
    const n = def.tiers.length;
    def.tiers.forEach((tier, i) => {
      if (tier.ilvl > it.ilvl) return;
      let w = tier.weight ?? def.weight ?? 1000;
      if (n >= 4 && i === n - 1) w *= 0.35;
      else if (n >= 4 && i === n - 2) w *= 0.7;
      out.push({ def, tier: i, weight: w });
    });
  }
  return out;
}

export function affixLimit(it: Item): number {
  if (it.rarity === 'magic') return 1;
  if (it.rarity === 'rare') return 3;
  return 0;
}

/** Add one random affix respecting prefix/suffix limits. Returns false if none possible. */
export function addRandomMod(it: Item, r: RNG = defaultRng, forceType?: 'prefix' | 'suffix'): boolean {
  const limit = affixLimit(it);
  const types: ('prefix' | 'suffix')[] = [];
  if ((!forceType || forceType === 'prefix') && it.prefixes.length < limit) types.push('prefix');
  if ((!forceType || forceType === 'suffix') && it.suffixes.length < limit) types.push('suffix');
  const cands: (Candidate & { type: 'prefix' | 'suffix' })[] = [];
  for (const t of types) for (const c of modCandidates(it, t)) cands.push({ ...c, type: t });
  const pick = r.weighted(cands, (c) => c.weight);
  if (!pick) return false;
  const roll: ModRoll = { id: pick.def.id, tier: pick.tier, values: rollValues(pick.def, pick.tier, it, r) };
  (pick.type === 'prefix' ? it.prefixes : it.suffixes).push(roll);
  return true;
}

function magicModCount(r: RNG): number {
  return r.chance(0.55) ? 2 : 1;
}

function rareModCount(r: RNG): number {
  return r.weighted([4, 5, 6], (n) => (n === 4 ? 8 : n === 5 ? 3 : 1)) ?? 4;
}

/** Reset explicit mods and roll the item as the given rarity. */
export function applyRarity(it: Item, rarity: Rarity, r: RNG = defaultRng): void {
  it.prefixes = [];
  it.suffixes = [];
  it.name = undefined;
  it.rarity = rarity;
  const base = getBase(it.baseId);
  if (rarity === 'magic') {
    const n = magicModCount(r);
    if (n === 2) {
      addRandomMod(it, r, 'prefix');
      addRandomMod(it, r, 'suffix');
    } else addRandomMod(it, r);
    if (explicitMods(it).length === 0) it.rarity = 'normal';
  } else if (rarity === 'rare') {
    if (base.flask) {
      applyRarity(it, 'magic', r);
      return;
    }
    const n = rareModCount(r);
    for (let i = 0; i < n; i++) addRandomMod(it, r);
    it.name = rareName(r, base.cls === 'map' || it.map ? 'map' : base.cls);
  }
}

// ---------------------------------------------------------------------------------------------
// Uniques
// ---------------------------------------------------------------------------------------------

export function createUnique(def: UniqueDef, ilvl: number, r: RNG = defaultRng): Item {
  const it = createItem(def.base, ilvl, 'normal', r);
  it.rarity = 'unique';
  it.uniqueId = def.id;
  it.prefixes = def.mods.map((m) => ({ id: m.mod, tier: 0, values: m.values.map(([lo, hi]) => rollUniqueValue(getMod(m.mod), lo, hi, r)) }));
  if (def.sockets) {
    it.sockets = def.sockets.colors.map((color, i) => ({ color, group: def.sockets!.linked ? 0 : i }));
  }
  return it;
}

function rollUniqueValue(def: ModDef, lo: number, hi: number, r: RNG): number {
  if (def.decimals) {
    const m = 10 ** def.decimals;
    return Math.round(r.float(lo, hi) * m) / m;
  }
  return r.int(lo, hi);
}

export function uniqueRanges(it: Item): [number, number][][] | undefined {
  if (!it.uniqueId) return undefined;
  return UNIQUE_BY_ID[it.uniqueId]?.mods.map((m) => m.values);
}

export function uniquesForBase(baseId: string): UniqueDef[] {
  return UNIQUES.filter((u) => u.base === baseId);
}

export function randomUnique(ilvl: number, r: RNG = defaultRng): UniqueDef | undefined {
  const ok = UNIQUES.filter((u) => Math.max(getBase(u.base).level, u.level ?? 0) <= ilvl + 5);
  return r.weighted(ok, (u) => u.dropWeight ?? 100);
}

// ---------------------------------------------------------------------------------------------
// Random drops
// ---------------------------------------------------------------------------------------------

export interface RarityRollOptions {
  itemRarity?: number;
  bonusRare?: number;
}

export function rollRarity(r: RNG, opts: RarityRollOptions = {}): Rarity {
  const mult = 1 + (opts.itemRarity ?? 0) / 100;
  const weights: Record<Rarity, number> = {
    normal: 420,
    magic: 110 * mult,
    rare: (14 + (opts.bonusRare ?? 0)) * mult,
    unique: 0.9 * mult,
  };
  return r.weighted(['normal', 'magic', 'rare', 'unique'] as Rarity[], (x) => weights[x]) ?? 'normal';
}

/** Pick a random equipment base that can drop at this item level (newer bases favoured). */
export function randomBase(ilvl: number, r: RNG = defaultRng, filter?: (b: ItemBase) => boolean): ItemBase {
  const ok = EQUIPMENT_BASES.filter((b) => b.level <= ilvl && (!filter || filter(b)));
  return (
    r.weighted(ok, (b) => {
      const age = ilvl - b.level;
      const recency = age < 12 ? 1.4 : age < 25 ? 1 : 0.6;
      const flaskW = b.flask ? (b.flask.kind === 'utility' ? 0.5 : 0.6) : 1;
      return (b.dropWeight ?? 1) * recency * flaskW;
    }) ?? EQUIPMENT_BASES[0]
  );
}

export function randomEquipment(ilvl: number, rarity: Rarity, r: RNG = defaultRng): Item {
  if (rarity === 'unique') {
    const u = randomUnique(ilvl, r);
    if (u) return createUnique(u, ilvl, r);
    rarity = 'rare';
  }
  const base = randomBase(ilvl, r);
  const it = createItem(base.id, ilvl, rarity, r);
  if (it.rarity !== 'normal') it.identified = false;
  return it;
}

export function randomCurrency(level: number, r: RNG = defaultRng, quantBonus = 0): Item {
  const ok = CURRENCY.filter((c) => c.minLevel <= level);
  const def = r.weighted(ok, (c) => c.dropWeight) ?? CURRENCY[0];
  let n = 1;
  if (def.id === 'identify' || def.id === 'portal') n = r.int(1, 3 + Math.floor(quantBonus / 50));
  return createCurrency(def.id, n);
}

export function randomGem(level: number, r: RNG = defaultRng): Item {
  const ok = GEMS.filter((g) => g.reqLevel <= level + 2);
  const g = r.weighted(ok, (x) => x.dropWeight ?? (x.support ? 80 : 100)) ?? GEMS[0];
  const quality = r.chance(0.12) ? r.int(1, 10) : 0;
  return createGem(g.id, 1, quality);
}

export function randomMapDrop(areaLevel: number, r: RNG = defaultRng): Item | undefined {
  if (areaLevel < 36) return undefined;
  const baseTier = Math.max(1, Math.min(10, Math.floor((areaLevel - 40) / 2)));
  const tier = Math.max(1, Math.min(10, baseTier + (r.chance(0.3) ? 1 : 0) - (r.chance(0.2) ? 1 : 0)));
  const it = createMap(tier, r);
  const rarity = rollRarity(r);
  if (rarity === 'magic' || rarity === 'rare') applyRarity(it, rarity, r);
  return it;
}
