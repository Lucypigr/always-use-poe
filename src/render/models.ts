import * as THREE from 'three';
import type { MonsterModel } from '../data/monsters';
import type { WeaponClass } from '../items/types';

/**
 * Procedural low-poly models. Everything is built from primitives so the game needs no
 * external art assets; flat shading + a fixed isometric-style camera gives the 2.5D look.
 */

export interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  wings: THREE.Object3D[];
  weaponHolder?: THREE.Group;
  offhandHolder?: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  height: number;
  kind: string;
  legCount: number;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g as T;
}

export function mat(color: string | number, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05, ...opts });
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

/** Create a pivot group placed at a joint so children rotate around it. */
function pivot(x: number, y: number, z: number, ...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  for (const c of children) g.add(c);
  return g;
}

function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
}

function newRig(kind: string, height: number): Rig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  return { root, body, legs: [], arms: [], wings: [], materials: [], height, kind, legCount: 2 };
}

// ---------------------------------------------------------------------------------------------
// Humanoids
// ---------------------------------------------------------------------------------------------

interface HumanoidOpts {
  skin: string;
  torso: string;
  legs: string;
  accent?: string;
  hunch?: number;
  thin?: boolean;
  bulky?: boolean;
  robe?: boolean;
  hood?: boolean;
  horns?: boolean;
  glowEyes?: string;
  noLegs?: boolean;
}

export function humanoid(kind: string, o: HumanoidOpts): Rig {
  const rig = newRig(kind, 1.9);
  const skinM = mat(o.skin);
  const torsoM = mat(o.torso);
  const legM = mat(o.legs);
  const accentM = mat(o.accent ?? shade(o.torso, 0.7));
  rig.materials.push(skinM, torsoM, legM, accentM);
  const w = o.bulky ? 1.45 : o.thin ? 0.7 : 1;

  // legs
  if (!o.noLegs) {
    for (const side of [-1, 1]) {
      const legGeo = geo(`leg${o.thin}`, () => new THREE.BoxGeometry(o.thin ? 0.1 : 0.17, 0.7, o.thin ? 0.1 : 0.19));
      const leg = mesh(legGeo, legM, 0, -0.35, 0);
      const foot = mesh(geo('foot', () => new THREE.BoxGeometry(0.18, 0.1, 0.26)), accentM, 0, -0.68, 0.05);
      const p = pivot(side * 0.13 * w, 0.78, 0, leg, foot);
      rig.body.add(p);
      rig.legs.push(p);
    }
  }
  // torso
  const torsoY = o.noLegs ? 0.9 : 1.12;
  if (o.robe || o.noLegs) {
    const robe = mesh(geo('robe', () => new THREE.CylinderGeometry(0.2, 0.42, 1.05, 7)), torsoM, 0, o.noLegs ? 0.75 : 0.62, 0);
    rig.body.add(robe);
  }
  const torsoGeo = geo(`torso${w}`, () => new THREE.BoxGeometry(0.44 * w, 0.55, 0.26 * (o.bulky ? 1.3 : 1)));
  const torso = mesh(torsoGeo, torsoM, 0, torsoY, 0);
  torso.rotation.x = o.hunch ?? 0;
  rig.body.add(torso);
  const belt = mesh(geo(`belt${w}`, () => new THREE.BoxGeometry(0.46 * w, 0.08, 0.28)), accentM, 0, torsoY - 0.26, 0);
  rig.body.add(belt);
  // head
  const headY = torsoY + 0.42 + (o.hunch ? -0.08 : 0);
  const head = mesh(geo(`head${o.bulky}`, () => new THREE.IcosahedronGeometry(o.bulky ? 0.17 : 0.2, 0)), skinM, 0, headY, (o.hunch ?? 0) * 0.35);
  rig.body.add(head);
  if (o.hood) {
    const hood = mesh(geo('hood', () => new THREE.ConeGeometry(0.26, 0.42, 6)), torsoM, 0, headY + 0.12, -0.02);
    rig.body.add(hood);
  }
  if (o.horns) {
    for (const side of [-1, 1]) {
      const horn = mesh(geo('horn', () => new THREE.ConeGeometry(0.05, 0.25, 4)), accentM, side * 0.13, headY + 0.18, 0);
      horn.rotation.z = -side * 0.5;
      rig.body.add(horn);
    }
  }
  if (o.glowEyes) {
    const eyeM = new THREE.MeshBasicMaterial({ color: o.glowEyes });
    for (const side of [-1, 1]) rig.body.add(mesh(geo('eye', () => new THREE.SphereGeometry(0.035, 4, 3)), eyeM, side * 0.07, headY + 0.02, 0.17));
  }
  // shoulders + arms
  if (o.bulky) {
    for (const side of [-1, 1]) rig.body.add(mesh(geo('pauldron', () => new THREE.IcosahedronGeometry(0.16, 0)), accentM, side * 0.3 * w, torsoY + 0.24, 0));
  }
  for (const side of [-1, 1]) {
    const armGeo = geo(`arm${o.thin}${o.bulky}`, () => new THREE.BoxGeometry(o.thin ? 0.08 : o.bulky ? 0.2 : 0.13, 0.6, o.thin ? 0.08 : o.bulky ? 0.2 : 0.14));
    const arm = mesh(armGeo, side < 0 ? torsoM : torsoM, 0, -0.28, 0);
    const hand = mesh(geo('hand', () => new THREE.BoxGeometry(0.11, 0.11, 0.11)), skinM, 0, -0.6, 0);
    const p = pivot(side * (0.28 * w + 0.02), torsoY + 0.22, 0, arm, hand);
    if (o.hunch) p.rotation.x = -0.9;
    rig.body.add(p);
    rig.arms.push(p);
  }
  // weapon holders at the hands
  rig.weaponHolder = pivot(0, -0.62, 0.02);
  rig.arms[1].add(rig.weaponHolder);
  rig.offhandHolder = pivot(0, -0.5, 0.08);
  rig.arms[0].add(rig.offhandHolder);
  if (o.noLegs) rig.legCount = 0;
  return rig;
}

