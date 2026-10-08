import { type StatMod } from '../stats/stats';
import { CULL, F, I, M, type Fx } from './fx';
import type { ClassId } from './classes';

/**
 * Ascendancy classes (like Path of Exile's): each base class has three. After the first
 * trial (beating 灰燼森林) you pick one for good and spend ascendancy points on its small
 * tree. Every trial (a story boss) grants 2 points, 8 in total — a tree has 10 nodes, so
 * you always have to choose.
 *
 * Tree shape (index → requires):
 *   0 root ─┬ 1 → 2 → 3   (branch A, 3 = capstone)
 *           ├ 4 → 5 → 6   (branch B)
 *           └ 7 → 8 → 9   (branch C)
 */

export interface AscNode {
  id: string;
  name: string;
  stats: StatMod[];
  text: string[];
  /** Node that must be allocated first (undefined for the root). */
  requires?: string;
  /** Index within the tree (0 root, 3/6/9 are the big notables). */
  index: number;
  major: boolean;
}

export interface AscendancyDef {
  id: string;
  classId: ClassId;
  name: string;
  description: string;
  branches: [string, string, string];
  nodes: AscNode[];
}

/** Areas whose boss is an ascendancy trial, 2 points each. */
export const ASCENDANCY_TRIALS = ['ashwood', 'citadel', 'cinder', 'throne'];
export const ASC_POINTS_PER_TRIAL = 2;

type NodeSpec = [name: string, ...fx: Fx[]];
const REQ_INDEX = [-1, 0, 1, 2, 0, 4, 5, 0, 7, 8];

function asc(
  id: string,
  classId: ClassId,
  name: string,
  description: string,
  branches: [string, string, string],
  specs: NodeSpec[],
): AscendancyDef {
  if (specs.length !== 10) throw new Error(`ascendancy ${id} needs 10 nodes`);
  const nodes: AscNode[] = specs.map(([nodeName, ...fx], index) => ({
    id: `${id}:${index}`,
    name: nodeName,
    stats: fx.map((f) => f.mod),
    text: fx.map((f) => f.text),
    requires: REQ_INDEX[index] >= 0 ? `${id}:${REQ_INDEX[index]}` : undefined,
    index,
    major: index === 3 || index === 6 || index === 9,
  }));
  return { id, classId, name, description, branches, nodes };
}

