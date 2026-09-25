import { getGem } from '../data/gems';
import { currencyId, itemSize } from '../items/item';
import type { Item, Socket } from '../items/types';
import { buildTooltip, type Tooltip, type TooltipContext } from '../items/tooltip';
import { h } from './dom';
import { itemIcon } from './icons';

export interface SocketHandlers {
  /** Return true if the click was consumed (otherwise it falls through to the item). */
  onSocketClick?: (item: Item, index: number, e: MouseEvent) => boolean;
  onSocketHover?: (item: Item, index: number, e: MouseEvent | null) => void;
}

/** PoE-style socket positions: a snake through a 2-wide item, or a column for 1-wide items. */
function socketPositions(w: number, h: number, count: number, cell: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const cx = (col: number) => (w === 1 ? (cell * w) / 2 : cell * (col + 0.5));
  const rows = Math.min(h, 3);
  const top = (cell * h - rows * cell * 0.62) / 2 + cell * 0.31;
  const cy = (row: number) => top + row * cell * 0.62;
  if (w === 1) {
    for (let i = 0; i < count; i++) out.push({ x: cx(0), y: cy(i) + (rows === 3 ? 0 : 0) });
    return out;
  }
  const order = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 2], [1, 2]];
  for (let i = 0; i < count; i++) out.push({ x: cx(order[i][0]), y: cy(order[i][1]) });
  return out;
}

export function socketsEl(item: Item, cell: number, handlers: SocketHandlers = {}): HTMLElement {
  const [w, hh] = itemSize(item);
  const wrap = h('div', { class: 'sockets' });
  const pos = socketPositions(w, hh, item.sockets.length, cell);
  item.sockets.forEach((s: Socket, i) => {
    if (i > 0 && item.sockets[i - 1].group === s.group) {
      const a = pos[i - 1];
      const b = pos[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      wrap.append(h('div', { class: 'link', style: `left:${a.x}px;top:${a.y - 3}px;width:${len}px;height:6px;transform-origin:0 50%;transform:rotate(${ang}rad)` }));
    }
  });
  item.sockets.forEach((s, i) => {
    const gemColor = s.gem?.gem ? getGem(s.gem.gem.id).color : '';
    const el = h('div', {
      class: `socket ${s.color}${s.gem ? ' has-gem' : ''}`,
      style: `left:${pos[i].x}px;top:${pos[i].y}px;${s.gem ? `box-shadow: 0 0 6px ${gemColor === 'R' ? '#f44' : gemColor === 'G' ? '#4f4' : '#48f'}` : ''}`,
    });
    el.dataset.socket = String(i);
    if (handlers.onSocketClick) {
      el.addEventListener('mousedown', (e) => {
        if (handlers.onSocketClick!(item, i, e)) e.stopPropagation();
      });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    if (handlers.onSocketHover && s.gem) {
      el.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        handlers.onSocketHover!(item, i, e);
      });
      el.addEventListener('mouseleave', () => handlers.onSocketHover!(item, i, null));
    }
    wrap.append(el);
  });
  return wrap;
}

export function itemEl(item: Item, cell: number, opts: SocketHandlers & { unusable?: boolean } = {}): HTMLElement {
  const [w, hh] = itemSize(item);
  const cls = ['item', item.rarity];
  if (item.gem) cls.push('gem');
  if (!item.identified) cls.push('unid');
  if (item.corrupted) cls.push('corrupted');
  if (opts.unusable) cls.push('unusable');
  const el = h('div', { class: cls.join(' '), style: `width:${w * cell}px;height:${hh * cell}px` }, h('img', { src: itemIcon(item), draggable: 'false' }));
  if (item.stack !== undefined && currencyId(item)) el.append(h('div', { class: 'stack' }, String(item.stack)));
  if (item.gem) el.append(h('div', { class: 'glvl' }, `${item.gem.level}${item.quality ? ` · ${item.quality}%` : ''}`));
  if (item.sockets.length) el.append(socketsEl(item, cell, opts));
  return el;
}

export function tooltipEl(tt: Tooltip, alt: boolean, title?: string): HTMLElement {
  const el = h('div', { class: 'tooltip' });
  if (title) el.append(h('div', { class: 'tt-compare-title' }, title));
  el.append(h('div', { class: `tt-head ${tt.frame}` }, ...tt.title.flatMap((t, i) => (i ? [h('br'), t] : [t]))));
  for (const sec of tt.sections) {
    if (!sec.length) continue;
    const s = h('div', { class: 'tt-sec' });
    for (const line of sec) {
      const l = h('div', { class: `tt-line ${line.cls ?? ''}` }, line.text);
      if (alt && line.detail) l.append(h('span', { class: 'detail' }, line.detail));
      s.append(l);
    }
    el.append(s);
  }
  return el;
}

/** Floating tooltip that follows the mouse and optionally shows the equipped item for comparison. */
export class TooltipView {
  private wrap = h('div', { class: 'tt-wrap' });
  private current: { item: Item; compare?: Item[] } | null = null;
  private lastAlt = false;

  constructor(parent: HTMLElement) {
    parent.append(this.wrap);
    this.wrap.style.display = 'none';
  }

  show(item: Item, ctx: TooltipContext, alt: boolean, compare: Item[] = []): void {
    this.current = { item, compare };
    this.lastAlt = alt;
    this.wrap.innerHTML = '';
    this.wrap.append(tooltipEl(buildTooltip(item, ctx), alt));
    for (const c of compare) this.wrap.append(tooltipEl(buildTooltip(c, ctx), alt, 'Currently Equipped'));
    this.wrap.style.display = 'flex';
  }

  showCustom(el: HTMLElement): void {
    this.current = null;
    this.wrap.innerHTML = '';
    this.wrap.append(el);
    this.wrap.style.display = 'flex';
  }

  hide(): void {
    this.current = null;
    this.wrap.style.display = 'none';
  }

  get visible(): boolean {
    return this.wrap.style.display !== 'none';
  }

  get item(): Item | null {
    return this.current?.item ?? null;
  }

  refresh(ctx: TooltipContext, alt: boolean): void {
    if (this.current && alt !== this.lastAlt) this.show(this.current.item, ctx, alt, this.current.compare);
  }

  position(mx: number, my: number): void {
    if (!this.visible) return;
    const r = this.wrap.getBoundingClientRect();
    let x = mx + 22;
    let y = my - r.height / 2;
    if (x + r.width > window.innerWidth - 8) x = mx - r.width - 22;
    if (x < 8) x = 8;
    y = Math.max(8, Math.min(window.innerHeight - r.height - 8, y));
    this.wrap.style.left = `${x}px`;
    this.wrap.style.top = `${y}px`;
  }
}
