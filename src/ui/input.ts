import type { Game } from '../game/game';
import type { Renderer } from '../render/renderer';
import type { UI } from './ui';
import { fromTouch } from './touch';
import { dist, type Vec2 } from '../core/math';
import type { Monster } from '../game/monster';

const KEY_SLOTS: Record<string, number> = { ' ': 0, q: 2, w: 3, e: 4, r: 5, t: 6 };

/** Touch aiming: drag this far (px) off a skill button to aim by hand; this far for full range. */
export const AIM_DEAD_ZONE = 18;
const AIM_FULL_DRAG = 90;
/** World units a full drag reaches (movement skills: their own maximum distance). */
const AIM_RANGE = 8;
/** Movement skills aim first and fire when the finger lifts (drag back onto the button to cancel). */
const AIM_ON_RELEASE = new Set(['leap', 'dash', 'blink']);
/** Skills whose target point matters (a ring marks where they land). */
const GROUND_TARGET = new Set(['leap', 'dash', 'blink', 'rain']);
/** Self-centred skills: no aim arrow. */
const NO_AIM = new Set(['aura', 'nova', 'summon', 'spin']);

type Drag = { dx: number; dy: number } | null;

/**
 * Mouse & keyboard → game intent. The left button only moves, picks up and interacts;
 * skills are on RMB / Space / QWERT / MMB (held to repeat), flasks on 1–5.
 */
