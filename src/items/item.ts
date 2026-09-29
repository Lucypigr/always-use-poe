import { getMod, type ModDef } from '../data/affixes';
import { getBase } from '../data/bases';
import { CURRENCY_BY_ID, type CurrencyId } from '../data/currency';
import { getGem, type GemDef } from '../data/gems';
import { UNIQUE_BY_ID } from '../data/uniques';
import { isLocalStat, StatSheet, type StatMod } from '../stats/stats';
import type { Attr, Item, ItemBase, ModRoll, WeaponProps } from './types';

/** Helpers for querying items. Items themselves are plain serialisable data. */

export const isCurrency = (it: Item): boolean => it.baseId.startsWith('currency:');
export const currencyId = (it: Item): CurrencyId | undefined =>
  isCurrency(it) ? (it.baseId.slice('currency:'.length) as CurrencyId) : undefined;
export const isGem = (it: Item): boolean => !!it.gem;
export const isMap = (it: Item): boolean => !!it.map;
export const isFlask = (it: Item): boolean => !!it.flask;

export function itemBase(it: Item): ItemBase {
  if (isCurrency(it)) {
    return { id: it.baseId, name: currencyName(it), cls: 'currency', w: 1, h: 1, level: 1, req: {}, tags: ['currency'] };
  }
  return getBase(it.baseId);
}

export function currencyName(it: Item): string {
  const id = currencyId(it);
  return id ? CURRENCY_BY_ID[id].name : '?';
}

export function gemDef(it: Item): GemDef | undefined {
  return it.gem ? getGem(it.gem.id) : undefined;
}

export function itemSize(it: Item): [number, number] {
  const b = itemBase(it);
  return [b.w, b.h];
}

export function baseName(it: Item): string {
  if (isCurrency(it)) return currencyName(it);
  if (it.gem) return getGem(it.gem.id).name;
  if (it.map) return `${mapName(it)}（${it.map.tier} 階）`;
  return getBase(it.baseId).name;
}

const MAP_NAMES: Record<string, string> = {
  crypt: '沉沒墓穴', caves: '空洞洞窟', forest: '荊棘森林', ruins: '淪陷要塞', inferno: '餘燼深坑',
  frost: '冰河裂隙', void: '虛空之境', shore: '破船者海岸',
};

export function mapName(it: Item): string {
  return `${MAP_NAMES[it.map?.layout ?? ''] ?? '未知'}地圖`;
}

/** Full display name including magic affix names. */
export function displayName(it: Item): string {
  if (it.rarity === 'unique' && it.uniqueId) return UNIQUE_BY_ID[it.uniqueId]?.name ?? baseName(it);
  if (it.rarity === 'rare' && it.name) return it.name;
  if (it.rarity === 'magic' && it.identified) {
    const pre = it.prefixes[0] ? affixName(it.prefixes[0]) : '';
    const suf = it.suffixes[0] ? affixName(it.suffixes[0]) : '';
    return [pre, baseName(it), suf].filter(Boolean).join('');
  }
  return baseName(it);
}

export function affixName(roll: ModRoll): string {
  const def = getMod(roll.id);
  return def.names?.[Math.min(roll.tier, def.names.length - 1)] ?? '';
}

export const explicitMods = (it: Item): ModRoll[] => [...it.prefixes, ...it.suffixes];

export function modStats(roll: ModRoll): StatMod[] {
  const def = getMod(roll.id);
  return def.stats.map((s) => ({
    stat: s.stat,
    kind: s.kind,
    value: s.value ?? (roll.values[s.idx ?? 0] ?? 0) * (s.mult ?? 1),
  }));
}

/** Format a mod's text lines with its rolled values. */
export function modText(roll: ModRoll, def: ModDef = getMod(roll.id)): string[] {
  return def.text.map((line) =>
    line.replace(/\{(\d)\}/g, (_, i) => {
      const v = roll.values[Number(i)];
      if (v === undefined) return '?';
      return def.decimals ? v.toFixed(def.decimals).replace(/\.0+$/, '') : String(v);
    }),
  );
}

/** All mods on the item that contribute stats (implicits + explicits), if identified. */
export function allRolls(it: Item): ModRoll[] {
  if (!it.identified && it.rarity !== 'normal') return it.implicits;
  return [...it.implicits, ...it.prefixes, ...it.suffixes];
}

/** Stats this item grants to the character (excludes local stats). */
export function globalItemStats(it: Item): StatMod[] {
  const out: StatMod[] = [];
  for (const r of allRolls(it)) for (const s of modStats(r)) if (!isLocalStat(s.stat)) out.push(s);
  return out;
}

export function localSheet(it: Item): StatSheet {
  const sheet = new StatSheet();
  for (const r of allRolls(it)) for (const s of modStats(r)) if (isLocalStat(s.stat)) sheet.add(s);
  return sheet;
}

