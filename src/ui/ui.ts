import { CURRENCY_BY_ID } from '../data/currency';
import { canEquip, equipItem, FLASK_SLOTS, meetsRequirements, slotsFor, socketAccepts } from '../game/equip';
import type { Game } from '../game/game';
import { addItem, itemAt, newGrid, placeAt, removeItem, type Grid } from '../items/grid';
import { currencyId, displayName, itemSize } from '../items/item';
import type { EquipSlot, Item } from '../items/types';
import type { TooltipContext } from '../items/tooltip';
import type { Renderer } from '../render/renderer';
import { evaluateSale } from '../game/vendor';
import { CharacterSheet } from './charSheet';
import { clear, h } from './dom';
import { Hud } from './hud';
import { itemIcon } from './icons';
import { itemEl, TooltipView } from './itemView';
import { Modals } from './modals';
import { PassiveTreeView } from './passiveTree';

export type PanelId = 'inventory' | 'character' | 'stash' | 'vendor' | 'passives';

type Loc = { kind: 'inv' } | { kind: 'stash'; tab: number } | { kind: 'sell' } | { kind: 'equip'; slot: EquipSlot } | { kind: 'device' };

const INV_CELL = 46;
const STASH_CELL = 38;

/** Where each equipment slot sits on the paper doll (px, within a 552×410 box). */
const DOLL: Record<EquipSlot, [number, number, number, number, string]> = {
  weapon: [16, 20, 92, 184, 'Main Hand'],
  offhand: [444, 20, 92, 184, 'Off Hand'],
  helmet: [230, 6, 92, 92, 'Helmet'],
  body: [230, 106, 92, 138, 'Body'],
  gloves: [124, 212, 92, 92, 'Gloves'],
  boots: [336, 212, 92, 92, 'Boots'],
  amulet: [336, 106, 46, 46, 'Amulet'],
  ring1: [170, 150, 46, 46, 'Ring'],
  ring2: [336, 160, 46, 46, 'Ring'],
  belt: [230, 252, 92, 46, 'Belt'],
  flask1: [161, 316, 46, 92, '1'],
  flask2: [207, 316, 46, 92, '2'],
  flask3: [253, 316, 46, 92, '3'],
  flask4: [299, 316, 46, 92, '4'],
  flask5: [345, 316, 46, 92, '5'],
};

export class UI {
  readonly root: HTMLElement;
  alt = false;
  ctrl = false;
  shift = false;
  mouse = { x: 0, y: 0 };
  cursor: { item: Item; from: Loc | null } | null = null;
  applying: Item | null = null;
  open = new Set<PanelId>();
  tooltip: TooltipView;
  hud: Hud;
  modals: Modals;
  sheet: CharacterSheet;
  tree: PassiveTreeView;
  stashTab = 0;
  vendorTab: 'buy' | 'sell' = 'buy';
  sellGrid: Grid = newGrid(12, 5);
  deviceMap: Item | null = null;
  private panels: Record<PanelId, HTMLElement>;
  private cursorEl = h('div', { class: 'cursor-item' });
  private currencyCursor = h('img', { class: 'cursor-currency' });
  private hoverSource: { item: Item; loc: Loc | null } | null = null;
  private unsub: (() => void)[] = [];

  constructor(
    root: HTMLElement,
    public game: Game,
    public renderer: Renderer,
    public onExit: () => void,
  ) {
    this.root = root;
    clear(root);
    this.hud = new Hud(this);
    this.panels = {
      inventory: h('div', { class: 'panel right' }),
      character: h('div', { class: 'panel left' }),
      stash: h('div', { class: 'panel left' }),
      vendor: h('div', { class: 'panel left' }),
      passives: h('div', { class: 'tree-overlay' }),
    };
    for (const p of Object.values(this.panels)) {
      p.style.display = 'none';
      root.append(p);
    }
    this.sheet = new CharacterSheet(this, this.panels.character);
    this.tree = new PassiveTreeView(this, this.panels.passives);
    this.modals = new Modals(this);
    root.append(this.cursorEl, this.currencyCursor);
    this.currencyCursor.style.display = 'none';
    this.tooltip = new TooltipView(root);

    const ev = game.events;
    this.unsub.push(
      ev.on('inventory', () => this.refreshItems()),
      ev.on('stats', () => {
        this.refreshItems();
        this.sheet.render();
        this.hud.refreshSkills();
      }),
      ev.on('panel', ({ panel }) => {
        if (panel === 'stash') this.openPanel('stash');
        else if (panel === 'vendor') this.openPanel('vendor');
        else if (panel === 'waypoint') this.modals.waypoint();
        else if (panel === 'map_device') this.modals.mapDevice();
      }),
      ev.on('death', () => setTimeout(() => this.modals.death(), 900)),
      ev.on('log', (m) => this.hud.log(m.text, m.color)),
      ev.on('levelup', ({ level }) => this.hud.toast(`Level ${level}`)),
      ev.on('area', () => {
        this.closePanel('stash');
        this.closePanel('vendor');
        this.hud.onArea();
      }),
    );
    this.refreshItems();
  }

