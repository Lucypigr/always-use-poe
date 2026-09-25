import type { DamageType } from '../stats/stats';

export type MonsterModel =
  | 'zombie' | 'crab' | 'skeleton' | 'spider' | 'beast' | 'humanoid' | 'caster' | 'wraith' | 'bat' | 'brute' | 'imp';

export type MonsterSkillKind = 'melee' | 'projectile' | 'slam' | 'nova' | 'rain' | 'charge' | 'summon';

export interface MonsterSkillDef {
  id: string;
  kind: MonsterSkillKind;
  range: number;
  cooldown: number;
  weight: number;
  /** Damage multiplier relative to the monster's base hit. */
  dmg: number;
  /** Damage type split, overriding the monster's default. */
  types?: Partial<Record<DamageType, number>>;
  spell?: boolean;
  /** Wind-up with a ground warning before the effect lands. */
  telegraph?: number;
  params?: Record<string, number>;
  summon?: string;
  /** Visual colour for effects. */
  color?: string;
}

export interface MonsterDef {
  id: string;
  name: string;
  model: MonsterModel;
  color: string;
  scale: number;
  radius: number;
  life: number;
  damage: number;
  speed: number;
  attackSpeed: number;
  armour: number;
  evasion: number;
  res: Partial<Record<'fire' | 'cold' | 'lightning' | 'chaos', number>>;
  types: Partial<Record<DamageType, number>>;
  skills: MonsterSkillDef[];
  xp: number;
  /** Ranged monsters try to keep their distance. */
  kite?: number;
  boss?: boolean;
  flying?: boolean;
}

const melee = (range = 1.3, dmg = 1): MonsterSkillDef => ({ id: 'melee', kind: 'melee', range, cooldown: 0, weight: 10, dmg });
const bolt = (color: string, types: Partial<Record<DamageType, number>>, opts: Partial<MonsterSkillDef> = {}): MonsterSkillDef => ({
  id: 'bolt', kind: 'projectile', range: 9, cooldown: 1.8, weight: 10, dmg: 1, spell: true, types, color,
  params: { count: 1, spread: 0, speed: 12, size: 0.3 }, ...opts,
});
const arrow = (opts: Partial<MonsterSkillDef> = {}): MonsterSkillDef => ({
  id: 'arrow', kind: 'projectile', range: 10, cooldown: 1.2, weight: 10, dmg: 1, color: '#d8c8a0',
  params: { count: 1, spread: 0, speed: 16, size: 0.2, visual: 1 }, ...opts,
});

const m = (d: Partial<MonsterDef> & Pick<MonsterDef, 'id' | 'name' | 'model' | 'color'>): MonsterDef => ({
  scale: 1, radius: 0.45, life: 1, damage: 1, speed: 3, attackSpeed: 1, armour: 1, evasion: 1, res: {}, types: { phys: 1 },
  skills: [melee()], xp: 1, ...d,
});

const BOSS = { boss: true, scale: 2.1, radius: 1.0, xp: 25, armour: 2, res: { fire: 30, cold: 30, lightning: 30, chaos: 20 } };