// ---------------------------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------------------------

const metal = () => mat('#b8b8c0', { metalness: 0.6, roughness: 0.35 });
const wood = () => mat('#6b4a2b');

export function weaponModel(cls: WeaponClass | 'shield' | 'quiver' | undefined, tint?: string): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  if (tint) m.color.set(tint);
  switch (cls) {
    case 'one_hand_sword':
    case 'two_hand_sword': {
      const long = cls === 'two_hand_sword' ? 1.5 : 1;
      g.add(mesh(new THREE.BoxGeometry(0.06, 0.8 * long, 0.02), m, 0, -0.45 * long, 0));
      g.add(mesh(new THREE.BoxGeometry(0.26, 0.05, 0.06), mat('#6b5a2b'), 0, -0.04, 0));
      g.add(mesh(new THREE.BoxGeometry(0.05, 0.18, 0.05), wood(), 0, 0.08, 0));
      g.rotation.x = Math.PI;
      break;
    }
    case 'one_hand_axe':
    case 'two_hand_axe': {
      const s = cls === 'two_hand_axe' ? 1.4 : 1;
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8 * s, 5), wood(), 0, 0.3 * s, 0));
      g.add(mesh(new THREE.BoxGeometry(0.3 * s, 0.22 * s, 0.03), m, 0.12 * s, 0.62 * s, 0));
      break;
    }
    case 'one_hand_mace':
    case 'two_hand_mace':
    case 'sceptre': {
      const s = cls === 'two_hand_mace' ? 1.4 : 1;
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7 * s, 5), wood(), 0, 0.28 * s, 0));
      const headM = cls === 'sceptre' ? mat('#d8b848', { metalness: 0.5, emissive: '#403000' }) : m;
      g.add(mesh(new THREE.DodecahedronGeometry(0.13 * s, 0), headM, 0, 0.66 * s, 0));
      break;
    }
    case 'dagger':
    case 'claw': {
      g.add(mesh(new THREE.ConeGeometry(0.05, 0.42, 4), m, 0, 0.26, 0.04));
      g.add(mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), wood(), 0, 0, 0));
      if (cls === 'claw') for (const x of [-0.06, 0.06]) g.add(mesh(new THREE.ConeGeometry(0.025, 0.3, 3), m, x, 0.2, 0.06));
      break;
    }
    case 'wand': {
      g.add(mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.5, 5), wood(), 0, 0.2, 0));
      g.add(mesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshBasicMaterial({ color: tint ?? '#8fb3ff' }), 0, 0.48, 0));
      break;
    }
    case 'staff': {
      g.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.8, 5), wood(), 0, 0.35, 0));
      g.add(mesh(new THREE.OctahedronGeometry(0.1, 0), new THREE.MeshBasicMaterial({ color: tint ?? '#8fd8ff' }), 0, 1.3, 0));
      break;
    }
    case 'bow': {
      const bow = mesh(new THREE.TorusGeometry(0.55, 0.03, 4, 12, Math.PI * 0.85), wood(), 0, 0, 0);
      bow.rotation.z = Math.PI / 2 + Math.PI * 0.075;
      bow.rotation.y = Math.PI / 2;
      g.add(bow);
      break;
    }
    case 'shield': {
      const s = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 8), tint ? mat(tint) : mat('#6a5a4a'), 0, 0, 0);
      s.rotation.x = Math.PI / 2;
      g.add(s);
      g.add(mesh(new THREE.SphereGeometry(0.07, 5, 4), m, 0, 0, 0.05));
      break;
    }
    case 'quiver': {
      g.add(mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.6, 6), mat('#5a3a1a'), 0, 0, 0));
      for (const x of [-0.04, 0, 0.04]) g.add(mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), mat('#e8e0d0'), x, 0.35, 0));
      break;
    }
  }
  return g;
}

