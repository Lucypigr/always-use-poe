import { describe, expect, it } from 'vitest';
import { RNG } from '../src/core/rng';
import { CURRENCY, CURRENCY_BY_ID } from '../src/data/currency';
import { ESSENCES } from '../src/data/essences';
import { JEWEL_RADIUS, CLUSTER_SIZES } from '../src/data/jewels';
import { PASSIVE_TREE } from '../src/data/passives';
import { UNIQUE_BY_ID } from '../src/data/uniques';
import { newCharacter } from '../src/game/character';
import { Game } from '../src/game/game';
import { DEFAULT_SETTINGS, newAccount } from '../src/game/save';
import { vendorStock } from '../src/game/vendor';
import { addItem } from '../src/items/grid';
import { applyCurrency, canApply } from '../src/items/craft';
import { createItem, createUnique, randomJewel } from '../src/items/generate';
import { allRolls, clusterContents, explicitMods, isAbyssJewel, isJewel } from '../src/items/item';
import { buildTooltip } from '../src/items/tooltip';
import { computeCharacterStats } from '../src/stats/character';
import { getMod } from '../src/data/affixes';

function setup() {
  const char = newCharacter('J', 'brute');
  char.level = 80;
  const game = new Game(char, newAccount(), { ...DEFAULT_SETTINGS });
  return { char, game };
}

describe('essences', () => {
  it('are registered as currency', () => {
    expect(ESSENCES.length).toBe(36);
    for (const e of ESSENCES) expect(CURRENCY_BY_ID[e.id]).toBeDefined();
    expect(CURRENCY.length).toBeGreaterThan(50);
  });

  it('turn a normal item into a rare with the guaranteed mod, at a higher tier for stronger essences', () => {
    const r = new RNG(11);
    const tierOf = (id: string) => {
      const it = createItem('helmet_str_3', 80, 'normal', r);
      expect(canApply(id as never, it).ok).toBe(true);
      expect(applyCurrency(id as never, it, r).ok).toBe(true);
      expect(it.rarity).toBe('rare');
      expect(explicitMods(it).length).toBeGreaterThanOrEqual(3);
      const roll = explicitMods(it).find((m) => m.id === 'life')!;
      expect(roll).toBeDefined();
      return roll.tier;
    };
    expect(tierOf('ess_life_3')).toBeGreaterThan(tierOf('ess_life_1'));
  });

  it('refuse non-normal, corrupted and unsuitable items', () => {
    const r = new RNG(5);
    const magic = createItem('helmet_str_0', 20, 'magic', r);
    expect(canApply('ess_life_1' as never, magic).ok).toBe(false);
    const flask = createItem('life_flask_0', 10);
    expect(canApply('ess_life_1' as never, flask).ok).toBe(false);
    const jewel = createItem('jewel_red', 50);
    expect(canApply('ess_life_1' as never, jewel).ok).toBe(false); // no life mod on jewels
  });
});

describe('radius jewels', () => {
  it('boost allocated small passives around the socket only', () => {
    const { char, game } = setup();
    const socket = PASSIVE_TREE.nodes.find((n) => n.kind === 'jewel')!;
    expect(game.allocatePassive(socket.id)).toBe(true);
    const baseLife = computeCharacterStats(char).maxLife;
    const j = createUnique(UNIQUE_BY_ID.wide_eye, 60);
    j.prefixes[0].values = [60];
    addItem(char.inventory, j);
    game.socketJewel(socket.id, j);
    const plain = computeCharacterStats(char).maxLife;
    expect(plain).toBeGreaterThanOrEqual(baseLife);
    // allocate nodes near the socket, then compare with / without the jewel
    const near = PASSIVE_TREE.nodes.filter((n) => n.kind === 'attr' && Math.hypot(n.x - socket.x, n.y - socket.y) <= JEWEL_RADIUS);
    expect(near.length).toBeGreaterThan(0);
    for (const n of near.slice(0, 3)) char.passives.push(n.id);
    const withJewel = computeCharacterStats(char);
    const jr = char.jewels![socket.id];
    jr.prefixes[0] = { id: 'jr_attr', tier: 0, values: [100] };
    const attr = computeCharacterStats(char);
    expect(attr.str + attr.dex + attr.int).toBeGreaterThan(withJewel.str + withJewel.dex + withJewel.int);
  });
});