export const ASCENDANCIES: AscendancyDef[] = [
  // ---- 蠻兵 ----
  asc('juggernaut', 'brute', '不朽者', '披甲而行的不倒壁壘，以護甲與生命硬撐一切。', ['鋼鐵之軀', '蠻力', '不屈'], [
    ['鋼鐵誓約', I('armour', 40), I('life', 5)],
    ['堅硬皮甲', I('armour', 35)],
    ['緩衝血肉', F('phys_damage_reduction', 3), F('life_regen_pct', 0.4)],
    ['不動如山', I('armour', 60), I('damage_taken', -8)],
    ['蠻力', I('melee_damage', 20)],
    ['撼地之擊', I('phys_damage', 20), I('area_of_effect', 8)],
    ['崩山', M('melee_damage', 30), I('attack_speed', -5)],
    ['老兵之血', I('life', 10)],
    ['不屈戰意', F('life_regen_pct', 1)],
    ['不朽之軀', M('damage_taken', -12), F('all_ele_res', 12), I('life', 10)],
  ]),
  asc('berserker', 'brute', '狂戰士', '以鮮血與怒火為燃料，越戰越狂的殺戮機器。', ['嗜血', '狂暴', '屠戮'], [
    ['戰吼狂怒', I('attack_speed', 8), I('melee_damage', 10)],
    ['飲血', F('life_leech', 0.4)],
    ['血紅視野', I('attack_damage', 15)],
    ['血浴', F('life_leech', 0.8), M('melee_damage', 20)],
    ['躁動', I('attack_speed', 8)],
    ['無懼痛楚', F('life_on_kill', 12)],
    ['怒火燎原', I('attack_speed', 15), I('movement_speed', 8)],
    ['斷骨', I('phys_damage', 20)],
    ['殘暴', F('crit_multi', 25)],
    ['戰神化身', M('damage', 25), F('life_leech', 0.5), M('damage_taken', 8)],
  ]),
  asc('chieftain', 'brute', '酋長', '喚醒祖靈之火的部族領袖，烈焰是他的盾也是他的矛。', ['烈焰', '祖靈', '戰團'], [
    ['烈焰圖騰', I('fire_damage', 25), F('fire_res', 20)],
    ['燃燒意志', I('burning_damage', 30)],
    ['灼熱之血', I('fire_damage', 25)],
    ['烈焰戰歌', M('fire_damage', 30), F('phys_as_extra_fire', 15)],
    ['熔岩皮膚', I('armour', 30), F('fire_res', 15)],
    ['祖靈庇佑', I('life', 8), F('life_regen_pct', 0.5)],
    ['不滅之火', F('max_all_ele_res', 3), F('fire_res', 20), M('damage_taken', -8)],
    ['火山之力', I('area_of_effect', 12)],
    ['灰燼', F('ignite_chance', 20)],
    ['戰團之王', M('fire_damage', 25), I('life', 12), F('fire_pen', 10)],
  ]),

  // ---- 追獵者 ----
  asc('deadeye', 'tracker', '銳眼', '百步穿楊的神射手，箭雨遮蔽戰場。', ['箭幕', '速射', '疾風'], [
    ['鷹眼', I('projectile_damage', 20), I('accuracy', 30)],
    ['密集', I('projectile_speed', 15)],
    ['穿心', F('pierce', 1)],
    ['箭幕', F('additional_projectiles', 1), M('projectile_damage', 10)],
    ['疾射', I('attack_speed', 8)],
    ['精準', I('accuracy', 40), I('crit_chance', 25)],
    ['暴風', I('attack_speed', 10), M('attack_damage', 20)],
    ['風馳', I('movement_speed', 6)],
    ['輕靈', I('evasion', 30)],
    ['神射手', F('chain', 1), M('projectile_damage', 25), F('crit_multi', 25)],
  ]),
  asc('raider', 'tracker', '掠奪者', '來去如風的襲擊者，速度就是最好的防禦。', ['閃避', '藥劑', '突襲'], [
    ['野性速度', I('movement_speed', 8), I('evasion', 25)],
    ['輕靈', I('evasion', 40)],
    ['影舞', F('dex', 25)],
    ['無跡可尋', I('evasion', 60), I('life', 8)],
    ['藥師', I('flask_charges', 25)],
    ['持久', I('flask_duration', 25)],
    ['狂熱', I('flask_recovery', 25), I('attack_speed', 8)],
    ['突襲', I('attack_damage', 15)],
    ['追擊', I('movement_speed', 6), I('attack_speed', 6)],
    ['風暴獵手', M('attack_damage', 20), I('movement_speed', 12), I('evasion', 30)],
  ]),
  asc('pathfinder', 'tracker', '開路者', '精通毒物與藥劑的荒野生存者。', ['劇毒', '煉金', '荒野'], [
    ['毒草學', F('poison_chance', 15), I('poison_damage', 20)],
    ['劇毒', I('poison_damage', 30)],
    ['蝕骨', I('chaos_damage', 25)],
    ['瘟疫使者', F('poison_chance', 25), M('poison_damage', 30)],
    ['煉金術', I('flask_recovery', 30)],
    ['長效', I('flask_duration', 30)],
    ['萬能藥', I('flask_charges', 40), F('all_ele_res', 10)],
    ['野外求生', F('life_regen_pct', 0.5)],
    ['輕足', I('movement_speed', 8)],
    ['荒野之子', M('chaos_damage', 20), F('chaos_res', 25), I('life', 8)],
  ]),

  // ---- 秘術師 ----
  asc('elementalist', 'arcanist', '元素使', '駕馭火、冰、雷三種元素的大法師。', ['元素異常', '穿透', '範圍'], [
    ['元素親和', I('elemental_damage', 20), F('all_ele_res', 8)],
    ['火種', F('ignite_chance', 20)],
    ['寒霜', F('freeze_chance', 20)],
    ['雷鳴', F('shock_chance', 20), M('elemental_damage', 20)],
    ['烈焰穿透', F('fire_pen', 10)],
    ['寒冰穿透', F('cold_pen', 10)],
    ['雷電穿透', F('lightning_pen', 10), I('spell_damage', 15)],
    ['擴散', I('area_of_effect', 15)],
    ['爆裂', I('area_damage', 20)],
    ['元素主宰', M('elemental_damage', 25), I('spell_crit_chance', 40), F('max_all_ele_res', 3)],
  ]),
  asc('occultist', 'arcanist', '祕儀者', '以能量護盾與混沌之力行走於虛空邊緣。', ['護盾', '混沌', '法術'], [
    ['虛空低語', I('energy_shield', 25), I('chaos_damage', 15)],
    ['虛空之膚', I('energy_shield', 30)],
    ['湧泉', I('es_recharge', 30)],
    ['虛空護盾', I('energy_shield', 50), I('es_recharge_delay', -30)],
    ['腐蝕', I('chaos_damage', 25)],
    ['抗腐', F('chaos_res', 15)],
    ['腐化之觸', M('chaos_damage', 25), F('ele_as_extra_chaos', 10)],
    ['奧術增幅', I('spell_damage', 25)],
    ['疾咒', I('cast_speed', 8)],
    ['吞噬者', M('spell_damage', 25), F('mana_on_kill', 10), I('mana_regen', 40)],
  ]),
  asc('necromancer', 'arcanist', '死靈師', '號令亡者大軍的黑暗主宰。', ['亡者', '強化', '主人'], [
    ['亡者低語', I('minion_damage', 25), I('minion_life', 25)],
    ['招魂', F('minion_count', 1)],
    ['疾行亡者', I('minion_speed', 15)],
    ['亡靈軍團', F('minion_count', 2), M('minion_damage', 20)],
    ['堅骨', I('minion_life', 40)],
    ['腐朽之力', I('minion_damage', 30)],
    ['不死之軀', M('minion_life', 30), I('minion_speed', 10)],
    ['主僕同命', I('life', 8)],
    ['死亡低語', F('life_regen_pct', 0.5)],
    ['亡靈之王', M('minion_damage', 35), I('minion_life', 50), I('energy_shield', 25)],
  ]),

  // ---- 劍術大師 ----
  asc('slayer', 'blademaster', '斬殺者', '以偷取與處決聞名的獨行劍客。', ['處決', '汲取', '劍術'], [
    ['殺戮本能', I('melee_damage', 15), F('life_leech', 0.3)],
    ['處決', CULL],
    ['致命精準', I('crit_chance', 40)],
    ['死神之鐮', F('crit_multi', 40), M('melee_damage', 20)],
    ['汲血', F('life_leech', 0.5)],
    ['戰利品', F('life_on_kill', 15)],
    ['嗜血', F('life_leech', 0.8), I('attack_speed', 10)],
    ['劍藝', I('attack_damage', 20)],
    ['迅劍', I('attack_speed', 8)],
    ['無情殺手', M('damage', 20), F('crit_multi', 30), I('life', 8)],
  ]),
  asc('gladiator', 'blademaster', '角鬥士', '格擋與流血並用的競技場王者。', ['格擋', '流血', '暴擊'], [
    ['競技場老手', F('block', 6), I('attack_damage', 15)],
    ['盾牌格擋', F('block', 6)],
    ['鎧甲', I('armour', 30)],
    ['不倒之盾', F('block', 10), I('armour', 40), M('damage_taken', -6)],
    ['割裂', F('bleed_chance', 20)],
    ['放血', I('bleed_damage', 35)],
    ['血祭', M('bleed_damage', 35), F('bleed_chance', 20)],
    ['致命一擊', I('crit_chance', 30)],
    ['觀眾的歡呼', F('crit_multi', 25)],
    ['萬眾矚目', M('attack_damage', 20), I('attack_speed', 10), F('life_leech', 0.4)],
  ]),
  asc('champion', 'blademaster', '衛士', '高舉戰旗的戰場統帥，鼓舞光環與堅甲並重。', ['鼓舞', '堅毅', '威壓'], [
    ['戰場旗幟', I('aura_effect', 10), I('armour', 25)],
    ['鼓舞', I('aura_effect', 10)],
    ['精簡指揮', I('reservation', -10)],
    ['不滅旗手', I('aura_effect', 20), I('reservation', -15)],
    ['堅甲', I('armour', 35)],
    ['鐵壁', F('phys_damage_reduction', 3)],
    ['鋼鐵壁壘', M('damage_taken', -10), I('life', 8)],
    ['威壓', I('attack_damage', 15)],
    ['疾戰', I('attack_speed', 8)],
    ['戰場統帥', M('damage', 15), F('life_regen_pct', 1), I('aura_effect', 10)],
  ]),

  // ---- 狂信者 ----
  asc('inquisitor', 'zealot', '審判官', '以暴擊與元素穿透降下神罰的聖職者。', ['暴擊', '穿透', '庇護'], [
    ['神聖審判', I('crit_chance', 30), F('all_ele_res', 8)],
    ['聖光洞察', I('spell_crit_chance', 40)],
    ['致命祈禱', F('crit_multi', 25)],
    ['無情審判', I('crit_chance', 60), F('crit_multi', 40)],
    ['烈焰穿透', F('fire_pen', 8)],
    ['寒冰穿透', F('cold_pen', 8)],
    ['雷電穿透', F('lightning_pen', 8), I('elemental_damage', 25)],
    ['神佑', I('life', 8)],
    ['聖療', F('life_regen_pct', 0.6)],
    ['神罰化身', M('elemental_damage', 25), F('max_all_ele_res', 3), I('energy_shield', 20)],
  ]),
  asc('hierophant', 'zealot', '護法', '汲取神殿之力的施法者，魔力源源不絕。', ['魔力', '聖火', '光環'], [
    ['神殿之力', I('mana', 20), I('spell_damage', 15)],
    ['魔力汲取', I('mana', 25)],
    ['靜心', I('mana_regen', 40)],
    ['魔力之泉', I('mana', 35), F('mana_on_kill', 15), I('mana_regen', 50)],
    ['聖火', I('fire_damage', 25)],
    ['廣域祝福', I('area_of_effect', 12)],
    ['聖焰', M('spell_damage', 25)],
    ['祝福', I('aura_effect', 8)],
    ['節制', I('reservation', -10)],
    ['神殿主宰', I('aura_effect', 15), I('reservation', -15), M('spell_damage', 15)],
  ]),
  asc('guardian', 'zealot', '守護者', '帶領光環與召喚物的聖騎士，是隊伍的堅盾。', ['光環', '庇護', '援軍'], [
    ['守護誓言', I('aura_effect', 10), I('life', 6)],
    ['聖光', I('aura_effect', 10)],
    ['虔敬', I('reservation', -12)],
    ['神聖光環', I('aura_effect', 20), I('reservation', -10)],
    ['元素庇護', F('all_ele_res', 12)],
    ['聖盾', F('block', 6)],
    ['不破之盾', M('damage_taken', -10), I('armour', 40), I('life', 8)],
    ['援軍', I('minion_life', 30)],
    ['聖戰', I('minion_damage', 30)],
    ['聖騎士團', F('minion_count', 1), M('minion_damage', 25), I('life', 8)],
  ]),

  // ---- 夜刃 ----
  asc('assassin', 'nightblade', '刺客', '暴擊與劇毒並用的暗殺者。', ['暴擊', '劇毒', '暗影'], [
    ['暗影步伐', I('crit_chance', 30), I('movement_speed', 5)],
    ['弱點洞察', I('crit_chance', 40)],
    ['致命角度', F('crit_multi', 30)],
    ['致命一擊', F('crit_multi', 50), I('crit_chance', 60)],
    ['淬毒', F('poison_chance', 15)],
    ['蝕骨之毒', I('poison_damage', 30)],
    ['蛇毒', M('poison_damage', 30), I('chaos_damage', 25)],
    ['鬼魅', I('evasion', 30)],
    ['迅刃', I('attack_speed', 8)],
    ['暗殺大師', M('damage', 18), CULL, I('movement_speed', 8)],
  ]),
  asc('trickster', 'nightblade', '詐欺師', '虛實難辨的幻術師，閃避與護盾並重。', ['幻影', '護盾', '詭計'], [
    ['虛實之間', I('evasion', 30), I('energy_shield', 20)],
    ['疾步', I('movement_speed', 8)],
    ['幻影', I('evasion', 40)],
    ['影分身', I('evasion', 50), M('damage_taken', -8)],
    ['暗影之膚', I('energy_shield', 25)],
    ['湧流', I('es_recharge', 35)],
    ['暗影護盾', I('energy_shield', 40), I('es_recharge_delay', -40)],
    ['混亂', I('chaos_damage', 25)],
    ['抗腐', F('chaos_res', 15)],
    ['戲法大師', M('damage', 15), I('movement_speed', 10), F('chaos_res', 20)],
  ]),
  asc('saboteur', 'nightblade', '破壞者', '擅長範圍爆破與閃電陷阱的破壞專家。', ['爆破', '閃電', '機動'], [
    ['爆破專家', I('area_of_effect', 12), I('fire_damage', 20)],
    ['擴大爆炸', I('area_of_effect', 15)],
    ['震波', I('area_damage', 25)],
    ['連環爆破', M('damage', 15), I('area_of_effect', 20)],
    ['雷霆', I('lightning_damage', 25)],
    ['感電', F('shock_chance', 20)],
    ['驚雷', I('shock_effect', 30), M('lightning_damage', 25)],
    ['疾行', I('movement_speed', 6)],
    ['靈巧', I('evasion', 30)],
    ['破壞大師', M('elemental_damage', 20), F('lightning_pen', 10), I('life', 8)],
  ]),
];

