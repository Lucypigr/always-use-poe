import { getMod } from '../data/affixes';
import { CLASS_LABEL, getBase } from '../data/bases';
import { CURRENCY_BY_ID } from '../data/currency';
import { getGem } from '../data/gems';
import { lvl } from '../data/scaling';
import { UNIQUE_BY_ID } from '../data/uniques';
import { gemRequirements, gemXpToNext } from '../skills/gemUtil';
import {
  armourProps, attributeReqs, baseName, currencyId, displayName, flaskProps, localSheet, mapName, modText, requiredLevel, weaponProps,
} from './item';
import type { Attr, Item } from './types';

export type LineClass =
  | 'prop' | 'aug' | 'req' | 'reqfail' | 'implicit' | 'mod' | 'unique' | 'corrupted' | 'flavour' | 'desc' | 'hint'
  | 'gemdesc' | 'crafted' | 'fire' | 'cold' | 'lightning' | 'chaos' | 'map';

export interface TooltipLine {
  text: string;
  cls?: LineClass;
  /** Extra detail shown in advanced (Alt) mode, e.g. "Prefix · Tier 3 · Hale". */
  detail?: string;
}

export interface Tooltip {
  frame: 'normal' | 'magic' | 'rare' | 'unique' | 'currency' | 'gem';
  title: string[];
  sections: TooltipLine[][];
}

export interface TooltipContext {
  level: number;
  attrs: Record<Attr, number>;
  alt?: boolean;
}

const TAG_ZH: Record<string, string> = {
  area: '範圍', attack: '攻擊', aura: '光環', bow: '弓', chaining: '連鎖', chaos: '混沌', cold: '冰冷', duration: '持續時間',
  fire: '火焰', lightning: '閃電', melee: '近戰', minion: '召喚物', movement: '位移', nova: '新星', physical: '物理',
  projectile: '投射物', slam: '猛擊', spell: '法術', strike: '打擊',
};
const ATTR_NAME: Record<Attr, string> = { str: '力', dex: '敏', int: '智' };

function reqSection(level: number, reqs: Partial<Record<Attr, number>>, ctx?: TooltipContext): TooltipLine[] {
  const parts: TooltipLine[] = [];
  if (level > 1) parts.push({ text: `等級 ${level}`, cls: ctx && ctx.level < level ? 'reqfail' : 'req' });
  for (const a of ['str', 'dex', 'int'] as Attr[]) {
    const v = reqs[a];
    if (v) parts.push({ text: `${v} ${ATTR_NAME[a]}`, cls: ctx && ctx.attrs[a] < v ? 'reqfail' : 'req' });
  }
  if (!parts.length) return [];
  return [{ text: `需求 ${parts.map((p) => p.text).join('、')}`, cls: parts.some((p) => p.cls === 'reqfail') ? 'reqfail' : 'req' }];
}

function fmtRange([a, b]: [number, number]): string {
  return `${a}-${b}`;
}

