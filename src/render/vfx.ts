import * as THREE from 'three';
import type { VfxEvent } from '../game/entities';

/** Pooled additive particle system (one draw call). */
export class Particles {
  readonly points: THREE.Points;
  private n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private baseSize: Float32Array;
  private grav: Float32Array;
  private next = 0;

  constructor(n = 4000) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.life = new Float32Array(n);
    this.maxLife = new Float32Array(n).fill(1);
    this.baseSize = new Float32Array(n);
    this.grav = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 pcolor; attribute float psize; attribute float palpha;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = pcolor; vAlpha = palpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * (420.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d) * vAlpha;
          gl_FragColor = vec4(vColor * a, a);
        }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, count: number, o: { color: THREE.Color; speed?: number; up?: number; life?: number; size?: number; gravity?: number; spread?: number }): void {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      const s = (o.spread ?? 0.2);
      this.pos[i * 3] = x + (Math.random() - 0.5) * s;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * s;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * s;
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 2) * (0.3 + Math.random() * 0.7);
      this.vel[i * 3] = Math.cos(a) * sp;
      this.vel[i * 3 + 1] = (o.up ?? 1.5) * (0.5 + Math.random());
      this.vel[i * 3 + 2] = Math.sin(a) * sp;
      const c = o.color;
      const v = 0.8 + Math.random() * 0.4;
      this.col[i * 3] = c.r * v;
      this.col[i * 3 + 1] = c.g * v;
      this.col[i * 3 + 2] = c.b * v;
      this.maxLife[i] = this.life[i] = (o.life ?? 0.6) * (0.6 + Math.random() * 0.6);
      this.baseSize[i] = (o.size ?? 0.25) * (0.6 + Math.random() * 0.8);
      this.grav[i] = o.gravity ?? -3;
    }
  }

  /** Emit particles along a ring (novas). */
  ring(x: number, z: number, r: number, count: number, color: THREE.Color, y = 0.3): void {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2;
      this.emit(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 1, { color, speed: 0.6, up: 1, life: 0.5, size: 0.3, spread: 0.3 });
    }
  }

  update(dt: number): void {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) {
          this.alpha[i] = 0;
          this.size[i] = 0;
        }
        continue;
      }
      this.life[i] -= dt;
      const t = this.life[i] / this.maxLife[i];
      this.vel[i * 3 + 1] += this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(0.02, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.max(0, t);
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * t);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.pcolor.needsUpdate = true;
    g.attributes.psize.needsUpdate = true;
    g.attributes.palpha.needsUpdate = true;
  }
}

let glowTex: THREE.Texture | null = null;
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function glowSprite(color: string, size: number, opacity = 0.9): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}

interface Transient {
  obj: THREE.Object3D;
  t: number;
  dur: number;
  update: (f: number, obj: THREE.Object3D) => void;
}

/** Short-lived effect meshes spawned from game VFX events. */
export class VfxManager {
  private list: Transient[] = [];

  constructor(
    private scene: THREE.Object3D,
    private particles: Particles,
  ) {}

  private add(obj: THREE.Object3D, dur: number, update: Transient['update']): void {
    this.scene.add(obj);
    this.list.push({ obj, t: 0, dur, update });
  }

