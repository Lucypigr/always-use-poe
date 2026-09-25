import type { ClassId } from './classes';

/**
 * Build guide (流派指南). Each entry mirrors a well-known Path of Exile build archetype and
 * lists the gems, uniques and keystones in this game that make it work.
 */
export interface BuildDef {
  id: string;
  name: string;
  /** The Path of Exile build it is modelled on. */
  poe: string;
  classes: ClassId[];
  /** Main skill gem. */
  skill: string;
  /** Recommended supports, best first. */
  supports: string[];
  /** Other useful gems (auras, movement, secondary skills). */
  extra?: string[];
  uniques: string[];
  keystones?: string[];
  summary: string;
  tips: string[];
}

export const BUILDS: BuildDef[] = [
  {
    id: 'rf', name: '正義之火・燃燒坦克', poe: 'Righteous Fire Juggernaut / Chieftain', classes: ['brute', 'zealot'],
    skill: 'righteous_fire', supports: ['efficacy', 'deadly_ailments', 'swift_affliction', 'increased_aoe', 'arcane_surge'],
    extra: ['cinderfall', 'flame_step', 'bulwark'],
    uniques: ['kaoms_heart', 'rise_phoenix', 'immortal_flesh', 'belly_beast'],
    summary: '開啟正義之火後走進怪群，傷害完全取決於最大生命與能量護盾。',
    tips: ['火焰抗性一定要堆到上限，鳳凰崛起能提高火焰抗性上限。', '靠生命回復（每秒回復 % 生命）抵銷自燃傷害。', '卡翁之心沒有插槽，但給予大量生命。'],
  },
  {
    id: 'boneshatter', name: '碎骨・重擊蠻兵', poe: 'Boneshatter Juggernaut', classes: ['brute', 'blademaster'],
    skill: 'bone_breaker', supports: ['brutal_force', 'pulverise', 'faster_attacks', 'life_leech_support', 'chance_to_bleed'],
    extra: ['leap_slam', 'bulwark'],
    uniques: ['abyssal_crown', 'kaoms_heart', 'bloodthirst', 'thornback'],
    keystones: ['鋼鐵意志', '堅定紀律'],
    summary: '單體重擊加上衝擊波，簡單粗暴的近戰開荒流派。',
    tips: ['雙手錘或雙手斧的基礎傷害最高。', '深淵之冠的附加物理傷害對所有攻擊有效，但會讓你承受更多傷害。'],
  },
  {
    id: 'cyclone', name: '旋風斬・星鑄', poe: 'Cyclone Slayer (Starforge)', classes: ['blademaster', 'brute'],
    skill: 'cyclone', supports: ['brutal_force', 'pulverise', 'faster_attacks', 'life_leech_support', 'increased_aoe'],
    extra: ['dash_strike', 'quickening'],
    uniques: ['starforge', 'belly_beast', 'abyssal_crown', 'windstride'],
    summary: '按住技能鍵持續旋轉並移動，範圍內所有敵人都會被斬擊。',
    tips: ['攻擊速度越快、旋轉越快；範圍越大，清怪越快。', '星鑄的物理傷害極高，並給予額外閃電傷害。'],
  },
  {
    id: 'flicker', name: '閃現打擊・刀舞者', poe: 'Flicker Strike Berserker / Slayer', classes: ['blademaster', 'nightblade'],
    skill: 'flicker_strike', supports: ['melee_splash', 'multistrike', 'brutal_force', 'life_leech_support', 'crit_strikes'],
    extra: ['double_strike', 'quickening'],
    uniques: ['paradoxica', 'veil_whispers', 'headhunter', 'windstride'],
    summary: '在敵人之間不斷瞬移並斬擊，速度最快的近戰流派。',
    tips: ['衝擊波（輔）讓每次閃現都能打到一群怪。', '悖論之刃讓攻擊傷害大幅提高；獵首者讓你越殺越快。'],
  },
  {
    id: 'bleed', name: '撕裂・流血角鬥士', poe: 'Lacerate / Bleed Gladiator', classes: ['blademaster', 'brute'],
    skill: 'lacerate', supports: ['chance_to_bleed', 'deadly_ailments', 'brutal_force', 'swift_affliction', 'faster_attacks'],
    extra: ['double_strike', 'leap_slam'],
    uniques: ['blood_grip', 'bloodthirst', 'belly_beast'],
    summary: '大範圍揮砍使敵人流血，靠持續傷害融化首領。',
    tips: ['流血傷害只看物理傷害，選擇高物理的武器。', '流血的敵人移動時會受到雙倍傷害。'],
  },
  {
    id: 'la', name: '閃電箭雨・神射手', poe: 'Lightning Arrow / Tornado Shot Deadeye', classes: ['tracker'],
    skill: 'storm_arrow', supports: ['lesser_volley', 'added_lightning', 'lightning_penetration', 'faster_attacks', 'elemental_focus'],
    extra: ['tornado_shot', 'quickening', 'dash_strike'],
    uniques: ['voltaxic_rift', 'wyrmfang', 'quill_of_ruin', 'windstride'],
    summary: '風暴箭 / 龍捲射擊搭配多重投射，滿螢幕的箭矢清怪。',
    tips: ['龍捲射擊本身會穿透並分裂，搭配多重投射效果最好。', '伏特裂隙的閃電傷害極高並可穿透閃電抗性。'],
  },
  {
    id: 'toxic_rain', name: '毒雨・探路者', poe: 'Toxic Rain Pathfinder', classes: ['tracker', 'nightblade'],
    skill: 'toxic_rain', supports: ['void_manipulation', 'deadly_ailments', 'swift_affliction', 'faster_attacks', 'increased_aoe'],
    extra: ['ice_shot', 'dash_strike'],
    uniques: ['quill_rain', 'plague_throat', 'windstride'],
    summary: '箭雨必定中毒，混沌持續傷害堆疊到首領身上。',
    tips: ['羽雨大幅提升攻擊速度，越快射擊就能疊越多層中毒。', '中毒傷害吃「混沌傷害」「持續傷害」加成。'],
  },
  {
    id: 'ed', name: '精華吸取・瘟疫術士', poe: 'Essence Drain / Contagion Occultist', classes: ['arcanist', 'nightblade'],
    skill: 'essence_drain', supports: ['void_manipulation', 'efficacy', 'deadly_ailments', 'swift_affliction', 'faster_casting'],
    extra: ['contagion', 'flame_step', 'serenity'],
    uniques: ['void_battery', 'plague_throat', 'voidsilk'],
    keystones: ['空虛之器'],
    summary: '先用傳染讓整群怪中毒，再用精華吸取施加強力的混沌持續傷害。',
    tips: ['空虛之器（虛空絲袍）讓你免疫混沌傷害，適合能量護盾流派。', '功效與致命異常都提高持續傷害。'],
  },
  {
    id: 'srs', name: '憤怒之靈・召喚大軍', poe: 'Summon Raging Spirits / Minion Necromancer', classes: ['arcanist', 'zealot'],
    skill: 'raging_spirits', supports: ['minion_might', 'minion_speed', 'increased_duration', 'minion_vitality'],
    extra: ['raise_zombie', 'raise_bones', 'flame_step'],
    uniques: ['spirit_drinker', 'bones_ullr', 'bone_herald'],
    summary: '不斷施放憤怒之靈，讓燃燒的頭顱衝向敵人；殭屍在前線擋怪。',
    tips: ['每種召喚技能有各自的數量上限，+召喚物數量對所有召喚技能有效。', '增加持續時間讓憤怒之靈存在更久。'],
  },
  {
    id: 'kb', name: '動能爆破・法杖射手', poe: 'Kinetic Blast Elementalist', classes: ['arcanist', 'tracker'],
    skill: 'kinetic_blast', supports: ['lesser_volley', 'added_lightning', 'faster_attacks', 'increased_aoe', 'vicious_projectiles'],
    extra: ['flame_step', 'quickening'],
    uniques: ['kinetic_star', 'glass_fang', 'hollow_king'],
    summary: '法杖射出會爆炸的動能球，範圍清怪極快。',
    tips: ['動能爆破是攻擊，吃武器傷害與攻擊速度。', '星落動能額外多一個投射物。'],
  },
  {
    id: 'cold_caster', name: '冰凍脈衝・寒冰法師', poe: 'Freezing Pulse / Ice Nova Hierophant', classes: ['arcanist'],
    skill: 'freezing_pulse', supports: ['cold_penetration', 'added_cold', 'hypothermia', 'faster_casting', 'elemental_focus'],
    extra: ['frost_nova', 'blade_vortex', 'flame_step'],
    uniques: ['frostbound', 'hollow_king', 'glass_fang'],
    keystones: ['秘法護衛'],
    summary: '穿透所有敵人的冰冷脈衝，冰緩與冰凍讓敵人無法靠近。',
    tips: ['冰冷穿透能無視敵人的冰冷抗性。', '刀刃漩渦可當作近身防守技能。'],
  },
];