  destroy(): void {
    for (const u of this.unsub) u();
    clear(this.root);
  }

  get tctx(): TooltipContext {
    const s = this.game.player.cstats;
    return { level: this.game.char.level, attrs: { str: s.str, dex: s.dex, int: s.int }, alt: this.alt };
  }

  // ------------------------------------------------------------------------------------------
  // Panels
  // ------------------------------------------------------------------------------------------

  openPanel(id: PanelId): void {
    this.open.add(id);
    if (id === 'stash' || id === 'vendor') {
      this.open.add('inventory');
      this.open.delete(id === 'stash' ? 'vendor' : 'stash');
      this.open.delete('character');
    }
    if (id === 'character') {
      this.open.delete('stash');
      this.open.delete('vendor');
    }
    this.syncPanels();
  }

  closePanel(id: PanelId): void {
    if (!this.open.has(id)) return;
    this.open.delete(id);
    if (id === 'vendor') this.returnSellItems();
    if (id === 'inventory') {
      this.open.delete('stash');
      if (this.open.has('vendor')) this.returnSellItems();
      this.open.delete('vendor');
    }
    this.syncPanels();
  }

  togglePanel(id: PanelId): void {
    if (this.open.has(id)) this.closePanel(id);
    else this.openPanel(id);
  }

  closeAll(): boolean {
    const had = this.open.size > 0 || this.modals.isOpen;
    if (this.open.has('vendor')) this.returnSellItems();
    this.open.clear();
    this.modals.close();
    this.syncPanels();
    return had;
  }

  private syncPanels(): void {
    for (const [id, el] of Object.entries(this.panels) as [PanelId, HTMLElement][]) {
      const on = this.open.has(id);
      el.style.display = on ? '' : 'none';
    }
    if (this.open.has('passives')) this.tree.render();
    if (this.open.has('character')) this.sheet.render();
    this.refreshItems();
    this.tooltip.hide();
  }

  /** True when the mouse is over any interactive UI element. */
  pointerOverUI(target: EventTarget | null): boolean {
    return !!(target instanceof HTMLElement && target !== this.renderer.canvas && this.root.contains(target));
  }

  // ------------------------------------------------------------------------------------------
  // Item panels
  // ------------------------------------------------------------------------------------------

  refreshItems(): void {
    if (this.open.has('inventory')) this.renderInventory();
    if (this.open.has('stash')) this.renderStash();
    if (this.open.has('vendor')) this.renderVendor();
    this.hud.refreshFlasks();
    this.renderCursor();
  }

  private renderInventory(): void {
    const p = this.panels.inventory;
    clear(p);
    p.append(h('div', { class: 'panel-title' }, 'Inventory', h('button', { class: 'panel-close small', onclick: () => this.closePanel('inventory') }, '×')));
    const doll = h('div', { class: 'equip' });
    const char = this.game.char;
    for (const [slot, [x, y, w, hh, label]] of Object.entries(DOLL) as [EquipSlot, (typeof DOLL)[EquipSlot]][]) {
      const el = h('div', { class: 'equip-slot', style: `left:${x}px;top:${y}px;width:${w}px;height:${hh}px` });
      const it = char.equipment[slot];
      if (it) {
        const cell = Math.min(w / itemSize(it)[0], hh / itemSize(it)[1]);
        const ie = itemEl(it, cell, this.socketHandlers({ kind: 'equip', slot }));
        ie.style.left = `${(w - itemSize(it)[0] * cell) / 2}px`;
        ie.style.top = `${(hh - itemSize(it)[1] * cell) / 2}px`;
        ie.style.position = 'absolute';
        el.append(ie);
        this.hoverable(ie, it, { kind: 'equip', slot });
      } else el.append(h('div', { class: 'slot-label' }, label));
      if (this.cursor && slotsFor(this.cursor.item).includes(slot)) el.classList.add('highlight');
      el.addEventListener('mousedown', (e) => this.onEquipClick(slot, e));
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      doll.append(el);
    }
    p.append(doll);
    p.append(this.gridEl(char.inventory, INV_CELL, { kind: 'inv' }));
    const help = h('div', { class: 'muted', style: 'margin-top:6px;text-align:center' }, 'Right-click currency to apply it · Ctrl-click to move · Right-click gear to equip · Hold Alt for mod tiers');
    p.append(help);
  }

