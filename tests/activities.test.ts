import { describe, expect, it } from 'vitest';
import { newCharacter } from '../src/game/character';
import { Game } from '../src/game/game';
import type { Monster } from '../src/game/monster';
import { DEFAULT_SETTINGS, newAccount } from '../src/game/save';
import { createCurrency } from '../src/items/generate';
import { addItem } from '../src/items/grid';

function game(level = 20) {
  const c = newCharacter('A', 'brute');
  c.level = level;
  return new Game(c, newAccount(), { ...DEFAULT_SETTINGS });
}

const kill = (g: Game, m: Monster) => {
  m.life = 0;
  m.dead = true;
  (g as unknown as { onKill: (m: Monster, s: null) => void }).onKill(m, null);
};

describe('heist', () => {
  it('offers contracts once unlocked and can reroll them', () => {
    expect(game(5).heistUnlocked()).toBe(false);
    const g = game(20);
    expect(g.heistUnlocked()).toBe(true);
    const ids = g.heistData().contracts.map((c) => c.id);
    expect(ids.length).toBe(3);
    expect(g.rerollHeistContracts()).toBe(false);
    addItem(g.char.inventory, createCurrency('alteration', 2));
    expect(g.rerollHeistContracts()).toBe(true);
    expect(g.heistData().contracts.map((c) => c.id)).not.toEqual(ids);
  });

  it('strongboxes raise the alarm, the vault pays out and exiting completes the contract', () => {
    const g = game(20);
    const c = g.heistData().contracts[0];
    expect(g.startHeist(c.id)).toBe(true);
    const h = g.area.heist!;
    expect(h).toBeTruthy();
    const box = g.area.interactables.find((i) => i.kind === 'strongbox')!;
    const before = g.area.groundItems.length;
    g.clickInteractable(box);
    g.player.pos = { ...box.pos };
    g.update(1 / 30);
    expect(h.alarm).toBeGreaterThanOrEqual(12);
    expect(g.area.groundItems.length).toBeGreaterThan(before);
    const vault = g.area.interactables.find((i) => i.kind === 'vault')!;
    const n = g.area.groundItems.length;
    g.clickInteractable(vault);
    g.player.pos = { ...vault.pos };
    g.update(1 / 30);
    expect(h.looted).toBe(true);
    expect(h.lockdown).toBe(true);
    expect(g.area.groundItems.length).toBeGreaterThan(n);
    // reinforcements arrive during lockdown
    const enemies = g.area.monsters.filter((m) => m.team === 'enemy' && !m.dead).length;
    // keep the (ungeared) hero alive while standing among the reinforcements
    for (let i = 0; i < 120; i++) {
      g.player.life = g.player.stats.maxLife;
      g.update(1 / 30);
    }
    expect(g.area.monsters.filter((m) => m.team === 'enemy').length).toBeGreaterThan(enemies);
    const exit = g.area.interactables.find((i) => i.kind === 'exit')!;
    g.clickInteractable(exit);
    g.player.pos = { ...exit.pos };
    g.update(1 / 30);
    expect(g.area.town).toBe(true);
    expect(g.heistData().completed).toBe(1);
    expect(g.heistData().contracts.some((x) => x.id === c.id)).toBe(false);
  });

  it('the alarm reaches lockdown on its own', () => {
    const g = game(20);
    g.startHeist(g.heistData().contracts[0].id);
    for (let t = 0; t < 200; t += 0.05) g.update(0.05);
    expect(g.area.heist!.lockdown || g.player.dead).toBe(true);
  });
});

describe('mercenaries', () => {
  it('a defeated mercenary can be hired and follows between areas', () => {
    const g = game(20);
    g.travelToArea('shore');
    const enemy = g.placeMercEncounter(g.area, true)!;
    expect(enemy.merc).toBeTruthy();
    kill(g, enemy);
    const obj = g.area.interactables.find((i) => i.kind === 'mercenary')!;
    expect(obj.merc?.name).toBe(enemy.merc!.name);
    g.hireMercenary(obj);
    expect(g.char.mercenary?.name).toBe(enemy.merc!.name);
    const comp = () => g.area.monsters.filter((m) => m.merc && m.team === 'player' && !m.dead);
    expect(comp().length).toBe(1);
    g.goToTown();
    expect(comp().length).toBe(1);
    // comes back after dying
    comp()[0].dead = true;
    for (let t = 0; t < 13; t += 0.05) g.update(0.05);
    expect(comp().length).toBe(1);
    g.dismissMercenary();
    expect(comp().length).toBe(0);
    expect(g.char.mercenary).toBeNull();
  });

  it('taking their gear drops loot instead', () => {
    const g = game(20);
    g.travelToArea('shore');
    const enemy = g.placeMercEncounter(g.area, true)!;
    kill(g, enemy);
    const obj = g.area.interactables.find((i) => i.kind === 'mercenary')!;
    const n = g.area.groundItems.length;
    g.lootMercenary(obj);
    expect(g.area.groundItems.length).toBeGreaterThanOrEqual(n + 4);
    expect(g.char.mercenary ?? null).toBeNull();
  });

  it('a ranged mercenary companion damages enemies', () => {
    const g = game(20);
    g.travelToArea('shore');
    g.area.monsters = [];
    g.char.mercenary = { name: '測試', archetype: 'merc_archer' };
    g.goToTown();
    g.travelToArea('shore');
    const merc = g.area.monsters.find((m) => m.merc && m.team === 'player')!;
    g.area.monsters = [merc];
    const enemy = g.placeMercEncounter(g.area, true)!;
    enemy.pos = g.map.nearestFloor({ x: merc.pos.x + 5, y: merc.pos.y });
    enemy.merc = null;
    g.player.pos = { ...merc.pos };
    for (let t = 0; t < 4; t += 1 / 30) {
      g.player.life = g.player.stats.maxLife;
      g.update(1 / 30);
    }
    expect(enemy.life).toBeLessThan(enemy.stats.maxLife);
  });
});