export const ASCENDANCY_BY_ID = Object.fromEntries(ASCENDANCIES.map((a) => [a.id, a])) as Record<string, AscendancyDef>;
export const ASC_NODE_BY_ID: Record<string, AscNode> = Object.fromEntries(ASCENDANCIES.flatMap((a) => a.nodes.map((n) => [n.id, n])));

export function ascendanciesFor(classId: ClassId): AscendancyDef[] {
  return ASCENDANCIES.filter((a) => a.classId === classId);
}

interface AscCharacter {
  ascendancy?: string;
  ascNodes?: string[];
  completedAreas: string[];
}

/** The first trial must be beaten before an ascendancy can be chosen. */
export function ascendancyUnlocked(c: AscCharacter): boolean {
  return c.completedAreas.includes(ASCENDANCY_TRIALS[0]);
}

export function ascPointsTotal(c: AscCharacter): number {
  return ASCENDANCY_TRIALS.filter((a) => c.completedAreas.includes(a)).length * ASC_POINTS_PER_TRIAL;
}

export function ascPointsUnspent(c: AscCharacter): number {
  return ascPointsTotal(c) - (c.ascNodes?.length ?? 0);
}

export function ascendancyStats(c: AscCharacter): StatMod[] {
  if (!c.ascendancy || !c.ascNodes) return [];
  const out: StatMod[] = [];
  for (const id of c.ascNodes) {
    const n = ASC_NODE_BY_ID[id];
    if (n && n.id.startsWith(`${c.ascendancy}:`)) out.push(...n.stats);
  }
  return out;
}
