import type { SocketColor } from '../items/types';
import { defineMod, modFlag, modStat, registerMods, tier } from './affixes';

/** Unique-only modifiers (regular affixes can also be reused by uniques). */
registerMods([
  defineMod({ id: 'u_extra_projectile', type: 'unique', text: '技能額外發射 {0} 個投射物', stats: [modStat('additional_projectiles')], spawn: [], tiers: [tier(1, 1, 1)] }),
  defineMod({ id: 'u_phys_as_fire', type: 'unique', text: '獲得 {0}% 物理傷害的額外火焰傷害', stats: [modStat('phys_as_extra_fire')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_phys_as_cold', type: 'unique', text: '獲得 {0}% 物理傷害的額外冰冷傷害', stats: [modStat('phys_as_extra_cold')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_block', type: 'unique', text: '+{0}% 攻擊格擋率', stats: [modStat('block')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_burning', type: 'unique', text: '增加 {0}% 燃燒傷害', stats: [modStat('burning_damage', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_flask_duration', type: 'unique', text: '增加 {0}% 藥劑效果持續時間', stats: [modStat('flask_duration', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_phys_reduction', type: 'unique', text: '額外 {0}% 物理傷害減免', stats: [modStat('phys_damage_reduction')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_life_on_hit', type: 'unique', text: '每擊中一名敵人獲得 {0} 生命', stats: [modStat('life_on_hit')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_move_speed', type: 'unique', text: '增加 {0}% 移動速度', stats: [modStat('movement_speed', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_life_leech', type: 'unique', text: '{0}% 攻擊傷害轉化為生命偷取', stats: [modStat('life_leech')], spawn: [], tiers: [tier(1, 0, 0)], decimals: 1 }),
  defineMod({ id: 'u_damage_taken', type: 'unique', text: '承受傷害增加 {0}%', stats: [modStat('damage_taken', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_minion_life', type: 'unique', text: '召喚物最大生命增加 {0}%', stats: [modStat('minion_life', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_minion_count', type: 'unique', text: '+{0} 召喚物最大數量', stats: [modStat('minion_count')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_aoe', type: 'unique', text: '增加 {0}% 效果範圍', stats: [modStat('area_of_effect', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_pierce', type: 'unique', text: '投射物額外穿透 {0} 個目標', stats: [modStat('pierce')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_hollow_vessel', type: 'unique', text: ['空虛之器', '最大生命變為 1，免疫混沌傷害'], stats: [modFlag('ks_hollow_vessel')], spawn: [], tiers: [{ ilvl: 1, values: [] }] }),
  defineMod({ id: 'u_phantom_step', type: 'unique', text: ['幻影步', '30% 機率迴避擊中，總減 50% 護甲與能量護盾'], stats: [modFlag('ks_phantom_step')], spawn: [], tiers: [{ ilvl: 1, values: [] }] }),
  defineMod({ id: 'u_max_fire_res', type: 'unique', text: '+{0}% 火焰抗性上限', stats: [modStat('max_fire_res')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_life_regen_pct', type: 'unique', text: '每秒回復 {0}% 生命', stats: [modStat('life_regen_pct')], spawn: [], tiers: [tier(1, 0, 0)], decimals: 1 }),
  defineMod({ id: 'u_phys_as_lightning', type: 'unique', text: '獲得 {0}% 物理傷害的額外閃電傷害', stats: [modStat('phys_as_extra_lightning')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_attack_more', type: 'unique', text: '攻擊傷害總增 {0}%', stats: [modStat('attack_damage', 'more')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_damage_less', type: 'unique', text: '總減 {0}% 傷害', stats: [modStat('damage', 'more', 0, -1)], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_lightning_pen', type: 'unique', text: '傷害穿透 {0}% 閃電抗性', stats: [modStat('lightning_pen')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_chaos_damage', type: 'unique', text: '增加 {0}% 混沌傷害', stats: [modStat('chaos_damage', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_dot_damage', type: 'unique', text: '增加 {0}% 持續傷害', stats: [modStat('dot_damage', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_ailment_duration', type: 'unique', text: '增加 {0}% 異常狀態持續時間', stats: [modStat('ailment_duration', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_minion_speed', type: 'unique', text: '召喚物移動與攻擊速度增加 {0}%', stats: [modStat('minion_speed', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_bleed_damage', type: 'unique', text: '增加 {0}% 流血傷害', stats: [modStat('bleed_damage', 'inc')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_bleed_chance', type: 'unique', text: '攻擊有 {0}% 機率造成流血', stats: [modStat('bleed_chance')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_poison_chance', type: 'unique', text: '擊中有 {0}% 機率使敵人中毒', stats: [modStat('poison_chance')], spawn: [], tiers: [tier(1, 0, 0)] }),
  defineMod({ id: 'u_headhunter', type: 'unique', text: ['獵首者', '擊殺稀有怪物時，獲得其詞綴 20 秒'], stats: [modFlag('headhunter')], spawn: [], tiers: [{ ilvl: 1, values: [] }] }),
  defineMod({ id: 'u_close_quarters', type: 'unique', text: ['近身作戰', '投射物對附近目標最多總增 40% 傷害，對遠處目標傷害較低'], stats: [modFlag('ks_close_quarters')], spawn: [], tiers: [{ ilvl: 1, values: [] }] }),
]);

export interface UniqueDef {
  id: string;
  name: string;
  base: string;
  level?: number;
  mods: { mod: string; values: [number, number][] }[];
  sockets?: { colors: SocketColor[]; linked: boolean };
  flavour: string;
  dropWeight?: number;
}

export const UNIQUES: UniqueDef[] = [
  {
    id: 'blank_canvas', name: '空白畫布', base: 'body_armour_int_1',
    mods: [], sockets: { colors: ['W', 'W', 'W', 'W', 'W', 'W'], linked: true }, dropWeight: 40,
    flavour: '每一件傑作都始於一無所有。',
  },
  {
    id: 'gilded_brow', name: '鍍金之額', base: 'helmet_dex_0',
    mods: [{ mod: 'local_evasion', values: [[20, 30]] }, { mod: 'all_res', values: [[30, 36]] }, { mod: 'item_rarity', values: [[15, 20]] }, { mod: 'u_damage_taken', values: [[10, 10]] }],
    flavour: '愚者之冠，最是耀眼。',
  },
  {
    id: 'windstride', name: '乘風', base: 'boots_dex_1',
    mods: [{ mod: 'dex', values: [[20, 30]] }, { mod: 'local_evasion_inc', values: [[30, 50]] }, { mod: 'life', values: [[30, 45]] }, { mod: 'u_move_speed', values: [[20, 30]] }],
    flavour: '風從不問路通往何方。',
  },
  {
    id: 'emberheart', name: '燼之心', base: 'ring_ruby', level: 12,
    mods: [{ mod: 'attack_fire_added', values: [[4, 8], [10, 16]] }, { mod: 'u_phys_as_fire', values: [[8, 12]] }, { mod: 'fire_res', values: [[20, 30]] }],
    flavour: '主人早已停止呼吸，它卻仍在跳動。',
  },
  {
    id: 'wyrmfang', name: '龍牙', base: 'bow_2',
    mods: [{ mod: 'local_phys_inc', values: [[100, 140]] }, { mod: 'local_phys_added', values: [[5, 10], [15, 25]] }, { mod: 'u_extra_projectile', values: [[1, 1]] }, { mod: 'local_attack_speed', values: [[8, 12]] }],
    flavour: '由天蛇之顎雕成，至今仍飢渴難耐。',
  },
  {
    id: 'stormcaller', name: '喚風者之棒', base: 'sceptre_1',
    mods: [{ mod: 'spell_lightning_added', values: [[1, 3], [40, 55]] }, { mod: 'cast_speed', values: [[15, 20]] }, { mod: 'shock_chance', values: [[20, 20]] }, { mod: 'int', values: [[20, 30]] }],
    flavour: '高舉它，天空便會回應。',
  },
  {
    id: 'bloodthirst', name: '嗜血', base: 'two_hand_axe_2',
    mods: [{ mod: 'local_phys_inc', values: [[150, 190]] }, { mod: 'u_life_leech', values: [[1, 1.5]] }, { mod: 'local_attack_speed', values: [[10, 15]] }, { mod: 'str', values: [[25, 35]] }],
    flavour: '它不在乎是誰的血，只在乎血是否流淌。',
  },
  {
    id: 'frostbound', name: '霜縛之心', base: 'amulet_lapis', level: 24,
    mods: [{ mod: 'cold_damage', values: [[25, 35]] }, { mod: 'freeze_chance', values: [[15, 15]] }, { mod: 'cold_res', values: [[30, 35]] }, { mod: 'int', values: [[20, 30]] }],
    flavour: '有些心比墳墓更冰冷。',
  },
  {
    id: 'thornback', name: '棘背板甲', base: 'body_armour_str_2',
    mods: [{ mod: 'local_armour_inc', values: [[150, 200]] }, { mod: 'life', values: [[60, 80]] }, { mod: 'u_block', values: [[5, 5]] }, { mod: 'u_phys_reduction', values: [[5, 8]] }],
    flavour: '敢打我，就用血來償。',
  },
  {
    id: 'veil_whispers', name: '低語面紗', base: 'gloves_dex_int_1',
    mods: [{ mod: 'attack_speed', values: [[10, 15]] }, { mod: 'crit_chance', values: [[25, 35]] }, { mod: 'u_life_on_hit', values: [[3, 5]] }, { mod: 'dex', values: [[25, 30]] }],
    flavour: '他們最後聽見的，是一片寂靜。',
  },
  {
    id: 'unbroken_oath', name: '不破之誓', base: 'shield_str_int_2',
    mods: [{ mod: 'local_block', values: [[6, 8]] }, { mod: 'all_res', values: [[12, 16]] }, { mod: 'life', values: [[50, 70]] }, { mod: 'local_aes_inc', values: [[60, 80]] }],
    flavour: '守住的誓言，是攻不破的城牆。',
  },
  {
    id: 'keeper_ashes', name: '灰燼守護者', base: 'staff_2',
    mods: [{ mod: 'spell_damage', values: [[60, 80]] }, { mod: 'fire_damage', values: [[40, 50]] }, { mod: 'ignite_chance', values: [[20, 20]] }, { mod: 'u_burning', values: [[40, 50]] }],
    flavour: '萬物終歸塵土，它只是加快了這個過程。',
  },
  {
    id: 'glass_fang', name: '玻璃之牙', base: 'dagger_1',
    mods: [{ mod: 'local_crit', values: [[60, 80]] }, { mod: 'crit_multi', values: [[40, 50]] }, { mod: 'local_lightning_added', values: [[3, 5], [30, 40]] }, { mod: 'spell_damage', values: [[40, 50]] }],
    flavour: '如它終結的生命一般脆弱。',
  },
  {
    id: 'voidsilk', name: '虛空絲袍', base: 'body_armour_int_3',
    mods: [{ mod: 'local_es_inc', values: [[180, 220]] }, { mod: 'local_es', values: [[60, 80]] }, { mod: 'int', values: [[30, 40]] }, { mod: 'u_hollow_vessel', values: [] }],
    flavour: '清空容器，虛空便會將其填滿。',
  },
  {
    id: 'mirebound', name: '泥縛腰封', base: 'belt_leather',
    mods: [{ mod: 'life', values: [[40, 60]] }, { mod: 'str', values: [[25, 35]] }, { mod: 'flask_charges_gained', values: [[20, 30]] }, { mod: 'u_flask_duration', values: [[15, 20]] }],
    flavour: '自沼澤中撈起，依然沉甸甸地承載著它的饋贈。',
  },
  {
    id: 'hollow_king', name: '空虛之王冠冕', base: 'helmet_str_int_2',
    mods: [{ mod: 'socketed_gem_level', values: [[1, 1]] }, { mod: 'local_es', values: [[50, 70]] }, { mod: 'all_attributes', values: [[20, 30]] }, { mod: 'mana_regen', values: [[20, 30]] }],
    flavour: '他一無所統，故無人能奪其所有。',
  },
  {
    id: 'shadowmantle', name: '影之披風', base: 'body_armour_dex_int_2',
    mods: [{ mod: 'local_ees_inc', values: [[120, 160]] }, { mod: 'dex', values: [[30, 40]] }, { mod: 'life', values: [[40, 60]] }, { mod: 'u_phantom_step', values: [] }],
    flavour: '它所經之處，刀刃只能劃過空氣。',
  },
  {
    id: 'tidebreaker', name: '破潮者', base: 'two_hand_mace_1',
    mods: [{ mod: 'local_phys_inc', values: [[120, 160]] }, { mod: 'local_cold_added', values: [[8, 12], [18, 26]] }, { mod: 'u_phys_as_cold', values: [[15, 20]] }, { mod: 'u_aoe', values: [[15, 25]] }],
    flavour: '大海永不停歇，它的戰鎚也是。',
  },
  {
    id: 'bone_herald', name: '骨之使者', base: 'wand_1',
    mods: [{ mod: 'minion_damage', values: [[30, 40]] }, { mod: 'u_minion_life', values: [[20, 30]] }, { mod: 'u_minion_count', values: [[1, 1]] }, { mod: 'int', values: [[15, 25]] }],
    flavour: '亡者會記得第一個呼喚他們的人。',
  },
  {
    id: 'quill_of_ruin', name: '毀滅羽箭', base: 'quiver_barbed',
    mods: [{ mod: 'u_pierce', values: [[2, 2]] }, { mod: 'crit_multi', values: [[20, 30]] }, { mod: 'life', values: [[40, 60]] }, { mod: 'u_close_quarters', values: [] }],
    flavour: '近得能看清他們的眼睛，也近得足以終結他們。',
  },
  // ------------------------------------------------------------------ build-enabling uniques
  {
    id: 'kaoms_heart', name: '卡翁之心', base: 'body_armour_str_4',
    mods: [{ mod: 'life', values: [[300, 400]] }, { mod: 'fire_damage', values: [[20, 40]] }],
    sockets: { colors: [], linked: false },
    flavour: '王者之心不需要寶石點綴——它本身就是寶藏。',
  },
  {
    id: 'rise_phoenix', name: '鳳凰崛起', base: 'shield_str_3',
    mods: [{ mod: 'u_max_fire_res', values: [[4, 5]] }, { mod: 'u_life_regen_pct', values: [[1.5, 2]] }, { mod: 'fire_res', values: [[30, 40]] }, { mod: 'life', values: [[60, 80]] }],
    flavour: '從灰燼中重生，比先前更加熾烈。',
  },
  {
    id: 'immortal_flesh', name: '不朽之軀', base: 'belt_heavy',
    mods: [{ mod: 'life', values: [[70, 90]] }, { mod: 'u_life_regen_pct', values: [[1.5, 2.5]] }, { mod: 'str', values: [[20, 30]] }],
    flavour: '血肉終將腐朽——除非它拒絕。',
  },
  {
    id: 'headhunter', name: '獵首者', base: 'belt_leather', level: 40, dropWeight: 15,
    mods: [{ mod: 'life', values: [[50, 60]] }, { mod: 'str', values: [[40, 55]] }, { mod: 'dex', values: [[40, 55]] }, { mod: 'u_headhunter', values: [] }],
    flavour: '「人是最危險的獵物，也是唯一值得狩獵的。」',
  },
  {
    id: 'starforge', name: '星鑄', base: 'two_hand_sword_4', dropWeight: 40,
    mods: [{ mod: 'local_phys_inc', values: [[350, 400]] }, { mod: 'life', values: [[90, 100]] }, { mod: 'u_aoe', values: [[20, 20]] }, { mod: 'u_phys_as_lightning', values: [[15, 20]] }],
    flavour: '墜落的星辰被鍛造成劍，至今仍渴望回到天際。',
  },
  {
    id: 'belly_beast', name: '巨獸之腹', base: 'body_armour_str_dex_3',
    mods: [{ mod: 'local_ae_inc', values: [[150, 200]] }, { mod: 'life_pct', values: [[30, 40]] }, { mod: 'all_res', values: [[10, 15]] }],
    flavour: '野獸的腹中溫暖而安全——只要你別介意那股氣味。',
  },
  {
    id: 'abyssal_crown', name: '深淵之冠', base: 'helmet_str_4',
    mods: [{ mod: 'attack_phys_added', values: [[20, 30], [40, 60]] }, { mod: 'crit_multi', values: [[35, 45]] }, { mod: 'life', values: [[60, 80]] }, { mod: 'u_damage_taken', values: [[20, 20]] }],
    flavour: '凝視深淵者，深淵也回以凝視。',
  },
  {
    id: 'paradoxica', name: '悖論之刃', base: 'one_hand_sword_4', dropWeight: 50,
    mods: [{ mod: 'u_attack_more', values: [[40, 50]] }, { mod: 'local_attack_speed', values: [[10, 15]] }, { mod: 'dex', values: [[25, 35]] }, { mod: 'local_crit', values: [[30, 40]] }],
    flavour: '它同時存在於兩個地方——而兩者都在你的敵人體內。',
  },
  {
    id: 'blood_grip', name: '血腥之握', base: 'gloves_str_dex_2',
    mods: [{ mod: 'u_bleed_chance', values: [[25, 25]] }, { mod: 'u_bleed_damage', values: [[40, 60]] }, { mod: 'attack_speed', values: [[8, 12]] }, { mod: 'life', values: [[40, 60]] }],
    flavour: '一點點血就能讓它甦醒。',
  },
  {
    id: 'quill_rain', name: '羽雨', base: 'bow_1',
    mods: [{ mod: 'local_attack_speed', values: [[90, 100]] }, { mod: 'u_damage_less', values: [[40, 40]] }, { mod: 'projectile_speed', values: [[25, 35]] }, { mod: 'item_rarity', values: [[20, 30]] }],
    flavour: '輕如鴻毛，密如暴雨。',
  },
  {
    id: 'voltaxic_rift', name: '伏特裂隙', base: 'bow_4',
    mods: [{ mod: 'local_lightning_added', values: [[2, 5], [150, 190]] }, { mod: 'u_lightning_pen', values: [[15, 20]] }, { mod: 'shock_chance', values: [[25, 25]] }, { mod: 'dex', values: [[20, 30]] }],
    flavour: '天空的裂縫中，雷霆正在低語。',
  },
  {
    id: 'plague_throat', name: '瘟疫之喉', base: 'amulet_agate',
    mods: [{ mod: 'u_chaos_damage', values: [[25, 35]] }, { mod: 'u_dot_damage', values: [[20, 30]] }, { mod: 'u_ailment_duration', values: [[15, 25]] }, { mod: 'chaos_res', values: [[20, 30]] }],
    flavour: '它不會殺死你——它只是讓你慢慢忘記如何活著。',
  },
  {
    id: 'void_battery', name: '虛空電池', base: 'wand_3',
    mods: [{ mod: 'spell_damage', values: [[60, 80]] }, { mod: 'u_chaos_damage', values: [[30, 40]] }, { mod: 'cast_speed', values: [[10, 15]] }, { mod: 'u_poison_chance', values: [[20, 20]] }],
    flavour: '儲存著虛無的能量，等待被釋放。',
  },
  {
    id: 'kinetic_star', name: '星落動能', base: 'wand_4',
    mods: [{ mod: 'local_phys_added', values: [[12, 18], [30, 40]] }, { mod: 'local_phys_inc', values: [[100, 130]] }, { mod: 'u_extra_projectile', values: [[1, 1]] }, { mod: 'local_crit', values: [[30, 40]] }],
    flavour: '星辰墜落的那一刻，被封存在木頭之中。',
  },
  {
    id: 'spirit_drinker', name: '飲魂之面', base: 'helmet_int_3',
    mods: [{ mod: 'minion_damage', values: [[30, 40]] }, { mod: 'u_minion_count', values: [[1, 1]] }, { mod: 'u_minion_speed', values: [[20, 30]] }, { mod: 'int', values: [[25, 35]] }],
    flavour: '亡者的低語，唯有戴上它的人才聽得見。',
  },
  {
    id: 'bones_ullr', name: '尤爾之骨', base: 'boots_dex_int_2',
    mods: [{ mod: 'u_minion_count', values: [[1, 1]] }, { mod: 'u_move_speed', values: [[15, 20]] }, { mod: 'life', values: [[30, 40]] }],
    flavour: '死者在他的足跡中行走。',
  },
  {
    id: 'seven_league', name: '七里靴', base: 'boots_str_1',
    mods: [{ mod: 'u_move_speed', values: [[50, 50]] }],
    flavour: '「然後，他一步就到了天涯海角。」',
  },
];

export const UNIQUE_BY_ID: Record<string, UniqueDef> = Object.fromEntries(UNIQUES.map((u) => [u.id, u]));
