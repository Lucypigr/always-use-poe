import { rng as defaultRng, type RNG } from '../core/rng';
import { getMod } from '../data/affixes';
import { getBase } from '../data/bases';
import type { CurrencyId } from '../data/currency';
import { MAX_GEM_LEVEL } from '../data/gems';
import {
  addRandomMod, applyRarity, maxSockets, modCandidates, rerollLinks, rerollSocketColors, rerollSocketCount,
  rollValues, uniqueRanges, uniquesForBase, createUnique,
} from './generate';
import { explicitMods, isCurrency } from './item';
import { rareName } from './names';
import type { Item } from './types';

/**
 * Currency application ("crafting"). Every function validates the target first so the UI
 * can show why an orb can't be used, then mutates the item in place.
 */

export interface CraftResult {
  ok: boolean;
  message?: string;
}

const fail = (message: string): CraftResult => ({ ok: false, message });
const ok = (message?: string): CraftResult => ({ ok: true, message });

const isEquipmentLike = (it: Item) => !isCurrency(it) && !it.gem;
const isWeapon = (it: Item) => !!getBase(it.baseId).weapon;
const isArmour = (it: Item) => ['helmet', 'body_armour', 'gloves', 'boots', 'shield'].includes(getBase(it.baseId).cls);

function sameSockets(a: Item['sockets'], b: Item['sockets']): boolean {
  return a.length === b.length && a.every((s, i) => s.color === b[i].color && s.group === b[i].group);
}

function hasGems(it: Item): boolean {
  return it.sockets.some((s) => s.gem);
}

/** Check whether a currency can be applied without applying it. */
export function canApply(currency: CurrencyId, it: Item): CraftResult {
  if (isCurrency(it)) return fail('無法對通貨使用通貨');
  if (currency === 'portal' || currency === 'regret') return fail('此物品需從背包中使用');
  if (it.corrupted && currency !== 'identify') return fail('已汙染的物品無法修改');
  if (!it.identified && currency !== 'identify' && currency !== 'vaal') return fail('物品必須先鑑定');
  const flaskOrMap = !!it.flask || !!it.map;
  switch (currency) {
    case 'identify':
      return it.identified ? fail('物品已鑑定') : ok();
    case 'transmute':
    case 'alchemy':
    case 'chance':
      if (!isEquipmentLike(it)) return fail('只能用於裝備');
      if (it.rarity !== 'normal') return fail('物品必須是普通稀有度');
      if (currency === 'alchemy' && it.flask) return fail('藥劑不能成為稀有物品');
      return ok();
    case 'augment':
      if (it.rarity !== 'magic') return fail('物品必須是魔法稀有度');
      if (it.prefixes.length && it.suffixes.length) return fail('物品無法再附加詞綴');
      return ok();
    case 'alteration':
      return it.rarity === 'magic' ? ok() : fail('物品必須是魔法稀有度');
    case 'regal':
      if (it.rarity !== 'magic') return fail('物品必須是魔法稀有度');
      if (it.flask) return fail('藥劑不能成為稀有物品');
      return ok();
    case 'chaos':
      return it.rarity === 'rare' ? ok() : fail('物品必須是稀有稀有度');
    case 'exalt':
      if (it.rarity !== 'rare') return fail('物品必須是稀有稀有度');
      if (it.prefixes.length >= 3 && it.suffixes.length >= 3) return fail('物品無法再附加詞綴');
      if (!modCandidates(it, 'prefix').length && !modCandidates(it, 'suffix').length) return fail('無法附加任何詞綴');
      return ok();
    case 'scour':
      if (it.rarity === 'unique') return fail('無法洗白傳奇物品');
      return it.rarity === 'normal' ? fail('物品沒有詞綴') : ok();
    case 'annul':
      if (it.rarity === 'unique') return fail('無法移除傳奇物品的詞綴');
      return explicitMods(it).length ? ok() : fail('物品沒有詞綴');
    case 'divine':
      if (it.rarity === 'normal') return fail('物品沒有詞綴');
      return explicitMods(it).some((m) => getMod(m.id).tiers[0]?.values.length || m.values.length) ? ok() : fail('物品沒有數值詞綴');
    case 'blessed':
      return it.implicits.some((m) => m.values.length) ? ok() : fail('物品沒有固定詞綴');
    case 'chromatic':
      if (!it.sockets.length) return fail('物品沒有插槽');
      if (hasGems(it)) return fail('請先取下鑲嵌的寶石');
      return ok();
    case 'jeweller':
      if (maxSockets(it) < 2) return fail('物品無法擁有更多插槽');
      if (hasGems(it)) return fail('請先取下鑲嵌的寶石');
      return ok();
    case 'fusing':
      if (it.sockets.length < 2) return fail('物品至少需要兩個插槽');
      if (hasGems(it)) return fail('請先取下鑲嵌的寶石');
      return ok();
    case 'vaal':
      if (it.corrupted) return fail('物品已被汙染');
      if (flaskOrMap && it.flask) return fail('藥劑無法汙染');
      return ok();
    case 'whetstone':
      if (!isWeapon(it)) return fail('只能用於武器');
      return it.quality >= 20 ? fail('物品品質已達上限') : ok();
    case 'armour_scrap':
      if (!isArmour(it)) return fail('只能用於護甲');
      return it.quality >= 20 ? fail('物品品質已達上限') : ok();
    case 'bauble':
      if (!it.flask) return fail('只能用於藥劑');
      return it.quality >= 20 ? fail('物品品質已達上限') : ok();
    case 'gcp':
      if (!it.gem) return fail('只能用於寶石');
      return it.quality >= 20 ? fail('寶石品質已達上限') : ok();
  }
  return fail('沒有發生任何事');
}

