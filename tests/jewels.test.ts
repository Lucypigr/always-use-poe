import { describe, expect, it } from 'vitest';
import { RNG } from '../src/core/rng';
import { UNIQUES } from '../src/data/uniques';
import { PASSIVE_TREE, JEWEL_SOCKETS } from '../src/data/passives';
import { newCharacter } from '../src/game/character';
import { Game } from '../src/game/game';
import { rollDrops } from '../src/game/loot';
import { DEFAULT_SETTINGS, newAccount } from '../src/game/save';
import { addItem } from '../src/items/grid';
import { createItem, createUnique, randomJewel } from '../src/items/generate';
import { explicitMods, globalItemStats, isJewel } from '../src/items/item';
import { buildTooltip } from '../src/items/tooltip';
import { computeCharacterStats } from '../src/stats/character';

function setup() {
  const char = newCharacter('J', 'brute');
  const game = new Game(char, newAccount(), { ...DEFAULT_SETTINGS });
  const socket = PASSIVE_TREE.nodes.find((n) => n.kind === 'jewel')!;
  return { char, game, socket };
}

function lifeJewel() {
  const j = createItem('jewel_red', 60, 'normal');
  j.rarity = 'magic';
  j.prefixes = [{ id: 'jw_life', tier: 2, values: [8] }];
  return j;
}

describe('jewel items', () => {
  it('generates magic / rare jewels from the jewel affix pool with the right limits', () => {
    const r = new RNG(7);
    for (let i = 0; i < 60; i++) {
      const j = createItem(['jewel_red', 'jewel_green', 'jewel_blue'][i % 3], 70, i % 2 ? 'rare' : 'magic', r);
      expect(isJewel(j)).toBe(true);
      expect(j.sockets.length).toBe(0);
      expect(j.prefixes.length).toBeLessThanOrEqual(i % 2 ? 2 : 1);
      expect(j.suffixes.length).toBeLessThanOrEqual(i % 2 ? 2 : 1);
      expect(explicitMods(j).length).toBeGreaterThan(0);
      for (const m of explicitMods(j)) expect(m.id.startsWith('jw_')).toBe(true);
      expect(buildTooltip(j).sections.length).toBeGreaterThan(0);
    }
  });

  it('has jewel uniques that roll and drop from monsters', () => {
    const uniques = UNIQUES.filter((u) => u.base.startsWith('jewel_'));
    expect(uniques.length).toBeGreaterThanOrEqual(5);
    for (const u of uniques) expect(globalItemStats(createUnique(u, 60)).length).toBeGreaterThan(0);
    const r = new RNG(3);
    let jewels = 0;
    for (let i = 0; i < 600; i++) {
      if (randomJewel(60, r) && rollDrops('rare', { areaLevel: 60, itemQuantity: 0, itemRarity: 0, isBoss: false }, r).some(isJewel)) jewels++;
    }
    expect(jewels).toBeGreaterThan(0);
  });
});

describe('jewel sockets', () => {
  it('adds sockets to the end of the tree without moving other nodes', () => {
    const sockets = PASSIVE_TREE.nodes.filter((n) => n.kind === 'jewel');
    expect(sockets.length).toBe(JEWEL_SOCKETS);
    const firstId = Math.min(...sockets.map((n) => n.id));
    expect(PASSIVE_TREE.nodes.slice(firstId).every((n) => n.kind === 'jewel')).toBe(true);
    for (const s of sockets) expect(s.links.length).toBe(1);
  });

  it('applies a socketed jewel only while its socket is allocated', () => {
    const { char, game, socket } = setup();
    char.level = 80;
    const jewel = lifeJewel();
    addItem(char.inventory, jewel);
    expect(game.socketJewel(socket.id, jewel)).toBe(false); // not allocated yet
    expect(game.allocatePassive(socket.id)).toBe(true);
    const before = computeCharacterStats(char).maxLife;
    expect(game.socketJewel(socket.id, jewel)).toBe(true);
    expect(char.inventory.items.some((e) => e.item === jewel)).toBe(false);
    expect(computeCharacterStats(char).maxLife).toBeGreaterThan(before);
    // can't refund a socket that still holds a jewel
    char.refundPoints = 1;
    expect(game.refundPassive(socket.id)).toBe(false);
    expect(game.unsocketJewel(socket.id)).toBe(true);
    expect(computeCharacterStats(char).maxLife).toBe(before);
    expect(char.inventory.items.some((e) => e.item === jewel)).toBe(true);
    expect(game.refundPassive(socket.id)).toBe(true);
  });

  it('swaps jewels and rejects non-jewels', () => {
    const { char, game, socket } = setup();
    char.level = 80;
    game.allocatePassive(socket.id);
    const a = lifeJewel();
    const b = lifeJewel();
    addItem(char.inventory, a);
    addItem(char.inventory, b);
    expect(game.socketJewel(socket.id, a)).toBe(true);
    expect(game.socketJewel(socket.id, b)).toBe(true);
    expect(char.jewels![socket.id]).toBe(b);
    expect(char.inventory.items.some((e) => e.item === a)).toBe(true);
    const sword = createItem('one_hand_sword_0', 1);
    addItem(char.inventory, sword);
    expect(game.socketJewel(socket.id, sword)).toBe(false);
  });

  it('ignores jewels in sockets that are not allocated (tampered save)', () => {
    const { char, socket } = setup();
    char.jewels = { [socket.id]: lifeJewel() };
    const base = computeCharacterStats(newCharacter('J', 'brute')).maxLife;
    expect(computeCharacterStats(char).maxLife).toBe(base);
  });
});
