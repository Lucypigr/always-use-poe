import { CURRENCY_BY_ID } from '../data/currency';
import { currencyId } from '../items/item';
import { h } from './dom';
import type { Input } from './input';
import { fromTouch, TOUCH_MODES, type TouchItemMode } from './touch';
import type { UI } from './ui';

/**
 * On-screen controls for phones and tablets: a virtual joystick for movement, hold-to-cast
 * skill buttons (auto-aimed at the nearest enemy), extra menu buttons and an item-action
 * toolbar that stands in for right-click / Ctrl-click while inventory panels are open.
 */
export class TouchControls {
  private root: HTMLElement;
  private joyBase: HTMLElement;
  private joyKnob: HTMLElement;
  private joyId: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private toolbar: HTMLElement;
  private modeButtons = new Map<TouchItemMode, HTMLElement>();
  private tiersBtn: HTMLElement;
  private editBtn: HTMLElement;
  private rotateHint: HTMLElement;
  private listeners: [EventTarget, string, EventListener, boolean][] = [];
  private synth = false;
  mode: TouchItemMode = 'take';

  constructor(
    private ui: UI,
    private input: Input,
  ) {
    document.body.classList.add('touch');
    ui.touch = true;
    this.root = h('div', { class: 'touch-controls' });

    // Joystick: the base appears wherever the thumb lands in the lower-left zone.
    this.joyKnob = h('div', { class: 'joy-knob' });
    this.joyBase = h('div', { class: 'joy-base' }, this.joyKnob);
    const zone = h('div', { class: 'joy-zone' }, this.joyBase);
    zone.addEventListener('pointerdown', (e) => this.joyDown(e));
    this.on(window, 'pointermove', (e) => this.joyMove(e as PointerEvent));
    this.on(window, 'pointerup', (e) => this.joyUp(e as PointerEvent));
    this.on(window, 'pointercancel', (e) => this.joyUp(e as PointerEvent));

    // Extra buttons that replace keyboard shortcuts.
    const btn = (label: string, fn: () => void, cls = '') => h('button', { class: `tbtn ${cls}`, onclick: fn }, label);
    this.editBtn = btn('編輯技能', () => {
      ui.editSkills = !ui.editSkills;
      this.editBtn.classList.toggle('on', ui.editSkills);
      if (ui.editSkills) ui.game.log('點擊技能欄位以更換技能，完成後再按一次「編輯技能」。', '#d8c8a0');
    });
    const extra = h('div', { class: 'touch-extra' },
      btn('地圖', () => ui.hud.toggleOverlay()),
      btn('標籤', () => (ui.hud.showLabels = !ui.hud.showLabels)),
      btn('回城', () => this.usePortal()),
      this.editBtn,
      btn('全螢幕', () => this.fullscreen()),
    );

    // Item action toolbar (shown while an item panel is open).
    this.toolbar = h('div', { class: 'touch-toolbar' });
    for (const m of TOUCH_MODES) {
      const b = h('button', { class: 'tmode', title: m.hint, onclick: () => this.setMode(m.id) }, m.label);
      this.modeButtons.set(m.id, b);
      this.toolbar.append(b);
    }
    this.tiersBtn = h('button', { class: 'tmode', onclick: () => {
      ui.setAlt(!ui.alt);
      this.tiersBtn.classList.toggle('on', ui.alt);
    } }, '詞綴階級');
    this.toolbar.append(this.tiersBtn, h('button', { class: 'tmode', onclick: () => {
      if (ui.applying) ui.stopApplying();
      else if (ui.cursor) ui.stowCursor();
      else ui.closeAll();
    } }, '取消 / 關閉'));
    this.setMode('take');

    this.rotateHint = h('div', { class: 'rotate-hint' }, '將手機橫放以獲得最佳遊戲體驗');
    this.root.append(zone, extra, this.toolbar, this.rotateHint);
    ui.root.append(this.root);

    // No keyboard: drop the hotkey hints from button labels.
    ui.root.querySelectorAll<HTMLElement>('.menu-buttons button, .tree-close button').forEach((b) => {
      b.textContent = (b.textContent ?? '').replace(/\s*\([A-Z]\)$/, '');
    });

    // Skill buttons: hold to cast. Tapping only opens the picker in edit mode or on empty slots.
    ui.root.querySelectorAll<HTMLElement>('.hud .skills .skill-slot').forEach((el, i) => {
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch' || ui.editSkills) return;
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('pressed');
        input.pressTouchSkill(i);
      });
      const up = (e: PointerEvent) => {
        if (e.pointerType !== 'touch') return;
        el.classList.remove('pressed');
        input.releaseTouchSkill(i);
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });

    // Item panels: re-dispatch taps as right-click / Ctrl-click according to the chosen mode.
    this.on(window, 'mousedown', (e) => this.remapItemClick(e as MouseEvent), true);
    this.on(window, 'resize', () => {
      this.layoutKey = '';
      this.layout();
    });
    this.layout();
  }

  private on(t: EventTarget, type: string, fn: EventListener, capture = false): void {
    t.addEventListener(type, fn, capture);
    this.listeners.push([t, type, fn, capture]);
  }

  destroy(): void {
    for (const [t, type, fn, capture] of this.listeners) t.removeEventListener(type, fn, capture);
    this.listeners = [];
    this.root.remove();
    document.body.classList.remove('touch');
  }

  private setMode(m: TouchItemMode): void {
    this.mode = m;
    for (const [id, b] of this.modeButtons) b.classList.toggle('on', id === m);
  }

  private remapItemClick(e: MouseEvent): void {
    if (this.synth || !fromTouch() || this.mode === 'take' || e.button !== 0) return;
    const t = e.target as HTMLElement | null;
    if (!t?.closest('.panel .grid, .panel .equip-slot, .modal .grid')) return;
    const ui = this.ui;
    // With currency or an item on the cursor, a tap is always the ordinary click.
    if (ui.applying || ui.cursor) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (this.mode === 'inspect') return;
    const ev = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      clientX: e.clientX,
      clientY: e.clientY,
      button: this.mode === 'use' ? 2 : 0,
      ctrlKey: this.mode === 'quick',
    });
    this.synth = true;
    try {
      t.dispatchEvent(ev);
    } finally {
      this.synth = false;
    }
  }

  private usePortal(): void {
    const g = this.ui.game;
    if (g.area.town) {
      g.log('你已經在城鎮中。', '#a0a0a0');
      return;
    }
    const gi = g.char.inventory.items.find((x) => currencyId(x.item) === 'portal');
    if (!gi) {
      g.log(`你沒有${CURRENCY_BY_ID.portal.name}。`, '#ff8080');
      return;
    }
    g.useSelfCurrency(gi.item);
    this.ui.refreshItems();
  }

  private fullscreen(): void {
    const d = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (document.fullscreenElement || d.webkitFullscreenElement) (document.exitFullscreen ?? d.webkitExitFullscreen)?.call(document);
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => this.ui.game.log('此瀏覽器不支援全螢幕。', '#a0a0a0'));
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else this.ui.game.log('此瀏覽器不支援全螢幕。可將網頁「加入主畫面」以全螢幕遊玩。', '#a0a0a0');
  }

  private layoutKey = '';

  /**
   * Scale item panels to fit a phone screen. With the inventory open on its own it is laid
   * out wide (paper doll beside the grid); next to the stash / vendor only the grid is shown.
   */
  private layout(): void {
    const ui = this.ui;
    const w = window.innerWidth;
    const hh = window.innerHeight;
    const left = ui.open.has('stash') || ui.open.has('vendor') || ui.open.has('character');
    const solo = ui.open.has('inventory') && !left;
    const key = `${w}x${hh}:${solo}:${left}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    const inv = ui.root.querySelector<HTMLElement>('.panel.right');
    inv?.classList.toggle('solo', solo);
    inv?.classList.toggle('paired', ui.open.has('inventory') && left);
    const z = solo
      ? Math.min(1, (w - 12) / 1150, (hh - 56) / 470)
      : Math.max(0.45, Math.min(1, (w / 2 - 10) / 600, (hh - 56) / 560));
    document.documentElement.style.setProperty('--pz', z.toFixed(3));
  }

  // ------------------------------------------------------------------ joystick

  private joyDown(e: PointerEvent): void {
    if (this.joyId !== null) return;
    e.preventDefault();
    this.joyId = e.pointerId;
    const zone = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.joyCenter = { x: e.clientX, y: e.clientY };
    this.joyBase.style.left = `${e.clientX - zone.left}px`;
    this.joyBase.style.top = `${e.clientY - zone.top}px`;
    this.joyBase.classList.add('active');
    this.joyKnob.style.transform = 'translate(-50%, -50%)';
    this.input.joy = { x: 0, y: 0 };
    this.ui.game.cancelInteract();
  }

  private joyMove(e: PointerEvent): void {
    if (e.pointerId !== this.joyId) return;
    const R = 50;
    let dx = e.clientX - this.joyCenter.x;
    let dy = e.clientY - this.joyCenter.y;
    const l = Math.hypot(dx, dy);
    if (l > R) {
      dx = (dx / l) * R;
      dy = (dy / l) * R;
    }
    this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.input.joy = { x: dx / R, y: dy / R };
  }

  private joyUp(e: PointerEvent): void {
    if (e.pointerId !== this.joyId) return;
    this.joyId = null;
    this.joyBase.classList.remove('active');
    this.joyKnob.style.transform = 'translate(-50%, -50%)';
    this.input.joy = null;
  }

  /** Per frame: show the item toolbar only while an item panel is open. */
  update(): void {
    const ui = this.ui;
    const itemPanel = ui.open.has('inventory') || ui.open.has('stash') || ui.open.has('vendor') || ui.modals.isDeviceOpen;
    this.toolbar.style.display = itemPanel ? '' : 'none';
    this.root.classList.toggle('panel-open', ui.open.size > 0);
    this.layout();
    if (this.tiersBtn.classList.contains('on') !== ui.alt) this.tiersBtn.classList.toggle('on', ui.alt);
  }
}