// ---------------------------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------------------------

function quadruped(kind: string, color: string, opts: { long?: number; tail?: boolean; horns?: boolean } = {}): Rig {
  const rig = newRig(kind, 1.2);
  const m = mat(color);
  const d = mat(shade(color, 0.65));
  rig.materials.push(m, d);
  const L = opts.long ?? 1;
  rig.body.add(mesh(geo(`qbody${L}`, () => new THREE.BoxGeometry(0.42, 0.4, 0.95 * L)), m, 0, 0.7, 0));
  const head = mesh(geo('qhead', () => new THREE.BoxGeometry(0.3, 0.3, 0.42)), m, 0, 0.85, 0.6 * L);
  rig.body.add(head);
  rig.body.add(mesh(geo('snout', () => new THREE.BoxGeometry(0.16, 0.14, 0.2)), d, 0, 0.78, 0.86 * L));
  if (opts.horns) for (const s of [-1, 1]) rig.body.add(mesh(geo('qhorn', () => new THREE.ConeGeometry(0.05, 0.3, 4)), d, s * 0.12, 1.05, 0.55 * L));
  if (opts.tail) {
    const tail = mesh(geo('tail', () => new THREE.BoxGeometry(0.08, 0.08, 0.45)), d, 0, 0.8, -0.65 * L);
    tail.rotation.x = 0.5;
    rig.body.add(tail);
  }
  for (const [x, z] of [[-0.15, 0.35], [0.15, 0.35], [-0.15, -0.35], [0.15, -0.35]]) {
    const leg = mesh(geo('qleg', () => new THREE.BoxGeometry(0.11, 0.5, 0.11)), d, 0, -0.25, 0);
    const p = pivot(x, 0.55, z * L, leg);
    rig.body.add(p);
    rig.legs.push(p);
  }
  rig.legCount = 4;
  return rig;
}

function spider(kind: string, color: string): Rig {
  const rig = newRig(kind, 0.9);
  const m = mat(color);
  const d = mat(shade(color, 0.6));
  rig.materials.push(m, d);
  const abdomen = mesh(geo('abdomen', () => new THREE.SphereGeometry(0.38, 7, 5)), m, 0, 0.5, -0.35);
  abdomen.scale.set(1, 0.8, 1.15);
  rig.body.add(abdomen);
  rig.body.add(mesh(geo('ceph', () => new THREE.SphereGeometry(0.22, 6, 4)), d, 0, 0.45, 0.15));
  const eyeM = new THREE.MeshBasicMaterial({ color: '#ff3020' });
  for (const s of [-1, 1]) rig.body.add(mesh(geo('seye', () => new THREE.SphereGeometry(0.04, 4, 3)), eyeM, s * 0.07, 0.52, 0.35));
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const upper = mesh(geo('sleg1', () => new THREE.BoxGeometry(0.5, 0.05, 0.05)), d, side * 0.25, 0.1, 0);
    upper.rotation.z = side * -0.5;
    const lower = mesh(geo('sleg2', () => new THREE.BoxGeometry(0.05, 0.5, 0.05)), d, side * 0.48, -0.15, 0);
    const p = pivot(side * 0.12, 0.45, 0.2 - k * 0.14, upper, lower);
    p.rotation.y = side * (k - 1.5) * 0.35;
    rig.body.add(p);
    rig.legs.push(p);
  }
  rig.legCount = 8;
  return rig;
}

