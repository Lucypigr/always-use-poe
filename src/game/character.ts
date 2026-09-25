import { uid } from '../core/rng';
import { CLASS_BY_ID, type ClassId } from '../data/classes';
import { PASSIVE_TREE } from '../data/passives';
import { createCurrency, createGem, createItem } from '../items/generate';
import { addItem, newGrid, type Grid } from '../items/grid';
import type { EquipSlot, Item } from '../items/types';
import type { QuestState } from './quests';

export const INV_W = 12;
export const INV_H = 5;
export const SKILL_SLOTS = 8;
/** Slot 0 is on the space bar: the left mouse button only moves / picks up / talks. */
export const SKILL_KEYS = ['空白', 'RMB', 'Q', 'W', 'E', 'R', 'T', 'MMB'] as const;

/** Persistent character state (serialised to the save file). */
export interface CharacterData {
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  equipment: Partial<Record<EquipSlot, Item>>;
  inventory: Grid;
  passives: number[];
  refundPoints: number;
  bonusPassivePoints: number;
  /** Skill bar: gem uid per slot, or 'default_attack'. */
  skillBar: (string | null)[];
  /** Aura gem uids that are toggled on. */
  activeAuras: string[];
  unlockedAreas: string[];
  completedAreas: string[];
  deaths: number;
  playTime: number;
  created: number;
  /** Story quest progress by quest id (missing on saves from before the story). */
  quests?: Record<string, QuestState>;
  /** The prologue has been shown. */
  storySeen?: boolean;
}

export function newCharacter(name: string, classId: ClassId): CharacterData {
  const cls = CLASS_BY_ID[classId];
  const weapon = createItem(cls.startWeapon, 1);
  // Starter weapons always have a linked pair so new players can try supports.
  weapon.sockets = [
    { color: weapon.sockets[0]?.color ?? 'R', group: 0 },
    { color: weapon.sockets[1]?.color ?? 'G', group: 0 },
  ];
  const gem = createGem(cls.startGem);
  weapon.sockets[0].gem = gem;
  const char: CharacterData = {
    id: uid('c'),
    name,
    classId,
    level: 1,
    xp: 0,
    equipment: { weapon },
    inventory: newGrid(INV_W, INV_H),
    passives: [PASSIVE_TREE.startOf[classId]],
    refundPoints: 0,
    bonusPassivePoints: 0,
    skillBar: [null, gem.uid, null, null, null, null, null, null],
    activeAuras: [],
    unlockedAreas: ['shore'],
    completedAreas: [],
    deaths: 0,
    playTime: 0,
    created: Date.now(),
    quests: {},
  };
  const lifeFlask = createItem('life_flask_0', 1);
  const lifeFlask2 = createItem('life_flask_0', 1);
  const manaFlask = createItem('mana_flask_0', 1);
  char.equipment.flask1 = lifeFlask;
  char.equipment.flask2 = lifeFlask2;
  char.equipment.flask3 = manaFlask;
  if (classId === 'tracker') char.equipment.offhand = createItem('quiver_hunter', 1);
  addItem(char.inventory, createCurrency('identify', 5));
  addItem(char.inventory, createCurrency('portal', 3));
  return char;
}

export function passivePointsTotal(c: CharacterData): number {
  return c.level - 1 + c.bonusPassivePoints;
}

export function passivePointsUnspent(c: CharacterData): number {
  return passivePointsTotal(c) - (c.passives.length - 1);
}

/** All gem items socketed in equipped gear. */
export function equippedGems(c: CharacterData): { gem: Item; host: Item; slot: EquipSlot; socket: number }[] {
  const out: { gem: Item; host: Item; slot: EquipSlot; socket: number }[] = [];
  for (const [slot, item] of Object.entries(c.equipment) as [EquipSlot, Item][]) {
    if (!item) continue;
    item.sockets.forEach((s, i) => {
      if (s.gem) out.push({ gem: s.gem, host: item, slot, socket: i });
    });
  }
  return out;
}