function qualityStep(it: Item): number {
  if (it.gem) return 1;
  if (it.rarity === 'normal') return 5;
  if (it.rarity === 'magic') return 2;
  return 1;
}

function rerollExplicitValues(it: Item, r: RNG): void {
  const ranges = uniqueRanges(it);
  if (ranges) {
    it.prefixes.forEach((m, i) => {
      const def = getMod(m.id);
      const rg = ranges[i] ?? [];
      m.values = rg.map(([lo, hi]) => {
        if (def.decimals) return Math.round(r.float(lo, hi) * 10 ** def.decimals) / 10 ** def.decimals;
        return r.int(lo, hi);
      });
    });
    return;
  }
  for (const m of explicitMods(it)) m.values = rollValues(getMod(m.id), m.tier, it, r);
}

function rerollImplicitValues(it: Item, r: RNG): void {
  const base = getBase(it.baseId);
  it.implicits.forEach((m, i) => {
    const def = getMod(m.id);
    if (def.type === 'corrupted') m.values = rollValues(def, m.tier, it, r);
    else {
      const rg = base.implicits?.[i]?.values;
      if (rg) m.values = rg.map(([lo, hi]) => r.int(lo, hi));
    }
  });
}

function corrupt(it: Item, r: RNG): string {
  it.corrupted = true;
  it.identified = true;
  if (it.gem) {
    const roll = r.int(0, 3);
    if (roll === 0) {
      it.gem.level = Math.min(MAX_GEM_LEVEL, it.gem.level + 1);
      return '寶石被強化了（+1 等級）';
    }
    if (roll === 1) {
      it.gem.level = Math.max(1, it.gem.level - 1);
      return '寶石被削弱了（-1 等級）';
    }
    if (roll === 2) {
      it.quality = Math.max(0, Math.min(23, it.quality + r.int(-10, 10)));
      return '寶石的品質改變了';
    }
    return '汙染沒有造成明顯效果';
  }
  const roll = r.int(0, 3);
  if (roll === 0) return '汙染沒有造成明顯效果';
  if (roll === 1) {
    const cands = modCandidates(it, 'corrupted');
    const pick = r.weighted(cands, (c) => c.weight);
    if (pick) {
      it.implicits = [{ id: pick.def.id, tier: pick.tier, values: rollValues(pick.def, pick.tier, it, r) }];
      return '附加了一條腐化固定詞綴';
    }
    return '汙染沒有造成明顯效果';
  }
  if (roll === 2 && it.sockets.length) {
    rerollSocketCount(it, r);
    rerollSocketColors(it, r, 0.25);
    return '插槽被扭曲了';
  }
  if (it.rarity !== 'unique' && !it.map) {
    applyRarity(it, 'rare', r);
    for (let i = explicitMods(it).length; i < 6 && r.chance(0.5); i++) addRandomMod(it, r);
    return '物品被重鑄成了新的東西';
  }
  rerollExplicitValues(it, r);
  return '詞綴被重塑了';
}

