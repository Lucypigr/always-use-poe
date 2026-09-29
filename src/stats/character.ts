import { CLASS_BY_ID } from '../data/classes';
import { passiveStats, PASSIVE_TREE } from '../data/passives';
import type { CharacterData } from '../game/character';
import { armourProps, globalItemStats, weaponProps } from '../items/item';
import type { EquipSlot, Item } from '../items/types';
import { flat, inc, more, StatSheet, type StatMod } from './stats';

/**
 * Defensive / utility stats shared by every actor (player, monsters, minions).
 * Combat code only depends on this interface.
 */
export interface ActorStats {
  sheet: StatSheet;
  level: number;
  maxLife: number;
  maxMana: number;
  maxES: number;
  armour: number;
  evasion: number;
  /** Chance to block attack hits (%). */
  block: number;
  res: { fire: number; cold: number; lightning: number; chaos: number };
  maxRes: { fire: number; cold: number; lightning: number; chaos: number };
  /** Additional flat physical damage reduction (%). */
  physReduction: number;
  /** Multiplier on all damage taken. */
  damageTakenMult: number;
  /** Chance to entirely avoid a hit (%). */
  avoidChance: number;
  /** Fraction of damage taken from mana before life (0..1). */
  manaFirst: number;
  chaosImmune: boolean;
  lifeRegen: number;
  manaRegen: number;
  /** ES recharge per second as a fraction of max ES. */
  esRecharge: number;
  esDelay: number;
  moveSpeed: number;
  accuracy: number;
  unerring: boolean;
}

export interface CharacterStats extends ActorStats {
  str: number;
  dex: number;
  int: number;
  itemRarity: number;
  itemQuantity: number;
  flaskRecovery: number;
  flaskDuration: number;
  flaskChargesGained: number;
  bloodPact: boolean;
  weapon?: Item;
  offhand?: Item;
}

export const BASE_MOVE_SPEED = 4.4;
export const RES_CAP = 75;
export const UNARMED = { phys: [2, 6] as [number, number], aps: 1.2, crit: 5, range: 1.1 };

/** Stats every character gets from level and class. */
function baseMods(c: CharacterData): StatMod[] {
  const cls = CLASS_BY_ID[c.classId];
  return [
    flat('str', cls.str),
    flat('dex', cls.dex),
    flat('int', cls.int),
    flat('life', 38 + 12 * c.level),
    flat('mana', 34 + 6 * c.level),
    flat('evasion', 50 + 3 * c.level),
    flat('accuracy', 2 * c.level),
  ];
}

/** Modifiers from all equipped items (global item stats + armour/shield base values). */
export function equipmentMods(c: CharacterData): StatMod[] {
  const out: StatMod[] = [];
  for (const [slot, item] of Object.entries(c.equipment) as [EquipSlot, Item | undefined][]) {
    if (!item || slot.startsWith('flask')) continue;
    out.push(...globalItemStats(item));
    const ap = armourProps(item);
    if (ap) {
      if (ap.armour) out.push(flat('armour', ap.armour));
      if (ap.evasion) out.push(flat('evasion', ap.evasion));
      if (ap.es) out.push(flat('energy_shield', ap.es));
      if (ap.block) out.push(flat('block', ap.block));
    }
  }
  return out;
}

/**
 * Build the character's stat sheet and resolve final values.
 * `extra` carries temporary modifiers: auras, flask effects, map penalties, area resist penalty.
 */
