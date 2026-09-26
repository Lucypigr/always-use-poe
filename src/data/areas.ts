export type ThemeId = 'town' | 'shore' | 'swamp' | 'forest' | 'crypt' | 'caves' | 'ruins' | 'inferno' | 'frost' | 'void';
export type LayoutStyle = 'outdoor' | 'caves' | 'rooms' | 'town';

export interface Theme {
  id: ThemeId;
  style: LayoutStyle;
  floor: [string, string];
  wall: string;
  wallTop: string;
  fog: string;
  ambient: string;
  sky: string;
  light: string;
  lightIntensity: number;
  decor: 'trees' | 'rocks' | 'pillars' | 'crystals' | 'bones' | 'dead_trees' | 'braziers';
  wallHeight: number;
  /** Emissive hazard tint (lava / void) on some floor tiles. */
  hazard?: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  town: { id: 'town', style: 'town', floor: ['#5b5140', '#4d4536'], wall: '#3a352c', wallTop: '#595041', fog: '#1d1a14', ambient: '#8a8070', sky: '#2a2620', light: '#ffcf8a', lightIntensity: 1.1, decor: 'braziers', wallHeight: 1.6 },
  shore: { id: 'shore', style: 'outdoor', floor: ['#6f6650', '#5c5845'], wall: '#3b3a33', wallTop: '#4d5a3f', fog: '#17201f', ambient: '#6f7d80', sky: '#1b2528', light: '#dfe6ff', lightIntensity: 0.9, decor: 'rocks', wallHeight: 1.4 },
  swamp: { id: 'swamp', style: 'outdoor', floor: ['#3f4a2f', '#343d27'], wall: '#262b1d', wallTop: '#3a4a2a', fog: '#141a10', ambient: '#62704f', sky: '#151a10', light: '#d8ffcc', lightIntensity: 0.9, decor: 'dead_trees', wallHeight: 1.3 },
  forest: { id: 'forest', style: 'outdoor', floor: ['#3b3a26', '#312f1f'], wall: '#1f2416', wallTop: '#2d3b1e', fog: '#0f140b', ambient: '#5b6446', sky: '#10150c', light: '#ffe8b0', lightIntensity: 1.0, decor: 'trees', wallHeight: 1.5 },
  crypt: { id: 'crypt', style: 'rooms', floor: ['#3c3c42', '#333338'], wall: '#23232a', wallTop: '#3d3d47', fog: '#0c0c10', ambient: '#50505e', sky: '#0b0b0f', light: '#b8c4ff', lightIntensity: 1.1, decor: 'bones', wallHeight: 1.8 },
  caves: { id: 'caves', style: 'caves', floor: ['#4a3d30', '#3f3428'], wall: '#2a221b', wallTop: '#3f332a', fog: '#120e0a', ambient: '#5e5044', sky: '#100c09', light: '#ffc98a', lightIntensity: 1.1, decor: 'crystals', wallHeight: 1.7 },
  ruins: { id: 'ruins', style: 'rooms', floor: ['#5a5448', '#4b463c'], wall: '#353027', wallTop: '#4f473a', fog: '#15130f', ambient: '#6e6656', sky: '#15120e', light: '#ffe0a8', lightIntensity: 1.0, decor: 'pillars', wallHeight: 1.8 },
  inferno: { id: 'inferno', style: 'rooms', floor: ['#3d2622', '#33201c'], wall: '#1f1210', wallTop: '#3b1f18', fog: '#1a0805', ambient: '#8a4a35', sky: '#1c0905', light: '#ff9a5a', lightIntensity: 1.2, decor: 'braziers', wallHeight: 1.8, hazard: '#ff4a10' },
  frost: { id: 'frost', style: 'outdoor', floor: ['#7d8896', '#6c7684'], wall: '#46505e', wallTop: '#c9d6e6', fog: '#1a2230', ambient: '#8b9ab0', sky: '#1a2230', light: '#d6e8ff', lightIntensity: 0.9, decor: 'crystals', wallHeight: 1.5 },
  void: { id: 'void', style: 'rooms', floor: ['#2b2438', '#231d2e'], wall: '#15101c', wallTop: '#2e2240', fog: '#08050d', ambient: '#5a4a78', sky: '#07040b', light: '#c9a8ff', lightIntensity: 1.2, decor: 'crystals', wallHeight: 2, hazard: '#8a3cff' },
};

export interface AreaDef {
  id: string;
  name: string;
  level: number;
  theme: ThemeId;
  monsters: string[];
  boss?: string;
  /** Approximate size in tiles. */
  size: [number, number];
  packs: number;
  next?: string;
  act: number;
  description: string;
}