export const MONSTERS: MonsterDef[] = [
  // Act 1
  m({ id: 'drowned', name: '溺亡水手', model: 'zombie', color: '#6b7d6a', life: 1.4, damage: 1.1, speed: 2.2, attackSpeed: 0.9 }),
  m({ id: 'crab', name: '海岸蟹', model: 'crab', color: '#b05a3a', life: 0.9, damage: 0.8, speed: 3.4, armour: 3, radius: 0.5 }),
  m({ id: 'drowned_archer', name: '溺亡弓手', model: 'skeleton', color: '#8a9a8a', life: 0.8, damage: 0.9, speed: 2.8, skills: [arrow()], kite: 6 }),
  m({
    id: 'tidecaller', name: '溺亡潮汐喚者', model: 'caster', color: '#3a7a8a', ...BOSS, life: 20, damage: 1.6, speed: 2.6,
    types: { cold: 1 }, kite: 5,
    skills: [
      bolt('#8fd8ff', { cold: 1 }, { id: 'tide_volley', params: { count: 5, spread: 50, speed: 12, size: 0.35 }, cooldown: 2.5 }),
      { id: 'tide_nova', kind: 'nova', range: 4, cooldown: 6, weight: 8, dmg: 2, spell: true, types: { cold: 1 }, telegraph: 0.9, params: { radius: 4.5 }, color: '#8fd8ff' },
      { id: 'raise', kind: 'summon', range: 12, cooldown: 12, weight: 5, dmg: 0, summon: 'drowned', params: { count: 3 } },
    ],
  }),
  m({ id: 'bog_spider', name: '沼澤爬行者', model: 'spider', color: '#4a5a2a', life: 0.7, damage: 0.8, speed: 4.6, attackSpeed: 1.4, types: { phys: 0.7, chaos: 0.3 } }),
  m({
    id: 'rhoa', name: '泥沼鴕獸', model: 'beast', color: '#7a6a50', life: 1.3, damage: 1.1, speed: 3.6,
    skills: [melee(1.4), { id: 'charge', kind: 'charge', range: 8, cooldown: 5, weight: 6, dmg: 1.5, params: { distance: 8 } }],
  }),
  m({
    id: 'bog_mother', name: '沼澤之母', model: 'spider', color: '#3a4a1a', ...BOSS, scale: 2.6, life: 24, damage: 1.7, speed: 3.2,
    types: { phys: 0.6, chaos: 0.4 },
    skills: [
      melee(2.2, 1.3),
      bolt('#9adf3a', { chaos: 1 }, { id: 'spit', params: { count: 3, spread: 30, speed: 10, size: 0.4 }, cooldown: 2.2, spell: false }),
      { id: 'brood', kind: 'summon', range: 14, cooldown: 10, weight: 5, dmg: 0, summon: 'bog_spider', params: { count: 4 } },
    ],
  }),
  m({ id: 'wolf', name: '灰狼', model: 'beast', color: '#6a6a6a', life: 0.8, damage: 0.9, speed: 5, attackSpeed: 1.5, scale: 0.85 }),
  m({ id: 'bandit_archer', name: '亡命弓手', model: 'humanoid', color: '#7a5a3a', life: 0.9, damage: 1, speed: 3, skills: [arrow()], kite: 7 }),
  m({
    id: 'ash_cultist', name: '灰燼信徒', model: 'caster', color: '#8a3a2a', life: 0.9, damage: 1.1, speed: 2.8, kite: 7, types: { fire: 1 },
    skills: [bolt('#ff8a3a', { fire: 1 }, { id: 'firebolt', params: { count: 1, spread: 0, speed: 12, size: 0.35, explode: 1.2 } })],
  }),
  m({
    id: 'grove_warden', name: '林地守衛', model: 'brute', color: '#5a4a2a', ...BOSS, scale: 2.2, life: 26, damage: 1.8, speed: 2.4,
    skills: [
      melee(2.4, 1.2),
      { id: 'root_slam', kind: 'slam', range: 6, cooldown: 4, weight: 8, dmg: 2.2, telegraph: 0.8, params: { angle: 60, length: 7 }, color: '#a08a4a' },
      { id: 'thorns', kind: 'rain', range: 10, cooldown: 7, weight: 6, dmg: 1.2, telegraph: 0.6, params: { radius: 3, impacts: 8, impactRadius: 1.1 }, color: '#8adf5a' },
    ],
  }),
  // Act 2
  m({ id: 'skeleton', name: '復活骷髏', model: 'skeleton', color: '#d8d0b8', life: 0.9, damage: 1, speed: 3.1, attackSpeed: 1.1 }),
  m({ id: 'skeleton_archer', name: '骷髏弓手', model: 'skeleton', color: '#c8c0a8', life: 0.75, damage: 0.95, speed: 2.9, skills: [arrow()], kite: 7 }),
  m({
    id: 'wraith', name: '墓穴怨靈', model: 'wraith', color: '#8090c0', life: 0.8, damage: 1.1, speed: 3.4, kite: 6, flying: true,
    types: { cold: 0.5, chaos: 0.5 }, res: { cold: 40, chaos: 30 },
    skills: [bolt('#a8b8ff', { cold: 1 }, { id: 'frostbolt' })],
  }),
  m({
    id: 'crypt_lord', name: '墓穴之主', model: 'skeleton', color: '#b8b098', ...BOSS, scale: 2.4, life: 30, damage: 2, speed: 3,
    skills: [
      { id: 'cleave', kind: 'slam', range: 3, cooldown: 1.5, weight: 10, dmg: 1.4, telegraph: 0.4, params: { angle: 140, length: 3.4 }, color: '#d8d0b8' },
      { id: 'grave_nova', kind: 'nova', range: 4, cooldown: 7, weight: 6, dmg: 2, spell: true, types: { chaos: 1 }, telegraph: 1, params: { radius: 5 }, color: '#9a5aff' },
      { id: 'raise', kind: 'summon', range: 14, cooldown: 11, weight: 5, dmg: 0, summon: 'skeleton', params: { count: 4 } },
    ],
  }),
  m({ id: 'cave_bat', name: '洞穴尖嘯者', model: 'bat', color: '#5a4a5a', life: 0.5, damage: 0.7, speed: 6, attackSpeed: 1.6, flying: true, scale: 0.9, radius: 0.35 }),
  m({
    id: 'venom_spitter', name: '毒液噴吐者', model: 'spider', color: '#6a8a2a', life: 0.85, damage: 1, speed: 3.2, kite: 7, types: { chaos: 1 },
    skills: [bolt('#9adf3a', { chaos: 1 }, { id: 'venom', spell: false })],
  }),
  m({
    id: 'broodmother', name: '巢母', model: 'spider', color: '#2a2a2a', ...BOSS, scale: 3, life: 32, damage: 2, speed: 3.6,
    types: { phys: 0.5, chaos: 0.5 },
    skills: [
      melee(2.6, 1.4),
      bolt('#9adf3a', { chaos: 1 }, { id: 'spray', params: { count: 7, spread: 80, speed: 11, size: 0.35 }, cooldown: 3, spell: false }),
      { id: 'brood', kind: 'summon', range: 14, cooldown: 9, weight: 5, dmg: 0, summon: 'bog_spider', params: { count: 5 } },
    ],
  }),
  m({
    id: 'brute', name: '魁梧蠻兵', model: 'brute', color: '#8a6a5a', life: 2.5, damage: 1.6, speed: 2.3, attackSpeed: 0.8, scale: 1.3, radius: 0.65, armour: 2, xp: 2,
    skills: [melee(1.7, 1), { id: 'slam', kind: 'slam', range: 3.5, cooldown: 4, weight: 6, dmg: 1.8, telegraph: 0.7, params: { angle: 50, length: 4 }, color: '#c0a080' }],
  }),
  m({
    id: 'fallen_knight', name: '墮落騎士奧德里克', model: 'humanoid', color: '#7a7a8a', ...BOSS, scale: 2, life: 34, damage: 2.2, speed: 3.8, armour: 4,
    skills: [
      melee(2.2, 1.3),
      { id: 'charge', kind: 'charge', range: 10, cooldown: 5, weight: 6, dmg: 1.8, params: { distance: 10 } },
      { id: 'sunder', kind: 'slam', range: 6, cooldown: 5, weight: 6, dmg: 2.4, telegraph: 0.8, params: { angle: 40, length: 8 }, color: '#ffd080' },
    ],
  }),
  // Act 3
  m({
    id: 'frost_witch', name: '霜之女巫', model: 'caster', color: '#6a8aba', life: 0.95, damage: 1.1, speed: 2.9, kite: 7, types: { cold: 1 }, res: { cold: 50 },
    skills: [
      bolt('#8fd8ff', { cold: 1 }, { id: 'icebolt' }),
      { id: 'frost_nova', kind: 'nova', range: 3, cooldown: 5, weight: 8, dmg: 1.4, spell: true, types: { cold: 1 }, telegraph: 0.6, params: { radius: 3.2 }, color: '#8fd8ff' },
    ],
  }),
  m({
    id: 'deep_horror', name: '深淵恐懼', model: 'beast', color: '#2a3a4a', ...BOSS, scale: 2.6, life: 36, damage: 2.2, speed: 4,
    types: { phys: 0.6, cold: 0.4 },
    skills: [
      melee(2.6, 1.3),
      { id: 'charge', kind: 'charge', range: 12, cooldown: 5, weight: 6, dmg: 1.8, params: { distance: 12 } },
      { id: 'abyss_nova', kind: 'nova', range: 5, cooldown: 7, weight: 5, dmg: 2.2, spell: true, types: { cold: 1 }, telegraph: 1, params: { radius: 5.5 }, color: '#5ab0ff' },
    ],
  }),
  m({
    id: 'imp', name: '餘燼小鬼', model: 'imp', color: '#c05a2a', life: 0.6, damage: 0.9, speed: 5.4, attackSpeed: 1.5, scale: 0.8, radius: 0.35, types: { phys: 0.4, fire: 0.6 }, res: { fire: 60 },
    skills: [melee(1.1), bolt('#ff8a3a', { fire: 1 }, { id: 'spark', cooldown: 3, weight: 4 })],
  }),
  m({
    id: 'ember_priest', name: '餘燼大祭司', model: 'caster', color: '#c04a1a', ...BOSS, scale: 2.2, life: 34, damage: 2.3, speed: 3, kite: 5,
    types: { fire: 1 }, res: { fire: 75, cold: 30, lightning: 30, chaos: 20 },
    skills: [
      bolt('#ff8a3a', { fire: 1 }, { id: 'fire_volley', params: { count: 5, spread: 60, speed: 13, size: 0.4, explode: 1.4 }, cooldown: 2.5 }),
      { id: 'meteor', kind: 'rain', range: 12, cooldown: 6, weight: 7, dmg: 1.6, spell: true, types: { fire: 1 }, telegraph: 1, params: { radius: 4, impacts: 7, impactRadius: 1.6 }, color: '#ff6a2a' },
      { id: 'fire_nova', kind: 'nova', range: 4, cooldown: 8, weight: 5, dmg: 2, spell: true, types: { fire: 1 }, telegraph: 1, params: { radius: 5 }, color: '#ff6a2a' },
    ],
  }),
  // Act 4
  m({
    id: 'yeti', name: '山地雪怪', model: 'brute', color: '#d0d8e0', life: 2.3, damage: 1.5, speed: 2.7, scale: 1.3, radius: 0.65, types: { phys: 0.6, cold: 0.4 }, res: { cold: 50 }, xp: 2,
    skills: [melee(1.7), { id: 'slam', kind: 'slam', range: 3.5, cooldown: 4, weight: 6, dmg: 1.7, telegraph: 0.7, params: { angle: 60, length: 4 }, types: { cold: 1 }, color: '#bfe8ff' }],
  }),
  m({
    id: 'rime_giant', name: '霜之巨人', model: 'brute', color: '#a0c0e0', ...BOSS, scale: 3, radius: 1.3, life: 40, damage: 2.4, speed: 2.8,
    types: { phys: 0.5, cold: 0.5 }, res: { fire: 30, cold: 75, lightning: 30, chaos: 20 },
    skills: [
      { id: 'smash', kind: 'slam', range: 5, cooldown: 2.5, weight: 10, dmg: 2, telegraph: 0.7, params: { angle: 70, length: 6 }, color: '#bfe8ff' },
      { id: 'hail', kind: 'rain', range: 12, cooldown: 6, weight: 6, dmg: 1.5, telegraph: 0.8, spell: true, types: { cold: 1 }, params: { radius: 4, impacts: 9, impactRadius: 1.3 }, color: '#bfe8ff' },
      { id: 'frost_nova', kind: 'nova', range: 5, cooldown: 7, weight: 5, dmg: 2.2, spell: true, types: { cold: 1 }, telegraph: 1, params: { radius: 6 }, color: '#8fd8ff' },
    ],
  }),
  m({
    id: 'forsaken_king', name: '被遺棄之王', model: 'humanoid', color: '#6a3a8a', ...BOSS, scale: 2.5, radius: 1.1, life: 55, damage: 2.6, speed: 3.6,
    types: { phys: 0.5, chaos: 0.5 }, res: { fire: 40, cold: 40, lightning: 40, chaos: 40 },
    skills: [
      { id: 'void_cleave', kind: 'slam', range: 3.5, cooldown: 1.6, weight: 10, dmg: 1.6, telegraph: 0.45, params: { angle: 150, length: 3.8 }, color: '#b07aff' },
      bolt('#b07aff', { chaos: 1 }, { id: 'void_spread', params: { count: 9, spread: 120, speed: 11, size: 0.4 }, cooldown: 3.5, weight: 6 }),
      { id: 'void_rain', kind: 'rain', range: 12, cooldown: 7, weight: 6, dmg: 1.6, spell: true, types: { chaos: 1 }, telegraph: 1, params: { radius: 4.5, impacts: 10, impactRadius: 1.4 }, color: '#b07aff' },
      { id: 'charge', kind: 'charge', range: 12, cooldown: 6, weight: 5, dmg: 1.8, params: { distance: 12 } },
      { id: 'raise', kind: 'summon', range: 14, cooldown: 14, weight: 4, dmg: 0, summon: 'wraith', params: { count: 3 } },
    ],
  }),
  // Player minion
  m({ id: 'bone_warrior', name: '骸骨戰士', model: 'skeleton', color: '#e8e0c8', life: 1, damage: 1, speed: 5.2, attackSpeed: 1.3 }),
  m({ id: 'raging_spirit', name: '憤怒之靈', model: 'wraith', color: '#ff7a2a', life: 0.35, damage: 0.75, speed: 8, attackSpeed: 1.6, scale: 0.6, radius: 0.3, flying: true, types: { fire: 1 } }),
  m({ id: 'zombie_minion', name: '殭屍', model: 'zombie', color: '#7a8a6a', life: 2.4, damage: 1.3, speed: 3.6, attackSpeed: 0.9, scale: 1.15, radius: 0.55 }),
];

