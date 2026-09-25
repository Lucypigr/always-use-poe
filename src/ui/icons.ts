import { getBase } from '../data/bases';
import { CURRENCY_BY_ID } from '../data/currency';
import { getGem } from '../data/gems';
import { currencyId, flaskProps } from '../items/item';
import type { DefenceType, Item } from '../items/types';

/**
 * Procedural SVG icons for every item class, so the game ships without image assets.
 * Icons are drawn in a 100×(100·h/w) viewBox matching the item's inventory footprint.
 */

const DEF_COLORS: Record<DefenceType, [string, string]> = {
  str: ['#9aa0aa', '#5a606a'],
  dex: ['#8a6a40', '#4a3520'],
  int: ['#5a6ec0', '#2a3470'],
  str_dex: ['#9a8a60', '#5a4a30'],
  str_int: ['#b0a070', '#6a5a30'],
  dex_int: ['#6a5a90', '#342a50'],
};

const cache = new Map<string, string>();

function svg(w: number, h: number, body: string, defs = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${defs}${body}</svg>`;
}

function grad(id: string, a: string, b: string): string {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
}

function weaponSvg(cls: string, h: number, accent: string): string {
  const metal = 'url(#m)';
  const defs = grad('m', '#e8e8f0', '#707480');
  const wood = '#6b4a2b';
  const cx = 50;
  switch (cls) {
    case 'one_hand_sword':
    case 'two_hand_sword':
      return svg(100, h, `<polygon points="${cx - 7},${h * 0.72} ${cx - 6},${h * 0.1} ${cx},${h * 0.02} ${cx + 6},${h * 0.1} ${cx + 7},${h * 0.72}" fill="${metal}" stroke="#303038" stroke-width="2"/>
        <rect x="${cx - 24}" y="${h * 0.72}" width="48" height="7" rx="2" fill="${accent}" stroke="#202020" stroke-width="2"/>
        <rect x="${cx - 5}" y="${h * 0.72 + 7}" width="10" height="${h * 0.18}" fill="${wood}" stroke="#202020" stroke-width="2"/>
        <circle cx="${cx}" cy="${h * 0.95}" r="6" fill="${accent}"/>`, defs);
    case 'one_hand_axe':
    case 'two_hand_axe':
      return svg(100, h, `<rect x="${cx - 5}" y="${h * 0.1}" width="10" height="${h * 0.85}" rx="3" fill="${wood}" stroke="#202020" stroke-width="2"/>
        <path d="M ${cx + 4} ${h * 0.12} Q ${cx + 45} ${h * 0.08} ${cx + 42} ${h * 0.42} Q ${cx + 20} ${h * 0.34} ${cx + 4} ${h * 0.36} Z" fill="${metal}" stroke="#303038" stroke-width="2"/>
        ${cls === 'two_hand_axe' ? `<path d="M ${cx - 4} ${h * 0.12} Q ${cx - 45} ${h * 0.08} ${cx - 42} ${h * 0.42} Q ${cx - 20} ${h * 0.34} ${cx - 4} ${h * 0.36} Z" fill="${metal}" stroke="#303038" stroke-width="2"/>` : ''}`, defs);
    case 'one_hand_mace':
    case 'two_hand_mace':
      return svg(100, h, `<rect x="${cx - 5}" y="${h * 0.25}" width="10" height="${h * 0.7}" rx="3" fill="${wood}" stroke="#202020" stroke-width="2"/>
        <circle cx="${cx}" cy="${h * 0.2}" r="${cls === 'two_hand_mace' ? 26 : 20}" fill="${metal}" stroke="#303038" stroke-width="2"/>
        ${[0, 60, 120, 180, 240, 300].map((a) => `<polygon points="${cx + Math.cos((a * Math.PI) / 180) * 18},${h * 0.2 + Math.sin((a * Math.PI) / 180) * 18} ${cx + Math.cos((a * Math.PI) / 180) * 32},${h * 0.2 + Math.sin((a * Math.PI) / 180) * 32} ${cx + Math.cos(((a + 20) * Math.PI) / 180) * 18},${h * 0.2 + Math.sin(((a + 20) * Math.PI) / 180) * 18}" fill="#9098a0"/>`).join('')}`, defs);
    case 'sceptre':
      return svg(100, h, `<rect x="${cx - 5}" y="${h * 0.25}" width="10" height="${h * 0.7}" rx="3" fill="#8a6a30" stroke="#202020" stroke-width="2"/>
        <path d="M ${cx - 20} ${h * 0.28} L ${cx} ${h * 0.04} L ${cx + 20} ${h * 0.28} Z" fill="#d8b848" stroke="#5a4a10" stroke-width="2"/>
        <circle cx="${cx}" cy="${h * 0.2}" r="8" fill="${accent}"/>`);
    case 'dagger':
      return svg(100, h, `<polygon points="${cx - 9},${h * 0.62} ${cx},${h * 0.04} ${cx + 9},${h * 0.62}" fill="${metal}" stroke="#303038" stroke-width="2"/>
        <rect x="${cx - 18}" y="${h * 0.62}" width="36" height="6" fill="${accent}"/>
        <rect x="${cx - 5}" y="${h * 0.62 + 6}" width="10" height="${h * 0.25}" fill="${wood}" stroke="#202020" stroke-width="2"/>`, defs);
    case 'claw':
      return svg(100, h, `<rect x="20" y="${h * 0.55}" width="60" height="30" rx="8" fill="#6a4a30" stroke="#202020" stroke-width="2"/>
        ${[28, 50, 72].map((x) => `<path d="M ${x - 6} ${h * 0.56} Q ${x - 10} ${h * 0.2} ${x + 8} ${h * 0.06} Q ${x + 2} ${h * 0.3} ${x + 6} ${h * 0.56} Z" fill="${metal}" stroke="#303038" stroke-width="2"/>`).join('')}`, defs);
    case 'wand':
      return svg(100, h, `<rect x="${cx - 4}" y="${h * 0.15}" width="8" height="${h * 0.8}" rx="3" fill="${wood}" stroke="#202020" stroke-width="2" transform="rotate(8 ${cx} ${h / 2})"/>
        <circle cx="${cx + 5}" cy="${h * 0.12}" r="10" fill="${accent}" opacity="0.9"/><circle cx="${cx + 5}" cy="${h * 0.12}" r="16" fill="${accent}" opacity="0.25"/>`);
    case 'staff':
      return svg(100, h, `<rect x="${cx - 5}" y="${h * 0.1}" width="10" height="${h * 0.88}" rx="4" fill="${wood}" stroke="#202020" stroke-width="2"/>
        <polygon points="${cx},${h * 0.0 + 4} ${cx + 12},${h * 0.1} ${cx},${h * 0.18} ${cx - 12},${h * 0.1}" fill="${accent}" stroke="#203040" stroke-width="2"/>`);
    case 'bow':
      return svg(100, h, `<path d="M 60 ${h * 0.03} Q 5 ${h * 0.5} 60 ${h * 0.97}" fill="none" stroke="${wood}" stroke-width="9" stroke-linecap="round"/>
        <line x1="60" y1="${h * 0.03}" x2="60" y2="${h * 0.97}" stroke="#e8e0c8" stroke-width="2"/>
        <rect x="24" y="${h * 0.45}" width="10" height="${h * 0.1}" fill="${accent}"/>`);
    default:
      return svg(100, h, `<rect x="20" y="10" width="60" height="${h - 20}" fill="#666"/>`);
  }
}

function armourSvg(cls: string, h: number, d: DefenceType, accent: string): string {
  const [a, b] = DEF_COLORS[d];
  const defs = grad('a', a, b);
  const f = 'url(#a)';
  const st = 'stroke="#1a1a1a" stroke-width="3"';
  switch (cls) {
    case 'helmet':
      return svg(100, h, `<path d="M 15 ${h * 0.7} Q 15 ${h * 0.08} 50 ${h * 0.08} Q 85 ${h * 0.08} 85 ${h * 0.7} L 70 ${h * 0.9} L 30 ${h * 0.9} Z" fill="${f}" ${st}/>
        <rect x="30" y="${h * 0.45}" width="40" height="8" fill="#101010"/><rect x="46" y="${h * 0.12}" width="8" height="${h * 0.5}" fill="${accent}" opacity="0.8"/>`, defs);
    case 'body_armour':
      return svg(100, h, `<path d="M 25 ${h * 0.06} L 40 ${h * 0.12} L 60 ${h * 0.12} L 75 ${h * 0.06} L 96 ${h * 0.22} L 86 ${h * 0.4} L 78 ${h * 0.36} L 78 ${h * 0.94} L 22 ${h * 0.94} L 22 ${h * 0.36} L 14 ${h * 0.4} L 4 ${h * 0.22} Z" fill="${f}" ${st}/>
        <path d="M 40 ${h * 0.12} L 50 ${h * 0.3} L 60 ${h * 0.12}" fill="none" stroke="${accent}" stroke-width="3"/><rect x="22" y="${h * 0.66}" width="56" height="7" fill="${accent}" opacity="0.8"/>`, defs);
    case 'gloves':
      return svg(100, h, `<path d="M 25 ${h * 0.92} L 25 ${h * 0.45} L 20 ${h * 0.3} L 28 ${h * 0.27} L 34 ${h * 0.4} L 34 ${h * 0.1} L 44 ${h * 0.1} L 46 ${h * 0.36} L 50 ${h * 0.06} L 60 ${h * 0.07} L 60 ${h * 0.37} L 66 ${h * 0.12} L 75 ${h * 0.14} L 72 ${h * 0.45} L 76 ${h * 0.92} Z" fill="${f}" ${st}/>
        <rect x="25" y="${h * 0.76}" width="51" height="8" fill="${accent}" opacity="0.8"/>`, defs);
    case 'boots':
      return svg(100, h, `<path d="M 30 ${h * 0.06} L 62 ${h * 0.06} L 62 ${h * 0.62} L 90 ${h * 0.74} L 90 ${h * 0.92} L 22 ${h * 0.92} L 26 ${h * 0.62} Z" fill="${f}" ${st}/>
        <rect x="30" y="${h * 0.2}" width="32" height="7" fill="${accent}" opacity="0.8"/>`, defs);
    case 'shield':
      return svg(100, h, `<path d="M 12 ${h * 0.08} L 88 ${h * 0.08} L 88 ${h * 0.5} Q 88 ${h * 0.82} 50 ${h * 0.96} Q 12 ${h * 0.82} 12 ${h * 0.5} Z" fill="${f}" ${st}/>
        <path d="M 50 ${h * 0.14} L 50 ${h * 0.86} M 20 ${h * 0.42} L 80 ${h * 0.42}" stroke="${accent}" stroke-width="6" opacity="0.8"/>`, defs);
  }
  return svg(100, h, '');
}

function jewellerySvg(cls: string, h: number, accent: string): string {
  const gold = grad('g', '#ffe8a0', '#a07820');
  switch (cls) {
    case 'ring':
      return svg(100, h, `<circle cx="50" cy="56" r="28" fill="none" stroke="url(#g)" stroke-width="12"/><circle cx="50" cy="26" r="13" fill="${accent}" stroke="#1a1a1a" stroke-width="2"/>`, gold);
    case 'amulet':
      return svg(100, h, `<path d="M 18 8 Q 50 60 82 8" fill="none" stroke="url(#g)" stroke-width="5"/><polygon points="50,52 66,70 50,94 34,70" fill="${accent}" stroke="#1a1a1a" stroke-width="3"/>`, gold);
    case 'belt':
      return svg(200, 100, `<rect x="6" y="34" width="188" height="32" rx="6" fill="#6a4a2a" stroke="#1a1a1a" stroke-width="3"/><rect x="84" y="26" width="32" height="48" rx="4" fill="none" stroke="url(#g)" stroke-width="7"/><circle cx="40" cy="50" r="6" fill="${accent}"/><circle cx="160" cy="50" r="6" fill="${accent}"/>`, gold);
    case 'quiver':
      return svg(100, h, `<rect x="28" y="${h * 0.22}" width="44" height="${h * 0.74}" rx="10" fill="#6a4020" stroke="#1a1a1a" stroke-width="3"/>
        ${[36, 50, 64].map((x) => `<line x1="${x}" y1="${h * 0.24}" x2="${x}" y2="${h * 0.04}" stroke="#d8c8a0" stroke-width="3"/><polygon points="${x - 5},${h * 0.04} ${x},${h * 0.0} ${x + 5},${h * 0.04} ${x},${h * 0.1}" fill="${accent}"/>`).join('')}`);
  }
  return svg(100, h, '');
}

function flaskSvg(kind: string, fill: number): string {
  const liquid = kind === 'life' ? '#d02020' : kind === 'mana' ? '#2040d0' : kind === 'hybrid' ? '#8030b0' : '#d8b848';
  const top = 200 - 130 * fill;
  return svg(100, 200, `<clipPath id="fc"><path d="M 38 20 L 62 20 L 62 60 Q 90 80 90 130 Q 90 190 50 190 Q 10 190 10 130 Q 10 80 38 60 Z"/></clipPath>
    <rect x="0" y="${top}" width="100" height="200" fill="${liquid}" clip-path="url(#fc)" opacity="0.9"/>
    <path d="M 38 20 L 62 20 L 62 60 Q 90 80 90 130 Q 90 190 50 190 Q 10 190 10 130 Q 10 80 38 60 Z" fill="rgba(200,220,255,0.12)" stroke="#c8d0d8" stroke-width="4"/>
    <rect x="34" y="6" width="32" height="16" rx="3" fill="#7a5a3a" stroke="#1a1a1a" stroke-width="2"/>`);
}

function gemSvg(color: string): string {
  const c = color === 'R' ? ['#ff6060', '#901010'] : color === 'G' ? ['#70ff70', '#107010'] : ['#7090ff', '#102090'];
  return svg(100, 100, `${grad('gm', c[0], c[1])}<polygon points="50,6 86,28 86,72 50,94 14,72 14,28" fill="url(#gm)" stroke="#101010" stroke-width="3"/>
    <polygon points="50,6 86,28 50,50 14,28" fill="rgba(255,255,255,0.25)"/><polygon points="50,50 86,72 50,94" fill="rgba(0,0,0,0.2)"/>`);
}

function currencySvg(id: string): string {
  const def = CURRENCY_BY_ID[id as keyof typeof CURRENCY_BY_ID];
  const [a, b] = def.colors;
  if (id === 'identify' || id === 'portal') {
    return svg(100, 100, `<rect x="22" y="14" width="56" height="72" rx="6" fill="#e8d8b0" stroke="#5a4020" stroke-width="3"/>
      <rect x="16" y="10" width="68" height="12" rx="6" fill="${a}" stroke="#5a4020" stroke-width="2"/><rect x="16" y="78" width="68" height="12" rx="6" fill="${a}" stroke="#5a4020" stroke-width="2"/>
      ${[32, 42, 52, 62].map((y) => `<line x1="30" y1="${y}" x2="70" y2="${y}" stroke="${b}" stroke-width="2"/>`).join('')}`);
  }
  if (['whetstone', 'armour_scrap', 'bauble', 'gcp'].includes(id)) {
    return svg(100, 100, `${grad('cq', a, b)}<polygon points="50,10 82,40 68,88 30,86 16,42" fill="url(#cq)" stroke="#1a1a1a" stroke-width="3"/><polygon points="50,10 82,40 50,50 16,42" fill="rgba(255,255,255,0.3)"/>`);
  }
  return svg(100, 100, `<defs><radialGradient id="co" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs>
    <circle cx="50" cy="50" r="36" fill="url(#co)" stroke="#1a1a1a" stroke-width="3"/><circle cx="50" cy="50" r="18" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="3"/>`);
}

function mapSvg(tier: number): string {
  const hue = Math.max(0, 50 - tier * 5);
  return svg(100, 100, `<rect x="12" y="16" width="76" height="68" rx="4" fill="hsl(${hue},40%,70%)" stroke="#3a2a1a" stroke-width="3"/>
    <path d="M 20 60 Q 35 30 50 50 T 80 30" fill="none" stroke="#5a3a1a" stroke-width="3"/><circle cx="62" cy="58" r="5" fill="#a02020"/>
    <text x="50" y="80" text-anchor="middle" font-size="16" font-family="serif" fill="#3a2a1a">T${tier}</text>`);
}

/** Data URL of an item's inventory icon. */
export function itemIcon(it: Item): string {
  const cid = currencyId(it);
  if (cid) return cached(`cur:${cid}`, () => currencySvg(cid));
  if (it.gem) {
    const g = getGem(it.gem.id);
    return cached(`gem:${g.color}`, () => gemSvg(g.color));
  }
  if (it.map) return cached(`map:${it.map.tier}`, () => mapSvg(it.map!.tier));
  const base = getBase(it.baseId);
  const accent = it.rarity === 'unique' ? '#e08a30' : it.rarity === 'rare' ? '#e0d060' : it.rarity === 'magic' ? '#7a8aff' : '#a0a0a0';
  const h = (100 * base.h) / base.w;
  if (base.flask && it.flask) {
    const fp = flaskProps(it);
    const f = fp ? Math.max(0, Math.min(1, it.flask.charges / fp.maxCharges)) : 1;
    const step = Math.round(f * 10);
    return cached(`flask:${base.flask.kind}:${step}`, () => flaskSvg(base.flask!.kind, step / 10));
  }
  if (base.weapon) return cached(`w:${base.cls}:${h}:${accent}`, () => weaponSvg(base.cls, h, accent));
  if (base.defence) return cached(`a:${base.cls}:${base.defence}:${accent}`, () => armourSvg(base.cls, h, base.defence!, accent));
  return cached(`j:${base.cls}:${accent}`, () => jewellerySvg(base.cls, h, accent));
}

/** Icons are returned as data URLs so each SVG is an isolated document (gradient ids can't collide). */
function cached(key: string, make: () => string): string {
  let v = cache.get(key);
  if (!v) cache.set(key, (v = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(make())}`));
  return v;
}