function crab(kind: string, color: string): Rig {
  const rig = newRig(kind, 0.7);
  const m = mat(color);
  const d = mat(shade(color, 0.7));
  rig.materials.push(m, d);
  const shell = mesh(geo('shell', () => new THREE.SphereGeometry(0.45, 7, 4)), m, 0, 0.35, 0);
  shell.scale.set(1.2, 0.5, 0.9);
  rig.body.add(shell);
  for (const s of [-1, 1]) {
    const claw = mesh(geo('claw', () => new THREE.BoxGeometry(0.22, 0.14, 0.3)), d, 0, 0, 0.2);
    const p = pivot(s * 0.4, 0.35, 0.35, claw);
    rig.body.add(p);
    rig.arms.push(p);
    for (let k = 0; k < 3; k++) {
      const leg = mesh(geo('cleg', () => new THREE.BoxGeometry(0.35, 0.05, 0.05)), d, s * 0.2, -0.1, 0);
      leg.rotation.z = s * -0.6;
      const lp = pivot(s * 0.35, 0.3, -0.15 + k * 0.15, leg);
      rig.body.add(lp);
      rig.legs.push(lp);
    }
  }
  rig.legCount = 6;
  return rig;
}

function bat(kind: string, color: string): Rig {
  const rig = newRig(kind, 1.4);
  const m = mat(color);
  const d = mat(shade(color, 0.6), { side: THREE.DoubleSide });
  rig.materials.push(m, d);
  rig.body.add(mesh(geo('batbody', () => new THREE.SphereGeometry(0.2, 5, 4)), m, 0, 1.3, 0));
  for (const s of [-1, 1]) {
    const wing = mesh(geo('wing', () => new THREE.PlaneGeometry(0.6, 0.35)), d, s * 0.3, 0, 0);
    wing.rotation.x = -Math.PI / 2;
    const p = pivot(s * 0.1, 1.3, 0, wing);
    rig.body.add(p);
    rig.wings.push(p);
  }
  rig.legCount = 0;
  return rig;
}

export function monsterRig(model: MonsterModel, color: string): Rig {
  switch (model) {
    case 'zombie':
      return humanoid(model, { skin: color, torso: shade(color, 0.7), legs: shade(color, 0.5), hunch: 0.35 });
    case 'skeleton':
      return humanoid(model, { skin: color, torso: shade(color, 0.9), legs: color, thin: true, glowEyes: '#ff5020' });
    case 'humanoid':
      return humanoid(model, { skin: '#c8a888', torso: color, legs: shade(color, 0.6), accent: shade(color, 1.3) });
    case 'caster':
      return humanoid(model, { skin: '#b8a090', torso: color, legs: shade(color, 0.6), robe: true, hood: true, glowEyes: '#ffe080' });
    case 'wraith':
      return humanoid(model, { skin: shade(color, 0.6), torso: color, legs: color, robe: true, hood: true, noLegs: true, glowEyes: '#c0e0ff' });
    case 'brute':
      return humanoid(model, { skin: color, torso: shade(color, 0.75), legs: shade(color, 0.55), bulky: true, hunch: 0.15 });
    case 'imp':
      return humanoid(model, { skin: color, torso: shade(color, 0.8), legs: shade(color, 0.6), horns: true, glowEyes: '#ffe020' });
    case 'spider':
      return spider(model, color);
    case 'beast':
      return quadruped(model, color, { tail: true, horns: color === '#7a6a50' });
    case 'crab':
      return crab(model, color);
    case 'bat':
      return bat(model, color);
  }
}

// ---------------------------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------------------------

export interface AnimState {
  moving: boolean;
  phase: number;
  /** 0..1 progress of the current attack/cast, or -1 when idle. */
  action: number;
  dead: boolean;
  deathT: number;
  airborne: number;
  time: number;
}

