import { describe, expect, it } from 'vitest';
import { RNG } from '../src/core/rng';
import { PASSIVE_TREE, canRefund, pathToNode } from '../src/data/passives';
import { newCharacter } from '../src/game/character';
import { armourReduction, chanceToHit } from '../src/game/combat';
import { createGem, createItem } from '../src/items/generate';
import { computeCharacterStats } from '../src/stats/character';
import { StatSheet, flat, inc, more } from '../src/stats/stats';
import { computeSkillStats, resolveSkills } from '../src/skills/skills';

describe('stat sheet', () => {
  it('uses (base + flat) × (1 + Σinc) × Π more', () => {
    const s = new StatSheet([flat('life', 50), inc('life', 20), inc('life', 30), more('life', 10), more('life', 20)]);
    expect(s.calc('life', 50)).toBeCloseTo(100 * 1.5 * 1.1 * 1.2);
  });
});

describe('character stats', () => {
  it('attributes grant life/mana bonuses', () => {
    const c = newCharacter('Test', 'brute');
    const s = computeCharacterStats(c);
    expect(s.str).toBe(32);
    expect(s.maxLife).toBe(38 + 12 + Math.floor(32 / 2));
    expect(s.maxMana).toBe(34 + 6 + Math.floor(14 / 2));
  });

  it('resistances are capped and penalised', () => {
    const c = newCharacter('Test', 'arcanist');
    const ring = createItem('ring_ruby', 10);
    ring.implicits[0].values = [30];
    c.equipment.ring1 = ring;
    const ring2 = createItem('ring_ruby', 10);
    ring2.implicits[0].values = [60];
    c.equipment.ring2 = ring2;
    expect(computeCharacterStats(c).res.fire).toBe(75);
    expect(computeCharacterStats(c, [], -60).res.fire).toBe(30);
  });

  it('keystones change stats', () => {
    const c = newCharacter('Test', 'arcanist');
    const hv = PASSIVE_TREE.nodes.find((n) => n.name === 'Hollow Vessel')!;
    c.passives.push(hv.id);
    const s = computeCharacterStats(c);
    expect(s.maxLife).toBe(1);
    expect(s.chaosImmune).toBe(true);
  });
});

describe('skills and supports', () => {
  it('linked supports modify the active skill; unlinked ones do not', () => {
    const c = newCharacter('Test', 'tracker');
    const wand = c.equipment.weapon!;
    const fireball = wand.sockets[0].gem!;
    const stats0 = computeCharacterStats(c);
    const before = computeSkillStats(resolveSkills(c, stats0).get(fireball.uid)!, stats0);

    wand.sockets[1].gem = createGem('lesser_volley');
    wand.sockets[1].group = wand.sockets[0].group;
    c.level = 10;
    const stats1 = computeCharacterStats(c);
    const skill = resolveSkills(c, stats1).get(fireball.uid)!;
    expect(skill.supports.map((s) => s.def.id)).toEqual(['lesser_volley']);
    const after = computeSkillStats(skill, stats1);
    expect(after.projectiles).toBe(before.projectiles + 2);
    expect(after.manaCost).toBeGreaterThan(before.manaCost);

    wand.sockets[1].group = wand.sockets[0].group + 1;
    const unlinked = resolveSkills(c, stats1).get(fireball.uid)!;
    expect(unlinked.supports.length).toBe(0);
  });

  it('supports only apply to skills with matching tags', () => {
    const c = newCharacter('Test', 'brute');
    c.level = 30;
    const mace = c.equipment.weapon!;
    mace.sockets[1].gem = createGem('lesser_volley');
    mace.sockets[1].group = mace.sockets[0].group;
    const stats = computeCharacterStats(c);
    const skill = resolveSkills(c, stats).get(mace.sockets[0].gem!.uid)!;
    expect(skill.supports.length).toBe(0);
  });

  it('bow skills require a bow', () => {
    const c = newCharacter('Test', 'brute');
    c.equipment.weapon!.sockets[1].gem = createGem('split_shot');
    const stats = computeCharacterStats(c);
    const skill = resolveSkills(c, stats).get(c.equipment.weapon!.sockets[1].gem!.uid)!;
    expect(skill.usable).toBe(false);
  });

  it('spells scale with gem level', () => {
    const c = newCharacter('Test', 'arcanist');
    c.level = 70;
    const gem = c.equipment.weapon!.sockets[0].gem!;
    const stats = computeCharacterStats(c);
    const l1 = computeSkillStats(resolveSkills(c, stats).get(gem.uid)!, stats).averageHit;
    gem.gem!.level = 20;
    const l20 = computeSkillStats(resolveSkills(c, stats).get(gem.uid)!, stats).averageHit;
    expect(l20).toBeGreaterThan(l1 * 20);
  });
});

describe('combat formulas', () => {
  it('armour is better against small hits', () => {
    expect(armourReduction(1000, 100)).toBeCloseTo(1000 / 1500);
    expect(armourReduction(1000, 10000)).toBeLessThan(0.05);
    expect(armourReduction(1e9, 1)).toBe(0.9);
  });
  it('chance to hit is clamped between 5% and 100%', () => {
    expect(chanceToHit(1000, 0)).toBe(1);
    expect(chanceToHit(1, 1e6)).toBe(0.05);
    const c = chanceToHit(500, 10000);
    expect(c).toBeGreaterThan(0.3);
    expect(c).toBeLessThan(1);
  });
});

describe('passive tree', () => {
  it('every node is reachable from every class start', () => {
    const start = PASSIVE_TREE.startOf.brute;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      for (const nb of PASSIVE_TREE.byId.get(stack.pop()!)!.links) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    expect(seen.size).toBe(PASSIVE_TREE.nodes.length);
    expect(PASSIVE_TREE.nodes.length).toBeGreaterThan(350);
  });

  it('allocation paths and refunds preserve connectivity', () => {
    const start = PASSIVE_TREE.startOf.arcanist;
    const target = PASSIVE_TREE.nodes.find((n) => n.kind === 'keystone' && n.name === 'Arcane Ward')!;
    const allocated = new Set([start]);
    const path = pathToNode(PASSIVE_TREE, allocated, target.id)!;
    expect(path.length).toBeGreaterThan(3);
    for (const id of path) allocated.add(id);
    expect(canRefund(PASSIVE_TREE, allocated, target.id, start)).toBe(true);
    expect(canRefund(PASSIVE_TREE, allocated, path[0], start)).toBe(false);
  });

  it('is deterministic', () => {
    const r = new RNG(1);
    expect(r.next()).toBe(new RNG(1).next());
    expect(PASSIVE_TREE.nodes[100].name).toBe(PASSIVE_TREE.nodes[100].name);
  });
});