  private basic(color: string, opacity = 0.8): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  }

  handle(e: VfxEvent): void {
    const P = this.particles;
    switch (e.type) {
      case 'swing': {
        const m = new THREE.Mesh(new THREE.RingGeometry(e.radius * 0.55, e.radius, 16, 1, -e.arc / 2, e.arc), this.basic(e.color, 0.55));
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = e.angle;
        m.position.set(e.pos.x, 0.9, e.pos.y);
        this.add(m, 0.18, (f, o) => ((o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.55 * (1 - f)));
        break;
      }
      case 'slam': {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.2, e.length, 24, 1, -e.halfAngle, e.halfAngle * 2), this.basic(e.color, 0.6));
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = e.angle;
        m.position.set(e.pos.x, 0.08, e.pos.y);
        this.add(m, 0.4, (f, o) => {
          (o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.6 * (1 - f);
          o.scale.setScalar(0.6 + 0.4 * f);
        });
        const c = new THREE.Color(e.color);
        for (let i = 0; i < 14; i++) {
          const a = e.angle + (Math.random() - 0.5) * e.halfAngle * 2;
          const d = Math.random() * e.length;
          P.emit(e.pos.x + Math.cos(a) * d, 0.2, e.pos.y + Math.sin(a) * d, 2, { color: c, speed: 1, up: 2.5, life: 0.6, size: 0.35 });
        }
        break;
      }
      case 'nova': {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), this.basic(e.color, 0.8));
        m.rotation.x = -Math.PI / 2;
        m.position.set(e.pos.x, 0.25, e.pos.y);
        this.add(m, 0.35, (f, o) => {
          o.scale.setScalar(Math.max(0.05, e.radius * (0.2 + 0.8 * f)));
          (o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.8 * (1 - f);
        });
        P.ring(e.pos.x, e.pos.y, e.radius * 0.9, Math.min(60, Math.round(e.radius * 10)), new THREE.Color(e.color));
        break;
      }
      case 'burn': {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 32), this.basic(e.color, 0.45));
        m.rotation.x = -Math.PI / 2;
        m.position.set(e.pos.x, 0.15, e.pos.y);
        m.scale.setScalar(e.radius);
        this.add(m, 0.5, (f, o) => ((o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.45 * (1 - f)));
        const c = new THREE.Color(e.color);
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * e.radius;
          P.emit(e.pos.x + Math.cos(a) * d, 0.2, e.pos.y + Math.sin(a) * d, 1, { color: c, speed: 0.4, up: 2.2, life: 0.6, size: 0.3 });
        }
        break;
      }
      case 'explosion': {
        const s = glowSprite(e.color, e.radius * 2.5);
        s.position.set(e.pos.x, 0.8, e.pos.y);
        this.add(s, 0.3, (f, o) => {
          (o as THREE.Sprite).material.opacity = 0.9 * (1 - f);
          o.scale.setScalar(e.radius * (1.5 + 1.5 * f));
        });
        P.emit(e.pos.x, 0.6, e.pos.y, Math.min(40, 10 + Math.round(e.radius * 8)), { color: new THREE.Color(e.color), speed: e.radius * 3, up: 2, life: 0.5, size: 0.35 });
        break;
      }
      case 'lightning': {
        const g = new THREE.Group();
        const pts = e.points;
        const m = this.basic(e.color, 1);
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const segs = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.8));
          let prev = new THREE.Vector3(a.x, i === 0 ? 1.2 : 1, a.y);
          for (let k = 1; k <= segs; k++) {
            const t = k / segs;
            const jitter = k === segs ? 0 : 0.35;
            const cur = new THREE.Vector3(a.x + (b.x - a.x) * t + (Math.random() - 0.5) * jitter, 1 + (Math.random() - 0.5) * jitter, a.y + (b.y - a.y) * t + (Math.random() - 0.5) * jitter);
            const len = prev.distanceTo(cur);
            const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, len), m);
            bolt.position.copy(prev).lerp(cur, 0.5);
            bolt.lookAt(cur);
            g.add(bolt);
            prev = cur;
          }
          const glow = glowSprite(e.color, 1.2);
          glow.position.set(b.x, 1, b.y);
          g.add(glow);
          P.emit(b.x, 1, b.y, 5, { color: new THREE.Color(e.color), speed: 2, up: 1, life: 0.3, size: 0.2 });
        }
        this.add(g, 0.22, (f, o) => {
          o.visible = Math.random() > 0.15;
          m.opacity = 1 - f;
        });
        break;
      }
      case 'impact':
        P.emit(e.pos.x, 0.9, e.pos.y, 5, { color: new THREE.Color(e.color), speed: 2.5, up: 1.5, life: 0.3, size: 0.18 });
        break;
      case 'blink': {
        const c = new THREE.Color(e.color);
        P.emit(e.from.x, 0.8, e.from.y, 20, { color: c, speed: 1.5, up: 2, life: 0.5, size: 0.35, spread: 0.6 });
        P.emit(e.to.x, 0.8, e.to.y, 20, { color: c, speed: 1.5, up: 2, life: 0.5, size: 0.35, spread: 0.6 });
        break;
      }
      case 'lob': {
        const s = glowSprite(e.color, 0.8);
        this.add(s, e.duration, (f, o) => {
          o.position.set(e.from.x + (e.to.x - e.from.x) * f, 1 + Math.sin(f * Math.PI) * 2.2, e.from.y + (e.to.y - e.from.y) * f);
          if (Math.random() < 0.5) P.emit(o.position.x, o.position.y, o.position.z, 1, { color: new THREE.Color(e.color), speed: 0.3, up: 0.2, life: 0.3, size: 0.25 });
        });
        break;
      }
      case 'levelup': {
        const c = new THREE.Color('#ffd870');
        for (let i = 0; i < 60; i++) P.emit(e.pos.x, 0.2 + Math.random() * 2, e.pos.y, 1, { color: c, speed: 0.8, up: 3, life: 1.2, size: 0.3, gravity: 0, spread: 1 });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), this.basic('#ffd870', 0.9));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(e.pos.x, 0.1, e.pos.y);
        this.add(ring, 0.8, (f, o) => {
          o.scale.setScalar(0.5 + f * 2.5);
          (o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.9 * (1 - f);
        });
        break;
      }
      case 'death':
        P.emit(e.pos.x, 0.6, e.pos.y, e.big ? 60 : 12, { color: new THREE.Color(e.color).lerp(new THREE.Color('#ff3030'), 0.3), speed: e.big ? 4 : 2, up: 2.5, life: 0.7, size: e.big ? 0.5 : 0.3 });
        break;
      case 'flask':
        P.emit(e.pos.x, 1, e.pos.y, 16, { color: new THREE.Color(e.color), speed: 1, up: 1.5, life: 0.6, size: 0.25, spread: 0.8 });
        break;
      case 'summon':
        P.emit(e.pos.x, 0.4, e.pos.y, 20, { color: new THREE.Color('#b0ffb0'), speed: 1, up: 2, life: 0.6, size: 0.3, spread: 0.6 });
        break;
      case 'text':
        break;
    }
  }

  update(dt: number): void {
    for (const t of this.list) {
      t.t += dt;
      t.update(Math.min(1, t.t / t.dur), t.obj);
    }
    const dead = this.list.filter((t) => t.t >= t.dur);
    for (const t of dead) {
      this.scene.remove(t.obj);
      t.obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry && !(o as THREE.Sprite).isSprite) m.geometry.dispose();
        const mat = m.material as THREE.Material | undefined;
        if (mat) mat.dispose();
      });
    }
    if (dead.length) this.list = this.list.filter((t) => t.t < t.dur);
  }

  clear(): void {
    for (const t of this.list) this.scene.remove(t.obj);
    this.list = [];
  }
}
