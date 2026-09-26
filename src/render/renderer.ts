import * as THREE from 'three';
import type { Vec2 } from '../core/math';
import { CLASS_BY_ID } from '../data/classes';
import { CURRENCY_BY_ID } from '../data/currency';
import { getBase } from '../data/bases';
import { NPC_BY_ID } from '../data/quests';
import type { AreaInstance } from '../game/area';
import type { AreaEffect, GroundItem, Interactable, Projectile } from '../game/entities';
import type { Game } from '../game/game';
import type { Monster } from '../game/monster';
import { FLOOR, type TileMap } from '../game/tilemap';
import { currencyId } from '../items/item';
import { maxLinks } from '../items/generate';
import type { Item, WeaponClass } from '../items/types';
import { animateRig, groundItemModel, humanoid, interactableModel, mat, monsterRig, propModel, turnTowards, weaponModel, type Rig } from './models';
import { glowSprite, Particles, VfxManager } from './vfx';
import { PostFx } from './post';
import { groundSurface, rockSurface, splatTexture } from './textures';

const CAM_OFFSET = new THREE.Vector3(0, 13.5, 9.2);
/** Visual scale of character models relative to their collision size. */
const RIG_SCALE = 1.3;

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function itemColor(it: Item): string {
  const cid = currencyId(it);
  if (cid) return CURRENCY_BY_ID[cid].colors[0];
  if (it.gem) return '#1ba29b';
  switch (it.rarity) {
    case 'magic':
      return '#8888ff';
    case 'rare':
      return '#ffff77';
    case 'unique':
      return '#af6025';
    default:
      return '#c8c8c8';
  }
}

export function itemBeam(it: Item): string | null {
  const cid = currencyId(it);
  if (cid && CURRENCY_BY_ID[cid].tier >= 2) return CURRENCY_BY_ID[cid].tier >= 3 ? '#ffffff' : '#ffd870';
  if (it.rarity === 'unique') return '#ff8a30';
  if (it.map) return '#c8a8ff';
  if (maxLinks(it) >= 5) return '#80c8ff';
  return null;
}

