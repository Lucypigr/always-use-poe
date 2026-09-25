import type { RNG } from '../core/rng';
import type { CurrencyId } from '../data/currency';
import { GEMS } from '../data/gems';
import { createCurrency, createGem, createItem, maxLinks, randomBase } from '../items/generate';
import { currencyId, isCurrency } from '../items/item';
import type { Item } from '../items/types';
import { getBase } from '../data/bases';

/**
 * The town vendor. Buys items for currency (with Path of Exile style vendor recipes)
 * and sells gems, flasks and a rotating stock of magic items.
 */

export interface Price {
  currency: CurrencyId;
  amount: number;
}

export interface VendorOffer {
  item: Item;
  price: Price;
}

function gemPrice(req: number): Price {
  if (req < 8) return { currency: 'identify', amount: 1 };
  if (req < 16) return { currency: 'transmute', amount: 1 };
  if (req < 28) return { currency: 'alteration', amount: 1 };
  return { currency: 'alteration', amount: 3 };
}

export function vendorStock(level: number, rng: RNG): VendorOffer[] {
  const out: VendorOffer[] = [];
  for (const g of GEMS) {
    if (g.reqLevel > level + 3) continue;
    out.push({ item: createGem(g.id), price: gemPrice(g.reqLevel) });
  }
  const flasks = ['life_flask_0', 'mana_flask_0', 'flask_quicksilver'];
  if (level >= 4) flasks.push('life_flask_1', 'mana_flask_1');
  if (level >= 9) flasks.push('life_flask_2', 'mana_flask_2');
  if (level >= 16) flasks.push('flask_ruby', 'flask_sapphire', 'flask_topaz');
  if (level >= 22) flasks.push('life_flask_4', 'flask_granite', 'flask_jade');
  if (level >= 30) flasks.push('life_flask_5', 'mana_flask_5');
  for (const f of flasks) {
    const b = getBase(f);
    out.push({ item: createItem(f, Math.max(1, level), 'normal', rng), price: b.flask?.kind === 'utility' ? { currency: 'transmute', amount: 1 } : { currency: 'identify', amount: 2 } });
  }
  for (let i = 0; i < 8; i++) {
    const base = randomBase(Math.max(1, level), rng, (b) => !b.flask);
    const it = createItem(base.id, Math.max(1, level), 'magic', rng);
    out.push({ item: it, price: { currency: 'alteration', amount: rng.int(1, 3) } });
  }
  out.push({ item: createCurrency('portal', 1), price: { currency: 'identify', amount: 1 } });
  return out;
}

export interface SaleResult {
  receive: Item[];
  recipes: string[];
}

const RARE_SET_SLOTS = ['helmet', 'body_armour', 'gloves', 'boots', 'belt', 'amulet'];

/** Evaluate what the vendor pays for a set of offered items (including recipes). */
export function evaluateSale(items: Item[]): SaleResult {
  const totals = new Map<CurrencyId, number>();
  const add = (c: CurrencyId, n: number) => totals.set(c, (totals.get(c) ?? 0) + n);
  const recipes: string[] = [];
  const consumed = new Set<Item>();

  // Rare item set recipe (≈ chaos recipe)
  const rares = items.filter((i) => i.rarity === 'rare' && !i.map && i.ilvl >= 30);
  const byCls = (cls: string) => rares.filter((i) => getBase(i.baseId).cls === cls && !consumed.has(i));
  const weapons = rares.filter((i) => getBase(i.baseId).weapon);
  const twoHand = weapons.find((w) => getBase(w.baseId).twoHanded);
  const oneHands = weapons.filter((w) => !getBase(w.baseId).twoHanded);
  const shield = rares.find((i) => ['shield', 'quiver'].includes(getBase(i.baseId).cls));
  const rings = byCls('ring');
  const setParts = RARE_SET_SLOTS.map((c) => byCls(c)[0]);
  const weaponPart = twoHand ? [twoHand] : oneHands.length >= 2 ? oneHands.slice(0, 2) : oneHands[0] && shield ? [oneHands[0], shield] : null;
  if (weaponPart && setParts.every(Boolean) && rings.length >= 2) {
    const set = [...weaponPart, ...setParts, rings[0], rings[1]] as Item[];
    const unid = set.every((i) => !i.identified);
    add('chaos', unid ? 2 : 1);
    recipes.push(`Full rare set${unid ? ' (unidentified)' : ''}`);
    for (const i of set) consumed.add(i);
  }

  let gemQuality = 0;
  let flaskQuality = 0;
  for (const it of items) {
    if (consumed.has(it)) continue;
    if (isCurrency(it)) continue;
    if (it.gem) {
      gemQuality += it.quality;
      add('identify', 1);
      continue;
    }
    if (it.flask) {
      flaskQuality += it.quality;
      add('identify', 1);
      continue;
    }
    if (it.map) {
      add('transmute', 1);
      continue;
    }
    const links = maxLinks(it);
    if (links >= 6) {
      add('divine', 1);
      recipes.push('Six-linked item');
      continue;
    }
    if (it.sockets.length >= 6) {
      add('jeweller', 7);
      recipes.push('Six-socket item');
      continue;
    }
    const groups = new Map<number, Set<string>>();
    for (const s of it.sockets) {
      if (!groups.has(s.group)) groups.set(s.group, new Set());
      groups.get(s.group)!.add(s.color);
    }
    if ([...groups.values()].some((g) => g.has('R') && g.has('G') && g.has('B'))) {
      add('chromatic', 1);
      recipes.push('Linked red, green and blue sockets');
    }
    switch (it.rarity) {
      case 'normal':
        add('identify', 1);
        break;
      case 'magic':
        add('identify', 2);
        break;
      case 'rare':
        add('alteration', it.identified ? 1 : 2);
        break;
      case 'unique':
        add('alchemy', 1);
        break;
    }
  }
  if (gemQuality >= 40) {
    add('gcp', Math.floor(gemQuality / 40));
    recipes.push('Gems with 40% total quality');
  }
  if (flaskQuality >= 40) {
    add('bauble', Math.floor(flaskQuality / 40));
    recipes.push('Flasks with 40% total quality');
  }
  const receive: Item[] = [];
  for (const [c, n] of totals) {
    let left = n;
    while (left > 0) {
      const stack = createCurrency(c, left);
      left -= stack.stack ?? 1;
      receive.push(stack);
    }
  }
  return { receive, recipes };
}

export function canSell(it: Item): boolean {
  return !currencyId(it);
}
