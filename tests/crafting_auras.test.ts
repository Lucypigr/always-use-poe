import { describe, expect, it } from 'vitest';
import { UNIQUE_BY_ID } from '../src/data/uniques';
import { newCharacter } from '../src/game/character';
import { Game } from '../src/game/game';
import { Monster, monsterDef } from '../src/game/monster';
import { DEFAULT_SETTINGS, newAccount } from '../src/game/save';
import { benchOptions } from '../src/items/bench';
import { createCurrency, createGem, createItem, createUnique } from '../src/items/generate';
import { addItem, countCurrency } from '../src/items/grid';

function game(cls: 'brute' | 'arcanist' = 'arcanist') {
  const c = newCharacter('C', cls);
  c.level = 60;
  const amulet = createItem('amulet_onyx', 40);
  amulet.implicits[0].values = [300];
  c.equipment.amulet = amulet;
  const g = new Game(c, newAccount(), { ...DEFAULT_SETTINGS });
  return g;
}

function withAuras(g: Game, ids: string[], supports: string[] = []) {
  const w = createItem('wand_3', 40);
  const all = [...ids, ...supports];
  w.sockets = all.map((_, i) => ({ color: 'W' as const, group: i < ids.length ? i : 0 }));
  all.forEach((id, i) => (w.sockets[i].gem = createGem(id, 10)));
  g.char.equipment.weapon = w;
  g.recalc(true);
  return w.sockets.slice(0, ids.length).map((s) => s.gem!.uid);
}

function enemy(g: Game, dx: number, dy = 0) {
  const p = g.player;
  const m = new Monster(monsterDef('drowned'), 20, 'normal', g.map.nearestFloor({ x: p.pos.x + dx, y: p.pos.y + dy }), 'enemy', g.rng);
  g.area.monsters.push(m);
  return m;
}

describe('crafting bench', () => {
  it('adds one crafted mod, charges currency and can remove it', () => {
    const g = game();
    const helm = createItem('helmet_str_2', 40);
    addItem(g.char.inventory, createCurrency('transmute', 20));
    addItem(g.char.inventory, createCurrency('alteration', 20));
    const before = countCurrency(g.char.inventory, 'alteration');
    expect(g.benchCraft(helm, 'mod:life')).toBe(true);
    expect(helm.rarity).toBe('magic');
    expect(helm.prefixes[0].crafted).toBe(true);
    expect(helm.prefixes[0].values[0]).toBeGreaterThanOrEqual(40);
    expect(countCurrency(g.char.inventory, 'alteration')).toBe(before - 6);
    // only one crafted mod per item
    expect(benchOptions(helm).find((o) => o.id === 'mod:fire_res')!.reason).toMatch(/工藝/);
    expect(g.benchCraft(helm, 'remove')).toBe(true);
    expect(helm.prefixes.length).toBe(0);
  });

  it('respects spawn rules, slots and unaffordable costs', () => {
    const g = game();
    const ring = createItem('ring_gold', 40);
    const ids = benchOptions(ring).map((o) => o.id);
    expect(ids).toContain('mod:fire_res');
    expect(ids).not.toContain('mod:local_phys_inc');
    expect(g.benchCraft(ring, 'mod:fire_res')).toBe(false); // no currency
    expect(benchOptions(createUnique(UNIQUE_BY_ID.astramentis, 40)).length).toBe(0);
  });

  it('links and recolours sockets', () => {
    const g = game();
    const chest = createItem('body_armour_str_3', 50);
    chest.sockets = [{ color: 'R', group: 0 }, { color: 'G', group: 1 }, { color: 'B', group: 2 }, { color: 'R', group: 3 }];
    addItem(g.char.inventory, createCurrency('fusing', 20));
    addItem(g.char.inventory, createCurrency('chromatic', 20));
    expect(g.benchCraft(chest, 'link')).toBe(true);
    expect(new Set(chest.sockets.map((s) => s.group)).size).toBe(1);
    expect(g.benchCraft(chest, 'colour:B')).toBe(true);
    expect(chest.sockets.every((s) => s.color === 'B')).toBe(true);
  });
});

describe('auras and heralds', () => {
  it('aura effect scales aura buffs; Enlighten lowers reservation', () => {
    const g = game();
    const [grace] = withAuras(g, ['grace']);
    g.toggleAura(grace);
    const ev = g.player.stats.evasion;
    g.char.equipment.helmet = createUnique(UNIQUE_BY_ID.leer_cast, 60);
    g.recalc();
    expect(g.player.stats.evasion).toBeGreaterThan(ev);
    const plain = game();
    const [u1] = withAuras(plain, ['grace']);
    const enl = game();
    const [u2] = withAuras(enl, ['grace'], ['enlighten']);
    expect(enl.player.skillStats.get(u2)!.reservation).toBeLessThan(plain.player.skillStats.get(u1)!.reservation);
  });

  it('Herald of Ice shatters chilled enemies into their neighbours', () => {
    const g = game();
    g.travelToArea('shore');
    g.area.monsters = [];
    const [ice] = withAuras(g, ['herald_ice']);
    g.toggleAura(ice);
    expect(g.player.cstats.sheet.has('herald_ice')).toBe(true);
    const a = enemy(g, 3);
    const b = enemy(g, 3.8);
    a.ailments.chill = { effect: 0.2, time: 2 };
    a.life = 0;
    a.dead = true;
    (g as unknown as { onKill: (m: Monster, s: null) => void }).onKill(a, null);
    expect(b.life).toBeLessThan(b.stats.maxLife);
  });

  it('Herald of Thunder strikes nearby enemies', () => {
    const g = game();
    g.travelToArea('shore');
    g.area.monsters = [];
    const [th] = withAuras(g, ['herald_thunder']);
    g.toggleAura(th);
    const m = enemy(g, 4);
    for (let i = 0; i < 90; i++) g.update(1 / 30);
    expect(m.life).toBeLessThan(m.stats.maxLife);
  });

  it("Inpulsa's heart makes shocked enemies explode", () => {
    const g = game();
    g.travelToArea('shore');
    g.area.monsters = [];
    g.char.equipment.body = createUnique(UNIQUE_BY_ID.inpulsa, 60);
    g.recalc();
    const a = enemy(g, 3);
    const b = enemy(g, 3.8);
    a.ailments.shock = { effect: 0.2, time: 2 };
    a.life = 0;
    a.dead = true;
    (g as unknown as { onKill: (m: Monster, s: null) => void }).onKill(a, null);
    expect(b.life).toBeLessThan(b.stats.maxLife);
  });
});
