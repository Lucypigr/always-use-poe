import type { StatMod } from '../stats/stats';

export type Rarity = 'normal' | 'magic' | 'rare' | 'unique';
export type SocketColor = 'R' | 'G' | 'B' | 'W';
export type Attr = 'str' | 'dex' | 'int';

export type WeaponClass =
  | 'claw' | 'dagger' | 'wand' | 'one_hand_sword' | 'one_hand_axe' | 'one_hand_mace' | 'sceptre'
  | 'bow' | 'staff' | 'two_hand_sword' | 'two_hand_axe' | 'two_hand_mace';

export type ArmourClass = 'helmet' | 'body_armour' | 'gloves' | 'boots' | 'shield';
export type ItemClass =
  | WeaponClass | ArmourClass | 'quiver' | 'amulet' | 'ring' | 'belt'
  | 'life_flask' | 'mana_flask' | 'hybrid_flask' | 'utility_flask'
  | 'currency' | 'gem' | 'map';

export type DefenceType = 'str' | 'dex' | 'int' | 'str_dex' | 'str_int' | 'dex_int';

export type EquipSlot =
  | 'weapon' | 'offhand' | 'helmet' | 'body' | 'gloves' | 'boots' | 'amulet' | 'ring1' | 'ring2' | 'belt'
  | 'flask1' | 'flask2' | 'flask3' | 'flask4' | 'flask5';

export const EQUIP_SLOTS: EquipSlot[] = [
  'weapon', 'offhand', 'helmet', 'body', 'gloves', 'boots', 'amulet', 'ring1', 'ring2', 'belt',
  'flask1', 'flask2', 'flask3', 'flask4', 'flask5',
];

export interface ModRoll {
  /** Mod definition id. */
  id: string;
  /** Index into the definition's tier list (0 = lowest tier). */
  tier: number;
  /** Rolled values, one per value range of the tier. */
  values: number[];
}

export interface Socket {
  color: SocketColor;
  /** Sockets with the same group id are linked. */
  group: number;
  gem?: Item;
}

export interface GemState {
  id: string;
  level: number;
  xp: number;
}

export interface FlaskState {
  charges: number;
}

export interface MapState {
  tier: number;
  /** Layout / theme of the area this map opens. */
  layout: string;
}

export interface Item {
  uid: string;
  baseId: string;
  rarity: Rarity;
  ilvl: number;
  /** Rare/unique display name. */
  name?: string;
  uniqueId?: string;
  identified: boolean;
  corrupted: boolean;
  /** Mirrored / otherwise unmodifiable items. */
  quality: number;
  implicits: ModRoll[];
  prefixes: ModRoll[];
  suffixes: ModRoll[];
  sockets: Socket[];
  stack?: number;
  gem?: GemState;
  flask?: FlaskState;
  map?: MapState;
}

export interface WeaponProps {
  phys: [number, number];
  aps: number;
  crit: number;
  range: number;
}

export interface ArmourProps {
  armour?: number;
  evasion?: number;
  es?: number;
  block?: number;
}

export type FlaskKind = 'life' | 'mana' | 'hybrid' | 'utility';

export interface FlaskProps {
  kind: FlaskKind;
  life?: number;
  mana?: number;
  /** Recovery / effect duration in seconds. */
  duration: number;
  maxCharges: number;
  chargesPerUse: number;
  /** Utility flask effect while active. */
  effect?: StatMod[];
  effectText?: string[];
}

export interface ItemBase {
  id: string;
  name: string;
  cls: ItemClass;
  w: number;
  h: number;
  /** Minimum item level for this base to drop. */
  level: number;
  req: Partial<Record<Attr, number>>;
  /** Tags used for affix spawn weighting. */
  tags: string[];
  implicits?: { mod: string; values: [number, number][] }[];
  weapon?: WeaponProps;
  armour?: ArmourProps;
  defence?: DefenceType;
  flask?: FlaskProps;
  twoHanded?: boolean;
  /** Relative drop weight among bases. */
  dropWeight?: number;
}