describe('cluster jewels', () => {
  it('roll a theme with the right number of notables and apply their stats', () => {
    const r = new RNG(9);
    for (const id of Object.keys(CLUSTER_SIZES)) {
      const j = createItem(id, 70, 'normal', r);
      expect(isJewel(j)).toBe(true);
      expect(j.cluster!.notables.length).toBe(CLUSTER_SIZES[id].notables);
      expect(clusterContents(j).length).toBe(1 + CLUSTER_SIZES[id].notables);
      expect(buildTooltip(j).sections.length).toBeGreaterThan(2);
      expect(canApply('chaos', j).ok).toBe(false);
    }
    const { char, game } = setup();
    const socket = PASSIVE_TREE.nodes.find((n) => n.kind === 'jewel')!;
    game.allocatePassive(socket.id);
    const j = createItem('jewel_cluster_l', 70);
    j.cluster = { theme: 'vitality', notables: ['勃發生機', '血脈沸騰', '堅毅之心'] };
    addItem(char.inventory, j);
    const before = computeCharacterStats(char).maxLife;
    expect(game.socketJewel(socket.id, j)).toBe(true);
    expect(computeCharacterStats(char).maxLife).toBeGreaterThan(before * 1.2);
  });
});

describe('abyss jewels', () => {
  it('roll abyss affixes and socket into abyssal sockets of equipped gear', () => {
    const r = new RNG(21);
    for (let i = 0; i < 30; i++) {
      const j = createItem('abyss_jewel', 70, i % 2 ? 'rare' : 'magic', r);
      expect(isAbyssJewel(j)).toBe(true);
      expect(isJewel(j)).toBe(false);
      for (const m of explicitMods(j)) expect(m.id.startsWith('ab_')).toBe(true);
      expect(allRolls(j).length).toBeGreaterThan(0);
    }
    const { char, game } = setup();
    const helmet = createItem('helmet_str_0', 30);
    helmet.abyss = [null];
    char.equipment.helmet = helmet;
    const j = createItem('abyss_jewel', 70);
    j.rarity = 'magic';
    j.prefixes = [{ id: 'ab_life', tier: 2, values: [50] }];
    addItem(char.inventory, j);
    const before = computeCharacterStats(char).maxLife;
    expect(game.socketAbyss(helmet, 0, j)).toBe(true);
    expect(computeCharacterStats(char).maxLife).toBe(before + 50);
    expect(buildTooltip(helmet).sections.flat().some((l) => l.text.includes('深淵插槽'))).toBe(true);
    expect(game.unsocketAbyss(helmet, 0)).toBe(true);
    expect(computeCharacterStats(char).maxLife).toBe(before);
    expect(game.socketAbyss(createItem('helmet_str_0', 30), 0, j)).toBe(false); // not equipped
  });

  it('only some gear rolls abyssal sockets', () => {
    let withAbyss = 0;
    for (let i = 0; i < 400; i++) if (createItem('body_armour_str_0', 30).abyss) withAbyss++;
    expect(withAbyss).toBeGreaterThan(5);
    expect(withAbyss).toBeLessThan(120);
    expect(createItem('one_hand_sword_0', 30).abyss).toBeUndefined();
  });
});

describe('jewel supply', () => {
  it('drops all kinds and sells magic jewels at the vendor', () => {
    const r = new RNG(2);
    const kinds = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const j = randomJewel(70, r);
      kinds.add(j.cluster ? 'cluster' : j.baseId === 'abyss_jewel' ? 'abyss' : j.rarity === 'unique' ? 'unique' : 'tree');
    }
    expect([...kinds].sort()).toEqual(['abyss', 'cluster', 'tree', 'unique']);
    const stock = vendorStock(30, r);
    expect(stock.filter((o) => o.item.baseId.startsWith('jewel_')).length).toBe(3);
    expect(stock.some((o) => o.item.baseId === 'abyss_jewel')).toBe(true);
    expect(getMod('jr_small')).toBeDefined();
  });
});
