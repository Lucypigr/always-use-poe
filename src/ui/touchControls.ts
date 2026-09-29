import { CURRENCY_BY_ID } from '../data/currency';
import { currencyId } from '../items/item';
import { h } from './dom';
import { AIM_DEAD_ZONE, type Input } from './input';
import { enterFullscreen, exitFullscreen, fullscreenSupported, isFullscreen, isPortrait } from './fullscreen';
import { fromTouch, TOUCH_MODES, type TouchItemMode } from './touch';
import type { UI } from './ui';

/**
 * On-screen controls for phones and tablets: a virtual joystick for movement, hold-to-cast
 * skill buttons (auto-aimed at the nearest enemy, or drag to aim), extra menu buttons and an item-action
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

    this.root.append(zone, extra, this.toolbar);
    ui.root.append(this.root);

    // No keyboard: drop the hotkey hints from button labels.
    ui.root.querySelectorAll<HTMLElement>('.menu-buttons button, .tree-close button').forEach((b) => {
      b.textContent = (b.textContent ?? '').replace(/\s*\([A-Z]\)$/, '');
    });

    // Skill buttons: hold to cast at the nearest enemy, or drag off the button to aim (an arrow
    // on the ground shows where). Movement skills fire when the finger lifts; dragging back onto
    // the button cancels them. Tapping only opens the picker in edit mode or on empty slots.
    ui.root.querySelectorAll<HTMLElement>('.hud .skills .skill-slot').forEach((el, i) => {
      let start: { x: number; y: number } | null = null;
      let aimed = false;
      let cancel = false;
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch' || ui.editSkills) return;
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('pressed');
        start = { x: e.clientX, y: e.clientY };
        aimed = cancel = false;
        input.pressTouchSkill(i);
      });
      el.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'touch' || !start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        const far = Math.hypot(dx, dy) > AIM_DEAD_ZONE;
        aimed ||= far;
        cancel = aimed && !far && input.aimsOnRelease(i);
        input.aimTouchSkill(i, far ? { dx, dy } : null);
        el.classList.toggle('aiming', far);
        el.classList.toggle('cancel', cancel);
      });
      const up = (e: PointerEvent) => {
        if (e.pointerType !== 'touch' || !start) return;
        start = null;
        el.classList.remove('pressed', 'aiming', 'cancel');
        input.releaseTouchSkill(i, cancel || e.type === 'pointercancel');
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
    document.body.classList.remove('touch', 'panel-open');
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

  /** Toggle fullscreen. Leaving it here also stops the automatic re-entry on the next tap. */
  private fullscreen(): void {
    if (isFullscreen()) exitFullscreen();
    else if (!fullscreenSupported()) this.ui.game.log('此瀏覽器不支援全螢幕。可將網頁「加入主畫面」以全螢幕遊玩。', '#a0a0a0');
    else enterFullscreen().then((ok) => ok || this.ui.game.log('無法進入全螢幕。', '#a0a0a0'));
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
    const portrait = isPortrait();
    const left = ui.open.has('stash') || ui.open.has('vendor') || ui.open.has('character') || (portrait && ui.modals.isDeviceOpen);
    // landscape: inventory alone is laid out wide (paper doll beside the grid)
    const solo = !portrait && ui.open.has('inventory') && !left;
    const key = `${w}x${hh}:${solo}:${left}:${portrait}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    const inv = ui.root.querySelector<HTMLElement>('.panel.right');
    inv?.classList.toggle('solo', solo);
    inv?.classList.toggle('paired', ui.open.has('inventory') && left);
    let z: number;
    if (portrait) {
      // portrait: panels use the full width; a second panel stacks above the inventory
      z = left ? Math.min(1, (w - 12) / 600, (hh - 70) / 880) : Math.min(1, (w - 12) / 590, (hh - 190) / 760);
    } else if (solo) z = Math.min(1, (w - 12) / 1150, (hh - 56) / 470);
    else z = Math.max(0.45, Math.min(1, (w / 2 - 10) / 600, (hh - 56) / 560));
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
    document.body.classList.toggle('panel-open', ui.open.size > 0 || ui.modals.isDeviceOpen);
    this.layout();
    if (this.tiersBtn.classList.contains('on') !== ui.alt) this.tiersBtn.classList.toggle('on', ui.alt);
  }
}