export function buildTooltip(it: Item, ctx?: TooltipContext): Tooltip {
  const cid = currencyId(it);
  if (cid) {
    const def = CURRENCY_BY_ID[cid];
    return {
      frame: 'currency',
      title: [def.name],
      sections: [
        [{ text: `堆疊數量：${it.stack ?? 1}/${def.stackSize}`, cls: 'prop' }],
        [{ text: def.description, cls: 'desc' }],
        [{ text: def.selfUse ? '按右鍵使用。' : '右鍵點擊此物品，再左鍵點擊要使用的物品。', cls: 'hint' }],
      ],
    };
  }
  if (it.gem) return gemTooltip(it, ctx);
  if (it.map) return mapTooltip(it, ctx);

  const base = getBase(it.baseId);
  const sections: TooltipLine[][] = [];
  const props: TooltipLine[] = [{ text: CLASS_LABEL[base.cls], cls: 'prop' }];
  if (it.quality > 0) props.push({ text: `品質：+${it.quality}%`, cls: 'aug' });

  const loc = localSheet(it);
  const wp = weaponProps(it);
  if (wp && base.weapon) {
    const physAug = it.quality > 0 || loc.inc('local_phys_inc') || loc.flat('local_phys_max');
    props.push({ text: `物理傷害：${fmtRange(wp.phys)}`, cls: physAug ? 'aug' : 'prop' });
    const ele = (['fire', 'cold', 'lightning', 'chaos'] as const).filter((t) => wp.ele[t][1] > 0);
    for (const t of ele) props.push({ text: `${t === 'chaos' ? '混沌' : '元素'}傷害：${fmtRange(wp.ele[t])}`, cls: t });
    props.push({ text: `暴擊率：${wp.crit.toFixed(2)}%`, cls: loc.inc('local_crit') ? 'aug' : 'prop' });
    props.push({ text: `每秒攻擊次數：${wp.aps.toFixed(2)}`, cls: loc.inc('local_attack_speed') ? 'aug' : 'prop' });
    props.push({ text: `武器範圍：${wp.range.toFixed(1)}`, cls: 'prop' });
  }
  const ap = armourProps(it);
  if (ap) {
    const aug = it.quality > 0 || loc.inc('local_def_inc');
    if (ap.block) props.push({ text: `格擋率：${ap.block}%`, cls: loc.flat('local_block') ? 'aug' : 'prop' });
    if (ap.armour) props.push({ text: `護甲：${ap.armour}`, cls: aug || loc.flat('local_armour') || loc.inc('local_armour_inc') ? 'aug' : 'prop' });
    if (ap.evasion) props.push({ text: `閃避值：${ap.evasion}`, cls: aug || loc.flat('local_evasion') || loc.inc('local_evasion_inc') ? 'aug' : 'prop' });
    if (ap.es) props.push({ text: `能量護盾：${ap.es}`, cls: aug || loc.flat('local_es') || loc.inc('local_es_inc') ? 'aug' : 'prop' });
  }
  const fp = flaskProps(it);
  if (fp && base.flask && it.flask) {
    const dur = fp.instant ? '（立即）' : `（${fp.duration.toFixed(2)} 秒內）`;
    if (fp.life) props.push({ text: `回復 ${fp.life} 生命${dur}`, cls: 'prop' });
    if (fp.mana) props.push({ text: `回復 ${fp.mana} 魔力${dur}`, cls: 'prop' });
    if (base.flask.kind === 'utility') props.push({ text: `持續 ${fp.duration.toFixed(2)} 秒`, cls: 'prop' });
    props.push({ text: `每次使用消耗 ${fp.chargesPerUse} / ${fp.maxCharges} 充能`, cls: 'prop' });
    props.push({ text: `目前充能 ${Math.floor(it.flask.charges)}`, cls: 'prop' });
    for (const e of fp.effectText) props.push({ text: e, cls: 'aug' });
  }
  sections.push(props);

  const req = reqSection(requiredLevel(it), attributeReqs(it), ctx);
  if (req.length) sections.push(req);
  if (it.sockets.length) {
    sections.push([{ text: `插槽：${socketString(it)}`, cls: 'prop' }]);
  }
  sections.push([{ text: `物品等級：${it.ilvl}`, cls: 'prop' }]);

  if (it.implicits.length) {
    sections.push(
      it.implicits.flatMap((m) => {
        const def = getMod(m.id);
        return modText(m, def).map((text) => ({ text, cls: (def.type === 'corrupted' ? 'implicit' : 'implicit') as LineClass, detail: def.type === 'corrupted' ? '汙染固定詞綴' : '固定詞綴' }));
      }),
    );
  }
  if (!it.identified) {
    sections.push([{ text: '未鑑定', cls: 'reqfail' }]);
  } else if (it.prefixes.length || it.suffixes.length) {
    const lines: TooltipLine[] = [];
    const add = (m: Item['prefixes'][number], label: string) => {
      const def = getMod(m.id);
      const isUnique = it.rarity === 'unique';
      const tierNo = def.tiers.length - m.tier;
      const name = def.names?.[m.tier];
      const detail = isUnique ? '傳奇詞綴' : `${label} · 第 ${tierNo} 階${name ? ` · "${name}"` : ''} · ${def.tiers[m.tier].values.map((v) => fmtRange(v)).join(' / ')}`;
      for (const text of modText(m, def)) lines.push({ text, cls: 'mod', detail });
    };
    it.prefixes.forEach((m) => add(m, '前綴'));
    it.suffixes.forEach((m) => add(m, '後綴'));
    sections.push(lines);
  }
  if (it.corrupted) sections.push([{ text: '已汙染', cls: 'corrupted' }]);
  if (it.uniqueId) {
    const u = UNIQUE_BY_ID[it.uniqueId];
    if (u) sections.push([{ text: u.flavour, cls: 'flavour' }]);
  }
  if (base.flask) sections.push([{ text: '按右鍵或對應數字鍵飲用。', cls: 'hint' }]);

  const title = it.rarity === 'rare' || it.rarity === 'unique' ? [displayName(it), baseName(it)] : [displayName(it)];
  if (!it.identified && it.rarity !== 'normal') title.splice(0, title.length, baseName(it));
  return { frame: it.rarity, title, sections };
}

export function socketString(it: Item): string {
  let s = '';
  it.sockets.forEach((sock, i) => {
    if (i > 0) s += it.sockets[i - 1].group === sock.group ? '-' : ' ';
    s += sock.color;
  });
  return s;
}

