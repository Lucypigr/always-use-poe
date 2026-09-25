import { beforeEach, describe, expect, it } from 'vitest';
import { RNG } from '../src/core/rng';
import { getMod } from '../src/data/affixes';
import { BASES, getBase } from '../src/data/bases';
import { UNIQUES } from '../src/data/uniques';
import { applyCurrency, canApply } from '../src/items/craft';
import {
  applyRarity, createCurrency, createGem, createItem, createMap, createUnique, maxLinks, maxSockets, randomEquipment,
} from '../src/items/generate';
import { armourProps, displayName, explicitMods, requiredLevel, weaponProps } from '../src/items/item';
import { addItem, countCurrency, newGrid, placeAt, spendCurrency } from '../src/items/grid';

let r: RNG;
beforeEach(() => {
  r = new RNG(12345);
});

describe('data integrity', () => {
  it('all uniques reference real bases and mods', () => {
    for (const u of UNIQUES) {
      expect(() => getBase(u.base)).not.toThrow();
      for (const m of u.mods) expect(() => getMod(m.mod)).not.toThrow();
    }
  });

  it('all base implicits reference real mods', () => {
    for (const b of BASES) for (const imp of b.implicits ?? []) expect(getMod(imp.mod).type).toBe('implicit');
  });
});

describe('item generation', () => {
  it('magic items have at most one prefix and one suffix', () => {
    for (let i = 0; i < 200; i++) {
      const it = createItem('body_armour_str_3', 60, 'magic', r);
      expect(it.prefixes.length).toBeLessThanOrEqual(1);
      expect(it.suffixes.length).toBeLessThanOrEqual(1);
      expect(explicitMods(it).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('rare items have 4–6 mods, max 3 of each, never two mods from one group', () => {
    for (let i = 0; i < 200; i++) {
      const it = createItem('ring_coral', 75, 'rare', r);
      const mods = explicitMods(it);
      expect(mods.length).toBeGreaterThanOrEqual(3);
      expect(mods.length).toBeLessThanOrEqual(6);
      expect(it.prefixes.length).toBeLessThanOrEqual(3);
      expect(it.suffixes.length).toBeLessThanOrEqual(3);
      const groups = mods.map((m) => getMod(m.id).group);
      expect(new Set(groups).size).toBe(groups.length);
      expect(it.name).toBeTruthy();
    }
  });

  it('mod tiers respect item level', () => {
    for (let i = 0; i < 300; i++) {
      const it = createItem('helmet_str_0', 10, 'rare', r);
      for (const m of explicitMods(it)) expect(getMod(m.id).tiers[m.tier].ilvl).toBeLessThanOrEqual(10);
    }
  });

  it('mods only spawn on bases with a matching tag', () => {
    for (let i = 0; i < 200; i++) {
      const it = createItem('boots_dex_2', 50, 'rare', r);
      const tags = new Set(getBase(it.baseId).tags);
      for (const m of explicitMods(it)) expect(getMod(m.id).spawn.some((t) => tags.has(t))).toBe(true);
    }
  });

  it('socket counts respect class and item level limits', () => {
    for (let i = 0; i < 200; i++) {
      const low = createItem('body_armour_int_0', 1, 'normal', r);
      expect(low.sockets.length).toBeLessThanOrEqual(2);
      const high = createItem('body_armour_int_5', 70, 'normal', r);
      expect(high.sockets.length).toBeLessThanOrEqual(6);
      const gloves = createItem('gloves_str_5', 70, 'normal', r);
      expect(gloves.sockets.length).toBeLessThanOrEqual(4);
    }
    expect(maxSockets(createItem('ring_iron', 70))).toBe(0);
  });

  it('local mods change weapon and armour properties', () => {
    const w = createItem('one_hand_sword_3', 50, 'normal', r);
    const before = weaponProps(w)!;
    w.rarity = 'magic';
    w.prefixes = [{ id: 'local_phys_inc', tier: 0, values: [100] }];
    const after = weaponProps(w)!;
    expect(after.phys[0]).toBeGreaterThanOrEqual(before.phys[0] * 2 - 1);
    const a = createItem('body_armour_str_3', 50, 'normal', r);
    const base = armourProps(a)!.armour;
    a.quality = 20;
    expect(armourProps(a)!.armour).toBe(Math.round(base * 1.2));
  });

  it('required level follows the highest mod', () => {
    const it = createItem('ring_coral', 80, 'normal', r);
    it.rarity = 'magic';
    it.prefixes = [{ id: 'life', tier: 10, values: [105] }];
    expect(requiredLevel(it)).toBe(Math.floor(73 * 0.8));
  });

  it('random drops never crash across levels and rarities', () => {
    for (let lvl = 1; lvl <= 80; lvl += 3) {
      for (const rarity of ['normal', 'magic', 'rare', 'unique'] as const) {
        const it = randomEquipment(lvl, rarity, r);
        expect(displayName(it)).toBeTruthy();
      }
    }
  });

  it('unique items roll their fixed mods', () => {
    const canvas = createUnique(UNIQUES.find((u) => u.id === 'blank_canvas')!, 10, r);
    expect(canvas.sockets.length).toBe(6);
    expect(maxLinks(canvas)).toBe(6);
    expect(canvas.sockets.every((s) => s.color === 'W')).toBe(true);
  });
});

describe('currency', () => {
  it('transmute → augment → regal → exalt progression', () => {
    const it = createItem('amulet_jade', 70, 'normal', r);
    expect(applyCurrency('transmute', it, r).ok).toBe(true);
    expect(it.rarity).toBe('magic');
    while (explicitMods(it).length < 2) {
      if (!applyCurrency('augment', it, r).ok) break;
    }
    expect(explicitMods(it).length).toBe(2);
    expect(canApply('augment', it).ok).toBe(false);
    expect(applyCurrency('regal', it, r).ok).toBe(true);
    expect(it.rarity).toBe('rare');
    expect(explicitMods(it).length).toBe(3);
    expect(applyCurrency('exalt', it, r).ok).toBe(true);
    expect(explicitMods(it).length).toBe(4);
  });

  it('chaos rerolls rares only; scour returns to normal', () => {
    const it = createItem('gloves_dex_3', 60, 'normal', r);
    expect(canApply('chaos', it).ok).toBe(false);
    applyCurrency('alchemy', it, r);
    expect(it.rarity).toBe('rare');
    const before = JSON.stringify(explicitMods(it));
    let changed = false;
    for (let i = 0; i < 5 && !changed; i++) {
      applyCurrency('chaos', it, r);
      changed = JSON.stringify(explicitMods(it)) !== before;
    }
    expect(changed).toBe(true);
    applyCurrency('scour', it, r);
    expect(it.rarity).toBe('normal');
    expect(explicitMods(it).length).toBe(0);
  });

  it('annulment removes exactly one mod', () => {
    const it = createItem('ring_gold', 60, 'rare', r);
    const n = explicitMods(it).length;
    applyCurrency('annul', it, r);
    expect(explicitMods(it).length).toBe(n - 1);
  });

  it('divine keeps mods but rerolls values within tier', () => {
    const it = createItem('body_armour_str_5', 75, 'rare', r);
    const ids = explicitMods(it).map((m) => `${m.id}:${m.tier}`);
    applyCurrency('divine', it, r);
    expect(explicitMods(it).map((m) => `${m.id}:${m.tier}`)).toEqual(ids);
    for (const m of explicitMods(it)) {
      const tier = getMod(m.id).tiers[m.tier];
      m.values.forEach((v, i) => {
        const [lo, hi] = tier.values[i];
        expect(v).toBeGreaterThanOrEqual(Math.round(lo) - 1);
        expect(v).toBeLessThanOrEqual(Math.round(hi * 1.75) + 1);
      });
    }
  });

  it('socket currencies change sockets and respect socketed gems', () => {
    const it = createItem('body_armour_str_int_5', 70, 'normal', r);
    it.sockets = [{ color: 'R', group: 0 }, { color: 'R', group: 1 }, { color: 'R', group: 2 }];
    expect(applyCurrency('fusing', it, r).ok).toBe(true);
    expect(applyCurrency('jeweller', it, r).ok).toBe(true);
    expect(it.sockets.length).not.toBe(3);
    expect(applyCurrency('chromatic', it, r).ok).toBe(true);
    it.sockets[0].gem = createGem('fireball');
    expect(canApply('chromatic', it).ok).toBe(false);
  });

  it('corruption locks the item', () => {
    const it = createItem('boots_str_3', 50, 'rare', r);
    applyCurrency('vaal', it, r);
    expect(it.corrupted).toBe(true);
    expect(canApply('chaos', it).ok).toBe(false);
  });

  it('quality currencies respect item class and cap at 20', () => {
    const w = createItem('two_hand_axe_2', 30, 'normal', r);
    expect(canApply('armour_scrap', w).ok).toBe(false);
    for (let i = 0; i < 10; i++) applyCurrency('whetstone', w, r);
    expect(w.quality).toBe(20);
    const g = createGem('fireball');
    applyCurrency('gcp', g, r);
    expect(g.quality).toBe(1);
  });

  it('identification gates crafting', () => {
    const it = randomEquipment(30, 'rare', r);
    expect(it.identified).toBe(false);
    expect(canApply('chaos', it).ok).toBe(false);
    applyCurrency('identify', it, r);
    expect(it.identified).toBe(true);
  });

  it('maps roll map mods', () => {
    const m = createMap(5, r);
    applyRarity(m, 'rare', r);
    for (const mod of explicitMods(m)) expect(getMod(mod.id).spawn).toContain('map');
  });
});

describe('inventory grid', () => {
  it('stacks currency and swaps items', () => {
    const g = newGrid(12, 5);
    addItem(g, createCurrency('chaos', 3));
    addItem(g, createCurrency('chaos', 4));
    expect(g.items.length).toBe(1);
    expect(countCurrency(g, 'chaos')).toBe(7);
    expect(spendCurrency(g, 'chaos', 5)).toBe(true);
    expect(countCurrency(g, 'chaos')).toBe(2);
    const sword = createItem('one_hand_sword_0', 1);
    const ring = createItem('ring_iron', 1);
    addItem(g, ring);
    const ringPos = g.items.find((x) => x.item === ring)!;
    const res = placeAt(g, sword, ringPos.x, ringPos.y);
    expect(res.placed).toBe(true);
    expect(res.swapped).toBe(ring);
  });
});