  private renderStash(): void {
    const p = this.panels.stash;
    clear(p);
    p.append(h('div', { class: 'panel-title' }, 'Stash', h('button', { class: 'panel-close small', onclick: () => this.closePanel('stash') }, '×')));
    const tabs = h('div', { class: 'tabs' });
    this.game.account.stash.forEach((_, i) => {
      tabs.append(h('button', { class: i === this.stashTab ? 'on' : '', onclick: () => ((this.stashTab = i), this.renderStash()) }, `Tab ${this.game.account.stashNames[i] ?? i + 1}`));
    });
    p.append(tabs, this.gridEl(this.game.account.stash[this.stashTab], STASH_CELL, { kind: 'stash', tab: this.stashTab }));
  }

  private renderVendor(): void {
    const p = this.panels.vendor;
    clear(p);
    const g = this.game;
    p.append(h('div', { class: 'panel-title' }, 'Mara, the Trader', h('button', { class: 'panel-close small', onclick: () => this.closePanel('vendor') }, '×')));
    const tabs = h('div', { class: 'tabs' },
      h('button', { class: this.vendorTab === 'buy' ? 'on' : '', onclick: () => ((this.vendorTab = 'buy'), this.renderVendor()) }, 'Buy'),
      h('button', { class: this.vendorTab === 'sell' ? 'on' : '', onclick: () => ((this.vendorTab = 'sell'), this.renderVendor()) }, 'Sell'),
    );
    p.append(tabs);
    if (this.vendorTab === 'buy') {
      const grid = newGrid(12, 11);
      const offerByUid = new Map<string, (typeof g.vendorOffers)[number]>();
      for (const o of g.vendorOffers) {
        if (addItem(grid, o.item)) offerByUid.set(o.item.uid, o);
      }
      const wrap = h('div', { class: 'grid', style: `width:${12 * STASH_CELL}px;height:${11 * STASH_CELL}px;--cs:${STASH_CELL}px` }, h('div', { class: 'cells' }));
      for (const gi of grid.items) {
        const offer = offerByUid.get(gi.item.uid)!;
        const el = itemEl(gi.item, STASH_CELL);
        el.style.left = `${gi.x * STASH_CELL}px`;
        el.style.top = `${gi.y * STASH_CELL}px`;
        el.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          if (e.button === 0) g.buy(offer);
        });
        el.addEventListener('mouseenter', () => {
          const c = CURRENCY_BY_ID[offer.price.currency];
          this.tooltip.show(offer.item, this.tctx, this.alt);
          const priceEl = h('div', { class: 'tooltip', style: 'min-width:0' }, h('div', { class: 'tt-sec' }, h('div', { class: 'tt-line desc' }, `Cost: ${offer.price.amount}× ${c.name}`), h('div', { class: 'tt-line hint' }, 'Click to buy')));
          this.tooltipWrapAppend(priceEl);
        });
        el.addEventListener('mouseleave', () => this.tooltip.hide());
        wrap.append(el);
      }
      p.append(wrap, h('div', { class: 'muted', style: 'margin-top:6px' }, 'Gems, flasks and gear. Prices are paid in currency from your inventory.'));
    } else {
      p.append(h('div', { class: 'section-title' }, 'Your offer'));
      p.append(this.gridEl(this.sellGrid, STASH_CELL, { kind: 'sell' }));
      const sale = evaluateSale(this.sellGrid.items.map((x) => x.item));
      const rec = h('div', { class: 'receive' });
      if (!sale.receive.length) rec.append(h('span', { class: 'muted' }, 'Ctrl-click items in your inventory to offer them.'));
      for (const it of sale.receive) rec.append(h('span', { class: 'cur' }, h('img', { src: itemIcon(it) }), `${it.stack}× ${CURRENCY_BY_ID[currencyId(it)!].name}`));
      p.append(h('div', { class: 'section-title' }, 'You will receive'), rec);
      for (const r of sale.recipes) p.append(h('div', { class: 'muted', style: 'color:#a0e080' }, `Recipe: ${r}`));
      p.append(h('div', { class: 'row-buttons' }, h('button', { onclick: () => this.acceptSale(), disabled: !this.sellGrid.items.length }, 'Accept')));
    }
  }

  private tooltipWrapAppend(el: HTMLElement): void {
    const wrap = this.root.querySelector('.tt-wrap');
    if (wrap) wrap.append(el);
  }

  private acceptSale(): void {
    const items = this.sellGrid.items.map((x) => x.item);
    if (!items.length) return;
    const receive = this.game.sell(items);
    this.sellGrid.items = [];
    for (const r of receive) if (!addItem(this.game.char.inventory, r)) this.game.dropItem(r, this.game.player.pos);
    this.game.log(`Sold ${items.length} item${items.length > 1 ? 's' : ''}.`, '#d8c8a0');
    this.refreshItems();
  }

  private returnSellItems(): void {
    for (const gi of this.sellGrid.items) if (!addItem(this.game.char.inventory, gi.item)) this.game.dropItem(gi.item, this.game.player.pos);
    this.sellGrid.items = [];
  }

  private gridEl(grid: Grid, cell: number, loc: Loc): HTMLElement {
    const wrap = h('div', { class: 'grid', style: `width:${grid.w * cell}px;height:${grid.h * cell}px;--cs:${cell}px` }, h('div', { class: 'cells' }));
    const ghost = h('div', { class: 'ghost', style: 'display:none' });
    wrap.append(ghost);
    const unusable = (it: Item) => !!slotsFor(it).length && it.identified && !!meetsRequirements(it, this.game.char, this.game.player.cstats);
    for (const gi of grid.items) {
      const el = itemEl(gi.item, cell, { ...this.socketHandlers(loc), unusable: unusable(gi.item) });
      el.style.left = `${gi.x * cell}px`;
      el.style.top = `${gi.y * cell}px`;
      this.hoverable(el, gi.item, loc);
      wrap.append(el);
    }
    const cellAt = (e: MouseEvent) => {
      // panels may be CSS-zoomed on small screens, so derive the on-screen cell size
      const r = wrap.getBoundingClientRect();
      const px = r.width / grid.w;
      return { cx: Math.floor((e.clientX - r.left) / px), cy: Math.floor((e.clientY - r.top) / px) };
    };
    wrap.addEventListener('mousemove', (e) => {
      if (!this.cursor) {
        ghost.style.display = 'none';
        return;
      }
      const [w, hh] = itemSize(this.cursor.item);
      const { cx, cy } = cellAt(e);
      const x = Math.max(0, Math.min(grid.w - w, cx - Math.floor((w - 1) / 2)));
      const y = Math.max(0, Math.min(grid.h - hh, cy - Math.floor((hh - 1) / 2)));
      const blockers = grid.items.filter((g) => {
        const [gw, gh] = itemSize(g.item);
        return x < g.x + gw && x + w > g.x && y < g.y + gh && y + hh > g.y;
      });
      ghost.style.display = '';
      ghost.className = `ghost${blockers.length > 1 ? ' bad' : ''}`;
      ghost.style.left = `${x * cell}px`;
      ghost.style.top = `${y * cell}px`;
      ghost.style.width = `${w * cell}px`;
      ghost.style.height = `${hh * cell}px`;
    });
    wrap.addEventListener('mouseleave', () => (ghost.style.display = 'none'));
    wrap.addEventListener('contextmenu', (e) => e.preventDefault());
    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const { cx, cy } = cellAt(e);
      this.onGridClick(grid, loc, cx, cy, e);
    });
    return wrap;
  }

  private hoverable(el: HTMLElement, item: Item, loc: Loc | null): void {
    el.addEventListener('mouseenter', () => {
      this.hoverSource = { item, loc };
      this.showItemTooltip(item, loc);
    });
    el.addEventListener('mouseleave', () => {
      if (this.hoverSource?.item === item) this.hoverSource = null;
      this.tooltip.hide();
    });
  }

  showItemTooltip(item: Item, loc: Loc | null): void {
    const compare: Item[] = [];
    if (!loc || loc.kind !== 'equip') {
      for (const slot of slotsFor(item)) {
        const eq = this.game.char.equipment[slot];
        if (eq && !FLASK_SLOTS.includes(slot) && !compare.includes(eq)) compare.push(eq);
      }
    }
    this.tooltip.show(item, this.tctx, this.alt, compare.slice(0, 2));
  }

  private socketHandlers(loc: Loc) {
    return {
      onSocketClick: (host: Item, index: number, e: MouseEvent) => this.onSocketClick(host, index, e, loc),
      onSocketHover: (host: Item, index: number, e: MouseEvent | null) => {
        const gem = host.sockets[index]?.gem;
        if (e && gem) this.tooltip.show(gem, this.tctx, this.alt);
        else this.showItemTooltip(host, loc);
      },
    };
  }

  // ------------------------------------------------------------------------------------------
  // Click handling
  // ------------------------------------------------------------------------------------------

  private onGridClick(grid: Grid, loc: Loc, cx: number, cy: number, e: MouseEvent): void {
    const target = itemAt(grid, cx, cy);
    if (e.button === 2) {
      if (this.applying) {
        this.stopApplying();
        return;
      }
      if (!target || this.cursor) return;
      this.onItemRightClick(target.item, grid, loc);
      return;
    }
    if (e.button !== 0) return;
    if (this.applying) {
      if (target) this.applyTo(target.item, e.shiftKey);
      return;
    }
    if (this.cursor) {
      const it = this.cursor.item;
      const [w, hh] = itemSize(it);
      const x = Math.max(0, Math.min(grid.w - w, cx - Math.floor((w - 1) / 2)));
      const y = Math.max(0, Math.min(grid.h - hh, cy - Math.floor((hh - 1) / 2)));
      const res = placeAt(grid, it, x, y);
      if (res.placed || res.swapped) this.cursor = res.swapped ? { item: res.swapped, from: loc } : null;
      this.refreshItems();
      return;
    }
    if (!target) return;
    if (e.ctrlKey) {
      this.quickMove(target.item, grid, loc);
      return;
    }
    removeItem(grid, target.item);
    this.cursor = { item: target.item, from: loc };
    this.tooltip.hide();
    this.refreshItems();
  }

  private onItemRightClick(item: Item, grid: Grid, loc: Loc): void {
    const cid = currencyId(item);
    if (cid) {
      if (CURRENCY_BY_ID[cid].selfUse) this.game.useSelfCurrency(item);
      else this.startApplying(item);
      this.refreshItems();
      return;
    }
    if (item.map && this.modals.isDeviceOpen) {
      removeItem(grid, item);
      if (this.deviceMap) addItem(grid, this.deviceMap);
      this.deviceMap = item;
      this.modals.mapDevice();
      this.refreshItems();
      return;
    }
    const slots = slotsFor(item);
    if (slots.length && loc.kind !== 'sell') {
      const char = this.game.char;
      const slot = slots.find((s) => !char.equipment[s] && !canEquip(char, this.game.player.cstats, item, s)) ?? slots[0];
      removeItem(grid, item);
      const res = equipItem(char, this.game.player.cstats, item, slot);
      if (!res.ok) {
        addItem(grid, item);
        this.game.log(res.error ?? 'Cannot equip', '#ff8080');
        return;
      }
      for (const d of res.displaced) if (!addItem(grid, d)) this.game.dropItem(d, this.game.player.pos);
      this.game.recalc();
      this.refreshItems();
    }
  }

  private quickMove(item: Item, grid: Grid, loc: Loc): void {
    let dest: Grid | null = null;
    if (loc.kind === 'inv') {
      if (this.open.has('stash')) dest = this.game.account.stash[this.stashTab];
      else if (this.open.has('vendor')) {
        this.vendorTab = 'sell';
        dest = this.sellGrid;
      }
    } else dest = this.game.char.inventory;
    if (!dest) return;
    removeItem(grid, item);
    if (!addItem(dest, item)) addItem(grid, item);
    this.refreshItems();
  }

  private onEquipClick(slot: EquipSlot, e: MouseEvent): void {
    e.preventDefault();
    const char = this.game.char;
    const current = char.equipment[slot];
    if (e.button === 2) {
      if (this.applying) return this.stopApplying();
      if (current && !this.cursor) {
        if (addItem(char.inventory, current)) {
          delete char.equipment[slot];
          this.game.recalc();
          this.refreshItems();
        } else this.game.log('Your inventory is full.', '#ff8080');
      }
      return;
    }
    if (e.button !== 0) return;
    if (this.applying) {
      if (current) this.applyTo(current, e.shiftKey);
      return;
    }
    if (this.cursor) {
      const res = equipItem(char, this.game.player.cstats, this.cursor.item, slot);
      if (!res.ok) {
        this.game.log(res.error ?? 'Cannot equip that here', '#ff8080');
        return;
      }
      const [first, ...rest] = res.displaced;
      this.cursor = first ? { item: first, from: null } : null;
      for (const d of rest) if (!addItem(char.inventory, d)) this.game.dropItem(d, this.game.player.pos);
      this.game.recalc();
      this.refreshItems();
      return;
    }
    if (current) {
      delete char.equipment[slot];
      this.cursor = { item: current, from: { kind: 'equip', slot } };
      this.tooltip.hide();
      this.game.recalc();
      this.refreshItems();
    }
  }

  private onSocketClick(host: Item, index: number, e: MouseEvent, _loc: Loc): boolean {
    const socket = host.sockets[index];
    if (!socket) return false;
    if (this.applying) return false;
    if (e.button === 0 && this.cursor?.item.gem) {
      if (!socketAccepts(socket.color, this.cursor.item)) {
        this.game.log('That gem does not fit in a socket of this colour.', '#ff8080');
        return true;
      }
      const old = socket.gem;
      socket.gem = this.cursor.item;
      this.cursor = old ? { item: old, from: null } : null;
      this.game.recalc();
      this.refreshItems();
      return true;
    }
    if (e.button === 2 && socket.gem && !this.cursor) {
      this.cursor = { item: socket.gem, from: null };
      socket.gem = undefined;
      this.tooltip.hide();
      this.game.recalc();
      this.refreshItems();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------------------------------
  // Currency application
  // ------------------------------------------------------------------------------------------

  startApplying(currency: Item): void {
    this.applying = currency;
    this.currencyCursor.src = itemIcon(currency);
    this.currencyCursor.style.display = '';
  }

  stopApplying(): void {
    this.applying = null;
    this.currencyCursor.style.display = 'none';
  }

  private applyTo(target: Item, keep: boolean): void {
    const cur = this.applying;
    if (!cur) return;
    const before = displayName(target);
    const res = this.game.applyCurrencyTo(cur, target);
    if (res.ok && !res.message) this.game.log(`${CURRENCY_BY_ID[currencyId(cur)!].name} used on ${before}.`, '#aa9e82');
    if (!keep || (cur.stack ?? 0) <= 0) this.stopApplying();
    this.refreshItems();
    if (this.hoverSource?.item === target) this.showItemTooltip(target, this.hoverSource.loc);
  }

  // ------------------------------------------------------------------------------------------
  // Cursor item
  // ------------------------------------------------------------------------------------------

  private renderCursor(): void {
    clear(this.cursorEl);
    if (!this.cursor) return;
    const el = itemEl(this.cursor.item, INV_CELL);
    el.classList.add('show-sockets');
    this.cursorEl.append(el);
    this.positionCursor();
  }

  private positionCursor(): void {
    if (this.cursor) {
      const [w, hh] = itemSize(this.cursor.item);
      this.cursorEl.style.left = `${this.mouse.x - (w * INV_CELL) / 2}px`;
      this.cursorEl.style.top = `${this.mouse.y - (hh * INV_CELL) / 2}px`;
    }
    this.currencyCursor.style.left = `${this.mouse.x + 6}px`;
    this.currencyCursor.style.top = `${this.mouse.y + 6}px`;
  }

  /** Clicking the world with an item on the cursor drops it on the ground. */
  dropCursorItem(): void {
    if (!this.cursor) return;
    this.game.dropItem(this.cursor.item, this.game.player.pos);
    this.cursor = null;
    this.refreshItems();
  }

  /** Put the cursor item back somewhere safe (e.g. when closing panels). */
  stowCursor(): void {
    if (!this.cursor) return;
    if (!addItem(this.game.char.inventory, this.cursor.item)) this.game.dropItem(this.cursor.item, this.game.player.pos);
    this.cursor = null;
    this.refreshItems();
  }

  takeDeviceMap(): Item | null {
    const m = this.deviceMap;
    this.deviceMap = null;
    return m;
  }

  // ------------------------------------------------------------------------------------------
  // Per-frame
  // ------------------------------------------------------------------------------------------

  onMouseMove(x: number, y: number): void {
    this.mouse.x = x;
    this.mouse.y = y;
    this.positionCursor();
    this.tooltip.position(x, y);
    this.tree.onMouseMove(x, y);
  }

  setAlt(v: boolean): void {
    if (this.alt === v) return;
    this.alt = v;
    this.tooltip.refresh(this.tctx, v);
  }

  update(dt: number): void {
    this.hud.update(dt);
    if (this.open.has('character')) this.sheet.tick(dt);
  }
}
