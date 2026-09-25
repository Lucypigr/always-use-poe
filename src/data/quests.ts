import type { CurrencyId } from './currency';
import { flat, inc, type StatMod } from '../stats/stats';

/**
 * Story & quests. The campaign follows the structure of Path of Exile's first four acts —
 * an exile washed ashore, a besieged harbour, bandit lords, a corrupt high templar and a
 * nightmare king — retold with this game's own areas, bosses and (renamed) characters.
 */

export type NpcId = 'nessa' | 'tarkleigh' | 'yeena' | 'clarissa' | 'dialla';

export interface NpcDef {
  id: NpcId;
  name: string;
  title: string;
  /** Tile position in town. */
  pos: { x: number; y: number };
  look: { skin: string; torso: string; legs: string; accent: string; robe?: boolean; hood?: boolean; bulky?: boolean };
  greeting: string[];
}

export const NPCS: NpcDef[] = [
  {
    id: 'nessa', name: '娜莎', title: '暮港的倖存者', pos: { x: 12.5, y: 18 },
    look: { skin: '#e0c0a0', torso: '#5a6a8a', legs: '#3a3a4a', accent: '#c8aa6e', robe: true },
    greeting: ['又一個被帝國扔下船的人……能活著走進暮港，你比大多數人都幸運。', '這裡的人都是罪人、逃兵或被遺忘的人。但在虛境，活下去就是唯一的法律。'],
  },
  {
    id: 'tarkleigh', name: '塔克雷', title: '老兵', pos: { x: 9.5, y: 10.5 },
    look: { skin: '#c8a080', torso: '#6a5a3a', legs: '#3a3020', accent: '#8a8a8a', bulky: true },
    greeting: ['我在帝國軍裡待了三十年，最後換來一張單程船票。哼。', '想活下去？砍得比它們快，跑得比它們早。就這麼簡單。'],
  },
  {
    id: 'yeena', name: '耶娜', title: '森林部族的獵人', pos: { x: 38.5, y: 12 },
    look: { skin: '#b08060', torso: '#4a5a2a', legs: '#3a3020', accent: '#8a6a3a', hood: true },
    greeting: ['我的族人在這片土地上生活了好幾代，比帝國的流放船早得多。', '森林在哭泣，流放者。那些古老的墓穴不該被打開。'],
  },
  {
    id: 'clarissa', name: '克萊莉絲', title: '下城區的逃亡者', pos: { x: 12.5, y: 28.5 },
    look: { skin: '#e8c8a8', torso: '#7a2a3a', legs: '#2a1a2a', accent: '#d8b848', robe: true },
    greeting: ['大祭司把整座城變成了他的祭壇，而我們只是柴火。', '有人說他在追尋神的力量。我只知道，被他注視的人都沒能回來。'],
  },
  {
    id: 'dialla', name: '黛亞拉', title: '古老的先知', pos: { x: 32.5, y: 28.5 },
    look: { skin: '#c8b8a8', torso: '#3a2a4a', legs: '#2a2030', accent: '#b07aff', robe: true, hood: true },
    greeting: ['山的另一邊，沉睡之物正在翻身。', '王座上的那位早已不是人了——他是夢魘本身，而夢魘正在醒來。'],
  },
];

export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n])) as Record<NpcId, NpcDef>;

export type QuestObjective =
  /** Defeat the boss of an area. */
  | { kind: 'boss'; area: string }
  /** Find and use quest objects placed in an area (one per label). */
  | { kind: 'collect'; area: string; objects: string[] }
  /** Kill any `count` monsters in an area. */
  | { kind: 'kill'; area: string; count: number }
  /** Hunt named rare monsters that appear in an area while the quest is active. */
  | { kind: 'slay'; area: string; targets: { monster: string; name: string }[] };

export interface QuestChoice {
  id: string;
  label: string;
  desc: string;
  mods?: StatMod[];
  passives?: number;
}

export interface QuestReward {
  /** Pick one of these gems. */
  gems?: string[];
  currency?: [CurrencyId, number][];
  passives?: number;
  refunds?: number;
  /** Pick one of these permanent blessings instead of a gem. */
  choices?: QuestChoice[];
}

