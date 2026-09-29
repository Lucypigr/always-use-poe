import { describe, expect, it } from 'vitest';
import { GEMS } from '../src/data/gems';
import { BUILDS } from '../src/data/builds';
import { UNIQUE_BY_ID } from '../src/data/uniques';
import { newCharacter } from '../src/game/character';
import { Game } from '../src/game/game';
import { Monster, monsterDef } from '../src/game/monster';
import { DEFAULT_SETTINGS, newAccount } from '../src/game/save';
import { createGem, createItem, createUnique } from '../src/items/generate';

const GEM_IDS = new Set(GEMS.map((g) => g.id));

function gameWith(gemId: string, weaponBase = 'wand_3', supports: string[] = []) {
  const char = newCharacter('B', 'arcanist');
  char.level = 60;
  const w = createItem(weaponBase, 40);
  w.sockets = [gemId, ...supports].map(() => ({ color: 'W' as const, group: 0 }));
  [gemId, ...supports].forEach((id, i) => (w.sockets[i].gem = createGem(id, 10)));
  char.equipment.weapon = w;
  const amulet = createItem('amulet_onyx', 40);
  amulet.implicits[0].values = [300];
  char.equipment.amulet = amulet;
  const game = new Game(char, newAccount(), { ...DEFAULT_SETTINGS });
  game.travelToArea('shore');
  game.area.monsters = [];
  return { game, uid: w.sockets[0].gem!.uid };
}

function enemy(game: Game, dx: number, rarity: 'normal' | 'rare' = 'normal') {
  const p = game.player;
  const m = new Monster(monsterDef('drowned'), 20, rarity, game.map.nearestFloor({ x: p.pos.x + dx, y: p.pos.y }), 'enemy', game.rng);
  game.area.monsters.push(m);
  return m;
}

describe('build guide', () => {
  it('references real gems and uniques', () => {
    for (const b of BUILDS) {
      for (const g of [b.skill, ...b.supports, ...(b.extra ?? [])]) expect(GEM_IDS.has(g), `${b.id}: ${g}`).toBe(true);
      for (const u of b.uniques) expect(UNIQUE_BY_ID[u], `${b.id}: ${u}`).toBeDefined();
    }
  });
});

describe('build mechanics', () => {
  it('Righteous Fire burns nearby enemies and the caster', () => {
    const { game, uid } = gameWith('righteous_fire');
    const m = enemy(game, 1.5);
    game.toggleAura(uid);
    expect(game.char.activeAuras).toContain(uid);
    const p = game.player;
    const life0 = p.life + p.es;
    const mLife = m.life;
    for (let i = 0; i < 30; i++) game.update(1 / 30);
    expect(m.life).toBeLessThan(mLife);
    expect(p.life + p.es).toBeLessThan(life0);
  });

  it('Raging spirits are temporary and capped per skill', () => {
    const { game, uid } = gameWith('raging_spirits');
    const g = game as unknown as { summonMinions: (u: string) => void };
    for (let i = 0; i < 20; i++) g.summonMinions(uid);
    const spirits = () => game.area.monsters.filter((m) => m.isMinion && !m.dead);
    expect(spirits().length).toBe(12);
    expect(spirits()[0].def.id).toBe('raging_spirit');
    for (let t = 0; t < 7; t += 1 / 30) game.update(1 / 30);
    expect(spirits().length).toBe(0);
  });

  it('Flicker Strike teleports to an enemy', () => {
    const { game, uid } = gameWith('flicker_strike', 'one_hand_sword_3');
    const m = enemy(game, 6);
    game.char.skillBar[1] = uid;
    const start = { ...game.player.pos };
    for (let i = 0; i < 20; i++) {
      game.input.cursor = { ...m.pos };
      game.input.hoverMonster = m;
      game.input.heldSlot = 1;
      game.player.mana = game.player.unreservedMana;
      game.update(1 / 30);
    }
    expect(Math.hypot(game.player.pos.x - start.x, game.player.pos.y - start.y)).toBeGreaterThan(3);
    expect(m.life).toBeLessThan(m.stats.maxLife);
  });

  it('Swift Affliction shortens ailments', () => {
    const plain = gameWith('essence_drain');
    const swift = gameWith('essence_drain', 'wand_3', ['swift_affliction']);
    expect(swift.game.player.skillStats.get(swift.uid)!.ailmentDur).toBeCloseTo(0.7);
    expect(plain.game.player.skillStats.get(plain.uid)!.ailmentDur).toBe(1);
  });

  it("Headhunter steals a rare monster's modifiers", () => {
    const { game } = gameWith('fireball');
    game.char.equipment.belt = createUnique(UNIQUE_BY_ID.headhunter, 60);
    game.recalc();
    const m = enemy(game, 2, 'rare');
    m.life = 0;
    m.dead = true;
    (game as unknown as { onKill: (m: Monster, s: null) => void }).onKill(m, null);
    expect(game.player.buffs.some((b) => b.id.startsWith('hh:'))).toBe(true);
  });

  it("Kaom's Heart has no sockets", () => {
    expect(createUnique(UNIQUE_BY_ID.kaoms_heart, 60).sockets.length).toBe(0);
  });
});
