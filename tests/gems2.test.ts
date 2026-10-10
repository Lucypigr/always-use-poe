import { describe, expect, it } from 'vitest';
import { GEMS } from '../src/data/gems';
import { GEMS_2 } from '../src/data/gems2';
import { MONSTER_BY_ID } from '../src/data/monsters';
import { newCharacter } from '../src/game/character';
import { Game } from '../src/game/game';
import { Monster, monsterDef } from '../src/game/monster';
import { DEFAULT_SETTINGS, newAccount } from '../src/game/save';
import { createGem, createItem } from '../src/items/generate';

function setup(gemId: string, weaponBase: string) {
  const char = newCharacter('G', 'arcanist');
  char.level = 60;
  const w = createItem(weaponBase, 40);
  w.sockets = [{ color: 'W' as const, group: 0 }];
  w.sockets[0].gem = createGem(gemId, 10);
  char.equipment.weapon = w;
  const amulet = createItem('amulet_onyx', 40);
  amulet.implicits[0].values = [300];
  char.equipment.amulet = amulet;
  const game = new Game(char, newAccount(), { ...DEFAULT_SETTINGS });
  game.travelToArea('shore');
  game.area.monsters = [];
  return { game, uid: w.sockets[0].gem!.uid };
}

describe('second batch of active gems', () => {
  it('adds new, uniquely identified active skills', () => {
    expect(GEMS_2.length).toBeGreaterThanOrEqual(25);
    const ids = new Set(GEMS.map((g) => g.id));
    expect(ids.size).toBe(GEMS.length);
    for (const g of GEMS_2) {
      expect(g.active).toBeDefined();
      expect(g.name).toBeTruthy();
      expect(g.active!.levelText!(10).every((t) => !/undefined|NaN/.test(t)), g.id).toBe(true);
      if (g.active!.minion) expect(MONSTER_BY_ID[g.active!.minion!], g.id).toBeDefined();
    }
  });

  for (const g of GEMS_2) {
    it(`${g.id} can be cast in a real game`, () => {
      const a = g.active!;
      const weapon = a.weapons?.includes('bow') ? 'bow_3' : a.weaponDamage ? 'one_hand_sword_3' : 'wand_3';
      const { game, uid } = setup(g.id, weapon);
      expect(game.player.skills.get(uid)).toBeDefined();
      if (a.behaviour === 'summon') {
        (game as unknown as { summonMinions: (u: string) => void }).summonMinions(uid);
        const minion = game.area.monsters.find((m) => m.isMinion && !m.dead);
        expect(minion?.def.id).toBe(a.minion);
        return;
      }
      const p = game.player;
      const m = new Monster(monsterDef('drowned'), 20, 'normal', game.map.nearestFloor({ x: p.pos.x + 3, y: p.pos.y }), 'enemy', game.rng);
      m.life = m.stats.maxLife = 1e7;
      game.area.monsters.push(m);
      game.char.skillBar[1] = uid;
      const start = { ...p.pos };
      for (let i = 0; i < 90; i++) {
        game.input.cursor = { ...m.pos };
        game.input.hoverMonster = m;
        game.input.heldSlot = 1;
        p.mana = p.unreservedMana;
        game.update(1 / 30);
      }
      const moved = Math.hypot(p.pos.x - start.x, p.pos.y - start.y) > 1.5;
      if (a.behaviour === 'blink') expect(moved).toBe(true);
      else expect(m.life, g.id).toBeLessThan(m.stats.maxLife);
    });
  }
});