/** Weapon properties after local modifiers and quality. */
export function weaponProps(it: Item): (WeaponProps & { ele: Record<'fire' | 'cold' | 'lightning' | 'chaos', [number, number]> }) | undefined {
  const b = getBase(it.baseId);
  if (!b.weapon) return undefined;
  const loc = localSheet(it);
  const physInc = loc.inc('local_phys_inc') + it.quality;
  const physMin = Math.round((b.weapon.phys[0] + loc.flat('local_phys_min')) * (1 + physInc / 100));
  const physMax = Math.round((b.weapon.phys[1] + loc.flat('local_phys_max')) * (1 + physInc / 100));
  const aps = b.weapon.aps * (1 + loc.inc('local_attack_speed') / 100);
  const crit = b.weapon.crit * (1 + loc.inc('local_crit') / 100);
  return {
    phys: [physMin, physMax],
    aps: Math.round(aps * 100) / 100,
    crit: Math.round(crit * 100) / 100,
    range: b.weapon.range,
    ele: {
      fire: [loc.flat('local_fire_min'), loc.flat('local_fire_max')],
      cold: [loc.flat('local_cold_min'), loc.flat('local_cold_max')],
      lightning: [loc.flat('local_lightning_min'), loc.flat('local_lightning_max')],
      chaos: [loc.flat('local_chaos_min'), loc.flat('local_chaos_max')],
    },
  };
}

/** Armour properties after local modifiers and quality. */
export function armourProps(it: Item): { armour: number; evasion: number; es: number; block: number } | undefined {
  const b = getBase(it.baseId);
  if (!b.armour) return undefined;
  const loc = localSheet(it);
  const all = loc.inc('local_def_inc') + it.quality;
  const armour = Math.round(((b.armour.armour ?? 0) + loc.flat('local_armour')) * (1 + (loc.inc('local_armour_inc') + all) / 100));
  const evasion = Math.round(((b.armour.evasion ?? 0) + loc.flat('local_evasion')) * (1 + (loc.inc('local_evasion_inc') + all) / 100));
  const es = Math.round(((b.armour.es ?? 0) + loc.flat('local_es')) * (1 + (loc.inc('local_es_inc') + all) / 100));
  const block = (b.armour.block ?? 0) + loc.flat('local_block');
  return { armour, evasion, es, block };
}

export interface FlaskComputed {
  life: number;
  mana: number;
  duration: number;
  maxCharges: number;
  chargesPerUse: number;
  instant: boolean;
  effect: StatMod[];
  effectText: string[];
  during: StatMod[];
  bleedImmune: boolean;
  freezeImmune: boolean;
}

export function flaskProps(it: Item, globalRecovery = 0, globalDuration = 0): FlaskComputed | undefined {
  const b = getBase(it.baseId);
  if (!b.flask) return undefined;
  const loc = localSheet(it);
  const amountMult = (1 + (loc.inc('flask_local_amount') + it.quality + globalRecovery) / 100);
  const speedMult = 1 + loc.inc('flask_local_speed') / 100;
  const durMult = 1 + (loc.inc('flask_local_duration') + (b.flask.kind === 'utility' ? it.quality : 0) + globalDuration) / 100;
  const instant = loc.has('flask_local_instant');
  const during: StatMod[] = [];
  if (loc.inc('flask_local_armour')) during.push({ stat: 'armour', kind: 'inc', value: loc.inc('flask_local_armour') });
  if (loc.inc('flask_local_evasion')) during.push({ stat: 'evasion', kind: 'inc', value: loc.inc('flask_local_evasion') });
  if (loc.inc('flask_local_move')) during.push({ stat: 'movement_speed', kind: 'inc', value: loc.inc('flask_local_move') });
  return {
    life: Math.round((b.flask.life ?? 0) * amountMult),
    mana: Math.round((b.flask.mana ?? 0) * amountMult),
    duration: b.flask.kind === 'utility' ? b.flask.duration * durMult : instant ? 0 : b.flask.duration / speedMult,
    maxCharges: b.flask.maxCharges + loc.flat('flask_local_charges'),
    chargesPerUse: Math.max(1, Math.round(b.flask.chargesPerUse * (1 + loc.inc('flask_local_charge_use') / 100))),
    instant,
    effect: b.flask.effect ?? [],
    effectText: b.flask.effectText ?? [],
    during,
    bleedImmune: loc.has('flask_local_bleed_immune'),
    freezeImmune: loc.has('flask_local_freeze_immune'),
  };
}

/** Item level requirement: base level or 80% of the highest mod's item level, like PoE. */
export function requiredLevel(it: Item): number {
  if (it.gem) return 0; // gems use their own requirement (see gem helpers)
  if (isCurrency(it)) return 0;
  let lvl = getBase(it.baseId).level;
  if (it.uniqueId) lvl = Math.max(lvl, UNIQUE_BY_ID[it.uniqueId]?.level ?? 0);
  for (const r of [...it.prefixes, ...it.suffixes]) {
    const def = getMod(r.id);
    if (def.type === 'unique') continue;
    const tier = def.tiers[r.tier];
    if (tier) lvl = Math.max(lvl, Math.floor(tier.ilvl * 0.8));
  }
  return Math.min(lvl, 100);
}

export function attributeReqs(it: Item): Partial<Record<Attr, number>> {
  if (isCurrency(it) || it.map) return {};
  return getBase(it.baseId).req;
}

export function stackable(it: Item): number {
  const id = currencyId(it);
  return id ? CURRENCY_BY_ID[id].stackSize : 1;
}

export function maxQuality(it: Item): number {
  return it.gem ? 20 : 20;
}

export function cloneItem(it: Item): Item {
  return JSON.parse(JSON.stringify(it)) as Item;
}
