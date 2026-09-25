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
    el.append(h('div', { class: 'panel-title' }, 'Character', h('button', { class: 'panel-close small', onclick: () => this.ui.closePanel('character') }, '×')));
    const box = h('div', { class: 'charsheet' });
    box.append(h('div', { class: 'hdr' }, h('span', { class: 'nm' }, c.name), h('span', {}, `Level ${c.level} ${CLASS_BY_ID[c.classId].name}`)));
    const row = (k: string, v: string, cls = '') => box.append(h('div', { class: 'row' }, h('span', { class: 'k' }, k), h('span', { class: `v ${cls}` }, v)));
    const title = (t: string) => box.append(h('div', { class: 'section-title' }, t));

    title('Attributes');
    row('Strength', fmt(s.str));
    row('Dexterity', fmt(s.dex));
    row('Intelligence', fmt(s.int));

    title('Defences');
    const lvl = g.area.town ? c.level : g.area.level;
    const typicalHit = monsterDamage(lvl) * 1.3;
    row('Life', `${fmt(p.maxLifeUsable)}${p.reservedLife ? ` (${fmt(p.reservedLife)} reserved)` : ''}`);
    row('Life Regeneration', `${fmt(s.lifeRegen, 1)} /sec`);
    row('Mana', `${fmt(s.maxMana)}${p.reserved ? ` (${fmt(p.reserved)} reserved)` : ''}`);
    row('Mana Regeneration', `${fmt(s.manaRegen, 1)} /sec`);
    row('Energy Shield', fmt(s.maxES));
    row('Armour', `${fmt(s.armour)} (${fmt(armourReduction(s.armour, typicalHit) * 100, 1)}% vs a level ${lvl} hit)`);
    row('Evasion Rating', `${fmt(s.evasion)} (${fmt((1 - chanceToHit(monsterAccuracy(lvl), s.evasion)) * 100, 1)}% evade chance)`);
    row('Chance to Block', `${fmt(s.block)}%`);
    if (s.physReduction) row('Physical Damage Reduction', `${fmt(s.physReduction)}%`);
    if (s.avoidChance) row('Chance to Avoid Hits', `${s.avoidChance}%`);
    row('Movement Speed', `${fmt((s.moveSpeed / 4.4) * 100 - 100)}%`);

    title(`Resistances${g.area.resPenalty ? ` (penalty ${g.area.resPenalty}%)` : ''}`);
    const un = uncappedRes(s, g.area.resPenalty);
    for (const t of ['fire', 'cold', 'lightning', 'chaos'] as const) {
      row(`${t[0].toUpperCase() + t.slice(1)} Resistance`, `${fmt(s.res[t])}% / ${s.maxRes[t]}%${un[t] > s.res[t] ? ` (${fmt(un[t])}%)` : ''}`, t);
    }

    title('Offence');
    const seen = new Set<string>();
    for (const uid of c.skillBar) {
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      const sk = p.skills.get(uid);
      const st = p.skillStats.get(uid);
      if (!sk || !st || !st.averageHit) continue;
      row(sk.gem.name, `${fmt(st.dps, 1)} DPS`);
      row('  · Average hit / Crit', `${fmt(st.averageHit, 1)} / ${fmt(st.critChance, 1)}%`);
      row('  · Uses per second', fmt(st.usesPerSecond * st.hitsPerUse, 2));
    }
    row('Accuracy Rating', fmt(s.accuracy));

    title('Miscellaneous');
    row('Increased Item Rarity', `${fmt(s.itemRarity)}%`);
    row('Increased Item Quantity', `${fmt(s.itemQuantity)}%`);
    row('Life Leech', `${fmt(s.sheet.flat('life_leech'), 1)}%`);
    row('Passive Points', `${c.passives.length - 1} allocated, ${c.refundPoints} refunds`);
    row('Deaths', fmt(c.deaths));
    row('Play Time', `${Math.floor(c.playTime / 3600)}h ${Math.floor((c.playTime % 3600) / 60)}m`);
    el.append(box);
  }
}
