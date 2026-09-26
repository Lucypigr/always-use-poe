import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * Path of Exile-style "grimdark" grade, applied after tone mapping:
 * muted colours with warm highlights and cold shadows, crushed blacks, a strong vignette
 * that doubles as the player's light radius, film grain, and a red pulse at low life.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uSaturation: { value: 0.82 },
    uContrast: { value: 1.12 },
    uVignette: { value: 0.85 },
    uRadius: { value: 0.62 },
    uGrain: { value: 0.045 },
    uHurt: { value: 0 },
    uShadowTint: { value: new THREE.Color('#1c2433') },
    uLightTint: { value: new THREE.Color('#ffe2b8') },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uAspect, uSaturation, uContrast, uVignette, uRadius, uGrain, uHurt;
    uniform vec3 uShadowTint, uLightTint;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      // desaturate, then split-tone: cold shadows, warm highlights
      c = mix(vec3(lum), c, uSaturation);
      c = mix(c * mix(vec3(1.0), uShadowTint * 3.0, 0.35), c * uLightTint * 1.08, smoothstep(0.15, 0.75, lum));
      // contrast around mid grey (crushes blacks a little)
      c = (c - 0.5) * uContrast + 0.5;
      // light radius / vignette, centred slightly below the middle where the hero stands
      vec2 d = (vUv - vec2(0.5, 0.47)) * vec2(uAspect, 1.0);
      float r = length(d);
      float v = smoothstep(uRadius * 0.45, uRadius * 1.25, r);
      c *= 1.0 - v * uVignette;
      // low-life pulse
      float hurt = uHurt * smoothstep(0.35, 0.95, r) * (0.75 + 0.25 * sin(uTime * 6.0));
      c = mix(c, vec3(0.45, 0.02, 0.02), hurt * 0.6);
      // film grain
      c += (rand(vUv * 731.0 + fract(uTime)) - 0.5) * uGrain;
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export class PostFx {
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly grade: ShaderPass;
  private renderPass: RenderPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, lowEnd: boolean) {
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    // only bright things (spells, fire, loot beams) bloom
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / (lowEnd ? 4 : 2), size.y / (lowEnd ? 4 : 2)), 0.45, 0.45, 0.92);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);
  }

  setSize(w: number, h: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
    this.grade.uniforms.uAspect.value = w / Math.max(1, h);
  }

  /** `town` brightens the scene (safe zone), `hurt` is 0…1 missing-life pressure. */
  private warm = new THREE.Color('#ffe2b8');
  private cool = new THREE.Color('#e4ecff');

  render(dt: number, opts: { town: boolean; hurt: number; zoom: number; cold: boolean }): void {
    const u = this.grade.uniforms;
    (u.uLightTint.value as THREE.Color).lerp(opts.cold ? this.cool : this.warm, Math.min(1, dt * 3));
    u.uTime.value += dt;
    u.uVignette.value = opts.town ? 0.55 : 0.85;
    u.uRadius.value = (opts.town ? 0.8 : 0.62) / Math.max(0.7, opts.zoom);
    u.uHurt.value += (opts.hurt - u.uHurt.value) * Math.min(1, dt * 4);
    this.composer.render(dt);
  }
}