export function animateRig(rig: Rig, s: AnimState): void {
  const swing = s.moving ? Math.sin(s.phase * 2.2) : 0;
  if (rig.legCount === 2) {
    rig.legs[0].rotation.x = swing * 0.7;
    rig.legs[1].rotation.x = -swing * 0.7;
  } else if (rig.legCount === 4) {
    rig.legs.forEach((l, i) => (l.rotation.x = swing * 0.6 * (i % 3 === 0 ? 1 : -1)));
  } else if (rig.legCount > 4) {
    rig.legs.forEach((l, i) => (l.rotation.z = Math.sin(s.phase * 3 + i * 1.3) * (s.moving ? 0.25 : 0.03)));
  }
  for (const w of rig.wings) w.rotation.z = Math.sin(s.time * 14 + rig.root.id) * 0.8 * (w.position.x < 0 ? 1 : -1);
  if (rig.arms.length >= 2 && rig.kind !== 'crab') {
    const base = rig.kind === 'zombie' ? -1.1 : 0;
    rig.arms[0].rotation.x = base - swing * 0.5;
    if (s.action >= 0) {
      // wind up then strike
      const a = s.action < 0.4 ? -2.4 * (s.action / 0.4) : -2.4 + 3.2 * Math.min(1, (s.action - 0.4) / 0.3);
      rig.arms[1].rotation.x = a;
    } else rig.arms[1].rotation.x = base + swing * 0.5;
  } else if (rig.kind === 'crab' && rig.arms.length) {
    rig.arms.forEach((a, i) => (a.rotation.y = s.action >= 0 ? Math.sin(s.action * Math.PI) * (i ? -0.8 : 0.8) : Math.sin(s.time * 3) * 0.1));
  }
  rig.body.position.y = (s.moving ? Math.abs(Math.sin(s.phase * 2.2)) * 0.05 : 0) + s.airborne;
  if (rig.kind === 'wraith' || rig.kind === 'bat') rig.body.position.y += Math.sin(s.time * 2 + rig.root.id) * 0.1 + (rig.kind === 'wraith' ? 0.25 : 0);
  if (s.dead) {
    const t = Math.min(1, s.deathT / 0.5);
    rig.body.rotation.x = -t * Math.PI * 0.5;
    rig.body.position.y = -Math.max(0, s.deathT - 1.5) * 0.6;
  } else rig.body.rotation.x = 0;
}

// ---------------------------------------------------------------------------------------------
// Props, NPCs, interactables
// ---------------------------------------------------------------------------------------------