export const AREAS: AreaDef[] = [
  { id: 'shore', name: '溺亡海岸', level: 1, theme: 'shore', monsters: ['drowned', 'crab', 'drowned_archer'], boss: 'tidecaller', size: [110, 70], packs: 22, next: 'mudflats', act: 1, description: '船難者被沖上岸 — 然後再度起身。' },
  { id: 'mudflats', name: '泥灘窪地', level: 4, theme: 'swamp', monsters: ['drowned', 'bog_spider', 'rhoa'], boss: 'bog_mother', size: [115, 75], packs: 24, next: 'ashwood', act: 1, description: '吸人的泥濘，以及在其中狩獵的東西。' },
  { id: 'ashwood', name: '灰燼森林', level: 8, theme: 'forest', monsters: ['wolf', 'bandit_archer', 'ash_cultist'], boss: 'grove_warden', size: [120, 80], packs: 26, next: 'old_crypt', act: 1, description: '一片燃燒後便從未熄滅的森林。' },
  { id: 'old_crypt', name: '古老墓穴', level: 12, theme: 'crypt', monsters: ['skeleton', 'skeleton_archer', 'wraith'], boss: 'crypt_lord', size: [90, 90], packs: 26, next: 'warrens', act: 2, description: '這裡的死者被草草埋葬，埋得不夠深。' },
  { id: 'warrens', name: '蜘蛛巢穴', level: 16, theme: 'caves', monsters: ['bog_spider', 'cave_bat', 'venom_spitter'], boss: 'broodmother', size: [95, 95], packs: 28, next: 'citadel', act: 2, description: '絲與骨，各佔一半。' },
  { id: 'citadel', name: '廢墟要塞', level: 21, theme: 'ruins', monsters: ['brute', 'ash_cultist', 'skeleton_archer', 'skeleton'], boss: 'fallen_knight', size: [95, 95], packs: 28, next: 'blackwater', act: 2, description: '它的衛戍部隊在死後仍在站崗。' },
  { id: 'blackwater', name: '黑水洞窟', level: 26, theme: 'caves', monsters: ['drowned', 'frost_witch', 'rhoa', 'cave_bat'], boss: 'deep_horror', size: [100, 100], packs: 30, next: 'cinder', act: 3, description: '冰冷的水從黑暗中滴落，而某種東西正在啜飲。' },
  { id: 'cinder', name: '餘燼神殿', level: 31, theme: 'inferno', monsters: ['ash_cultist', 'imp', 'brute'], boss: 'ember_priest', size: [100, 100], packs: 30, next: 'frozen', act: 3, description: '信徒們燃燒自己，並稱之為祈禱。' },
  { id: 'frozen', name: '冰封山道', level: 36, theme: 'frost', monsters: ['wolf', 'frost_witch', 'yeti'], boss: 'rime_giant', size: [130, 80], packs: 32, next: 'throne', act: 4, description: '唯有寒冷比這座山更古老。' },
  { id: 'throne', name: '被遺棄者王座', level: 40, theme: 'void', monsters: ['wraith', 'brute', 'imp', 'venom_spitter', 'skeleton_archer'], boss: 'forsaken_king', size: [100, 100], packs: 34, act: 4, description: '旅途的終點，地圖的起點。' },
];

export const AREA_BY_ID: Record<string, AreaDef> = Object.fromEntries(AREAS.map((a) => [a.id, a]));

/** Map layouts reuse monsters and bosses from story areas. */
export const MAP_LAYOUTS: Record<string, { theme: ThemeId; monsters: string[]; boss: string }> = {
  crypt: { theme: 'crypt', monsters: ['skeleton', 'skeleton_archer', 'wraith', 'brute'], boss: 'crypt_lord' },
  caves: { theme: 'caves', monsters: ['bog_spider', 'cave_bat', 'venom_spitter', 'rhoa'], boss: 'broodmother' },
  forest: { theme: 'forest', monsters: ['wolf', 'bandit_archer', 'ash_cultist'], boss: 'grove_warden' },
  ruins: { theme: 'ruins', monsters: ['brute', 'skeleton', 'skeleton_archer', 'ash_cultist'], boss: 'fallen_knight' },
  inferno: { theme: 'inferno', monsters: ['imp', 'ash_cultist', 'brute'], boss: 'ember_priest' },
  frost: { theme: 'frost', monsters: ['yeti', 'frost_witch', 'wolf'], boss: 'rime_giant' },
  void: { theme: 'void', monsters: ['wraith', 'imp', 'venom_spitter', 'brute'], boss: 'forsaken_king' },
  shore: { theme: 'shore', monsters: ['drowned', 'crab', 'drowned_archer'], boss: 'tidecaller' },
};