export const MONSTER_BY_ID: Record<string, MonsterDef> = Object.fromEntries(MONSTERS.map((x) => [x.id, x]));

export interface RareMonsterMod {
  id: string;
  name: string;
  lifeMore?: number;
  damageMore?: number;
  speedInc?: number;
  attackSpeedInc?: number;
  physReduction?: number;
  regenPct?: number;
  leech?: number;
  extra?: Partial<Record<'fire' | 'cold' | 'lightning' | 'chaos', number>>;
  res?: Partial<Record<'fire' | 'cold' | 'lightning' | 'chaos', number>>;
  poison?: number;
}

export const RARE_MODS: RareMonsterMod[] = [
  { id: 'hasted', name: '迅捷', speedInc: 35, attackSpeedInc: 20 },
  { id: 'armoured', name: '重甲', physReduction: 35 },
  { id: 'regenerating', name: '再生', regenPct: 3 },
  { id: 'vampiric', name: '吸血', leech: 0.1 },
  { id: 'flame', name: '火焰之觸', extra: { fire: 60 }, res: { fire: 40 } },
  { id: 'frost', name: '冰霜之觸', extra: { cold: 60 }, res: { cold: 40 } },
  { id: 'storm', name: '風暴之觸', extra: { lightning: 60 }, res: { lightning: 40 } },
  { id: 'empowered', name: '強化', damageMore: 35 },
  { id: 'resilient', name: '堅韌', lifeMore: 50 },
  { id: 'venomous', name: '劇毒', poison: 50 },
  { id: 'frenzied', name: '狂亂', attackSpeedInc: 40 },
  { id: 'warded', name: '元素護衛', res: { fire: 40, cold: 40, lightning: 40 } },
];