export function propModel(kind: string, theme: { wall: string; wallTop: string }): THREE.Object3D {
  const g = new THREE.Group();
  switch (kind) {
    case 'tree':
    case 'pine': {
      g.add(mesh(geo('trunk', () => new THREE.CylinderGeometry(0.12, 0.18, 1.2, 5)), mat('#4a3520'), 0, 0.6, 0));
      const leaf = mat(kind === 'pine' ? '#2d4a26' : '#3d5a2a');
      g.add(mesh(geo('crown1', () => new THREE.ConeGeometry(0.9, 1.6, 6)), leaf, 0, 1.7, 0));
      g.add(mesh(geo('crown2', () => new THREE.ConeGeometry(0.65, 1.2, 6)), leaf, 0, 2.4, 0));
      break;
    }
    case 'dead_tree': {
      g.add(mesh(geo('dtrunk', () => new THREE.CylinderGeometry(0.1, 0.2, 2, 5)), mat('#3a3025'), 0, 1, 0));
      for (const [r, y] of [[0.8, 1.4], [-0.9, 1.1], [2.2, 1.7]]) {
        const b = mesh(geo('branch', () => new THREE.CylinderGeometry(0.04, 0.07, 0.9, 4)), mat('#3a3025'), 0, y, 0);
        b.rotation.z = 0.9;
        b.rotation.y = r;
        g.add(b);
      }
      break;
    }
    case 'rock':
    case 'rubble': {
      const r = mesh(geo('rock', () => new THREE.DodecahedronGeometry(0.55, 0)), mat(theme.wallTop), 0, 0.3, 0);
      r.scale.set(1, 0.7, 0.9);
      g.add(r);
      if (kind === 'rubble') g.add(mesh(geo('rock2', () => new THREE.DodecahedronGeometry(0.3, 0)), mat(theme.wall), 0.4, 0.15, 0.2));
      break;
    }
    case 'stalagmite':
      g.add(mesh(geo('stalag', () => new THREE.ConeGeometry(0.35, 1.8, 5)), mat(theme.wallTop), 0, 0.9, 0));
      break;
    case 'crystal': {
      const cm = mat('#7fb8ff', { emissive: '#1a3a70', roughness: 0.3 });
      for (const [x, z, h, rz] of [[0, 0, 1.3, 0.1], [0.25, 0.1, 0.8, -0.4], [-0.2, -0.15, 0.9, 0.35]]) {
        const c = mesh(geo('crystal', () => new THREE.OctahedronGeometry(0.25, 0)), cm, x, h / 2, z);
        c.scale.set(0.8, h * 2, 0.8);
        c.rotation.z = rz;
        g.add(c);
      }
      break;
    }
    case 'pillar': {
      g.add(mesh(geo('pillar', () => new THREE.CylinderGeometry(0.35, 0.4, 2.8, 8)), mat(theme.wallTop), 0, 1.4, 0));
      g.add(mesh(geo('pcap', () => new THREE.BoxGeometry(0.95, 0.2, 0.95)), mat(theme.wall), 0, 2.85, 0));
      break;
    }
    case 'coffin':
      g.add(mesh(geo('coffin', () => new THREE.BoxGeometry(0.6, 0.4, 1.3)), mat('#3a2a20'), 0, 0.2, 0));
      break;
    case 'brazier': {
      g.add(mesh(geo('brazier', () => new THREE.CylinderGeometry(0.35, 0.2, 0.9, 6)), mat('#3a3a3a', { metalness: 0.5 }), 0, 0.45, 0));
      const fire = mesh(geo('fire', () => new THREE.ConeGeometry(0.25, 0.5, 5)), new THREE.MeshBasicMaterial({ color: '#ff9a3a' }), 0, 1.1, 0);
      fire.name = 'flame';
      g.add(fire);
      break;
    }
    case 'wreck': {
      const hull = mesh(geo('hull', () => new THREE.BoxGeometry(0.7, 0.5, 1.6)), mat('#4a3a2a'), 0, 0.25, 0);
      hull.rotation.z = 0.4;
      g.add(hull);
      break;
    }
    case 'crate':
      g.add(mesh(geo('crate', () => new THREE.BoxGeometry(0.8, 0.8, 0.8)), mat('#7a5a3a'), 0, 0.4, 0));
      break;
    case 'barrel':
      g.add(mesh(geo('barrel', () => new THREE.CylinderGeometry(0.35, 0.35, 0.9, 8)), mat('#6a4a2a'), 0, 0.45, 0));
      break;
    // non-blocking small decor
    case 'grass': {
      const gm = mat('#4a5a2a');
      for (let i = 0; i < 3; i++) {
        const b = mesh(geo('blade', () => new THREE.ConeGeometry(0.04, 0.35, 3)), gm, (i - 1) * 0.08, 0.17, (i % 2) * 0.06);
        b.rotation.z = (i - 1) * 0.3;
        g.add(b);
      }
      break;
    }
    case 'stone':
    case 'debris':
    case 'shard':
      g.add(mesh(geo('pebble', () => new THREE.DodecahedronGeometry(0.15, 0)), mat(kind === 'shard' ? '#7fb8ff' : theme.wallTop), 0, 0.07, 0));
      break;
    case 'bones': {
      const bm = mat('#d8d0b8');
      for (let i = 0; i < 3; i++) {
        const b = mesh(geo('bone', () => new THREE.CylinderGeometry(0.03, 0.03, 0.4, 4)), bm, (i - 1) * 0.12, 0.03, 0);
        b.rotation.z = Math.PI / 2;
        b.rotation.y = i * 0.9;
        g.add(b);
      }
      g.add(mesh(geo('skull', () => new THREE.SphereGeometry(0.09, 5, 4)), bm, 0.1, 0.08, 0.15));
      break;
    }
    case 'candle': {
      g.add(mesh(geo('candle', () => new THREE.CylinderGeometry(0.04, 0.04, 0.2, 5)), mat('#e8e0c8'), 0, 0.1, 0));
      g.add(mesh(geo('cflame', () => new THREE.SphereGeometry(0.04, 4, 3)), new THREE.MeshBasicMaterial({ color: '#ffc050' }), 0, 0.23, 0));
      break;
    }
    case 'mushroom': {
      g.add(mesh(geo('mstem', () => new THREE.CylinderGeometry(0.03, 0.04, 0.15, 4)), mat('#d8d0c0'), 0, 0.07, 0));
      g.add(mesh(geo('mcap', () => new THREE.SphereGeometry(0.09, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2)), mat('#a04030'), 0, 0.14, 0));
      break;
    }
    case 'shell':
      g.add(mesh(geo('shellprop', () => new THREE.ConeGeometry(0.1, 0.12, 5)), mat('#e8d0c0'), 0, 0.05, 0));
      break;
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.receiveShadow = true;
  });
  return g;
}

