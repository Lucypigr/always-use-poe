import { getMod, type ModDef } from '../data/affixes';
import { getBase } from '../data/bases';
import { BENCH_RECIPES, COLOUR_COST_PER_SOCKET, LINK_COST, SOCKET_COST } from '../data/bench';
import type { CurrencyId } from '../data/currency';
import { rng as defaultRng, type RNG } from '../core/rng';
import { itemTags, maxSockets, rollColor, valueScale } from './generate';
import { currencyId, explicitMods } from './item';
import type { Item, SocketColor } from './types';

/** One action offered by the crafting bench for a given item. */
export interface BenchOption {
  /** 'mod:<affix>', 'colour:R|G|B', 'link', 'sockets:<n>' or 'remove'. */
  id: string;
  group: 'prefix' | 'suffix' | 'socket' | 'other';
  label: string;
  cost: [CurrencyId, number][];
  /** Why the option can't be used right now (currency is checked separately). */
  reason?: string;
}

const COLOUR_NAME: Record<SocketColor, string> = { R: '紅', G: '綠', B: '藍', W: '白' };

/** Reason the item can't be used on the bench at all, if any. */
export function benchBlocker(it: Item): string | undefined {
  const base = getBase(it.baseId);
  if (currencyId(it) || it.gem || it.map || base.flask) return '工藝台只能修改裝備';
  if (it.rarity === 'unique') return '傳奇物品無法工藝';
  if (it.corrupted) return '已汙染的物品無法修改';
  if (!it.identified && it.rarity !== 'normal') return '請先鑑定物品';
  return undefined;
}

function rangeText(def: ModDef, values: [number, number][], scale: number): string {
  return def.text
    .map((line) =>
      line.replace(/\{(\d)\}/g, (_, i) => {
        const v = values[Number(i)];
        if (!v) return '?';
        const [lo, hi] = [Math.round(v[0] * scale), Math.round(v[1] * scale)];
        return lo === hi ? String(lo) : `(${lo}–${hi})`;
      }),
    )
    .join('，');
}

/** Everything the bench can do to this item. */
export function benchOptions(it: Item): BenchOption[] {
  if (benchBlocker(it)) return [];
  const out: BenchOption[] = [];
  const tags = itemTags(it);
  const mods = explicitMods(it);
  const hasCrafted = mods.some((m) => m.crafted);
  const groups = new Set(mods.map((m) => getMod(m.id).group));
  const limit = it.rarity === 'rare' ? 3 : 1;
  for (const rec of BENCH_RECIPES) {
    const def = getMod(rec.mod);
    if (!def.spawn.some((t) => tags.has(t))) continue;
    const tier = [...rec.tiers].reverse().find((x) => x.ilvl <= it.ilvl);
    const shown = tier ?? rec.tiers[0];
    const type = def.type === 'suffix' ? 'suffix' : 'prefix';
    let reason: string | undefined;
    if (!tier) reason = `需要物品等級 ${shown.ilvl}`;
    else if (hasCrafted) reason = '已有一條工藝詞綴';
    else if (groups.has(def.group)) reason = '已有同類詞綴';
    else if ((type === 'prefix' ? it.prefixes : it.suffixes).length >= limit) reason = `${type === 'prefix' ? '前綴' : '後綴'}已滿`;
    out.push({ id: `mod:${rec.mod}`, group: type, label: rangeText(def, shown.values, valueScale(def, tags)), cost: shown.cost, reason });
  }
  const n = it.sockets.length;
  const gems = it.sockets.some((s) => s.gem);
  if (n > 0) {
    for (const c of ['R', 'G', 'B'] as SocketColor[]) {
      out.push({
        id: `colour:${c}`, group: 'socket', label: `全部插槽改為${COLOUR_NAME[c]}色`, cost: [['chromatic', COLOUR_COST_PER_SOCKET * n]],
        reason: gems ? '請先取下寶石' : it.sockets.every((s) => s.color === c) ? '已經是這個顏色' : undefined,
      });
    }
    if (n >= 2) {
      const linked = it.sockets.every((s) => s.group === it.sockets[0].group);
      out.push({ id: 'link', group: 'socket', label: `連結全部 ${n} 個插槽`, cost: [['fusing', LINK_COST[n] ?? 120]], reason: linked ? '已全部連結' : undefined });
    }
  }
  const max = maxSockets(it);
  for (let k = 2; k <= max; k++) {
    if (k === n) continue;
    out.push({ id: `sockets:${k}`, group: 'socket', label: `插槽數量設為 ${k}`, cost: [['jeweller', SOCKET_COST[k] ?? 100]], reason: gems ? '請先取下寶石' : undefined });
  }
  if (hasCrafted) out.push({ id: 'remove', group: 'other', label: '移除工藝詞綴', cost: [] });
  return out;
}

/** Apply a bench option (validity and payment are checked by the caller). */
export function applyBench(it: Item, id: string, r: RNG = defaultRng): void {
  const [kind, arg] = id.split(':');
  const tags = itemTags(it);
  if (kind === 'mod') {
    const rec = BENCH_RECIPES.find((x) => x.mod === arg)!;
    const tier = [...rec.tiers].reverse().find((x) => x.ilvl <= it.ilvl)!;
    const def = getMod(arg);
    const scale = valueScale(def, tags);
    const dec = def.decimals ?? 0;
    const values = tier.values.map(([lo, hi]) => (dec ? Math.round(r.float(lo, hi) * scale * 10 ** dec) / 10 ** dec : r.int(Math.round(lo * scale), Math.round(hi * scale))));
    // closest regular tier, so the tooltip / magic name read naturally
    let t = 0;
    def.tiers.forEach((x, i) => {
      if (x.values[0][0] <= values[0] / scale) t = i;
    });
    if (it.rarity === 'normal') {
      it.rarity = 'magic';
      it.identified = true;
    }
    (def.type === 'suffix' ? it.suffixes : it.prefixes).push({ id: arg, tier: t, values, crafted: true });
  } else if (kind === 'colour') {
    for (const s of it.sockets) s.color = arg as SocketColor;
  } else if (kind === 'link') {
    for (const s of it.sockets) s.group = 0;
  } else if (kind === 'sockets') {
    const n = Number(arg);
    const base = getBase(it.baseId);
    const linked = it.sockets.length > 0 && it.sockets.every((s) => s.group === it.sockets[0].group);
    while (it.sockets.length > n) it.sockets.pop();
    while (it.sockets.length < n) it.sockets.push({ color: rollColor(base, r), group: linked ? 0 : it.sockets.length + 100 });
  } else if (kind === 'remove') {
    it.prefixes = it.prefixes.filter((m) => !m.crafted);
    it.suffixes = it.suffixes.filter((m) => !m.crafted);
  }
}