export interface QuestDef {
  id: string;
  name: string;
  act: number;
  giver: NpcId;
  main?: boolean;
  requires?: string[];
  objective: QuestObjective;
  /** Short objective text for the tracker. */
  task: string;
  intro: string[];
  outro: string[];
  reward: QuestReward;
}

const SKILLS_STR = ['crushing_blow', 'bone_breaker', 'sweeping_cleave', 'earthshatter', 'magma_strike', 'righteous_fire'];
const SKILLS_DEX = ['split_shot', 'double_strike', 'ice_shot', 'venom_strike', 'rime_blades', 'storm_arrow', 'lacerate', 'toxic_rain'];
const SKILLS_INT = ['fireball', 'freezing_pulse', 'raging_spirits', 'frost_nova', 'chain_lightning', 'sparkstorm', 'raise_bones', 'raise_zombie', 'essence_drain', 'contagion', 'blade_vortex', 'kinetic_blast'];

export const QUESTS: QuestDef[] = [
  // ------------------------------------------------------------------ Act 1 — 流放之岸
  {
    id: 'a1_enemy_gate', name: '城門前的敵人', act: 1, giver: 'nessa', main: true,
    objective: { kind: 'boss', area: 'shore' },
    task: '擊敗溺亡海岸的潮汐喚者',
    intro: [
      '你也是從那艘船上被扔下來的吧？能爬上岸已經是奇蹟了。',
      '海岸上有個東西在呼喚死者起身——人們叫它「潮汐喚者」。每個漲潮的夜晚，溺死的水手就會拖著腳步走向我們的城門。',
      '只要它還在，暮港就不得安寧。去溺亡海岸，殺了它。',
    ],
    outro: ['潮水……安靜下來了。你真的做到了。', '這些寶石是從被沖上岸的屍體身上找到的。挑一顆吧，願它比它的前主人更走運。'],
    reward: { gems: [...SKILLS_STR.slice(0, 2), ...SKILLS_DEX.slice(0, 3), ...SKILLS_INT.slice(0, 3)] },
  },
  {
    id: 'a1_mercy', name: '慈悲任務', act: 1, giver: 'nessa', requires: ['a1_enemy_gate'],
    objective: { kind: 'collect', area: 'mudflats', objects: ['走私者的醫藥箱'] },
    task: '在泥灘窪地找到醫藥箱',
    intro: [
      '塔克雷的傷口在惡化，他嘴上不說，但我看得出來。',
      '有艘走私船擱淺在泥灘窪地，船上應該還有一箱藥品。拜託你，把它帶回來。',
    ],
    outro: ['是藥！這些夠塔克雷撐過這個冬天了。', '謝謝你，流放者。這是我僅有的東西，希望對你有用。'],
    reward: { gems: ['added_fire', 'added_cold', 'life_leech_support', 'faster_attacks', 'faster_casting', 'lesser_volley', 'chance_to_bleed', 'arcane_surge'], currency: [['transmute', 2]] },
  },
  {
    id: 'a1_dirty_job', name: '骯髒的差事', act: 1, giver: 'tarkleigh', requires: ['a1_enemy_gate'],
    objective: { kind: 'kill', area: 'mudflats', count: 30 },
    task: '在泥灘窪地消滅怪物',
    intro: ['泥灘那邊的東西越來越靠近港口了。蜘蛛、鴕獸、還有那些泡爛的死人。', '去把它們清一清。至少殺個三十隻，讓牠們知道暮港不好惹。'],
    outro: ['幹得好。你比那些帝國的新兵強多了。', '這本書是我從一個死掉的學者身上拿的——據說讀了可以讓人忘記錯誤的選擇。我用不著，給你。'],
    reward: { refunds: 2, currency: [['augment', 2]] },
  },
  {
    id: 'a1_eggs', name: '打破蛋', act: 1, giver: 'tarkleigh', requires: ['a1_enemy_gate'],
    objective: { kind: 'collect', area: 'mudflats', objects: ['古老符文石・一', '古老符文石・二', '古老符文石・三'] },
    task: '在泥灘窪地找到三塊符文石',
    intro: ['泥灘裡埋著三塊古老的符文石。拼在一起，據說能打開通往森林深處的舊水道。', '找到它們。別被那些鴕獸踩扁了。'],
    outro: ['就是這三塊。你看，符文拼起來是一扇門的形狀。', '拿著這個，你會需要比拳頭更好用的東西。'],
    reward: { gems: [...SKILLS_STR.slice(2), ...SKILLS_DEX.slice(3), ...SKILLS_INT.slice(3)] },
  },
  {
    id: 'a1_dweller', name: '深淵的居住者', act: 1, giver: 'tarkleigh', main: true,
    objective: { kind: 'boss', area: 'mudflats' },
    task: '擊敗泥灘窪地的沼澤之母',
    intro: ['泥灘深處有一隻大得離譜的蜘蛛，那些小東西全是牠生的。', '不殺了母巢，蜘蛛就殺不完。'],
    outro: ['沼澤之母死了？哈！今晚我請喝酒——如果我們還有酒的話。'],
    reward: { currency: [['alchemy', 1], ['fusing', 2]] },
  },
  {
    id: 'a1_caged_brute', name: '牢籠中的蠻獸', act: 1, giver: 'tarkleigh', main: true,
    objective: { kind: 'boss', area: 'ashwood' },
    task: '擊敗灰燼森林的林地守衛',
    intro: [
      '灰燼森林裡曾經有座監獄，關著帝國最危險的囚犯。守衛他們的典獄長後來比囚犯還瘋。',
      '現在他成了「林地守衛」——一頭披著樹皮的怪物。他擋住了往東的唯一道路。',
    ],
    outro: ['東邊的路通了。你離這片海岸越來越遠了，流放者——這是好事，也是壞事。', '選一個吧，接下來的路只會更難走。'],
    reward: { gems: ['leap_slam', 'dash_strike', 'flame_step', 'flicker_strike', 'multistrike', 'echoing_spell', 'increased_duration', 'minion_speed'] },
  },
  {
    id: 'a1_siren', name: '海妖的歌聲', act: 1, giver: 'nessa', requires: ['a1_dweller'],
    objective: { kind: 'slay', area: 'ashwood', targets: [{ monster: 'ash_cultist', name: '海妖 瑪薇兒' }] },
    task: '在灰燼森林獵殺海妖瑪薇兒',
    intro: [
      '你聽到了嗎？夜裡從森林傳來的歌聲。',
      '那是瑪薇兒——召喚潮汐喚者的就是她。她逃進了灰燼森林，繼續用歌聲把死者叫醒。',
      '只要她還在唱，海岸就永遠不會安靜。',
    ],
    outro: ['歌聲……停了。暮港第一次聽見了真正的寂靜。', '這是我父親留下的書，上面寫滿了古老的技藝。你比我更需要它。'],
    reward: { passives: 1 },
  },

  // ------------------------------------------------------------------ Act 2 — 森林與盜匪
  {
    id: 'a2_sacred', name: '穿越聖地', act: 2, giver: 'yeena',
    objective: { kind: 'collect', area: 'old_crypt', objects: ['金色聖手'] },
    task: '在古老墓穴找到金色聖手',
    intro: ['古老墓穴是我族人祖先的長眠之地。有人闖了進去，偷走了「金色聖手」。', '把它帶回來。祖先們需要安息。'],
    outro: ['聖手回來了……謝謝你。', '這是祖先的智慧——它能讓你撤回曾經走錯的路。'],
    reward: { refunds: 3, currency: [['chromatic', 3]] },
  },
  {
    id: 'a2_intruders', name: '黑衣入侵者', act: 2, giver: 'yeena', main: true,
    objective: { kind: 'boss', area: 'old_crypt' },
    task: '擊敗古老墓穴的墓穴之主',
    intro: [
      '穿黑衣的人來過墓穴——帝國的聖堂騎士。他們在找某樣東西，並且喚醒了不該喚醒的存在。',
      '墓穴之主已經站起來了。在他帶著亡者走出墓穴之前，阻止他。',
    ],
    outro: ['墓穴重新沉睡了。但那些黑衣人……他們拿走了什麼？我有不好的預感。'],
    reward: { gems: ['brutal_force', 'searing_heat', 'piercing_shots', 'forking', 'controlled_ruin', 'minion_might', 'void_manipulation', 'vicious_projectiles', 'deadly_ailments', 'efficacy'] },
  },
  {
    id: 'a2_sharp_cruel', name: '利齒與殘酷', act: 2, giver: 'yeena', main: true,
    objective: { kind: 'boss', area: 'warrens' },
    task: '擊敗蜘蛛巢穴的巢母',
    intro: ['森林東邊的洞窟被絲網封住了。巢母——「織網者」——在那裡產下了無數的子嗣。', '我們的獵人一個個消失在網裡。替他們報仇。'],
    outro: ['織網者死了。獵人們終於可以回家了——至少是那些還活著的。'],
    reward: { gems: ['arrow_rain', 'cinderfall', 'bulwark', 'winters_grasp', 'ashen_fury', 'cyclone', 'tornado_shot', 'ice_crash', 'swift_affliction', 'pulverise'] },
  },
  {
    id: 'a2_white_beast', name: '大白獸', act: 2, giver: 'yeena', requires: ['a2_intruders'],
    objective: { kind: 'slay', area: 'warrens', targets: [{ monster: 'rhoa', name: '大白獸' }] },
    task: '在蜘蛛巢穴獵殺大白獸',
    intro: ['洞窟裡還住著一頭白色的巨獸。牠不是蜘蛛，但比蜘蛛更可怕。', '我的族人說，吃下牠的心臟就能獲得牠的力量。先殺了牠再說。'],
    outro: ['你把牠的角帶回來了！族人會為你唱歌的。'],
    reward: { currency: [['regal', 1], ['jeweller', 3]] },
  },
  {
    id: 'a2_bandits', name: '與盜匪的交易', act: 2, giver: 'yeena', requires: ['a2_sharp_cruel'],
    objective: {
      kind: 'slay', area: 'citadel', targets: [
        { monster: 'brute', name: '盜匪首領 鐵橡' },
        { monster: 'bandit_archer', name: '盜匪首領 克雷恩' },
        { monster: 'ash_cultist', name: '盜匪首領 艾菈' },
      ],
    },
    task: '在廢墟要塞擊敗三名盜匪首領',
    intro: [
      '三個盜匪首領佔據了廢墟要塞，向每個經過的人收「過路費」。',
      '鐵橡力大無窮，克雷恩快如疾風，艾菈精通元素。他們彼此仇視，卻聯手封鎖了道路。',
      '擊敗他們。至於之後怎麼處置他們的力量……由你決定。',
    ],
    outro: [
      '三個盜匪首領都倒下了。他們的信物還殘留著主人的力量。',
      '你可以吸收其中一人的力量，或者把三件信物全部摧毀——那會帶給你純粹的領悟。',
    ],
    reward: {
      choices: [
        { id: 'kill_all', label: '摧毀全部信物', desc: '+1 天賦點', passives: 1 },
        { id: 'oak', label: '吸收鐵橡的力量', desc: '+40 最大生命、物理傷害提高 16%', mods: [flat('life', 40), inc('phys_damage', 16)] },
        { id: 'kraityn', label: '吸收克雷恩的力量', desc: '攻擊速度提高 8%、移動速度提高 4%', mods: [inc('attack_speed', 8), inc('movement_speed', 4)] },
        { id: 'alira', label: '吸收艾菈的力量', desc: '+15% 全元素抗性、+20% 暴擊傷害加成', mods: [flat('all_ele_res', 15), flat('crit_multi', 20)] },
      ],
    },
  },
  {
    id: 'a2_root', name: '問題的根源', act: 2, giver: 'yeena', main: true,
    objective: { kind: 'boss', area: 'citadel' },
    task: '擊敗廢墟要塞的墮落騎士奧德里克',
    intro: ['盜匪只是症狀。要塞的主人——墮落騎士奧德里克——才是根源。', '他替帝國看守這片土地，死後依然在執行命令。他的命令只有一個：不讓任何流放者離開。'],
    outro: ['奧德里克的劍斷了。流放者，你已經走得比任何人都遠。', '但黑衣人去了東方——去了大祭司的城市。我感覺得到，更大的黑暗在那裡等著你。'],
    reward: { gems: ['greater_volley', 'melee_splash', 'increased_aoe', 'concentrated_effect', 'elemental_focus', 'crit_strikes', 'fire_penetration', 'cold_penetration', 'lightning_penetration'] },
  },

  // ------------------------------------------------------------------ Act 3 — 大祭司之城
  {
    id: 'a3_lost_love', name: '迷失的愛', act: 3, giver: 'clarissa',
    objective: { kind: 'collect', area: 'blackwater', objects: ['托爾曼的手鐲'] },
    task: '在黑水洞窟找到托爾曼的手鐲',
    intro: ['托爾曼……我的愛人。他為了替我們找一條逃出城的路，走進了黑水洞窟，再也沒有回來。', '如果你找到他……請把他的手鐲帶回來給我。'],
    outro: ['這是他的手鐲……他真的不會回來了。', '謝謝你告訴我真相。這是他留下的東西，他會希望它被用在對的地方。'],
    reward: { gems: ['added_lightning', 'hypothermia', 'velocity', 'culling_strike', 'venom', 'kindling'], currency: [['alteration', 4]] },
  },
  {
    id: 'a3_victario', name: '維多里歐的秘密', act: 3, giver: 'clarissa', requires: ['a3_lost_love'],
    objective: { kind: 'collect', area: 'blackwater', objects: ['維多里歐的半身像・一', '維多里歐的半身像・二', '維多里歐的半身像・三'] },
    task: '在黑水洞窟找到三尊半身像',
    intro: ['反抗軍的領袖維多里歐在地下藏了一批物資，線索刻在三尊他自己的半身像裡——他一向很自戀。', '找到那三尊半身像，我們就能找到物資。'],
    outro: ['你找到了！維多里歐的寶庫……比我想像的還要豐富。這些分給你。'],
    reward: { gems: [...SKILLS_STR, ...SKILLS_DEX, ...SKILLS_INT], currency: [['chaos', 1]] },
  },
  {
    id: 'a3_piety', name: '皮耶緹的寵物', act: 3, giver: 'clarissa', main: true,
    objective: { kind: 'boss', area: 'blackwater' },
    task: '擊敗黑水洞窟的深淵恐懼',
    intro: ['大祭司的煉金術師皮耶緹在黑水洞窟裡「養」著某種東西——她用活人做實驗。', '那頭深淵恐懼就是她最得意的作品。殺了它，她的實驗就完了。'],
    outro: ['那個怪物……曾經是人，對嗎？皮耶緹會為此付出代價的。'],
    reward: { currency: [['chaos', 2], ['regal', 1]] },
  },
  {
    id: 'a3_fixture', name: '命運的定數', act: 3, giver: 'clarissa', requires: ['a3_piety'],
    objective: { kind: 'collect', area: 'cinder', objects: ['金色書頁・一', '金色書頁・二', '金色書頁・三', '金色書頁・四'] },
    task: '在餘燼神殿找到四張金色書頁',
    intro: ['神殿圖書館的學者西歐薩被困在裡面。他說大祭司撕碎了一本禁書，書頁散落在神殿各處。', '找回那四張金色書頁——那本書記載著大祭司想要的力量。'],
    outro: ['西歐薩說，書上寫的是「沉睡之獸」……大祭司想要喚醒它。', '他讓我把這顆寶石交給你，說它屬於「能改變命運的人」。'],
    reward: { gems: ['greater_volley', 'critical_wrath', 'elemental_penetration', 'controlled_ruin', 'multistrike', 'echoing_spell', 'minion_vitality'] },
  },
  {
    id: 'a3_sceptre', name: '神之權杖', act: 3, giver: 'clarissa', main: true,
    objective: { kind: 'boss', area: 'cinder' },
    task: '擊敗餘燼神殿的餘燼大祭司',
    intro: [
      '一切都要結束了。大祭司在神殿頂端舉行最後的儀式——他要用整座城的靈魂喚醒沉睡之獸，成為新的神。',
      '他就是當初把你流放的人，流放者。去神之權杖的頂端，終結他。',
    ],
    outro: ['大祭司倒下了……但儀式沒有完全停止。', '北方的山在震動。不管他喚醒了什麼，那東西現在正往王座的方向去。'],
    reward: { currency: [['exalt', 1], ['divine', 1]] },
  },

  // ------------------------------------------------------------------ Act 4 — 夢魘之王
  {
    id: 'a4_king_fury', name: '狂怒之王', act: 4, giver: 'dialla', main: true,
    objective: { kind: 'boss', area: 'frozen' },
    task: '擊敗冰封山道的霜之巨人',
    intro: ['通往王座的山道被一位古老的王者把守——他曾是征服者，如今只剩憤怒。', '霜之巨人不會讓任何人通過。除非你證明你比他的憤怒更強。'],
    outro: ['狂怒之王的心臟停止了跳動。現在，只剩下王座。'],
    reward: { gems: ['quickening', 'serenity', 'greater_volley', 'critical_wrath', 'elemental_penetration'] },
  },
  {
    id: 'a4_spirit', name: '不屈之魂', act: 4, giver: 'dialla',
    objective: { kind: 'slay', area: 'frozen', targets: [{ monster: 'wraith', name: '被束縛的德雷之魂' }] },
    task: '在冰封山道解放德雷之魂',
    intro: ['很久以前，德雷女王用自己的靈魂封印了夢魘。但大祭司的儀式扭曲了她。', '她的亡魂在山道上徘徊，被夢魘束縛。讓她解脫吧——她會感謝你的。'],
    outro: ['她在消散前對你微笑了。德雷把她最後的智慧留給了你。'],
    reward: { passives: 1 },
  },
  {
    id: 'a4_corpus', name: '王者之軀', act: 4, giver: 'dialla', requires: ['a4_king_fury'],
    objective: { kind: 'collect', area: 'throne', objects: ['夢魘之心', '夢魘之肺', '夢魘之臟'] },
    task: '在被遺棄者王座取得夢魘的三個器官',
    intro: ['夢魘是用被遺棄之王的血肉餵養的。他的心、肺與臟腑被分別封存在王座的深處。', '毀掉它們，夢魘就會衰弱。這很噁心，我知道。'],
    outro: ['夢魘在尖叫——你聽到了嗎？它感覺到了。'],
    reward: { gems: [...SKILLS_STR, ...SKILLS_DEX, ...SKILLS_INT], currency: [['exalt', 1]] },
  },
  {
    id: 'a4_nightmare', name: '永恆夢魘', act: 4, giver: 'dialla', main: true,
    objective: { kind: 'boss', area: 'throne' },
    task: '擊敗被遺棄之王',
    intro: [
      '這是最後的路了，流放者。',
      '被遺棄之王曾是這片大陸的統治者。他為了永生與夢魘締結契約，結果成了它的容器。',
      '擊敗他，終結這場永恆的夢魘。然後……這片土地會記住你的名字。',
    ],
    outro: [
      '夢魘……結束了。我幾百年來第一次沒有做夢。',
      '但虛境從來不會真正平靜。地圖裝置的另一端還有無數被扭曲的世界，等著像你這樣的人去征服。',
      '去吧，流放者。你已經不再是被放逐的人了——你是這片土地的主人。',
    ],
    reward: { currency: [['exalt', 2], ['divine', 1], ['chaos', 5]] },
  },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export const PROLOGUE: string[] = [
  '你被帝國以「叛亂」之名判處流放。押送船駛向虛境——那片沒有人能活著回來的大陸。',
  '在看得見海岸的地方，獄卒把你們一個個推下船。冰冷的海水灌進你的肺裡……',
  '當你醒來時，你躺在溺亡海岸的礁石上。四周的屍體正一具具地站起來。',
  '你拼死逃進了一座燈火未熄的小港——暮港，流放者最後的避難所。',
  '也許，這裡有人能告訴你該如何活下去。和鎮上的人談談吧。',
];
