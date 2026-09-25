import { describe, expect, it } from 'vitest';
import { RNG } from '../src/core/rng';
import { newCharacter } from '../src/game/character';
import { canEquip, equipItem, socketAccepts } from '../src/game/equip';
import { evaluateSale } from '../src/game/vendor';
import { emptySave } from '../src/game/save';
import { createGem, createItem } from '../src/items/generate';
import { computeCharacterStats } from '../src/stats/character';
import { addGemXp, canLevelGem, gemXpToNext, levelGem } from '../src/skills/gemUtil';
import { getGem } from '../src/data/gems';
import { xpMultiplier, xpToNext } from '../src/data/scaling';

describe('equipment rules', () => {
  it('two-handed weapons displace the off-hand, bows keep quivers', () => {
    const c = newCharacter('E', 'brute');
    c.level = 50;
    const s = computeCharacterStats(c);
    c.equipment.offhand = createItem('shield_str_0', 1);
    const axe = createItem('two_hand_axe_0', 1);
    const res = equipItem(c, s, axe, 'weapon');
    expect(res.ok).toBe(true);
    expect(res.displaced.map((i) => i.baseId)).toContain('shield_str_0');
    expect(c.equipment.offhand).toBeUndefined();
    expect(canEquip(c, s, createItem('shield_str_0', 1), 'offhand')).toMatch(/two-handed/);
  });

  it('enforces level and attribute requirements', () => {
    const c = newCharacter('E', 'arcanist');
    const s = computeCharacterStats(c);
    const plate = createItem('body_armour_str_5', 70);
    expect(canEquip(c, s, plate, 'body')).toMatch(/Requires/);
    expect(canEquip(c, s, createItem('ring_iron', 1), 'helmet')).toMatch(/fit/);
  });

  it('socket colours gate gems, white sockets accept anything', () => {
    const fireball = createGem('fireball');
    expect(socketAccepts('B', fireball)).toBe(true);
    expect(socketAccepts('R', fireball)).toBe(false);
    expect(socketAccepts('W', fireball)).toBe(true);
  });
});

describe('gem experience', () => {
  it('gems bank experience and level up on request', () => {
    const gem = createGem('fireball');
    const need = gemXpToNext(getGem('fireball'), 1);
    addGemXp(gem, need * 10);
    expect(gem.gem!.xp).toBe(need);
    expect(canLevelGem(gem, 1)).toBe(false); // character too low for level 2's requirement
    expect(canLevelGem(gem, 20)).toBe(true);
    expect(levelGem(gem, 20)).toBe(true);
    expect(gem.gem!.level).toBe(2);
    expect(gem.gem!.xp).toBe(0);
  });
});

describe('experience', () => {
  it('xp curve grows and far-off monsters give less', () => {
    expect(xpToNext(10)).toBeGreaterThan(xpToNext(5));
    expect(xpMultiplier(50, 50)).toBe(1);
    expect(xpMultiplier(50, 20)).toBeLessThan(0.2);
  });
});

describe('vendor recipes', () => {
  const r = new RNG(3);
  it('pays more for unidentified rares and pays prismatic orbs for RGB links', () => {
    const rare = createItem('gloves_str_2', 30, 'rare', r);
    rare.identified = false;
    const sale = evaluateSale([rare]);
    expect(sale.receive.find((i) => i.baseId === 'currency:alteration')?.stack).toBe(2);
    const rgb = createItem('body_armour_str_2', 30, 'normal', r);
    rgb.sockets = [{ color: 'R', group: 0 }, { color: 'G', group: 0 }, { color: 'B', group: 0 }];
    const sale2 = evaluateSale([rgb]);
    expect(sale2.receive.some((i) => i.baseId === 'currency:chromatic')).toBe(true);
  });

  it('a full rare set is worth an Orb of Upheaval', () => {
    const set = ['two_hand_sword_3', 'helmet_str_3', 'body_armour_str_3', 'gloves_str_3', 'boots_str_3', 'belt_leather', 'amulet_jade', 'ring_iron', 'ring_coral'].map((b) => {
      const it = createItem(b, 60, 'rare', r);
      it.identified = true;
      return it;
    });
    const sale = evaluateSale(set);
    expect(sale.receive.find((i) => i.baseId === 'currency:chaos')?.stack).toBe(1);
    expect(sale.recipes.length).toBeGreaterThan(0);
  });

  it('six-linked items sell for an Orb of Providence', () => {
    const it = createItem('body_armour_int_5', 70, 'normal', r);
    it.sockets = Array.from({ length: 6 }, () => ({ color: 'B' as const, group: 0 }));
    expect(evaluateSale([it]).receive.some((i) => i.baseId === 'currency:divine')).toBe(true);
  });
});

describe('save data', () => {
  it('round-trips characters and items through JSON', () => {
    const save = emptySave();
    const c = newCharacter('Saver', 'zealot');
    c.equipment.helmet = createItem('helmet_str_int_2', 30, 'rare');
    save.characters.push(c);
    const copy = JSON.parse(JSON.stringify(save));
    expect(copy.characters[0].equipment.helmet.prefixes.length + copy.characters[0].equipment.helmet.suffixes.length).toBeGreaterThan(0);
    const s1 = computeCharacterStats(c);
    const s2 = computeCharacterStats(copy.characters[0]);
    expect(s2.maxLife).toBe(s1.maxLife);
    expect(s2.armour).toBe(s1.armour);
  });
});

describe('vendor stock', () => {
  it('gear offers sell once, gems stay in stock', async () => {
    const { Game } = await import('../src/game/game');
    const { newAccount, DEFAULT_SETTINGS } = await import('../src/game/save');
    const { addItem } = await import('../src/items/grid');
    const { createCurrency } = await import('../src/items/generate');
    const g = new Game(newCharacter('V', 'brute'), newAccount(), { ...DEFAULT_SETTINGS });
    g.refreshVendor(true);
    for (const c of ['alteration', 'identify', 'transmute'] as const) addItem(g.char.inventory, createCurrency(c, 30));
    const gear = g.vendorOffers.find((o) => !o.item.gem && !o.item.flask && o.price.currency === 'alteration')!;
    const gem = g.vendorOffers.find((o) => o.item.gem)!;
    expect(g.buy(gear)).toBe(true);
    expect(g.vendorOffers).not.toContain(gear);
    expect(g.buy(gem)).toBe(true);
    expect(g.vendorOffers).toContain(gem);
  });
});