export function computeCharacterStats(c: CharacterData, extra: StatMod[] = [], resPenalty = 0): CharacterStats {
  const sheet = new StatSheet([...baseMods(c), ...equipmentMods(c), ...passiveStats(PASSIVE_TREE, c.passives), ...extra]);
  const allAttr = sheet.flat('all_attributes');
  const str = Math.round((sheet.flat('str') + allAttr) * (1 + sheet.inc('str') / 100));
  const dex = Math.round((sheet.flat('dex') + allAttr) * (1 + sheet.inc('dex') / 100));
  const int = Math.round((sheet.flat('int') + allAttr) * (1 + sheet.inc('int') / 100));

  // Attribute bonuses (as in PoE): Str → life & melee physical, Dex → accuracy & evasion, Int → mana & ES
  sheet.add(flat('life', Math.floor(str / 2)));
  sheet.add(inc('melee_phys_damage', Math.floor(str / 5)));
  sheet.add(flat('accuracy', dex * 2));
  if (!sheet.has('ks_ironclad')) sheet.add(inc('evasion', Math.floor(dex / 5)));
  sheet.add(flat('mana', Math.floor(int / 2)));
  sheet.add(inc('energy_shield', Math.floor(int / 5)));

  // Keystones
  if (sheet.has('ks_wrath_of_ages')) {
    sheet.add(more('damage', 30));
    sheet.add(more('damage_taken', 15));
  }
  if (sheet.has('ks_elemental_overload')) sheet.add(more('elemental_damage', 40));
  if (sheet.has('ks_phantom_step')) {
    sheet.add(more('armour', -50));
    sheet.add(more('energy_shield', -50));
  }

  const hollow = sheet.has('ks_hollow_vessel');
  const bloodPact = sheet.has('ks_blood_pact');
  let maxLife = hollow ? 1 : Math.max(1, Math.round(sheet.calc('life')));
  const maxMana = bloodPact ? 0 : Math.max(0, Math.round(sheet.calc('mana')));
  const maxES = Math.max(0, Math.round(sheet.calc('energy_shield', 0, ['energy_shield', 'defences'])));
  let armour = sheet.calc('armour', 0, ['armour', 'defences']);
  let evasion = sheet.calc('evasion', 0, ['evasion', 'defences']);
  if (sheet.has('ks_ironclad')) {
    armour += evasion;
    evasion = 0;
  }
  maxLife = Math.max(1, maxLife);

  const maxAll = sheet.flat('max_all_ele_res');
  const maxRes = {
    fire: Math.min(90, RES_CAP + sheet.flat('max_fire_res') + maxAll),
    cold: Math.min(90, RES_CAP + sheet.flat('max_cold_res') + maxAll),
    lightning: Math.min(90, RES_CAP + sheet.flat('max_lightning_res') + maxAll),
    chaos: RES_CAP,
  };
  const allRes = sheet.flat('all_ele_res');
  const rawRes = {
    fire: sheet.flat('fire_res') + allRes + resPenalty,
    cold: sheet.flat('cold_res') + allRes + resPenalty,
    lightning: sheet.flat('lightning_res') + allRes + resPenalty,
    chaos: sheet.flat('chaos_res') + resPenalty,
  };
  const res = {
    fire: Math.min(maxRes.fire, rawRes.fire),
    cold: Math.min(maxRes.cold, rawRes.cold),
    lightning: Math.min(maxRes.lightning, rawRes.lightning),
    chaos: Math.min(maxRes.chaos, rawRes.chaos),
  };

  const lifeRegen = hollow ? 0 : sheet.flat('life_regen') + (maxLife * sheet.flat('life_regen_pct')) / 100;
  const manaRegen = (maxMana * 0.025 + sheet.flat('mana_regen')) * (1 + sheet.inc('mana_regen') / 100) * sheet.more('mana_regen');

  return {
    sheet,
    level: c.level,
    str,
    dex,
    int,
    maxLife,
    maxMana,
    maxES,
    armour: Math.round(armour),
    evasion: Math.round(evasion),
    block: Math.min(75, sheet.flat('block')),
    res,
    maxRes,
    physReduction: Math.min(50, sheet.flat('phys_damage_reduction')),
    damageTakenMult: Math.max(0.1, (1 + sheet.inc('damage_taken') / 100) * sheet.more('damage_taken')),
    avoidChance: sheet.has('ks_phantom_step') ? 30 : 0,
    manaFirst: sheet.has('ks_arcane_ward') ? 0.3 : 0,
    chaosImmune: hollow,
    lifeRegen,
    manaRegen,
    esRecharge: 0.333 * (1 + sheet.inc('es_recharge') / 100),
    esDelay: 2 * Math.max(0.2, 1 + sheet.inc('es_recharge_delay') / 100),
    moveSpeed: BASE_MOVE_SPEED * Math.max(0.2, 1 + sheet.inc('movement_speed') / 100) * sheet.more('movement_speed'),
    accuracy: Math.round(sheet.calc('accuracy')),
    unerring: sheet.has('ks_unerring'),
    itemRarity: sheet.inc('item_rarity'),
    itemQuantity: sheet.inc('item_quantity'),
    flaskRecovery: sheet.inc('flask_recovery'),
    flaskDuration: sheet.inc('flask_duration'),
    flaskChargesGained: sheet.inc('flask_charges'),
    bloodPact,
    weapon: c.equipment.weapon,
    offhand: c.equipment.offhand,
  };
}

/** Unresolved resistances (before cap) are useful for the character sheet. */
export function uncappedRes(stats: CharacterStats, resPenalty: number): Record<'fire' | 'cold' | 'lightning' | 'chaos', number> {
  const s = stats.sheet;
  const all = s.flat('all_ele_res');
  return {
    fire: s.flat('fire_res') + all + resPenalty,
    cold: s.flat('cold_res') + all + resPenalty,
    lightning: s.flat('lightning_res') + all + resPenalty,
    chaos: s.flat('chaos_res') + resPenalty,
  };
}

export function equippedWeaponProps(stats: CharacterStats) {
  return stats.weapon ? weaponProps(stats.weapon) : undefined;
}