export class Input {
  private held: number[] = [];
  private lmb: 'none' | 'move' = 'none';
  private mouseX = 0;
  private mouseY = 0;
  private overUI = false;
  private shift = false;
  private listeners: [EventTarget, string, EventListener][] = [];
  /** Touch: fingers currently on the game canvas. */
  private touches = new Map<number, { x: number; y: number }>();
  private pinch: { d: number; zoom: number } | null = null;
  /** Touch: skill slots held via on-screen buttons. */
  private touchSkills: number[] = [];
  /** Touch: drag offset (screen px) of each held skill button; null = auto-aim at the nearest enemy. */
  private touchAim = new Map<number, Drag>();
  /** Touch: the player's action when each button went down, to tell whether it has fired since. */
  private touchStart = new Map<number, unknown>();
  private touchFired = new Set<number>();
  /** Touch: a skill released before it fired (a quick tap, or an aimed movement skill). */
  private tap: { slot: number; aim: Drag; action: unknown; until: number } | null = null;
  /** Virtual joystick deflection in screen space (-1…1), or null. */
  joy: { x: number; y: number } | null = null;
  private releaseLmb = false;

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
    this.on(canvas, 'mousedown', (e) => !fromTouch() && this.onCanvasDown(e as MouseEvent));
    this.on(canvas, 'pointerdown', (e) => this.onTouchDown(e as PointerEvent));
    this.on(window, 'pointermove', (e) => this.onTouchMove(e as PointerEvent));
    this.on(window, 'pointerup', (e) => this.onTouchUp(e as PointerEvent));
    this.on(window, 'pointercancel', (e) => this.onTouchUp(e as PointerEvent));
    this.on(window, 'mouseup', (e) => !fromTouch() && this.onUp(e as MouseEvent));
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
    this.touchSkills = [];
    this.touchAim.clear();
    this.tap = null;
    this.touches.clear();
    this.pinch = null;
    this.joy = null;
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
      this.game.cancelInteract();
      this.lmb = 'move';
    } else if (e.button === 2) this.press(1);
    else if (e.button === 1) {
      e.preventDefault();
      this.press(7);
    }
  }

  // ------------------------------------------------------------------ touch

  private onTouchDown(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.releaseLmb = false;
    if (this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.renderer.zoom };
      this.lmb = 'none';
      return;
    }
    if (this.touches.size > 2) return;
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    this.overUI = false;
    this.ui.onMouseMove(e.clientX, e.clientY);
    this.onCanvasDown({ button: 0, clientX: e.clientX, clientY: e.clientY, shiftKey: false, preventDefault() {} } as MouseEvent);
  }

  private onTouchMove(e: PointerEvent): void {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    t.x = e.clientX;
    t.y = e.clientY;
    if (this.pinch && this.touches.size >= 2) {
      const [a, b] = [...this.touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.renderer.zoom = Math.max(0.65, Math.min(1.45, this.pinch.zoom * (this.pinch.d / Math.max(20, d))));
      return;
    }
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  }

  private onTouchUp(e: PointerEvent): void {
    if (!this.touches.delete(e.pointerId)) return;
    if (this.touches.size < 2) this.pinch = null;
    // release after the next update so even a very quick tap registers as a move / attack
    if (this.touches.size === 0) this.releaseLmb = true;
  }

  /** On-screen skill button pressed (touch). */
  pressTouchSkill(slot: number): void {
    this.touchSkills = this.touchSkills.filter((s) => s !== slot);
    this.touchSkills.push(slot);
    this.touchAim.set(slot, null);
    this.touchStart.set(slot, this.game.player.action);
    this.touchFired.delete(slot);
  }

  /** Finger dragged on a held skill button: aim by hand, or null inside the dead zone. */
  aimTouchSkill(slot: number, drag: Drag): void {
    if (this.touchSkills.includes(slot)) this.touchAim.set(slot, drag);
  }

  /**
   * Finger lifted. Movement skills fire now (unless cancelled); other skills that haven't
   * fired yet (a very quick tap) get one cast so no tap is lost.
   */
  releaseTouchSkill(slot: number, cancel = false): void {
    if (!this.touchSkills.includes(slot)) return;
    const aim = this.touchAim.get(slot) ?? null;
    const action = this.game.player.action;
    const fired = this.touchFired.has(slot) || (!!action && action !== this.touchStart.get(slot));
    this.touchSkills = this.touchSkills.filter((s) => s !== slot);
    this.touchAim.delete(slot);
    this.touchStart.delete(slot);
    this.touchFired.delete(slot);
    if (!cancel && (this.aimsOnRelease(slot) || !fired)) {
      this.tap = { slot, aim, action: this.game.player.action, until: performance.now() + 400 };
    }
  }

  /** Active skill definition of a bar slot. */
  private slotSkill(slot: number) {
    const g = this.game;
    const uid = g.char.skillBar[slot] ?? (slot === 0 ? 'default_attack' : null);
    return uid ? g.player.skills.get(uid)?.gem.active : undefined;
  }

  private slotBehaviour(slot: number): string | undefined {
    return this.slotSkill(slot)?.behaviour;
  }

  /** How far a full drag aims: movement skills stop at their own maximum distance. */
  private slotReach(slot: number): number {
    const a = this.slotSkill(slot);
    const p = a?.params ?? {};
    switch (a?.behaviour) {
      case 'leap':
        return p.maxDist ?? 8;
      case 'dash':
        return p.distance ?? 7;
      case 'blink':
        return p.distance ?? 6;
      default:
        return AIM_RANGE;
    }
  }

  /** Movement skills aim while held and fire on release. */
  aimsOnRelease(slot: number): boolean {
    return AIM_ON_RELEASE.has(this.slotBehaviour(slot) ?? '');
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
      if (key === ' ') e.preventDefault();
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
      case 'u':
        if (ui.modals.isOpen) ui.modals.close();
        else ui.modals.ascendancy();
        break;
      case 'b':
        if (ui.modals.isOpen) ui.modals.close();
        else ui.modals.builds();
        break;
      case 'j':
        if (ui.modals.isOpen) ui.modals.close();
        else ui.story.journal();
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
    const slot: number | null = this.held.length ? this.held[this.held.length - 1] : null;
    inp.heldSlot = slot;
    // holding the left button keeps walking even while a skill key is held (move while casting)
    inp.moveHeld = this.lmb === 'move';

    // Virtual joystick: convert the screen-space deflection into a world direction.
    inp.moveDir = null;
    if (this.joy && Math.hypot(this.joy.x, this.joy.y) > 0.25) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const a = this.renderer.screenToGround(cx, cy);
      const b = this.renderer.screenToGround(cx + this.joy.x * 120, cy + this.joy.y * 120);
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      if (l > 1e-3) inp.moveDir = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
      if (this.lmb === 'move') inp.moveHeld = false;
    }

    this.updateTouchAim();
    if (this.releaseLmb) {
      this.releaseLmb = false;
      this.lmb = 'none';
    }
  }

  /**
   * Touch skill buttons: aim where the finger drags (an arrow on the ground shows it), else at
   * the nearest enemy, else straight ahead. Movement skills only aim while held.
   */
  private updateTouchAim(): void {
    const g = this.game;
    const inp = g.input;
    const p = g.player;
    this.renderer.aim = null;
    for (const s of this.touchSkills) if (p.action && p.action !== this.touchStart.get(s)) this.touchFired.add(s);
    if (this.tap && ((p.action && p.action !== this.tap.action) || performance.now() > this.tap.until)) this.tap = null;
    let slot: number;
    let drag: Drag;
    let fire: boolean;
    if (this.touchSkills.length) {
      slot = this.touchSkills[this.touchSkills.length - 1];
      drag = this.touchAim.get(slot) ?? null;
      fire = !this.aimsOnRelease(slot);
    } else if (this.tap) {
      ({ slot, aim: drag } = this.tap);
      fire = true;
    } else return;
    const behaviour = this.slotBehaviour(slot);
    if (!behaviour) return; // empty slot
    inp.heldSlot = fire ? slot : null;
    let target: Monster | null = null;
    let to: Vec2;
    if (drag) {
      // screen drag → world direction, measured from the hero's position on screen
      const s = this.renderer.project(p.pos);
      const l = Math.hypot(drag.dx, drag.dy);
      const a = this.renderer.screenToGround(s.x, s.y);
      const b = this.renderer.screenToGround(s.x + (drag.dx / l) * 120, s.y + (drag.dy / l) * 120);
      const wl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const dir = { x: (b.x - a.x) / wl, y: (b.y - a.y) / wl };
      const reach = Math.max(0.2, Math.min(1, (l - AIM_DEAD_ZONE) / (AIM_FULL_DRAG - AIM_DEAD_ZONE))) * this.slotReach(slot);
      to = { x: p.pos.x + dir.x * reach, y: p.pos.y + dir.y * reach };
      // lock onto the nearest enemy along the arrow (ground-targeted skills go where aimed)
      if (!GROUND_TARGET.has(behaviour)) {
        let bestD = 14;
        for (const m of g.area.monsters) {
          if (m.dead || m.team !== 'enemy') continue;
          const along = (m.pos.x - p.pos.x) * dir.x + (m.pos.y - p.pos.y) * dir.y;
          const side = Math.abs((m.pos.x - p.pos.x) * dir.y - (m.pos.y - p.pos.y) * dir.x);
          if (along > 0 && along < bestD && side < 0.9 + m.radius) {
            bestD = along;
            target = m;
          }
        }
      }
    } else {
      let bestD = 12;
      for (const m of g.area.monsters) {
        if (m.dead || m.team !== 'enemy') continue;
        const d = dist(p.pos, m.pos);
        if (d < bestD) {
          bestD = d;
          target = m;
        }
      }
      const dir = inp.moveDir ?? { x: Math.cos(p.facing), y: Math.sin(p.facing) };
      to = target ? { ...target.pos } : { x: p.pos.x + dir.x * 5, y: p.pos.y + dir.y * 5 };
    }
    inp.hoverMonster = target;
    inp.cursor = to;
    if (!NO_AIM.has(behaviour) && !p.dead) {
      this.renderer.aim = { from: { ...p.pos }, to: target ? { ...target.pos } : to, manual: !!drag, ring: GROUND_TARGET.has(behaviour) };
    }
  }
}