function gemTooltip(it: Item, ctx?: TooltipContext): Tooltip {
  const def = getGem(it.gem!.id);
  const level = it.gem!.level;
  const sections: TooltipLine[][] = [];
  const props: TooltipLine[] = [
    { text: def.tags.map((t) => TAG_ZH[t] ?? t).join('、') || '輔助', cls: 'prop' },
    { text: `等級：${level}${level >= 20 ? ' (最大)' : ''}`, cls: 'prop' },
  ];
  if (def.active) {
    const a = def.active;
    const cost = Math.round(lvl(a.manaCost[0], a.manaCost[1], level));
    if (a.reservation) props.push({ text: `保留：${a.reservation}% 魔力`, cls: 'prop' });
    else if (cost > 0) props.push({ text: `消耗：${cost} 魔力`, cls: 'prop' });
    if (a.castTime) props.push({ text: `施放時間：${a.castTime.toFixed(2)} 秒`, cls: 'prop' });
    if (a.attackSpeedMult && a.attackSpeedMult !== 1) props.push({ text: `攻擊速度：基礎的 ${Math.round(a.attackSpeedMult * 100)}%`, cls: 'prop' });
    if (a.crit) props.push({ text: `暴擊率：${a.crit.toFixed(2)}%`, cls: 'prop' });
    if (a.effectiveness) props.push({ text: `附加傷害效用：${Math.round(a.effectiveness * 100)}%`, cls: 'prop' });
  } else if (def.support) {
    props.push({ text: `消耗與保留倍率：${Math.round(def.support.manaMult * 100)}%`, cls: 'prop' });
  }
  if (it.quality) props.push({ text: `品質：+${it.quality}%`, cls: 'aug' });
  sections.push(props);
  const req = gemRequirements(def, level);
  const reqs = reqSection(req.level, req.value ? { [req.attr]: req.value } : {}, ctx);
  if (reqs.length) sections.push(reqs);
  sections.push([{ text: def.description, cls: 'gemdesc' }]);
  const lines = def.active?.levelText?.(level) ?? def.support?.text(level) ?? [];
  if (lines.length) sections.push(lines.map((text) => ({ text, cls: 'mod' as LineClass })));
  if (def.qualityText) {
    const per = def.quality[0]?.value ?? 0;
    const val = +(per * it.quality).toFixed(1);
    sections.push([
      { text: '品質額外效果：', cls: 'prop' },
      { text: def.qualityText.replace('{0}', String(it.quality ? val : `每 1% 品質 ${per}`)), cls: it.quality ? 'mod' : 'hint' },
    ]);
  }
  if (level < 20) {
    const need = gemXpToNext(def, level);
    sections.push([{ text: `經驗值：${Math.floor(it.gem!.xp).toLocaleString()}/${need.toLocaleString()}`, cls: 'prop' }]);
  }
  if (it.corrupted) sections.push([{ text: '已汙染', cls: 'corrupted' }]);
  sections.push([{ text: def.support ? '這是輔助寶石。它不會直接強化角色，而是強化與其相連插槽中的技能。' : '放入對應顏色的物品插槽以獲得此技能。', cls: 'hint' }]);
  return { frame: 'gem', title: [def.name], sections };
}

export function mapStats(it: Item): { quant: number; rarity: number; pack: number } {
  let quant = 0;
  let rarity = 0;
  let pack = 0;
  for (const m of [...it.prefixes, ...it.suffixes]) {
    const def = getMod(m.id);
    if (def.mapEffect) {
      quant += def.mapEffect.quant;
      rarity += def.mapEffect.rarity;
      if (def.mapEffect.packSize) pack += m.values[0] ?? 0;
    }
  }
  quant += it.quality;
  if (it.rarity === 'magic') quant += 5;
  if (it.rarity === 'rare') quant += 15;
  return { quant, rarity, pack };
}

function mapTooltip(it: Item, _ctx?: TooltipContext): Tooltip {
  const ms = mapStats(it);
  const sections: TooltipLine[][] = [];
  const props: TooltipLine[] = [
    { text: `地圖階級：${it.map!.tier}`, cls: 'prop' },
    { text: `區域等級：${it.ilvl}`, cls: 'prop' },
  ];
  if (ms.quant) props.push({ text: `物品數量：+${ms.quant}%`, cls: 'aug' });
  if (ms.rarity) props.push({ text: `物品稀有度：+${ms.rarity}%`, cls: 'aug' });
  if (ms.pack) props.push({ text: `怪物群規模：+${ms.pack}%`, cls: 'aug' });
  if (it.quality) props.push({ text: `品質：+${it.quality}%`, cls: 'aug' });
  sections.push(props);
  if (!it.identified) sections.push([{ text: '未鑑定', cls: 'reqfail' }]);
  else if (it.prefixes.length || it.suffixes.length) {
    sections.push([...it.prefixes, ...it.suffixes].flatMap((m) => modText(m).map((text) => ({ text, cls: 'mod' as LineClass, detail: getMod(m.id).type === 'prefix' ? '前綴 · 怪物詞綴' : '後綴 · 玩家詞綴' }))));
  }
  if (it.corrupted) sections.push([{ text: '已汙染', cls: 'corrupted' }]);
  sections.push([{ text: '將此地圖放入城鎮的地圖裝置以開啟傳送門。', cls: 'hint' }]);
  const name = mapName(it);
  const title = it.rarity === 'rare' && it.name && it.identified ? [it.name, name] : [name];
  return { frame: it.rarity, title, sections };
}