export function applyCurrency(currency: CurrencyId, it: Item, r: RNG = defaultRng): CraftResult {
  const check = canApply(currency, it);
  if (!check.ok) return check;
  const base = it.map ? undefined : getBase(it.baseId);
  switch (currency) {
    case 'identify':
      it.identified = true;
      return ok();
    case 'transmute':
      applyRarity(it, 'magic', r);
      return ok();
    case 'alchemy':
      applyRarity(it, 'rare', r);
      return ok();
    case 'augment':
      addRandomMod(it, r);
      return ok();
    case 'alteration':
      applyRarity(it, 'magic', r);
      return ok();
    case 'regal':
      it.rarity = 'rare';
      it.name = rareName(r, base?.cls ?? 'map');
      addRandomMod(it, r);
      return ok();
    case 'chaos':
      applyRarity(it, 'rare', r);
      return ok();
    case 'exalt':
      addRandomMod(it, r);
      return ok();
    case 'scour':
      it.prefixes = [];
      it.suffixes = [];
      it.rarity = 'normal';
      it.name = undefined;
      return ok();
    case 'annul': {
      const all = explicitMods(it);
      const victim = r.pick(all);
      it.prefixes = it.prefixes.filter((m) => m !== victim);
      it.suffixes = it.suffixes.filter((m) => m !== victim);
      return ok(`已移除：${getMod(victim.id).text[0].replace(/\{\d\}/g, '#')}`);
    }
    case 'divine':
      rerollExplicitValues(it, r);
      return ok();
    case 'blessed':
      rerollImplicitValues(it, r);
      return ok();
    case 'chromatic': {
      const before = JSON.parse(JSON.stringify(it.sockets));
      for (let i = 0; i < 25; i++) {
        rerollSocketColors(it, r);
        if (!sameSockets(before, it.sockets)) break;
      }
      return ok();
    }
    case 'jeweller': {
      const before = it.sockets.length;
      for (let i = 0; i < 25; i++) {
        rerollSocketCount(it, r);
        if (it.sockets.length !== before) break;
      }
      return ok();
    }
    case 'fusing': {
      const before = JSON.parse(JSON.stringify(it.sockets));
      for (let i = 0; i < 25; i++) {
        rerollLinks(it, r);
        if (!sameSockets(before, it.sockets)) break;
      }
      return ok();
    }
    case 'vaal':
      return ok(corrupt(it, r));
    case 'chance': {
      const roll = r.next();
      const uniques = uniquesForBase(it.baseId);
      if (roll < 0.02 && uniques.length) {
        const u = createUnique(r.pick(uniques), it.ilvl, r);
        Object.assign(it, { ...u, uid: it.uid, sockets: u.sockets.length ? u.sockets : it.sockets });
        return ok('傳奇！');
      }
      applyRarity(it, roll < 0.2 ? 'rare' : 'magic', r);
      return ok();
    }
    case 'whetstone':
    case 'armour_scrap':
    case 'bauble':
    case 'gcp':
      it.quality = Math.min(20, it.quality + qualityStep(it));
      return ok();
  }
  return fail('沒有發生任何事');
}
