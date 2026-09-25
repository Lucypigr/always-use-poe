import type { Game } from '../game/game';
import type { Renderer } from '../render/renderer';
import type { UI } from './ui';

const KEY_SLOTS: Record<string, number> = { q: 2, w: 3, e: 4, r: 5, t: 6 };

/**
 * Mouse & keyboard → game intent. Mirrors Path of Exile's controls: click to move,
 * click monsters to attack, skills on RMB/QWERT/MMB (held to repeat), flasks on 1–5.
 */
export class Input {
  private held: number[] = [];
  private lmb: 'none' | 'move' | 'skill' = 'none';
  private mouseX = 0;
  private mouseY = 0;
  private overUI = false;
  private shift = false;
  private listeners: [EventTarget, string, EventListener][] = [];

  constructor(
    private ui: UI,
    private game: Game,
    private renderer: Renderer,
  ) {
    const canvas = renderer.canvas;
    this.on(window, 'keydown', (e) => this.onKey(e as KeyboardEvent, true));
    this.on(window, 'keyup', (e) => this.onKey(e as KeyboardEvent, false));
    this.on(window, 'mousemove', (e) => {
      const m = e as MouseEvent;
      this.mouseX = m.clientX;
      this.mouseY = m.clientY;
      this.overUI = ui.pointerOverUI(m.target);
      ui.onMouseMove(m.clientX, m.clientY);
    });
    this.on(canvas, 'mousedown', (e) => this.onCanvasDown(e as MouseEvent));
    this.on(window, 'mouseup', (e) => this.onUp(e as MouseEvent));
    this.on(canvas, 'contextmenu', (e) => e.preventDefault());
    this.on(canvas, 'wheel', (e) => {
      const w = e as WheelEvent;
      renderer.zoom = Math.max(0.65, Math.min(1.45, renderer.zoom * (w.deltaY > 0 ? 1.08 : 1 / 1.08)));
    });
    this.on(window, 'blur', () => this.releaseAll());
  }

  private on(t: EventTarget, type: string, fn: EventListener): void {
    t.addEventListener(type, fn);
    this.listeners.push([t, type, fn]);
  }

  destroy(): void {
    for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn);
    this.listeners = [];
  }

  private releaseAll(): void {
    this.held = [];
    this.lmb = 'none';
    this.shift = false;
    this.ui.setAlt(false);
  }

  private press(slot: number): void {
    this.held = this.held.filter((s) => s !== slot);
    this.held.push(slot);
  }

  private release(slot: number): void {
    this.held = this.held.filter((s) => s !== slot);
  }

  private onCanvasDown(e: MouseEvent): void {
    const ui = this.ui;
    if (e.button === 2 && ui.applying) {
      ui.stopApplying();
      return;
    }
    if (ui.cursor && e.button === 0) {
      ui.dropCursorItem();
      return;
    }
    if (ui.modals.isOpen && !ui.modals.isDeviceOpen) return;
    if (e.button === 0) {
      const hover = this.renderer.pickMonster(this.game, e.clientX, e.clientY);
      this.game.cancelInteract();
      this.lmb = e.shiftKey || hover ? 'skill' : 'move';
    } else if (e.button === 2) this.press(1);
    else if (e.button === 1) {
      e.preventDefault();
      this.press(7);
    }
  }

  private onUp(e: MouseEvent): void {
    if (e.button === 0) this.lmb = 'none';
    else if (e.button === 2) this.release(1);
    else if (e.button === 1) this.release(7);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (e.target instanceof HTMLInputElement) return;
    const key = e.key.toLowerCase();
    this.shift = e.shiftKey;
    this.ui.shift = e.shiftKey;
    this.ui.ctrl = e.ctrlKey;
    if (key === 'alt') {
      e.preventDefault();
      this.ui.setAlt(down);
      return;
    }
    if (key in KEY_SLOTS) {
      if (down) this.press(KEY_SLOTS[key]);
      else this.release(KEY_SLOTS[key]);
      return;
    }
    if (!down || e.repeat) return;
    const ui = this.ui;
    switch (key) {
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
        this.game.drinkFlask(Number(key) - 1);
        break;
      case 'i':
        ui.togglePanel('inventory');
        break;
      case 'c':
        ui.togglePanel('character');
        break;
      case 'p':
        ui.togglePanel('passives');
        break;
      case 'tab':
        e.preventDefault();
        ui.hud.toggleOverlay();
        break;
      case 'z':
        ui.hud.showLabels = !ui.hud.showLabels;
        break;
      case 'h':
      case 'f1':
        e.preventDefault();
        ui.modals.help();
        break;
      case 'escape':
        if (ui.applying) ui.stopApplying();
        else if (ui.cursor) ui.stowCursor();
        else if (!ui.closeAll()) ui.modals.options();
        break;
    }
  }

  /** Called every frame before the game update. */
  update(): void {
    const g = this.game;
    const inp = g.input;
    inp.cursor = this.renderer.screenToGround(this.mouseX, this.mouseY);
    inp.hoverMonster = this.overUI ? null : this.renderer.pickMonster(g, this.mouseX, this.mouseY);
    inp.stand = this.shift;
    let slot: number | null = this.held.length ? this.held[this.held.length - 1] : null;
    if (slot === null && this.lmb === 'skill') slot = 0;
    inp.heldSlot = slot;
    inp.moveHeld = this.lmb === 'move' && slot === null;
    if (this.lmb === 'move' && this.shift) {
      inp.heldSlot = 0;
      inp.moveHeld = false;
    }
  }
}
