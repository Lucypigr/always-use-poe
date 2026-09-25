import { getBase } from '../data/bases';
import { getGem } from '../data/gems';
import { attributeReqs, isCurrency, requiredLevel } from '../items/item';
import type { Attr, EquipSlot, Item, SocketColor } from '../items/types';
import type { CharacterStats } from '../stats/character';
import type { CharacterData } from './character';

/** Equipment slot rules (what fits where, requirements, two-handed weapons). */

export const FLASK_SLOTS: EquipSlot[] = ['flask1', 'flask2', 'flask3', 'flask4', 'flask5'];

export function slotsFor(it: Item): EquipSlot[] {
  if (isCurrency(it) || it.gem || it.map) return [];
  const b = getBase(it.baseId);
  if (b.flask) return FLASK_SLOTS;
  switch (b.cls) {
    case 'helmet':
      return ['helmet'];
    case 'body_armour':
      return ['body'];
    case 'gloves':
      return ['gloves'];
    case 'boots':
      return ['boots'];
    case 'amulet':
      return ['amulet'];
    case 'ring':
      return ['ring1', 'ring2'];
    case 'belt':
      return ['belt'];
    case 'shield':
    case 'quiver':
      return ['offhand'];
  }
  if (b.weapon) return b.twoHanded ? ['weapon'] : ['weapon', 'offhand'];
  return [];
}

export function meetsRequirements(it: Item, char: CharacterData, stats: CharacterStats): string | null {
  const lvl = requiredLevel(it);
  if (lvl > char.level) return `需要等級 ${lvl}`;
  const reqs = attributeReqs(it);
  for (const a of ['str', 'dex', 'int'] as Attr[]) {
    const need = reqs[a] ?? 0;
    if (need > stats[a]) return `需要 ${need} ${a === 'str' ? '力量' : a === 'dex' ? '敏捷' : '智慧'}`;
  }
  return null;
}

export function canEquip(char: CharacterData, stats: CharacterStats, it: Item, slot: EquipSlot): string | null {
  if (!slotsFor(it).includes(slot)) return '該物品無法放入此欄位';
  if (!it.identified) return '物品必須鑑定後才能裝備';
  const req = meetsRequirements(it, char, stats);
  if (req) return req;
  const b = getBase(it.baseId);
  if (slot === 'offhand') {
    const main = char.equipment.weapon ? getBase(char.equipment.weapon.baseId) : undefined;
    if (b.cls === 'quiver' && main?.cls !== 'bow') return '箭袋只能搭配弓使用';
    if (main?.twoHanded && !(main.cls === 'bow' && b.cls === 'quiver')) return '使用雙手武器時無法裝備副手';
  }
  return null;
}

/**
 * Equip an item, returning whatever was displaced (the previous item, and an off-hand that
 * no longer fits after equipping a two-handed weapon).
 */
export function equipItem(char: CharacterData, stats: CharacterStats, it: Item, slot: EquipSlot): { ok: boolean; error?: string; displaced: Item[] } {
  const err = canEquip(char, stats, it, slot);
  if (err) return { ok: false, error: err, displaced: [] };
  const displaced: Item[] = [];
  const prev = char.equipment[slot];
  if (prev) displaced.push(prev);
  char.equipment[slot] = it;
  if (slot === 'weapon') {
    const b = getBase(it.baseId);
    const off = char.equipment.offhand;
    if (off) {
      const ob = getBase(off.baseId);
      const keep = b.twoHanded ? b.cls === 'bow' && ob.cls === 'quiver' : ob.cls !== 'quiver';
      if (!keep) {
        displaced.push(off);
        delete char.equipment.offhand;
      }
    }
  }
  return { ok: true, displaced };
}

export function socketAccepts(socket: SocketColor, gem: Item): boolean {
  if (!gem.gem) return false;
  return socket === 'W' || getGem(gem.gem.id).color === socket;
}
