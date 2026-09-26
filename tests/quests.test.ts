import { describe, expect, it } from 'vitest';
import { AREA_BY_ID } from '../src/data/areas';
import { CURRENCY_BY_ID } from '../src/data/currency';
import { GEM_BY_ID } from '../src/data/gems';
import { MONSTERS } from '../src/data/monsters';
import { NPC_BY_ID, QUESTS, QUEST_BY_ID } from '../src/data/quests';
import { newCharacter } from '../src/game/character';
import { Game } from '../src/game/game';
import { questBonusMods, questStates, refreshQuests } from '../src/game/quests';
import { DEFAULT_SETTINGS, newAccount } from '../src/game/save';
import { countCurrency } from '../src/items/grid';

const MONSTER_IDS = new Set(MONSTERS.map((m) => m.id));

function newGame() {
  return new Game(newCharacter('Q', 'brute'), newAccount(), { ...DEFAULT_SETTINGS });
}

describe('quest data', () => {
  it('references real areas, NPCs, gems, currency and monsters', () => {
    for (const q of QUESTS) {
      expect(AREA_BY_ID[q.objective.area], q.id).toBeDefined();
      expect(NPC_BY_ID[q.giver], q.id).toBeDefined();
      for (const g of q.reward.gems ?? []) expect(GEM_BY_ID[g], `${q.id}: ${g}`).toBeDefined();
      for (const [c] of q.reward.currency ?? []) expect(CURRENCY_BY_ID[c], `${q.id}: ${c}`).toBeDefined();
      for (const r of q.requires ?? []) expect(QUEST_BY_ID[r], `${q.id}: ${r}`).toBeDefined();
      if (q.objective.kind === 'slay') for (const t of q.objective.targets) expect(MONSTER_IDS.has(t.monster), t.monster).toBe(true);
      if (q.objective.kind === 'boss') expect(AREA_BY_ID[q.objective.area].boss, q.id).toBeDefined();
    }
  });

  it('every story boss has a main quest', () => {
    const bossAreas = QUESTS.filter((q) => q.objective.kind === 'boss').map((q) => q.objective.area);
    for (const a of Object.values(AREA_BY_ID)) if (a.boss) expect(bossAreas, a.id).toContain(a.id);
  });
});

describe('quest progression', () => {
  it('starts with the first quest and puts NPCs in town', () => {
    const game = newGame();
    expect(questStates(game.char).a1_enemy_gate?.s).toBe('active');
    const npcs = game.town.interactables.filter((i) => i.kind === 'npc');
    expect(npcs.length).toBe(5);
    expect(npcs.find((n) => n.npc === 'nessa')?.label).toMatch(/^！/);
    // new characters keep the left button for walking: the starting gem sits on RMB
    expect(game.char.skillBar[0]).toBeNull();
    expect(game.char.skillBar[1]).toBeTruthy();
  });

  it('boss kill → ready → reward with a gem choice → next quests start', () => {
    const game = newGame();
    game.travelToArea('shore');
    const boss = game.area.monsters.find((m) => m.id === game.area.bossId)!;
    boss.life = 0;
    boss.dead = true;
    (game as unknown as { onKill: (m: unknown, s: unknown) => void }).onKill(boss, null);
    expect(questStates(game.char).a1_enemy_gate.s).toBe('ready');
    expect(game.turnInQuest('a1_enemy_gate')).toBe(false); // must pick a gem
    const pick = QUEST_BY_ID.a1_enemy_gate.reward.gems![0];
    expect(game.turnInQuest('a1_enemy_gate', pick)).toBe(true);
    expect(questStates(game.char).a1_enemy_gate.s).toBe('done');
    expect(game.char.inventory.items.some((i) => i.item.gem?.id === pick || i.item.baseId === pick)).toBe(true);
    for (const id of ['a1_mercy', 'a1_dirty_job', 'a1_eggs', 'a1_dweller']) expect(questStates(game.char)[id]?.s, id).toBe('active');
  });

  it('places collectable quest objects and counts them', () => {
    const game = newGame();
    game.char.unlockedAreas.push('mudflats');
    questStates(game.char).a1_enemy_gate = { s: 'done', n: 1 };
    refreshQuests(game.char);
    game.travelToArea('mudflats');
    const objs = game.area.interactables.filter((i) => i.kind === 'quest');
    expect(objs.length).toBe(4); // medicine chest + three rune stones
    for (const o of objs) {
      game.clickInteractable(o);
      game.player.pos = { ...o.pos };
      game.update(1 / 30);
    }
    expect(questStates(game.char).a1_mercy.s).toBe('ready');
    expect(questStates(game.char).a1_eggs.s).toBe('ready');
    const before = countCurrency(game.char.inventory, 'transmute');
    expect(game.turnInQuest('a1_mercy', 'added_fire')).toBe(true);
    expect(countCurrency(game.char.inventory, 'transmute')).toBe(before + 2);
  });

  it('spawns named targets and applies the bandit blessing', () => {
    const game = newGame();
    game.char.unlockedAreas.push('mudflats', 'ashwood', 'old_crypt', 'warrens', 'citadel');
    for (const id of ['a1_enemy_gate', 'a2_intruders', 'a2_sharp_cruel']) questStates(game.char)[id] = { s: 'done', n: 1 };
    refreshQuests(game.char);
    game.travelToArea('citadel');
    const bandits = game.area.monsters.filter((m) => m.questId === 'a2_bandits');
    expect(bandits.map((m) => m.name).sort()).toEqual(['盜匪首領 克雷恩', '盜匪首領 艾菈', '盜匪首領 鐵橡'].sort());
    for (const m of bandits) {
      m.life = 0;
      m.dead = true;
      (game as unknown as { onKill: (m: unknown, s: unknown) => void }).onKill(m, null);
    }
    expect(questStates(game.char).a2_bandits.s).toBe('ready');
    const life = game.player.stats.maxLife;
    expect(game.turnInQuest('a2_bandits', 'oak')).toBe(true);
    expect(questBonusMods(game.char).length).toBeGreaterThan(0);
    expect(game.player.stats.maxLife).toBeGreaterThan(life);
  });

  it('old saves: quests for beaten bosses are ready to hand in', () => {
    const c = newCharacter('Old', 'arcanist');
    delete c.quests;
    c.skillBar = [c.skillBar[1], null, null, null, null, null, null, null];
    c.unlockedAreas = ['shore', 'mudflats'];
    c.completedAreas = ['shore'];
    const game = new Game(c, newAccount(), { ...DEFAULT_SETTINGS });
    expect(questStates(game.char).a1_enemy_gate.s).toBe('ready');
    expect(game.char.skillBar[0]).toBeNull();
    expect(game.char.skillBar[1]).toBeTruthy();
  });
});