/** Three.js scene for the current area, rendered from a fixed isometric-style angle. */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  zoom = 1;
  private world = new THREE.Group();
  private dynamic = new THREE.Group();
  private areaUid = -1;
  private playerRig: Rig | null = null;
  private playerWeaponKey = '';
  private monsterRigs = new Map<number, Rig>();
  private projMeshes = new Map<number, THREE.Object3D>();
  private effectMeshes = new Map<number, THREE.Mesh>();
  private itemMeshes = new Map<number, THREE.Object3D>();
  private interMeshes = new Map<number, THREE.Object3D>();
  private flames: THREE.Object3D[] = [];
  private hazardMeshes: THREE.Mesh[] = [];
  private particles = new Particles(5000);
  private vfx: VfxManager;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private torch: THREE.PointLight;
  private wallUniforms = { uPlayer: { value: new THREE.Vector3() } };
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private time = 0;
  private target = new THREE.Vector3();
  private post: PostFx;
  /** Bloom, colour grading, vignette and grain (setting "高畫質特效"). */
  postFx = true;
  private lowEnd: boolean;
  private decals: { mesh: THREE.Mesh; age: number }[] = [];
  private decalMat: THREE.MeshBasicMaterial;
  private dustTimer = 0;

  constructor(private container: HTMLElement) {
    this.lowEnd = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowEnd, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowEnd ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    this.hemi = new THREE.HemisphereLight('#8090a0', '#302820', 0.9);
    this.sun = new THREE.DirectionalLight('#c8d0ff', 1.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -22;
    sc.right = 22;
    sc.top = 22;
    sc.bottom = -22;
    sc.near = 1;
    sc.far = 70;
    this.sun.shadow.bias = -0.0015;
    this.torch = new THREE.PointLight('#ffd8a0', 30, 20, 1.6);
    this.torch.castShadow = false;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.torch, this.world, this.dynamic, this.particles.points);
    this.vfx = new VfxManager(this.dynamic, this.particles);
    this.post = new PostFx(this.renderer, this.scene, this.camera, this.lowEnd);
    this.decalMat = new THREE.MeshBasicMaterial({ map: splatTexture(), color: '#5a0808', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.post?.setSize(w, h, this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------------------------------
  // Static area geometry
  // ------------------------------------------------------------------------------------------

  private clearGroup(g: THREE.Group): void {
    for (const c of [...g.children]) {
      g.remove(c);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
      });
    }
  }

  private buildArea(area: AreaInstance): void {
    this.clearGroup(this.world);
    this.clearGroup(this.dynamic);
    this.vfx.clear();
    this.monsterRigs.clear();
    this.projMeshes.clear();
    this.effectMeshes.clear();
    this.itemMeshes.clear();
    this.interMeshes.clear();
    this.flames = [];
    this.hazardMeshes = [];
    this.decals = [];
    this.playerRig = null;
    this.playerWeaponKey = '';

    const map = area.map;
    const theme = map.theme;
    // PoE-style: dim moonlit ambience outside town, the hero's torch does the heavy lifting
    const fog = new THREE.Color(theme.fog).multiplyScalar(area.town ? 1 : 0.7);
    this.scene.background = fog.clone();
    this.scene.fog = new THREE.Fog(fog, area.town ? 20 : 15, area.town ? 44 : 36);
    this.hemi.color.set(theme.ambient);
    this.hemi.groundColor.set(theme.fog);
    this.hemi.intensity = area.town ? 1.5 : 0.62;
    this.sun.color.set(theme.light).lerp(new THREE.Color('#9fb0d8'), area.town ? 0 : 0.45);
    this.sun.intensity = area.town ? 1.5 : 0.6;
    // warm torchlight, except in icy / void areas where the light takes the area's own colour
    this.torch.color.set('#ffc98a').lerp(new THREE.Color(theme.light), theme.id === 'frost' || theme.id === 'void' ? 0.85 : 0.3);
    this.torch.intensity = (area.town ? 45 : 85) * theme.lightIntensity;
    this.torch.distance = area.town ? 24 : 20;

    this.world.add(this.buildFloor(map));
    this.world.add(this.buildWalls(map));
    const under = new THREE.Mesh(new THREE.PlaneGeometry(map.w + 60, map.h + 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.wall).multiplyScalar(0.35) }));
    under.rotation.x = -Math.PI / 2;
    under.position.set(map.w / 2, -0.05, map.h / 2);
    this.world.add(under);

    for (const d of map.decor) {
      const o = propModel(d.kind, theme);
      o.position.set(d.x, 0, d.y);
      o.rotation.y = d.rot;
      o.scale.setScalar(d.scale);
      o.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) c.castShadow = d.blocking;
        if (c.name === 'flame') this.flames.push(c);
      });
      this.world.add(o);
      if (d.kind === 'brazier') {
        const light = new THREE.PointLight('#ff9a50', 14, 8, 1.8);
        light.position.set(d.x, 1.4, d.y);
        this.world.add(light);
      }
    }
    if (theme.hazard) {
      const hm = new THREE.MeshBasicMaterial({ color: theme.hazard, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
      for (const h of map.hazards) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.35 + hash(h.x, h.y) * 0.4, 6), hm);
        m.rotation.x = -Math.PI / 2;
        m.position.set(h.x, 0.02, h.y);
        this.world.add(m);
        this.hazardMeshes.push(m);
      }
    }
  }

  private buildFloor(map: TileMap): THREE.Mesh {
    const theme = map.theme;
    const a = new THREE.Color(theme.floor[0]);
    const b = new THREE.Color(theme.floor[1]);
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    let v = 0;
    const tmp = new THREE.Color();
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (map.get(x, y) === 0) continue;
        const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
        for (const [cx, cy] of corners) {
          positions.push(cx, 0, cy);
          uvs.push(cx / 7, cy / 7);
          const n = hash(cx * 0.37, cy * 0.37) * 0.6 + hash(Math.floor(cx / 4), Math.floor(cy / 4)) * 0.4;
          tmp.copy(a).lerp(b, n);
          // darken near walls for fake ambient occlusion
          let walls = 0;
          for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (map.get(cx + dx, cy + dy) === 0) walls++;
          tmp.multiplyScalar(1 - walls * 0.12);
          colors.push(tmp.r, tmp.g, tmp.b);
        }
        idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
        v += 4;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const surf = groundSurface();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, map: surf.map, normalMap: surf.normalMap, normalScale: new THREE.Vector2(1.3, 1.3) }));
    m.receiveShadow = true;
    return m;
  }

  private buildWalls(map: TileMap): THREE.Object3D {
    const theme = map.theme;
    const cells: [number, number][] = [];
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (map.get(x, y) !== 0) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) if (map.get(x + dx, y + dy) !== 0) near = true;
        if (near) cells.push([x, y]);
      }
    }
    const outdoor = theme.style === 'outdoor' || theme.style === 'caves';
    const geo: THREE.BufferGeometry = outdoor ? new THREE.DodecahedronGeometry(0.72, 0) : new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, outdoor ? 0.35 : 0.5, 0);
    // vertex colours: top face lighter
    const top = new THREE.Color(theme.wallTop);
    const side = new THREE.Color(theme.wall);
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const cols: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const c = nrm.getY(i) > 0.5 ? top : side.clone().multiplyScalar(0.7 + pos.getY(i) * 0.4);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const rs = rockSurface();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, flatShading: true, map: rs.map, normalMap: rs.normalMap, normalScale: new THREE.Vector2(1.6, 1.6) });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uPlayer = this.wallUniforms.uPlayer;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHWorld;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec4 hwp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            hwp = instanceMatrix * hwp;
          #endif
          vHWorld = (modelMatrix * hwp).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHWorld;\nuniform vec3 uPlayer;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float dz = vHWorld.z - uPlayer.z;
          float dx = abs(vHWorld.x - uPlayer.x);
          if (dz > -0.2 && dz < 4.5 && dx < 2.6 - dz * 0.2 && vHWorld.y > 0.25) {
            if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;
          }`);
    };
    const inst = new THREE.InstancedMesh(geo, material, cells.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    const e = new THREE.Euler();
    cells.forEach(([x, y], i) => {
      const hv = hash(x, y);
      const h = theme.wallHeight * (outdoor ? 0.8 + hv * 0.9 : 0.95 + hv * 0.1);
      if (outdoor) {
        p.set(x + 0.5 + (hash(x + 3, y) - 0.5) * 0.4, -0.1, y + 0.5 + (hash(x, y + 3) - 0.5) * 0.4);
        e.set(hash(x, y * 2) * 0.6, hv * 6.28, hash(x * 2, y) * 0.6);
        q.setFromEuler(e);
        s.set(1.1 + hv * 0.5, h, 1.1 + hash(y, x) * 0.5);
      } else {
        p.set(x + 0.5, 0, y + 0.5);
        q.identity();
        s.set(1, h, 1);
      }
      m4.compose(p, q, s);
      inst.setMatrixAt(i, m4);
      c.setScalar(0.8 + hv * 0.35);
      inst.setColorAt(i, c);
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    return inst;
  }

  // ------------------------------------------------------------------------------------------
  // Frame
  // ------------------------------------------------------------------------------------------

  render(game: Game, dt: number): void {
    this.time += dt;
    const area = game.area;
    if (area.uid !== this.areaUid) {
      this.areaUid = area.uid;
      this.buildArea(area);
    }
    for (const e of game.vfxQueue) {
      this.vfx.handle(e);
      if (e.type === 'death' && !area.town) this.addDecal(e.pos.x, e.pos.y, e.big ? 2.6 : 1.2);
    }
    this.updateAmbience(game, dt);
    this.syncPlayer(game, dt);
    this.syncMonsters(area, dt);
    this.syncProjectiles(area.projectiles);
    this.syncEffects(area.effects);
    this.syncItems(area.groundItems, game.settings.hideNormalItems);
    this.syncInteractables(area.interactables);
    for (const f of this.flames) f.scale.set(1 + Math.sin(this.time * 13 + f.id) * 0.15, 1 + Math.sin(this.time * 9 + f.id) * 0.25, 1);
    for (const h of this.hazardMeshes) (h.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(this.time * 2 + h.id) * 0.15;
    this.particles.update(dt);
    this.vfx.update(dt);

    const p = game.player;
    this.target.lerp(new THREE.Vector3(p.pos.x, 0, p.pos.y), Math.min(1, dt * 12));
    this.camera.position.copy(this.target).addScaledVector(CAM_OFFSET, this.zoom);
    this.camera.lookAt(this.target.x, this.target.y + 0.6, this.target.z);
    // the torch hangs high above and slightly in front of the hero so it lights the ground, not their head
    this.torch.position.set(p.pos.x, 6.5, p.pos.y + 2.5);
    this.sun.position.set(this.target.x - 8, 25, this.target.z + 6);
    this.sun.target.position.copy(this.target);
    this.wallUniforms.uPlayer.value.set(p.pos.x, 0, p.pos.y);
    if (this.postFx) {
      const lifeFrac = p.stats.maxLife > 1 ? p.life / p.stats.maxLife : 1;
      this.post.render(dt, { town: area.town, hurt: p.dead ? 0 : Math.max(0, Math.min(1, (0.4 - lifeFrac) / 0.4)), zoom: this.zoom, cold: area.map.theme.id === 'frost' || area.map.theme.id === 'void' });
    } else this.renderer.render(this.scene, this.camera);
  }

  /** Blood pools that stay on the ground for a while. */
  private addDecal(x: number, y: number, size: number): void {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.decalMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI * 2;
    m.position.set(x, 0.015, y);
    m.renderOrder = -1;
    this.dynamic.add(m);
    this.decals.push({ mesh: m, age: 0 });
    if (this.decals.length > 60) {
      const old = this.decals.shift()!;
      this.dynamic.remove(old.mesh);
      old.mesh.geometry.dispose();
    }
  }

  /** Decal fade-out and drifting dust / embers around the hero. */
  private updateAmbience(game: Game, dt: number): void {
    for (const d of this.decals) {
      d.age += dt;
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.85, d.age * 6) * Math.max(0, 1 - Math.max(0, d.age - 40) / 10);
    }
    this.dustTimer -= dt;
    if (this.dustTimer > 0) return;
    this.dustTimer = this.lowEnd ? 0.25 : 0.1;
    const p = game.player.pos;
    const theme = game.area.map.theme;
    const ember = theme.id === 'inferno' || theme.id === 'forest';
    const col = new THREE.Color(ember ? '#ff8a3a' : theme.id === 'frost' ? '#e8f0ff' : theme.id === 'void' ? '#b08aff' : '#d8c8a0');
    this.particles.emit(p.x + (Math.random() - 0.5) * 16, 0.3 + Math.random() * 2.5, p.y + (Math.random() - 0.5) * 12, 1, { color: col, speed: 0.25, up: ember ? 0.5 : 0.1, life: 3.5, size: ember ? 0.12 : 0.08, gravity: ember ? 0.05 : 0 });
  }

  private tintRig(rig: Rig, a: Monster['ailments'] | null, flash: number, base?: [string, number]): void {
    let color: string | null = null;
    let intensity = 0;
    if (base) [color, intensity] = base;
    if (a) {
      if (a.freeze) [color, intensity] = ['#80c8ff', 0.8];
      else if (a.ignite) [color, intensity] = ['#ff6020', 0.45];
      else if (a.shock) [color, intensity] = ['#ffe860', 0.35];
      else if (a.chill) [color, intensity] = ['#4080ff', 0.35];
      else if (a.poison.length) [color, intensity] = ['#60c020', 0.3];
    }
    if (flash > 0) [color, intensity] = ['#ffffff', Math.min(0.45, flash * 4)];
    for (const m of rig.materials) {
      if (color) {
        m.emissive.set(color);
        m.emissiveIntensity = intensity;
      } else if (m.emissiveIntensity !== 0) m.emissiveIntensity = 0;
    }
  }

  private syncPlayer(game: Game, dt: number): void {
    const p = game.player;
    const char = game.char;
    const weapon = char.equipment.weapon;
    const off = char.equipment.offhand;
    const key = `${char.classId}:${weapon?.baseId ?? ''}:${off?.baseId ?? ''}:${char.equipment.body?.baseId ?? ''}`;
    if (!this.playerRig || key !== this.playerWeaponKey) {
      if (this.playerRig) this.dynamic.remove(this.playerRig.root);
      const cls = CLASS_BY_ID[char.classId];
      const body = char.equipment.body;
      const torso = body ? (getBase(body.baseId).defence?.startsWith('str') ? '#7a7a88' : getBase(body.baseId).defence?.startsWith('dex') ? '#5a4630' : '#4a3a6a') : cls.color;
      const rig = humanoid('player', { skin: '#d8b090', torso, legs: '#3a3028', accent: cls.color });
      const wcls = weapon ? (getBase(weapon.baseId).cls as WeaponClass) : undefined;
      if (wcls) {
        const wm = weaponModel(wcls, weapon?.rarity === 'unique' ? '#e0a050' : undefined);
        if (wcls === 'bow') {
          rig.offhandHolder!.add(wm);
        } else rig.weaponHolder!.add(wm);
      }
      if (off) {
        const ocls = getBase(off.baseId).cls;
        if (ocls === 'shield') rig.offhandHolder!.add(weaponModel('shield'));
        else if (ocls === 'quiver') {
          const q = weaponModel('quiver');
          q.position.set(0.15, 1.3, -0.2);
          q.rotation.x = 0.3;
          rig.body.add(q);
        } else rig.offhandHolder!.add(weaponModel(ocls as WeaponClass));
      }
      rig.root.scale.setScalar(RIG_SCALE);
      this.playerRig = rig;
      this.playerWeaponKey = key;
      this.dynamic.add(rig.root);
    }
    const rig = this.playerRig;
    rig.root.position.set(p.pos.x, 0, p.pos.y);
    turnTowards(rig.root, Math.PI / 2 - p.facing, dt, 22);
    const action = p.action ? p.action.elapsed / p.action.duration : -1;
    animateRig(rig, { moving: p.moving || !!p.travel, phase: p.stride * 1.3, action, dead: p.dead, deathT: game.deathTimer ? this.time : 0, airborne: p.airborne, time: this.time, dt });
    this.tintRig(rig, p.ailments, p.hitFlash);
    rig.root.visible = true;
  }

  private syncMonsters(area: AreaInstance, dt: number): void {
    const seen = new Set<number>();
    for (const m of area.monsters) {
      seen.add(m.id);
      let rig = this.monsterRigs.get(m.id);
      if (!rig) {
        rig = monsterRig(m.def.model, m.def.color);
        const s = RIG_SCALE * m.def.scale * (m.rarity === 'rare' ? 1.15 : m.rarity === 'magic' ? 1.05 : 1);
        rig.root.scale.setScalar(s);
        if (m.isMinion) rig.materials.forEach((x) => x.color.lerp(new THREE.Color('#a0ffa0'), 0.15));
        if (m.def.boss) {
          const aura = glowSprite(m.def.color, 3.5, 0.35);
          aura.position.y = 1.2;
          rig.root.add(aura);
        }
        rig.root.rotation.y = Math.PI / 2 - m.facing;
        this.monsterRigs.set(m.id, rig);
        this.dynamic.add(rig.root);
      }
      rig.root.position.set(m.pos.x, 0, m.pos.y);
      turnTowards(rig.root, Math.PI / 2 - m.facing, dt, 12);
      if (m.moving) m.phase += dt * m.stats.moveSpeed * 1.2;
      const action = m.actionTimer > 0 && m.actionDuration > 0 ? 1 - m.actionTimer / m.actionDuration : -1;
      animateRig(rig, { moving: m.moving || !!m.travel, phase: m.phase, action, dead: m.dead, deathT: m.deathTimer, airborne: m.airborne, time: this.time, dt });
      const base: [string, number] | undefined = m.rarity === 'rare' ? ['#a08020', 0.18] : m.rarity === 'magic' ? ['#2040c0', 0.18] : undefined;
      this.tintRig(rig, m.dead ? null : m.ailments, m.dead ? 0 : m.hitFlash, m.dead ? undefined : base);
    }
    for (const [id, rig] of this.monsterRigs) {
      if (!seen.has(id)) {
        this.dynamic.remove(rig.root);
        this.monsterRigs.delete(id);
      }
    }
  }

  private projectileMesh(p: Projectile): THREE.Object3D {
    const g = new THREE.Group();
    switch (p.visual) {
      case 'arrow':
      case 'lightning_arrow': {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 4), mat(p.visual === 'arrow' ? '#c8b890' : '#c8d8ff', { emissive: p.visual === 'arrow' ? '#000000' : '#4060ff' }));
        shaft.rotation.x = Math.PI / 2;
        g.add(shaft);
        if (p.visual === 'lightning_arrow') g.add(glowSprite(p.color, 1.2));
        break;
      }
      case 'blade': {
        const b = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 3), new THREE.MeshBasicMaterial({ color: p.color }));
        b.rotation.x = Math.PI / 2;
        g.add(b, glowSprite(p.color, 1));
        break;
      }
      case 'spark':
        g.add(glowSprite(p.color, 0.9), new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 3), new THREE.MeshBasicMaterial({ color: '#ffffff' })));
        break;
      default: {
        const size = p.visual === 'fireball' ? 0.3 : 0.22;
        const core = new THREE.Mesh(p.visual === 'frost' ? new THREE.OctahedronGeometry(size, 0) : new THREE.SphereGeometry(size, 6, 5), new THREE.MeshBasicMaterial({ color: p.color }));
        g.add(core, glowSprite(p.color, size * 7));
      }
    }
    return g;
  }

  private syncProjectiles(list: Projectile[]): void {
    const seen = new Set<number>();
    for (const p of list) {
      seen.add(p.id);
      let o = this.projMeshes.get(p.id);
      if (!o) {
        o = this.projectileMesh(p);
        this.projMeshes.set(p.id, o);
        this.dynamic.add(o);
      }
      o.position.set(p.pos.x, 1.05, p.pos.y);
      o.rotation.y = Math.atan2(p.dir.x, p.dir.y);
      if (p.visual === 'blade') o.rotation.z += 0.4;
      if ((p.visual === 'fireball' || p.visual === 'spark') && Math.random() < 0.6) {
        this.particles.emit(p.pos.x, 1.05, p.pos.y, 1, { color: new THREE.Color(p.color), speed: 0.3, up: 0.3, life: 0.35, size: 0.3, gravity: 0 });
      }
    }
    for (const [id, o] of this.projMeshes) {
      if (!seen.has(id)) {
        this.dynamic.remove(o);
        this.projMeshes.delete(id);
      }
    }
  }

  private syncEffects(list: AreaEffect[]): void {
    const seen = new Set<number>();
    for (const e of list) {
      if (!e.telegraph) continue;
      seen.add(e.id);
      let m = this.effectMeshes.get(e.id);
      if (!m) {
        const g = e.shape === 'cone' ? new THREE.CircleGeometry(e.radius, 24, -e.halfAngle, e.halfAngle * 2) : new THREE.CircleGeometry(e.radius, 32);
        m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
        m.rotation.x = -Math.PI / 2;
        if (e.shape === 'cone') m.rotation.z = e.dir;
        this.effectMeshes.set(e.id, m);
        this.dynamic.add(m);
      }
      m.position.set(e.pos.x, 0.04, e.pos.y);
      const f = 1 - Math.max(0, e.delay) / Math.max(0.01, e.totalDelay);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.12 + f * 0.35;
    }
    for (const [id, m] of this.effectMeshes) {
      if (!seen.has(id)) {
        this.dynamic.remove(m);
        m.geometry.dispose();
        this.effectMeshes.delete(id);
      }
    }
  }

  private syncItems(list: GroundItem[], hideNormal: boolean): void {
    const seen = new Set<number>();
    for (const gi of list) {
      if (hideNormal && gi.item.rarity === 'normal' && !gi.item.gem && !currencyId(gi.item) && !gi.item.map) continue;
      seen.add(gi.id);
      let o = this.itemMeshes.get(gi.id);
      if (!o) {
        const it = gi.item;
        const kind = currencyId(it) ? 'currency' : it.gem ? 'gem' : it.map ? 'map' : it.flask ? 'flask' : 'equipment';
        o = new THREE.Group();
        o.add(groundItemModel(itemColor(it), kind));
        const beam = itemBeam(it);
        if (beam) {
          const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 9, 8, 1, true), new THREE.MeshBasicMaterial({ color: beam, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
          b.position.y = 4.5;
          o.add(b);
        }
        o.position.set(gi.pos.x, 0, gi.pos.y);
        o.rotation.y = hash(gi.pos.x, gi.pos.y) * 6;
        this.itemMeshes.set(gi.id, o);
        this.dynamic.add(o);
      }
      if (gi.age < 0.4) o.position.y = Math.sin((gi.age / 0.4) * Math.PI) * 0.8;
      else o.position.y = 0;
    }
    for (const [id, o] of this.itemMeshes) {
      if (!seen.has(id)) {
        this.dynamic.remove(o);
        this.itemMeshes.delete(id);
      }
    }
  }

  private syncInteractables(list: Interactable[]): void {
    const seen = new Set<number>();
    for (const it of list) {
      seen.add(it.id);
      let o = this.interMeshes.get(it.id);
      if (!o) {
        o = interactableModel(it.kind, it.npc ? NPC_BY_ID[it.npc].look : undefined);
        o.position.set(it.pos.x, 0, it.pos.y);
        if (it.kind === 'vendor') o.rotation.y = 0.3;
        // town NPCs face the square
        if (it.kind === 'npc') o.rotation.y = Math.atan2(23 - it.pos.x, 20 - it.pos.y);
        if (it.kind === 'quest') {
          const light = new THREE.PointLight('#ffc860', 8, 6, 1.6);
          light.position.y = 1.3;
          o.add(light);
        }
        if (it.kind === 'town_portal' || it.kind === 'area_portal' || it.kind === 'waypoint' || it.kind === 'exit' || it.kind === 'map_device') {
          const light = new THREE.PointLight(it.kind === 'map_device' ? '#b07aff' : '#6ab0ff', 10, 8, 1.6);
          light.position.y = 1.5;
          o.add(light);
        }
        this.interMeshes.set(it.id, o);
        this.dynamic.add(o);
      }
      o.traverse((c) => {
        if (c.name === 'spin') c.rotation.z += 0.02;
      });
      if (o.name === 'billboard') o.rotation.y = 0;
    }
    for (const [id, o] of this.interMeshes) {
      if (!seen.has(id)) {
        this.dynamic.remove(o);
        this.interMeshes.delete(id);
      }
    }
  }

  // ------------------------------------------------------------------------------------------
  // Picking / projection
  // ------------------------------------------------------------------------------------------

  screenToGround(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.groundPlane, hit);
    return { x: hit.x, y: hit.z };
  }

  /** Project a world point (game coords + height) to CSS pixels. */
  project(p: Vec2, height = 0): { x: number; y: number; visible: boolean } {
    const v = new THREE.Vector3(p.x, height, p.y).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * rect.width + rect.left, y: (-v.y * 0.5 + 0.5) * rect.height + rect.top, visible: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 };
  }

  /** Monster whose projected body is closest to the cursor, within a pixel radius. */
  pickMonster(game: Game, clientX: number, clientY: number): Monster | null {
    let best: Monster | null = null;
    let bestD = Infinity;
    for (const m of game.area.monsters) {
      if (m.dead || m.team !== 'enemy') continue;
      const s = m.def.scale;
      const c = this.project(m.pos, 0.8 * s);
      if (!c.visible) continue;
      const r = 34 * s * (1 / this.zoom);
      const d = Math.hypot(c.x - clientX, c.y - clientY);
      if (d < r && d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  }

  isFloor(map: TileMap, p: Vec2): boolean {
    return map.get(Math.floor(p.x), Math.floor(p.y)) === FLOOR;
  }
}
