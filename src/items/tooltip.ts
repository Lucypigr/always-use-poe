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

const ATTR_NAME: Record<Attr, string> = { str: 'Str', dex: 'Dex', int: 'Int' };

function reqSection(level: number, reqs: Partial<Record<Attr, number>>, ctx?: TooltipContext): TooltipLine[] {
  const parts: TooltipLine[] = [];
  if (level > 1) parts.push({ text: `Level ${level}`, cls: ctx && ctx.level < level ? 'reqfail' : 'req' });
  for (const a of ['str', 'dex', 'int'] as Attr[]) {
    const v = reqs[a];
    if (v) parts.push({ text: `${v} ${ATTR_NAME[a]}`, cls: ctx && ctx.attrs[a] < v ? 'reqfail' : 'req' });
  }
  if (!parts.length) return [];
  return [{ text: `Requires ${parts.map((p) => p.text).join(', ')}`, cls: parts.some((p) => p.cls === 'reqfail') ? 'reqfail' : 'req' }];
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
        [{ text: `Stack Size: ${it.stack ?? 1}/${def.stackSize}`, cls: 'prop' }],
        [{ text: def.description, cls: 'desc' }],
        [{ text: def.selfUse ? 'Right click to use.' : 'Right click this item then left click on an item to apply it.', cls: 'hint' }],
      ],
    };
  }
  if (it.gem) return gemTooltip(it, ctx);
  if (it.map) return mapTooltip(it, ctx);

  const base = getBase(it.baseId);
  const sections: TooltipLine[][] = [];
  const props: TooltipLine[] = [{ text: CLASS_LABEL[base.cls], cls: 'prop' }];
  if (it.quality > 0) props.push({ text: `Quality: +${it.quality}%`, cls: 'aug' });

  const loc = localSheet(it);
  const wp = weaponProps(it);
  if (wp && base.weapon) {
    const physAug = it.quality > 0 || loc.inc('local_phys_inc') || loc.flat('local_phys_max');
    props.push({ text: `Physical Damage: ${fmtRange(wp.phys)}`, cls: physAug ? 'aug' : 'prop' });
    const ele = (['fire', 'cold', 'lightning', 'chaos'] as const).filter((t) => wp.ele[t][1] > 0);
    for (const t of ele) props.push({ text: `${t === 'chaos' ? 'Chaos' : 'Elemental'} Damage: ${fmtRange(wp.ele[t])}`, cls: t });
    props.push({ text: `Critical Strike Chance: ${wp.crit.toFixed(2)}%`, cls: loc.inc('local_crit') ? 'aug' : 'prop' });
    props.push({ text: `Attacks per Second: ${wp.aps.toFixed(2)}`, cls: loc.inc('local_attack_speed') ? 'aug' : 'prop' });
    props.push({ text: `Weapon Range: ${wp.range.toFixed(1)}`, cls: 'prop' });
  }
  const ap = armourProps(it);
  if (ap) {
    const aug = it.quality > 0 || loc.inc('local_def_inc');
    if (ap.block) props.push({ text: `Chance to Block: ${ap.block}%`, cls: loc.flat('local_block') ? 'aug' : 'prop' });
    if (ap.armour) props.push({ text: `Armour: ${ap.armour}`, cls: aug || loc.flat('local_armour') || loc.inc('local_armour_inc') ? 'aug' : 'prop' });
    if (ap.evasion) props.push({ text: `Evasion Rating: ${ap.evasion}`, cls: aug || loc.flat('local_evasion') || loc.inc('local_evasion_inc') ? 'aug' : 'prop' });
    if (ap.es) props.push({ text: `Energy Shield: ${ap.es}`, cls: aug || loc.flat('local_es') || loc.inc('local_es_inc') ? 'aug' : 'prop' });
  }
  const fp = flaskProps(it);
  if (fp && base.flask && it.flask) {
    const dur = fp.instant ? 'instantly' : `over ${fp.duration.toFixed(2)} seconds`;
    if (fp.life) props.push({ text: `Recovers ${fp.life} Life ${dur}`, cls: 'prop' });
    if (fp.mana) props.push({ text: `Recovers ${fp.mana} Mana ${dur}`, cls: 'prop' });
    if (base.flask.kind === 'utility') props.push({ text: `Lasts ${fp.duration.toFixed(2)} Seconds`, cls: 'prop' });
    props.push({ text: `Consumes ${fp.chargesPerUse} of ${fp.maxCharges} Charges on use`, cls: 'prop' });
    props.push({ text: `Currently has ${Math.floor(it.flask.charges)} Charges`, cls: 'prop' });
    for (const e of fp.effectText) props.push({ text: e, cls: 'aug' });
  }
  sections.push(props);

  const req = reqSection(requiredLevel(it), attributeReqs(it), ctx);
  if (req.length) sections.push(req);
  if (it.sockets.length) {
    sections.push([{ text: `Sockets: ${socketString(it)}`, cls: 'prop' }]);
  }
  sections.push([{ text: `Item Level: ${it.ilvl}`, cls: 'prop' }]);

  if (it.implicits.length) {
    sections.push(
      it.implicits.flatMap((m) => {
        const def = getMod(m.id);
        return modText(m, def).map((text) => ({ text, cls: (def.type === 'corrupted' ? 'implicit' : 'implicit') as LineClass, detail: def.type === 'corrupted' ? 'Corrupted Implicit' : 'Implicit' }));
      }),
    );
  }
  if (!it.identified) {
    sections.push([{ text: 'Unidentified', cls: 'reqfail' }]);
  } else if (it.prefixes.length || it.suffixes.length) {
    const lines: TooltipLine[] = [];
    const add = (m: Item['prefixes'][number], label: string) => {
      const def = getMod(m.id);
      const isUnique = it.rarity === 'unique';
      const tierNo = def.tiers.length - m.tier;
      const name = def.names?.[m.tier];
      const detail = isUnique ? 'Unique Modifier' : `${label} · Tier ${tierNo}${name ? ` · "${name}"` : ''} · ${def.tiers[m.tier].values.map((v) => fmtRange(v)).join(' / ')}`;
      for (const text of modText(m, def)) lines.push({ text, cls: 'mod', detail });
    };
    it.prefixes.forEach((m) => add(m, 'Prefix'));
    it.suffixes.forEach((m) => add(m, 'Suffix'));
    sections.push(lines);
  }
  if (it.corrupted) sections.push([{ text: 'Corrupted', cls: 'corrupted' }]);
  if (it.uniqueId) {
    const u = UNIQUE_BY_ID[it.uniqueId];
    if (u) sections.push([{ text: u.flavour, cls: 'flavour' }]);
  }
  if (base.flask) sections.push([{ text: 'Right click or press its number key to drink.', cls: 'hint' }]);

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
    { text: def.tags.map((t) => t[0].toUpperCase() + t.slice(1)).join(', ') || 'Support', cls: 'prop' },
    { text: `Level: ${level}${level >= 20 ? ' (Max)' : ''}`, cls: 'prop' },
  ];
  if (def.active) {
    const a = def.active;
    const cost = Math.round(lvl(a.manaCost[0], a.manaCost[1], level));
    if (a.reservation) props.push({ text: `Reservation: ${a.reservation}% Mana`, cls: 'prop' });
    else if (cost > 0) props.push({ text: `Cost: ${cost} Mana`, cls: 'prop' });
    if (a.castTime) props.push({ text: `Cast Time: ${a.castTime.toFixed(2)} sec`, cls: 'prop' });
    if (a.attackSpeedMult && a.attackSpeedMult !== 1) props.push({ text: `Attack Speed: ${Math.round(a.attackSpeedMult * 100)}% of base`, cls: 'prop' });
    if (a.crit) props.push({ text: `Critical Strike Chance: ${a.crit.toFixed(2)}%`, cls: 'prop' });
    if (a.effectiveness) props.push({ text: `Effectiveness of Added Damage: ${Math.round(a.effectiveness * 100)}%`, cls: 'prop' });
  } else if (def.support) {
    props.push({ text: `Cost & Reservation Multiplier: ${Math.round(def.support.manaMult * 100)}%`, cls: 'prop' });
  }
  if (it.quality) props.push({ text: `Quality: +${it.quality}%`, cls: 'aug' });
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
      { text: 'Additional Effects From Quality:', cls: 'prop' },
      { text: def.qualityText.replace('{0}', String(it.quality ? val : `${per}` + ' per 1%')), cls: it.quality ? 'mod' : 'hint' },
    ]);
  }
  if (level < 20) {
    const need = gemXpToNext(def, level);
    sections.push([{ text: `Experience: ${Math.floor(it.gem!.xp).toLocaleString()}/${need.toLocaleString()}`, cls: 'prop' }]);
  }
  if (it.corrupted) sections.push([{ text: 'Corrupted', cls: 'corrupted' }]);
  sections.push([{ text: def.support ? 'This is a Support Gem. It does not grant a bonus to your character, but to skills in sockets connected to it.' : 'Place into an item socket of the right colour to gain this skill.', cls: 'hint' }]);
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
    { text: `Map Tier: ${it.map!.tier}`, cls: 'prop' },
    { text: `Area Level: ${it.ilvl}`, cls: 'prop' },
  ];
  if (ms.quant) props.push({ text: `Item Quantity: +${ms.quant}%`, cls: 'aug' });
  if (ms.rarity) props.push({ text: `Item Rarity: +${ms.rarity}%`, cls: 'aug' });
  if (ms.pack) props.push({ text: `Monster Pack Size: +${ms.pack}%`, cls: 'aug' });
  if (it.quality) props.push({ text: `Quality: +${it.quality}%`, cls: 'aug' });
  sections.push(props);
  if (!it.identified) sections.push([{ text: 'Unidentified', cls: 'reqfail' }]);
  else if (it.prefixes.length || it.suffixes.length) {
    sections.push([...it.prefixes, ...it.suffixes].flatMap((m) => modText(m).map((text) => ({ text, cls: 'mod' as LineClass, detail: getMod(m.id).type === 'prefix' ? 'Prefix · Monster modifier' : 'Suffix · Player modifier' }))));
  }
  if (it.corrupted) sections.push([{ text: 'Corrupted', cls: 'corrupted' }]);
  sections.push([{ text: 'Place this Map into the Map Device in town to open portals to it.', cls: 'hint' }]);
  const name = mapName(it);
  const title = it.rarity === 'rare' && it.name && it.identified ? [it.name, name] : [name];
  return { frame: it.rarity, title, sections };
}
