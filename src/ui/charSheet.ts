import { CLASS_BY_ID } from '../data/classes';
import { monsterAccuracy, monsterDamage } from '../data/scaling';
import { armourReduction, chanceToHit } from '../game/combat';
import { uncappedRes } from '../stats/character';
import { clear, fmt, h } from './dom';
import type { UI } from './ui';

/** Character sheet (PoE's "C" panel): attributes, defences, resistances and offence. */
export class CharacterSheet {
  private timer = 0;

  constructor(
    private ui: UI,
    private el: HTMLElement,
  ) {}

  tick(dt: number): void {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 1;
      this.render();
    }
  }

  render(): void {
    const el = this.el;
    const g = this.ui.game;
    const c = g.char;
    const p = g.player;
    const s = p.cstats;
    if (!s) return;
    clear(el);
    el.append(h('div', { class: 'panel-title' }, '角色', h('button', { class: 'panel-close small', onclick: () => this.ui.closePanel('character') }, '×')));
    const box = h('div', { class: 'charsheet' });
    box.append(h('div', { class: 'hdr' }, h('span', { class: 'nm' }, c.name), h('span', {}, `等級 ${c.level} ${CLASS_BY_ID[c.classId].name}`)));
    const row = (k: string, v: string, cls = '') => box.append(h('div', { class: 'row' }, h('span', { class: 'k' }, k), h('span', { class: `v ${cls}` }, v)));
    const title = (t: string) => box.append(h('div', { class: 'section-title' }, t));

    title('屬性');
    row('力量', fmt(s.str));
    row('敏捷', fmt(s.dex));
    row('智慧', fmt(s.int));

    title('防禦');
    const lvl = g.area.town ? c.level : g.area.level;
    const typicalHit = monsterDamage(lvl) * 1.3;
    row('生命', `${fmt(p.maxLifeUsable)}${p.reservedLife ? `（保留 ${fmt(p.reservedLife)}）` : ''}`);
    row('生命回復', `${fmt(s.lifeRegen, 1)} /秒`);
    row('魔力', `${fmt(s.maxMana)}${p.reserved ? `（保留 ${fmt(p.reserved)}）` : ''}`);
    row('魔力回復', `${fmt(s.manaRegen, 1)} /秒`);
    row('能量護盾', fmt(s.maxES));
    row('護甲', `${fmt(s.armour)} (${fmt(armourReduction(s.armour, typicalHit) * 100, 1)}% 減傷，對等級 ${lvl} 的擊中)`);
    row('閃避值', `${fmt(s.evasion)} (${fmt((1 - chanceToHit(monsterAccuracy(lvl), s.evasion)) * 100, 1)}% 閃避率)`);
    row('格擋率', `${fmt(s.block)}%`);
    if (s.physReduction) row('物理傷害減免', `${fmt(s.physReduction)}%`);
    if (s.avoidChance) row('迴避擊中機率', `${s.avoidChance}%`);
    row('移動速度', `${fmt((s.moveSpeed / 4.4) * 100 - 100)}%`);

    title(`抗性${g.area.resPenalty ? `（懲罰 ${g.area.resPenalty}%）` : ''}`);
    const un = uncappedRes(s, g.area.resPenalty);
    for (const t of ['fire', 'cold', 'lightning', 'chaos'] as const) {
      row(`${({ fire: '火焰', cold: '冰冷', lightning: '閃電', chaos: '混沌' } as const)[t]}抗性`, `${fmt(s.res[t])}% / ${s.maxRes[t]}%${un[t] > s.res[t] ? ` (${fmt(un[t])}%)` : ''}`, t);
    }

    title('攻擊');
    const seen = new Set<string>();
    for (const uid of c.skillBar) {
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      const sk = p.skills.get(uid);
      const st = p.skillStats.get(uid);
      if (!sk || !st || !st.averageHit) continue;
      row(sk.gem.name, `${fmt(st.dps, 1)} DPS`);
      row('  · 平均傷害 / 暴擊', `${fmt(st.averageHit, 1)} / ${fmt(st.critChance, 1)}%`);
      row('  · 每秒使用次數', fmt(st.usesPerSecond * st.hitsPerUse, 2));
    }
    row('命中值', fmt(s.accuracy));

    title('其他');
    row('物品稀有度增加', `${fmt(s.itemRarity)}%`);
    row('物品數量增加', `${fmt(s.itemQuantity)}%`);
    row('生命偷取', `${fmt(s.sheet.flat('life_leech'), 1)}%`);
    row('天賦點數', `已配置 ${c.passives.length - 1}，重置點數 ${c.refundPoints}`);
    row('死亡次數', fmt(c.deaths));
    row('遊戲時間', `${Math.floor(c.playTime / 3600)} 小時 ${Math.floor((c.playTime % 3600) / 60)} 分`);
    el.append(box);
  }
}
