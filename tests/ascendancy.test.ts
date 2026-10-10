import { describe, expect, it } from 'vitest';
import { ASCENDANCIES, ASC_NODE_BY_ID, ascendanciesFor, ascPointsTotal, ascPointsUnspent, ascendancyStats } from '../src/data/ascendancy';
import { CLASSES } from '../src/data/classes';
import { newCharacter } from '../src/game/character';
import { Game } from '../src/game/game';
import { DEFAULT_SETTINGS, newAccount } from '../src/game/save';
import { computeCharacterStats } from '../src/stats/character';

function newGame(classId: 'brute' | 'tracker' = 'brute') {
  const char = newCharacter('A', classId);
  const game = new Game(char, newAccount(), { ...DEFAULT_SETTINGS });
  return { char, game };
}

describe('ascendancy data', () => {
  it('gives every class three ascendancies with 10 well-formed nodes', () => {
    expect(ASCENDANCIES.length).toBe(18);
    for (const c of CLASSES) expect(ascendanciesFor(c.id).length, c.id).toBe(3);
    for (const a of ASCENDANCIES) {
      expect(a.nodes.length).toBe(10);
      expect(a.nodes.filter((n) => !n.requires).length).toBe(1);
      for (const n of a.nodes) {
        expect(n.stats.length).toBeGreaterThan(0);
        expect(n.text.length).toBe(n.stats.length);
        for (const t of n.text) expect(t, `${n.id}: ${t}`).not.toMatch(/undefined|NaN/);
        if (n.requires) expect(ASC_NODE_BY_ID[n.requires]).toBeDefined();
      }
    }
  });
});

describe('ascendancy progress', () => {
  it('needs the first trial, then grants 2 points per trial', () => {
    const { char, game } = newGame();
    expect(game.chooseAscendancy('juggernaut')).toBe(false);
    char.completedAreas.push('ashwood');
    expect(game.chooseAscendancy('deadeye')).toBe(false); // wrong class
    expect(game.chooseAscendancy('juggernaut')).toBe(true);
    expect(game.chooseAscendancy('berserker')).toBe(false); // permanent
    expect(ascPointsTotal(char)).toBe(2);
    char.completedAreas.push('citadel', 'cinder', 'throne');
    expect(ascPointsTotal(char)).toBe(8);
  });

  it('allocates along the tree, spends points and applies stats', () => {
    const { char, game } = newGame();
    char.completedAreas.push('ashwood');
    game.chooseAscendancy('juggernaut');
    const before = computeCharacterStats(char).maxLife;
    expect(game.allocateAscendancy('juggernaut:2')).toBe(false); // parent missing
    expect(game.allocateAscendancy('juggernaut:0')).toBe(true);
    expect(game.allocateAscendancy('juggernaut:1')).toBe(true);
    expect(ascPointsUnspent(char)).toBe(0);
    expect(game.allocateAscendancy('juggernaut:2')).toBe(false); // no points
    expect(computeCharacterStats(char).maxLife).toBeGreaterThan(before);
    expect(ascendancyStats(char).length).toBeGreaterThan(0);
  });

  it('refunds only leaf nodes and costs a refund point', () => {
    const { char, game } = newGame();
    char.completedAreas.push('ashwood');
    game.chooseAscendancy('juggernaut');
    game.allocateAscendancy('juggernaut:0');
    game.allocateAscendancy('juggernaut:1');
    char.refundPoints = 2;
    expect(game.refundAscendancy('juggernaut:0')).toBe(false); // node 1 depends on it
    expect(game.refundAscendancy('juggernaut:1')).toBe(true);
    expect(char.refundPoints).toBe(1);
    expect(ascPointsUnspent(char)).toBe(1);
  });

  it('ignores nodes from another ascendancy in a tampered save', () => {
    const { char } = newGame();
    char.ascendancy = 'juggernaut';
    char.ascNodes = ['berserker:3'];
    expect(ascendancyStats(char)).toEqual([]);
  });
});
