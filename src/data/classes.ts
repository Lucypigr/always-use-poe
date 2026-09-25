export type ClassId = 'brute' | 'tracker' | 'arcanist' | 'blademaster' | 'zealot' | 'nightblade';

export interface ClassDef {
  id: ClassId;
  name: string;
  str: number;
  dex: number;
  int: number;
  /** Angle (degrees) of the class start on the passive tree. 90 = top. */
  treeAngle: number;
  color: string;
  startWeapon: string;
  startGem: string;
  startSupport?: string;
  description: string;
}

export const CLASSES: ClassDef[] = [
  {
    id: 'brute', name: 'Brute', str: 32, dex: 14, int: 14, treeAngle: 210, color: '#b8452f',
    startWeapon: 'one_hand_mace_0', startGem: 'crushing_blow',
    description: 'A hulking warrior of pure Strength. Starts near life, armour and melee passives.',
  },
  {
    id: 'tracker', name: 'Tracker', str: 14, dex: 32, int: 14, treeAngle: 330, color: '#4f9a3b',
    startWeapon: 'bow_0', startGem: 'split_shot',
    description: 'A deadly archer of pure Dexterity. Starts near evasion, projectile and speed passives.',
  },
  {
    id: 'arcanist', name: 'Arcanist', str: 14, dex: 14, int: 32, treeAngle: 90, color: '#4a6fd1',
    startWeapon: 'wand_0', startGem: 'fireball',
    description: 'A wielder of raw Intelligence. Starts near spell, energy shield and minion passives.',
  },
  {
    id: 'blademaster', name: 'Blademaster', str: 23, dex: 23, int: 14, treeAngle: 270, color: '#c4a13a',
    startWeapon: 'one_hand_sword_0', startGem: 'sweeping_cleave',
    description: 'A duelist of Strength and Dexterity. Starts near attack speed, leech and weapon passives.',
  },
  {
    id: 'zealot', name: 'Zealot', str: 23, dex: 14, int: 23, treeAngle: 150, color: '#d9d2b4',
    startWeapon: 'sceptre_0', startGem: 'magma_strike',
    description: 'A holy warrior of Strength and Intelligence. Starts near fire, area and block passives.',
  },
  {
    id: 'nightblade', name: 'Nightblade', str: 14, dex: 23, int: 23, treeAngle: 30, color: '#7a4fa8',
    startWeapon: 'dagger_0', startGem: 'chain_lightning',
    description: 'A cunning killer of Dexterity and Intelligence. Starts near critical strike, cold and chaos passives.',
  },
];

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c])) as Record<ClassId, ClassDef>;
