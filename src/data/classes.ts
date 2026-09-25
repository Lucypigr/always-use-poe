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
    id: 'brute', name: '蠻兵', str: 32, dex: 14, int: 14, treeAngle: 210, color: '#b8452f',
    startWeapon: 'one_hand_mace_0', startGem: 'crushing_blow',
    description: '純力量的魁梧戰士。起點鄰近生命、護甲與近戰天賦。',
  },
  {
    id: 'tracker', name: '追獵者', str: 14, dex: 32, int: 14, treeAngle: 330, color: '#4f9a3b',
    startWeapon: 'bow_0', startGem: 'split_shot',
    description: '純敏捷的致命弓手。起點鄰近閃避、投射物與速度天賦。',
  },
  {
    id: 'arcanist', name: '秘術師', str: 14, dex: 14, int: 32, treeAngle: 90, color: '#4a6fd1',
    startWeapon: 'wand_0', startGem: 'fireball',
    description: '純智慧的施法者。起點鄰近法術、能量護盾與召喚物天賦。',
  },
  {
    id: 'blademaster', name: '劍術大師', str: 23, dex: 23, int: 14, treeAngle: 270, color: '#c4a13a',
    startWeapon: 'one_hand_sword_0', startGem: 'sweeping_cleave',
    description: '力量與敏捷兼備的決鬥者。起點鄰近攻擊速度、偷取與武器天賦。',
  },
  {
    id: 'zealot', name: '狂信者', str: 23, dex: 14, int: 23, treeAngle: 150, color: '#d9d2b4',
    startWeapon: 'sceptre_0', startGem: 'magma_strike',
    description: '力量與智慧兼備的聖戰士。起點鄰近火焰、範圍與格擋天賦。',
  },
  {
    id: 'nightblade', name: '夜刃', str: 14, dex: 23, int: 23, treeAngle: 30, color: '#7a4fa8',
    startWeapon: 'dagger_0', startGem: 'chain_lightning',
    description: '精通敏捷與智慧的狡詐殺手。起點鄰近暴擊、冰冷與混沌天賦。',
  },
];

export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c])) as Record<ClassId, ClassDef>;
