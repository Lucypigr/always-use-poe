import { fromTouch } from './touch';
import { canRefund, pathToNode, PASSIVE_TREE, type PassiveNode } from '../data/passives';
import { passivePointsUnspent } from '../game/character';
import { clear, h } from './dom';
import type { UI } from './ui';

const RADIUS: Record<PassiveNode['kind'], number> = { start: 30, attr: 8, small: 10, notable: 17, keystone: 26 };

/** Full-screen passive skill tree with PoE-style path allocation. */
export class PassiveTreeView {
  private canvas: HTMLCanvasElement;
  private tip: HTMLElement;
  private hudPts: HTMLElement;
  private hudRef: HTMLElement;
  private search: HTMLInputElement;
  private scale = 0.55;
  private touches = new Map<number, { x: number; y: number }>();
  private pinch: { d: number; scale: number; mx: number; my: number } | null = null;
  private touchSel: PassiveNode | null = null;
  private panX = 0;
  private panY = 0;
  private hover: PassiveNode | null = null;
  private preview: number[] = [];
  private drag: { x: number; y: number; px: number; py: number; moved: boolean } | null = null;
  private centeredFor = '';
  private matches = new Set<number>();

  constructor(
    private ui: UI,
    private el: HTMLElement,
  ) {
    this.canvas = h('canvas');
    this.tip = h('div', { class: 'node-tip', style: 'display:none' });
    this.hudPts = h('div', { class: 'pts' });
    this.hudRef = h('div', { class: 'ref' });
    this.search = h('input', { type: 'text', placeholder: '搜尋天賦…' });
    this.search.addEventListener('input', () => this.updateSearch());
    this.search.addEventListener('keydown', (e) => e.stopPropagation());
    el.append(
      this.canvas,
      h('div', { class: 'tree-hud' }, this.hudPts, this.hudRef),
      h('div', { class: 'tree-search' }, this.search),
      h('div', { class: 'tree-close' }, h('button', { onclick: () => ui.closePanel('passives') }, '關閉 (P)')),
      h('div', { class: 'tree-help' }, '點擊：配置（自動走最短路徑）· 右鍵／長按：重置（需要後悔石）· 拖曳：平移 · 滾輪／雙指：縮放'),
    );
    document.body.append(this.tip);
    this.canvas.addEventListener('mousedown', (e) => !fromTouch() && this.onDown(e));
    window.addEventListener('mouseup', (e) => !fromTouch() && this.onUp(e));
    this.canvas.addEventListener('pointerdown', (e) => this.onTouchDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onTouchMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onTouchUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.onTouchUp(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
  }

  private get visible(): boolean {
    return this.el.style.display !== 'none';
  }

  render(): void {
    if (!this.visible) {
      this.tip.style.display = 'none';
      return;
    }
    const c = this.canvas;
    const w = this.el.clientWidth || window.innerWidth;
    const hh = this.el.clientHeight || window.innerHeight;
    if (c.width !== w || c.height !== hh) {
      c.width = w;
      c.height = hh;
    }
    const char = this.ui.game.char;
    if (this.centeredFor !== char.id) {
      const start = PASSIVE_TREE.byId.get(PASSIVE_TREE.startOf[char.classId])!;
      this.panX = -start.x * 0.6;
      this.panY = -start.y * 0.6;
      this.scale = 0.6;
      this.centeredFor = char.id;
    }
    const pts = passivePointsUnspent(char);
    this.hudPts.textContent = `可用天賦點數：${pts}`;
    this.hudRef.textContent = `重置點數：${char.refundPoints} · 已配置 ${char.passives.length - 1}`;
    this.draw();
  }

  private toScreen(x: number, y: number): [number, number] {
    return [this.canvas.width / 2 + this.panX + x * this.scale, this.canvas.height / 2 + this.panY + y * this.scale];
  }

  private toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.canvas.width / 2 - this.panX) / this.scale, (sy - this.canvas.height / 2 - this.panY) / this.scale];
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d')!;
    const allocated = new Set(this.ui.game.char.passives);
    const preview = new Set(this.preview);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // background glow
    const [cx, cy] = this.toScreen(0, 0);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1300 * this.scale);
    grad.addColorStop(0, 'rgba(60,45,25,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // links
    ctx.lineCap = 'round';
    for (const n of PASSIVE_TREE.nodes) {
      for (const id of n.links) {
        if (id < n.id) continue;
        const m = PASSIVE_TREE.byId.get(id)!;
        const a = allocated.has(n.id);
        const b = allocated.has(m.id);
        const inPreview = (preview.has(n.id) || a) && (preview.has(m.id) || b) && (preview.has(n.id) || preview.has(m.id));
        ctx.strokeStyle = a && b ? '#d8b860' : inPreview ? '#70d060' : a || b ? '#6a5a3a' : '#2e2a24';
        ctx.lineWidth = (a && b ? 5 : inPreview ? 4 : 3) * Math.max(0.5, this.scale);
        const [x1, y1] = this.toScreen(n.x, n.y);
        const [x2, y2] = this.toScreen(m.x, m.y);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    // nodes
    const reachable = (n: PassiveNode) => n.links.some((l) => allocated.has(l));
    for (const n of PASSIVE_TREE.nodes) {
      const [x, y] = this.toScreen(n.x, n.y);
      const r = RADIUS[n.kind] * this.scale;
      if (x < -50 || y < -50 || x > this.canvas.width + 50 || y > this.canvas.height + 50) continue;
      const a = allocated.has(n.id);
      let fill = '#1e1a16';
      if (n.kind === 'start') fill = n.classId === this.ui.game.char.classId ? '#5a4020' : '#1a1612';
      else if (a) fill = n.kind === 'keystone' ? '#ff9a40' : n.kind === 'notable' ? '#ffd860' : '#d8b860';
      else if (preview.has(n.id)) fill = '#3a6a2a';
      else if (reachable(n)) fill = '#4a4030';
      ctx.fillStyle = fill;
      ctx.strokeStyle = a ? '#fff0c0' : n.kind === 'keystone' ? '#b07a40' : n.kind === 'notable' ? '#9a8a50' : '#5a5040';
      ctx.lineWidth = (n.kind === 'notable' || n.kind === 'keystone' ? 3 : 2) * Math.max(0.6, this.scale);
      ctx.beginPath();
      if (n.kind === 'keystone') {
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
          const px = x + Math.cos(ang) * r;
          const py = y + Math.sin(ang) * r;
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.closePath();
      } else ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (this.matches.has(n.id)) {
        ctx.strokeStyle = '#40e0ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (n === this.hover) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (n.kind === 'start' && this.scale > 0.25) {
        ctx.fillStyle = n.classId === this.ui.game.char.classId ? '#ffe0a0' : '#8a7a60';
        ctx.font = `${Math.round(14 * Math.max(0.7, this.scale))}px Cinzel, Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText(n.name, x, y + 5);
      }
      if ((n.kind === 'keystone' || n.kind === 'notable') && this.scale > 0.7) {
        ctx.fillStyle = '#c8b890';
        ctx.font = `${Math.round(11 * this.scale)}px Spectral, Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText(n.name, x, y + r + 14 * this.scale);
      }
    }
  }

  private nodeAt(sx: number, sy: number): PassiveNode | null {
    const [wx, wy] = this.toWorld(sx, sy);
    let best: PassiveNode | null = null;
    let bestD = Infinity;
    for (const n of PASSIVE_TREE.nodes) {
      const d = Math.hypot(n.x - wx, n.y - wy);
      if (d < RADIUS[n.kind] + 6 && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  onMouseMove(x: number, y: number): void {
    if (!this.visible) return;
    if (this.drag) {
      const dx = x - this.drag.x;
      const dy = y - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true;
      if (this.drag.moved) {
        this.panX = this.drag.px + dx;
        this.panY = this.drag.py + dy;
        this.draw();
      }
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const n = this.nodeAt(x - rect.left, y - rect.top);
    if (n !== this.hover) {
      this.hover = n;
      const allocated = new Set(this.ui.game.char.passives);
      this.preview = n && !allocated.has(n.id) ? pathToNode(PASSIVE_TREE, allocated, n.id) ?? [] : [];
      this.draw();
    }
    if (n) this.showTip(n, x, y);
    else this.tip.style.display = 'none';
  }

  private showTip(n: PassiveNode, x: number, y: number): void {
    const char = this.ui.game.char;
    const allocated = new Set(char.passives);
    clear(this.tip);
    this.tip.append(h('div', { class: `nt-head ${n.kind}` }, n.name));
    if (n.text.length) this.tip.append(h('div', { class: 'nt-body' }, ...n.text.flatMap((t, i) => (i ? [h('br'), t] : [t]))));
    let foot = '';
    if (n.kind === 'start') foot = '職業起點';
    else if (allocated.has(n.id)) foot = canRefund(PASSIVE_TREE, allocated, n.id, PASSIVE_TREE.startOf[char.classId]) ? (this.ui.touch ? '再點一次以重置（消耗 1 重置點數）' : '按右鍵重置') : '已配置';
    else if (this.preview.length) foot = this.ui.touch ? `再點一次以配置（需要 ${this.preview.length} 點）` : `點擊配置（需要 ${this.preview.length} 點）`;
    else foot = '無法連接';
    this.tip.append(h('div', { class: 'nt-foot' }, foot));
    this.tip.style.display = '';
    const r = this.tip.getBoundingClientRect();
    this.tip.style.left = `${Math.min(window.innerWidth - r.width - 8, x + 18)}px`;
    this.tip.style.top = `${Math.min(window.innerHeight - r.height - 8, y + 12)}px`;
  }

  private onDown(e: MouseEvent): void {
    if (e.button === 0) this.drag = { x: e.clientX, y: e.clientY, px: this.panX, py: this.panY, moved: false };
    if (e.button === 2 && this.hover) {
      this.ui.game.refundPassive(this.hover.id);
      this.preview = [];
      this.render();
    }
  }

  private onUp(e: MouseEvent): void {
    if (!this.drag) return;
    const wasDrag = this.drag.moved;
    this.drag = null;
    if (!wasDrag && e.button === 0 && this.hover && this.visible) {
      if (this.ui.game.allocatePassive(this.hover.id)) {
        this.preview = [];
        this.render();
      }
    }
  }

  // ------------------------------------------------------------------ touch: drag to pan, pinch to zoom, tap twice to allocate

  private onTouchDown(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    this.canvas.setPointerCapture?.(e.pointerId);
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size === 1) this.drag = { x: e.clientX, y: e.clientY, px: this.panX, py: this.panY, moved: false };
    else if (this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: this.scale, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      if (this.drag) this.drag.moved = true;
    }
  }

  private onTouchMove(e: PointerEvent): void {
    const t = this.touches.get(e.pointerId);
    if (!t) return;
    t.x = e.clientX;
    t.y = e.clientY;
    if (this.pinch && this.touches.size >= 2) {
      const [a, b] = [...this.touches.values()];
      const rect = this.canvas.getBoundingClientRect();
      const sx = this.pinch.mx - rect.left;
      const sy = this.pinch.my - rect.top;
      const [wx, wy] = this.toWorld(sx, sy);
      this.scale = Math.max(0.2, Math.min(1.6, this.pinch.scale * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(20, this.pinch.d))));
      this.panX = sx - this.canvas.width / 2 - wx * this.scale;
      this.panY = sy - this.canvas.height / 2 - wy * this.scale;
      this.draw();
      return;
    }
    if (this.drag) {
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 10) this.drag.moved = true;
      if (this.drag.moved) {
        this.panX = this.drag.px + dx;
        this.panY = this.drag.py + dy;
        this.draw();
      }
    }
  }

  private onTouchUp(e: PointerEvent): void {
    if (!this.touches.delete(e.pointerId)) return;
    if (this.touches.size < 2) this.pinch = null;
    if (this.touches.size) return;
    const drag = this.drag;
    this.drag = null;
    if (!drag || drag.moved || !this.visible) return;
    const rect = this.canvas.getBoundingClientRect();
    const n = this.nodeAt(e.clientX - rect.left, e.clientY - rect.top);
    const char = this.ui.game.char;
    const allocated = new Set(char.passives);
    if (n && n === this.touchSel) {
      // second tap on the same node: allocate, or refund an allocated one
      if (allocated.has(n.id)) this.ui.game.refundPassive(n.id);
      else this.ui.game.allocatePassive(n.id);
      this.touchSel = null;
      this.hover = null;
      this.preview = [];
      this.tip.style.display = 'none';
      this.render();
      return;
    }
    this.touchSel = n;
    this.hover = n;
    this.preview = n && !allocated.has(n.id) ? pathToNode(PASSIVE_TREE, allocated, n.id) ?? [] : [];
    this.draw();
    if (n) this.showTip(n, e.clientX, e.clientY);
    else this.tip.style.display = 'none';
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const [wx, wy] = this.toWorld(sx, sy);
    this.scale = Math.max(0.2, Math.min(1.6, this.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    this.panX = sx - this.canvas.width / 2 - wx * this.scale;
    this.panY = sy - this.canvas.height / 2 - wy * this.scale;
    this.draw();
  }

  private updateSearch(): void {
    const q = this.search.value.trim().toLowerCase();
    this.matches.clear();
    if (q.length >= 2) for (const n of PASSIVE_TREE.nodes) if (n.name.toLowerCase().includes(q) || n.text.some((t) => t.toLowerCase().includes(q))) this.matches.add(n.id);
    this.draw();
  }
}
