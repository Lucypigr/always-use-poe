import { describe, expect, it } from 'vitest';
import { dist } from '../src/core/math';
import { newCharacter } from '../src/game/character';
import { Game } from '../src/game/game';
import { DEFAULT_SETTINGS, newAccount } from '../src/game/save';

function setup() {
  const game = new Game(newCharacter('M', 'arcanist'), newAccount(), { ...DEFAULT_SETTINGS });
  game.travelToArea('shore');
  game.area.monsters = [];
  const p = game.player;
  // a walkable goal a few tiles away in a straight line
  let goal = p.pos;
  for (const [dx, dy] of [[6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [-4, -4]]) {
    const g = { x: p.pos.x + dx, y: p.pos.y + dy };
    if (game.map.wideLos(p.pos, g, p.radius)) {
      goal = g;
      break;
    }
  }
  return { game, p, goal };
}

describe('movement feel', () => {
  it('keeps walking (slower) while casting', () => {
    const { game, p, goal } = setup();
    const start = { ...p.pos };
    const uid = game.char.skillBar[1]!;
    let casts = 0;
    for (let i = 0; i < 30; i++) {
      game.input.cursor = { ...goal };
      game.input.moveHeld = true;
      game.input.heldSlot = 1;
      p.mana = p.unreservedMana;
      game.update(1 / 30);
      if (p.action?.skillUid === uid) casts++;
    }
    expect(casts).toBeGreaterThan(0);
    expect(dist(p.pos, start)).toBeGreaterThan(1);
  });

  it('standing still (Shift) roots the hero while casting', () => {
    const { game, p, goal } = setup();
    const start = { ...p.pos };
    for (let i = 0; i < 20; i++) {
      game.input.cursor = { ...goal };
      game.input.moveHeld = true;
      game.input.stand = true;
      game.input.heldSlot = 1;
      p.mana = p.unreservedMana;
      game.update(1 / 30);
    }
    expect(dist(p.pos, start)).toBeLessThan(0.05);
    expect(p.moving).toBe(false);
  });

  it('a click-to-move destination survives a cast', () => {
    const { game, p, goal } = setup();
    game.input.cursor = { ...goal };
    game.input.moveHeld = true;
    game.update(1 / 30);
    game.input.moveHeld = false;
    game.input.heldSlot = 1;
    p.mana = p.unreservedMana;
    game.update(1 / 30);
    game.input.heldSlot = null;
    for (let i = 0; i < 90; i++) game.update(1 / 30);
    expect(dist(p.pos, goal)).toBeLessThan(0.6);
  });

  it('holding the mouse on the hero does not jitter', () => {
    const { game, p } = setup();
    const start = { ...p.pos };
    for (let i = 0; i < 20; i++) {
      game.input.cursor = { x: p.pos.x + 0.1, y: p.pos.y };
      game.input.moveHeld = true;
      game.update(1 / 30);
    }
    expect(dist(p.pos, start)).toBeLessThan(0.05);
  });
});