export function interactableModel(kind: string): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case 'stash': {
      g.add(mesh(new THREE.BoxGeometry(1.1, 0.6, 0.7), mat('#6a4a2a'), 0, 0.3, 0));
      g.add(mesh(new THREE.BoxGeometry(1.15, 0.2, 0.75), mat('#8a6a3a'), 0, 0.7, 0));
      g.add(mesh(new THREE.BoxGeometry(0.15, 0.2, 0.05), mat('#d8b848', { metalness: 0.8 }), 0, 0.5, 0.37));
      break;
    }
    case 'vendor': {
      const rig = humanoid('npc', { skin: '#c8a888', torso: '#6a3a5a', legs: '#3a2a3a', accent: '#d8b848', robe: true });
      g.add(rig.root);
      break;
    }
    case 'waypoint':
    case 'exit': {
      g.add(mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.2, 10), mat('#5a5a6a'), 0, 0.1, 0));
      const rune = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 20), new THREE.MeshBasicMaterial({ color: '#6ab0ff', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      rune.rotation.x = -Math.PI / 2;
      rune.position.y = 0.22;
      rune.name = 'spin';
      g.add(rune);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        g.add(mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), mat('#6a6a7a'), Math.cos(a) * 1.05, 0.55, Math.sin(a) * 1.05));
      }
      break;
    }
    case 'map_device': {
      g.add(mesh(new THREE.CylinderGeometry(1, 1.2, 0.35, 8), mat('#3a3040'), 0, 0.17, 0));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 6, 24), new THREE.MeshBasicMaterial({ color: '#b07aff' }));
      ring.position.y = 1.1;
      ring.name = 'spin';
      g.add(ring);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        g.add(mesh(new THREE.BoxGeometry(0.15, 1.4, 0.15), mat('#5a4a6a'), Math.cos(a) * 0.85, 0.7, Math.sin(a) * 0.85));
      }
      break;
    }
    case 'town_portal':
    case 'area_portal': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.08, 6, 24), new THREE.MeshBasicMaterial({ color: '#8fd8ff' }));
      ring.position.y = 1.1;
      g.add(ring);
      const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ color: '#3a7aff', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
      swirl.position.y = 1.1;
      swirl.name = 'spin';
      g.add(swirl);
      g.name = 'billboard';
      break;
    }
  }
  return g;
}

export function groundItemModel(color: string, kind: 'currency' | 'gem' | 'equipment' | 'map' | 'flask'): THREE.Object3D {
  const m = kind === 'gem' || kind === 'currency' ? new THREE.MeshBasicMaterial({ color }) : mat(color, { emissive: color, emissiveIntensity: 0.25 });
  let g: THREE.BufferGeometry;
  if (kind === 'currency') g = geo('gi_cur', () => new THREE.SphereGeometry(0.12, 6, 4));
  else if (kind === 'gem') g = geo('gi_gem', () => new THREE.OctahedronGeometry(0.14, 0));
  else if (kind === 'map') g = geo('gi_map', () => new THREE.BoxGeometry(0.35, 0.05, 0.28));
  else if (kind === 'flask') g = geo('gi_flask', () => new THREE.CylinderGeometry(0.08, 0.12, 0.3, 6));
  else g = geo('gi_eq', () => new THREE.BoxGeometry(0.4, 0.12, 0.3));
  const o = mesh(g, m, 0, 0.1, 0);
  return o;
}
