import { describe, expect, it } from 'vitest';
import { dist } from '../src/core/math';
import { AREAS } from '../src/data/areas';
import { newCharacter } from '../src/game/character';
import { Game } from '../src/game/game';
import { createMap } from '../src/items/generate';
import { newAccount, DEFAULT_SETTINGS } from '../src/game/save';
import { generateArea } from '../src/game/mapgen';
import { RNG } from '../src/core/rng';
import { findPath } from '../src/game/path';
import type { ClassId } from '../src/data/classes';

/** A tiny bot: walks toward the nearest monster and uses the first skill. */
function botStep(game: Game): void {
  const p = game.player;
  const targets = game.area.monsters.filter((m) => !m.dead && m.team === 'enemy');
  targets.sort((a, b) => dist(a.pos, p.pos) - dist(b.pos, p.pos));
  const t = targets[0];
  if (!t) {
    game.input.heldSlot = null;
    game.input.moveHeld = false;
    return;
  }
  game.input.cursor = { ...t.pos };
  game.input.hoverMonster = t;
  game.input.heldSlot = 0;
  game.input.moveHeld = false;
  // Use the class's main skill (slot 0) — if it's ranged and out of range, walk closer first
  if (dist(p.pos, t.pos) > 7) {
    game.input.heldSlot = null;
    game.input.moveHeld = true;
  }
  if (p.life < p.stats.maxLife * 0.5) game.drinkFlask(p.buffs.length % 2);
  if (p.mana < 12) game.drinkFlask(2);
}

function simulate(classId: ClassId, seconds: number) {
  const char = newCharacter('Bot', classId);
  const game = new Game(char, newAccount(), { ...DEFAULT_SETTINGS });
  game.travelToArea('shore');
  const startMonsters = game.area.monsters.length;
  const dt = 1 / 30;
  for (let t = 0; t < seconds; t += dt) {
    if (game.player.dead) game.respawn(), game.travelToArea('shore');
    botStep(game);
    game.update(dt);
    game.vfxQueue.length = 0;
  }
  return { game, startMonsters };
}

describe('game simulation', () => {
  for (const cls of ['brute', 'tracker', 'arcanist', 'blademaster', 'zealot', 'nightblade'] as ClassId[]) {
    it(`${cls} can fight, gain experience and find loot`, () => {
      const { game, startMonsters } = simulate(cls, 90);
      expect(startMonsters).toBeGreaterThan(30);
      console.log(`${cls}: kills=${game.kills} level=${game.char.level} deaths=${game.char.deaths} items=${game.area.groundItems.length}`);
      expect(game.kills).toBeGreaterThan(3);
      expect(game.char.xp + (game.char.level - 1) * 1000).toBeGreaterThan(0);
      expect(game.area.groundItems.length + game.char.inventory.items.length).toBeGreaterThan(0);
    });
  }

  it('every area generates a connected, populated map', () => {
    const rng = new RNG(7);
    for (const a of AREAS) {
      const map = generateArea(a.theme, a.size, a.packs, rng);
      expect(map.walkable(map.spawn.x, map.spawn.y)).toBe(true);
      expect(map.packSpots.length).toBeGreaterThan(a.packs * 0.5);
      const path = findPath(map, map.spawn, map.bossPos, 0.4, 100000);
      expect(path).not.toBeNull();
      expect(dist(map.spawn, map.bossPos)).toBeGreaterThan(20);
    }
  });

  it('portals return to the same instance', () => {
    const game = new Game(newCharacter('P', 'brute'), newAccount(), { ...DEFAULT_SETTINGS });
    game.travelToArea('shore');
    const inst = game.area;
    game.addXp(0);
    game.char.inventory.items.length; // has 3 portal scrolls
    expect(game.usePortalScroll()).toBe(true);
    const portal = game.area.interactables.find((i) => i.kind === 'town_portal')!;
    game.clickInteractable(portal);
    for (let i = 0; i < 120 && !game.area.town; i++) game.update(1 / 30);
    expect(game.area.town).toBe(true);
    const back = game.area.interactables.find((i) => i.kind === 'area_portal')!;
    expect(back).toBeTruthy();
    game.clickInteractable(back);
    for (let i = 0; i < 300 && game.area.town; i++) game.update(1 / 30);
    expect(game.area).toBe(inst);
  });

  it('maps can be opened and carry their modifiers', () => {
    const game = new Game(newCharacter('M', 'arcanist'), newAccount(), { ...DEFAULT_SETTINGS });
    const map = createMap(3);
    map.rarity = 'magic';
    map.prefixes = [{ id: 'map_life', tier: 0, values: [35] }];
    map.suffixes = [{ id: 'map_exposure', tier: 0, values: [15] }];
    expect(game.openMap(map)).toBe(true);
    expect(game.area.level).toBe(46);
    expect(game.area.quant).toBeGreaterThan(0);
    expect(game.player.cstats.sheet.flat('all_ele_res')).toBe(-15);
    expect(game.area.monsters.some((m) => m.def.boss)).toBe(true);
  });
});
