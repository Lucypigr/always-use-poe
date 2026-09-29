import * as THREE from 'three';

/**
 * Procedural surface textures (no image assets): a greyscale albedo that is multiplied with
 * the theme's vertex colours, plus a normal map derived from the same height field so the
 * player's torch light picks out stones, cracks and rock facets.
 */

export interface Surface {
  map: THREE.Texture;
  normalMap: THREE.Texture;
}

function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Tileable value noise with `cells` lattice cells across the texture. */
function valueNoise(size: number, cells: number, rnd: () => number): Float32Array {
  const lat = new Float32Array(cells * cells).map(() => rnd());
  const out = new Float32Array(size * size);
  const at = (x: number, y: number) => lat[((y + cells) % cells) * cells + ((x + cells) % cells)];
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    const sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const x0 = Math.floor(fx);
      const tx = fx - x0;
      const sx = tx * tx * (3 - 2 * tx);
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      out[y * size + x] = a + (b - a) * sy;
    }
  }
  return out;
}

function fbm(size: number, base: number, octaves: number, rnd: () => number): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = valueNoise(size, base << o, rnd);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function toTextures(size: number, height: Float32Array, albedo: Float32Array, strength: number): Surface {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  };
  const ac = make();
  const nc = make();
  const actx = ac.getContext('2d')!;
  const nctx = nc.getContext('2d')!;
  const aimg = actx.createImageData(size, size);
  const nimg = nctx.createImageData(size, size);
  const h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const v = Math.max(0, Math.min(255, Math.round(albedo[i] * 255)));
      aimg.data[i * 4] = aimg.data[i * 4 + 1] = aimg.data[i * 4 + 2] = v;
      aimg.data[i * 4 + 3] = 255;
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      nimg.data[i * 4] = Math.round(((-dx / l) * 0.5 + 0.5) * 255);
      nimg.data[i * 4 + 1] = Math.round(((dy / l) * 0.5 + 0.5) * 255);
      nimg.data[i * 4 + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255);
      nimg.data[i * 4 + 3] = 255;
    }
  }
  actx.putImageData(aimg, 0, 0);
  nctx.putImageData(nimg, 0, 0);
  const map = new THREE.CanvasTexture(ac);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(nc);
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  }
  return { map, normalMap };
}

let ground: Surface | null = null;
/** Dirt with embedded stones, puddle-dark patches and hairline cracks. */
export function groundSurface(): Surface {
  if (ground) return ground;
  const size = 512;
  const rnd = rng(1337);
  const height = fbm(size, 4, 5, rnd);
  const albedo = new Float32Array(size * size);
  const patches = fbm(size, 2, 3, rnd);
  for (let i = 0; i < albedo.length; i++) albedo[i] = 0.55 + height[i] * 0.35 - Math.max(0, patches[i] - 0.55) * 0.6;
  // stones: rounded bumps, lighter on top
  for (let s = 0; s < 150; s++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const r = 2 + rnd() * rnd() * rnd() * 22;
    const tone = 0.6 + rnd() * 0.35;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.2) / r;
        if (d >= 1) continue;
        const i = ((y + size) % size) * size + ((x + size) % size);
        const bump = Math.sqrt(1 - d * d);
        height[i] += bump * 0.35;
        albedo[i] = albedo[i] * 0.3 + tone * (0.75 + bump * 0.25) * 0.7;
      }
    }
  }
  // cracks: random walks carved into the height field
  for (let k = 0; k < 22; k++) {
    let x = rnd() * size;
    let y = rnd() * size;
    let a = rnd() * Math.PI * 2;
    for (let step = 0; step < 90; step++) {
      a += (rnd() - 0.5) * 0.7;
      x += Math.cos(a) * 1.5;
      y += Math.sin(a) * 1.5;
      const i = ((Math.floor(y) + size) % size) * size + ((Math.floor(x) + size) % size);
      height[i] -= 0.25;
      albedo[i] *= 0.45;
    }
  }
  ground = toTextures(size, height, albedo, 6);
  return ground;
}

let rock: Surface | null = null;
/** Craggy stone for walls and cliffs. */
export function rockSurface(): Surface {
  if (rock) return rock;
  const size = 256;
  const rnd = rng(4242);
  const height = fbm(size, 4, 5, rnd);
  const ridges = fbm(size, 8, 3, rnd);
  const albedo = new Float32Array(size * size);
  for (let i = 0; i < height.length; i++) {
    const r = 1 - Math.abs(ridges[i] - 0.5) * 2;
    height[i] = height[i] * 0.7 + r * r * 0.3;
    albedo[i] = 0.5 + height[i] * 0.45;
  }
  rock = toTextures(size, height, albedo, 9);
  return rock;
}

let splat: THREE.Texture | null = null;
/** Blood splatter decal (white, tinted by the material colour). */
export function splatTexture(): THREE.Texture {
  if (splat) return splat;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const rnd = rng(99);
  ctx.fillStyle = '#fff';
  const blob = (x: number, y: number, r: number) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  blob(64, 64, 22);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 14 + rnd() * 40;
    blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 2 + rnd() * 8 * (1 - d / 60));
  }
  splat = new THREE.CanvasTexture(c);
  return splat;
}
