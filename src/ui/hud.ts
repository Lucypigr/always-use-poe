import { dist } from '../core/math';
import { CURRENCY_BY_ID } from '../data/currency';
import { getGem } from '../data/gems';
import { xpToNext } from '../data/scaling';
import { equippedGems, passivePointsUnspent, SKILL_KEYS } from '../game/character';
import type { VfxEvent } from '../game/entities';
import { NPC_BY_ID } from '../data/quests';
import { questGoal, questProgress, trackedQuests } from '../game/quests';
import { FLOOR, PROP } from '../game/tilemap';
import { currencyId, displayName, flaskProps } from '../items/item';
import { maxLinks } from '../items/generate';
import type { EquipSlot, Item } from '../items/types';
import { canLevelGem } from '../skills/gemUtil';
import { clear, fmt, h } from './dom';
import { itemIcon } from './icons';
import type { UI } from './ui';

interface FloatText {
  el: HTMLElement;
  x: number;
  y: number;
  t: number;
}

const GEM_BG: Record<string, string> = { R: 'linear-gradient(#b03030,#501010)', G: 'linear-gradient(#30a030,#105010)', B: 'linear-gradient(#3050c0,#102060)' };

function labelClass(it: Item): string {
  const cid = currencyId(it);
  if (cid) return `currency cur-t${CURRENCY_BY_ID[cid].tier}`;
  if (it.gem) return 'gem';
  if (it.map) return 'map';
  const cls: string[] = [it.rarity];
  if (maxLinks(it) >= 5 || it.sockets.length >= 6) cls.push('linked');
  return cls.join(' ');
}

function labelText(it: Item): string {
  const cid = currencyId(it);
  if (cid) return `${(it.stack ?? 1) > 1 ? `${it.stack}× ` : ''}${CURRENCY_BY_ID[cid].name}`;
  if (it.gem) return `${displayName(it)}${it.quality ? ` (${it.quality}%)` : ''}`;
  let s = displayName(it);
  if (!it.identified && it.rarity !== 'normal') s = `${s}`;
  const links = maxLinks(it);
  if (links >= 5) s += ` [${links}L]`;
  else if (it.sockets.length >= 6) s += ' [6S]';
  return s;
}

export class Hud {
  private el: HTMLElement;
  private lifeFill: HTMLElement;
  private lifeEs: HTMLElement;
  private lifeText: HTMLElement;
  private manaFill: HTMLElement;
  private manaReserved: HTMLElement;
  private manaText: HTMLElement;
  private xpFill: HTMLElement;
  private flaskEls: HTMLElement[] = [];
  private skillEls: HTMLElement[] = [];
  private areaName: HTMLElement;
  private areaSub: HTMLElement;
  private buffs: HTMLElement;
  private points: HTMLElement;
  private target: HTMLElement;
  private boss: HTMLElement;
  private minimap: HTMLCanvasElement;
  private overlay: HTMLCanvasElement;
  private logEl: HTMLElement;
  private labels: HTMLElement;
  private gemLevels: HTMLElement;
  private toastEl: HTMLElement;
  private questEl: HTMLElement;
  private labelMap = new Map<number, { el: HTMLElement; w: number; h: number }>();
  private hpMap = new Map<number, HTMLElement>();
  private texts: FloatText[] = [];
  private explored: HTMLCanvasElement = document.createElement('canvas');
  private exploredTimer = 0;
  private slowTimer = 0;
  private logLines: { el: HTMLElement; t: number }[] = [];
  showOverlay = false;
  showLabels = true;

  constructor(private ui: UI) {
    const root = ui.root;
    this.el = h('div', { class: 'hud' });
    root.append(this.el);
    this.labels = h('div', { class: 'labels' });
    this.overlay = h('canvas', { class: 'overlay-map' });
    this.el.append(this.labels, this.overlay);

    // Top left
    this.areaName = h('div', { class: 'area-name' });
    this.areaSub = h('div', { class: 'area-sub' });
    this.buffs = h('div', { class: 'buffs' });
    this.points = h('div', { class: 'passive-points', onclick: () => ui.togglePanel('passives') });
    this.el.append(h('div', { class: 'hud-top-left' }, this.areaName, this.areaSub, this.points, this.buffs));

    this.target = h('div', { class: 'target-frame' });
    this.boss = h('div', { class: 'boss-bar' });
    this.minimap = h('canvas', { class: 'minimap', width: '210', height: '210' });
    this.logEl = h('div', { class: 'log' });
    this.gemLevels = h('div', { class: 'gem-levels' });
    this.toastEl = h('div', { class: 'toast', style: 'opacity:0' });
    this.questEl = h('div', { class: 'quest-tracker', title: '任務日誌 (J)', onclick: () => ui.story.journal() });
    this.el.append(this.target, this.boss, this.minimap, this.questEl, this.logEl, this.gemLevels, this.toastEl);

    // Bottom bar
    const bottom = h('div', { class: 'hud-bottom' });
    this.lifeFill = h('div', { class: 'fill' });
    this.lifeEs = h('div', { class: 'es' });
    this.lifeText = h('div', { class: 'globe-text life' });
    this.manaFill = h('div', { class: 'fill' });
    this.manaReserved = h('div', { class: 'reserved' });
    this.manaText = h('div', { class: 'globe-text mana' });
    bottom.append(
      h('div', { class: 'globe life' }, this.lifeFill, this.lifeEs, h('div', { class: 'shine' })),
      this.lifeText,
      h('div', { class: 'globe mana' }, this.manaFill, this.manaReserved, h('div', { class: 'shine' })),
      this.manaText,
    );
    const flasks = h('div', { class: 'flasks' });
    for (let i = 0; i < 5; i++) {
      const f = h('div', { class: 'flask-slot', onclick: () => ui.game.drinkFlask(i) });
      f.addEventListener('mouseenter', () => {
        const it = ui.game.char.equipment[`flask${i + 1}` as EquipSlot];
        if (it && !ui.touch) ui.tooltip.show(it, ui.tctx, ui.alt);
      });
      f.addEventListener('mouseleave', () => ui.tooltip.hide());
      this.flaskEls.push(f);
      flasks.append(f);
    }
    const skills = h('div', { class: 'skills' });
    for (let i = 0; i < 8; i++) {
      const s = h('div', { class: 'skill-slot', onclick: () => {
        if (!ui.touch || ui.editSkills || (i > 0 && !ui.game.char.skillBar[i])) ui.modals.skillPicker(i);
      } });
      s.addEventListener('mouseenter', () => (!ui.touch || ui.editSkills) && this.skillTooltip(i));
      s.addEventListener('mouseleave', () => ui.tooltip.hide());
      this.skillEls.push(s);
      skills.append(s);
    }
    bottom.append(h('div', { class: 'bar-center' }, flasks, skills));
    this.xpFill = h('div', { class: 'fill' });
    const xp = h('div', { class: 'xp-bar interactive' }, this.xpFill);
    xp.addEventListener('mouseenter', () => {
      const c = ui.game.char;
      ui.tooltip.showCustom(h('div', { class: 'tooltip' }, h('div', { class: 'tt-sec' }, h('div', { class: 'tt-line desc' }, `等級 ${c.level}`), h('div', { class: 'tt-line prop' }, `經驗值：${fmt(c.xp)} / ${fmt(xpToNext(c.level))}`))));
    });
    xp.addEventListener('mouseleave', () => ui.tooltip.hide());
    bottom.append(xp);
    bottom.append(
      h('div', { class: 'menu-buttons' },
        h('button', { onclick: () => ui.togglePanel('character') }, '角色 (C)'),
        h('button', { onclick: () => ui.togglePanel('inventory') }, '背包 (I)'),
        h('button', { onclick: () => ui.togglePanel('passives') }, '天賦 (P)'),
        h('button', { onclick: () => ui.story.journal() }, '任務 (J)'),
        h('button', { onclick: () => ui.modals.options() }, '選單'),
      ),
    );
    this.el.append(bottom);
    this.refreshSkills();
    this.refreshFlasks();
    this.onArea();
    this.refreshQuests();
  }

  /** Quest tracker under the minimap. */
  refreshQuests(): void {
    const c = this.ui.game.char;
    clear(this.questEl);
    const list = trackedQuests(c, this.ui.touch ? 3 : 4);
    if (!list.length) {
      this.questEl.style.display = 'none';
      return;
    }
    this.questEl.style.display = '';
    for (const { q, st } of list) {
      const goal = questGoal(q);
      const task = st.s === 'ready' ? `回報${NPC_BY_ID[q.giver].name}` : `${q.task}${goal > 1 ? `（${Math.min(goal, questProgress(st))}/${goal}）` : ''}`;
      this.questEl.append(h('div', { class: `qt-row ${st.s}${q.main ? ' main' : ''}` }, h('div', { class: 'qt-name' }, q.name), h('div', { class: 'qt-task' }, task)));
    }
  }

  onArea(): void {
    const a = this.ui.game.area;
    this.areaName.textContent = a.name;
    this.areaSub.textContent = a.town ? '城鎮 · 安全區' : `區域等級 ${a.level}${a.resPenalty ? ` · 抗性懲罰 ${a.resPenalty}%` : ''}${a.quant ? ` · 物品數量 +${a.quant}%` : ''}`;
    this.clearDynamic();
    const map = a.map;
    this.explored.width = map.w;
    this.explored.height = map.h;
  }

  private clearDynamic(): void {
    clear(this.labels);
    this.labelMap.clear();
    this.hpMap.clear();
    this.texts = [];
  }

  log(text: string, color = '#c8c0b0'): void {
    const el = h('div', { style: `color:${color}` }, text);
    this.logEl.append(el);
    this.logLines.push({ el, t: 0 });
    while (this.logLines.length > 8) this.logLines.shift()!.el.remove();
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    setTimeout(() => (this.toastEl.style.opacity = '0'), 1800);
  }

  addText(e: Extract<VfxEvent, { type: 'text' }>): void {
    if (this.texts.length > 60) return;
    const el = h('div', { class: `ftext${e.big ? ' big' : ''}`, style: `color:${e.color}` }, e.text);
    this.labels.append(el);
    this.texts.push({ el, x: e.pos.x + (Math.random() - 0.5) * 0.6, y: e.pos.y, t: 0 });
  }

  refreshSkills(): void {
    const g = this.ui.game;
    const p = g.player;
    this.skillEls.forEach((el, i) => {
      clear(el);
      const uid = g.skillSlotUid(i);
      el.append(h('div', { class: 'key' }, SKILL_KEYS[i]));
      el.className = 'skill-slot';
      if (!uid) return;
      const sk = p.skills.get(uid);
      if (!sk) return;
      const st = p.skillStats.get(uid);
      const abbrev = sk.gem.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
      el.append(h('div', { class: 'skill-icon', style: `background:${GEM_BG[sk.gem.color]}` }, abbrev));
      if (st && (st.manaCost || st.lifeCost)) el.append(h('div', { class: 'cost' }, String(st.manaCost || st.lifeCost)));
      if (!sk.usable) el.classList.add('unusable');
      if (g.char.activeAuras.includes(uid)) el.classList.add('aura-on');
    });
  }

  private skillTooltip(i: number): void {
    const g = this.ui.game;
    const uid = g.skillSlotUid(i);
    const box = h('div', { class: 'tooltip' });
    if (!uid) {
      box.append(h('div', { class: 'tt-sec' }, h('div', { class: 'tt-line hint' }, '空的技能欄位 — 點擊以指定技能。')));
      this.ui.tooltip.showCustom(box);
      return;
    }
    const sk = g.player.skills.get(uid);
    const st = g.player.skillStats.get(uid);
    if (!sk || !st) return;
    box.append(h('div', { class: 'tt-head gem' }, `${sk.gem.name}${sk.item ? `（等級 ${sk.level}）` : ''}`));
    const lines = h('div', { class: 'tt-sec' });
    const add = (t: string, cls = 'prop') => lines.append(h('div', { class: `tt-line ${cls}` }, t));
    if (!sk.usable) add(sk.reason ?? '無法使用', 'reqfail');
    if (st.reservation) add(`保留 ${st.reservation}% 魔力`);
    else if (st.manaCost || st.lifeCost) add(`消耗：${st.manaCost || st.lifeCost} ${st.lifeCost ? '生命' : '魔力'}`);
    const dmg = (['phys', 'fire', 'cold', 'lightning', 'chaos'] as const).filter((t) => st.damage[t][1] > 0);
    for (const t of dmg) add(`${({ phys: '物理', fire: '火焰', cold: '冰冷', lightning: '閃電', chaos: '混沌' } as const)[t]}傷害：${fmt(st.damage[t][0])}–${fmt(st.damage[t][1])}`, t === 'phys' ? 'desc' : t);
    if (dmg.length) {
      add(`平均傷害：${fmt(st.averageHit, 1)}`, 'desc');
      add(`${st.isAttack ? '攻擊' : '施放'}每秒次數：${fmt(st.usesPerSecond * st.hitsPerUse, 2)}`, 'desc');
      add(`暴擊率：${fmt(st.critChance, 2)}%`, 'desc');
      add(`估計 DPS：${fmt(st.dps, 1)}`, 'aug');
    }
    if (sk.gem.tags.includes('projectile')) add(`投射物：${st.projectiles}${st.pierce ? ` · 穿透 ${st.pierce}` : ''}${st.chain ? ` · 連鎖 ${st.chain}` : ''}${st.fork ? ' · 分裂' : ''}`);
    box.append(lines);
    if (sk.supports.length) {
      const sup = h('div', { class: 'tt-sec' });
      sup.append(h('div', { class: 'tt-line prop' }, '輔助寶石：'));
      for (const s of sk.supports) sup.append(h('div', { class: 'tt-line mod' }, `${s.def.name}（等級 ${s.level}）`));
      box.append(sup);
    }
    box.append(h('div', { class: 'tt-sec' }, h('div', { class: 'tt-line hint' }, '點擊以更換此欄位的技能。')));
    this.ui.tooltip.showCustom(box);
  }

  refreshFlasks(): void {
    const g = this.ui.game;
    this.flaskEls.forEach((el, i) => {
      clear(el);
      const it = g.char.equipment[`flask${i + 1}` as EquipSlot];
      if (it) el.append(h('img', { src: itemIcon(it) }));
      el.append(h('div', { class: 'key' }, String(i + 1)));
      el.append(h('div', { class: 'dur', style: 'height:0' }));
    });
  }

  update(dt: number): void {
    const ui = this.ui;
    const g = ui.game;
    const p = g.player;
    const s = p.stats;
    // globes
    const lifeMax = Math.max(1, p.maxLifeUsable);
    this.lifeFill.style.height = `${Math.max(0, Math.min(100, (p.life / s.maxLife) * 100))}%`;
    this.lifeEs.style.opacity = s.maxES > 0 ? String(Math.min(1, p.es / s.maxES)) : '0';
    this.lifeText.innerHTML = `${Math.ceil(p.life)} / ${lifeMax}${s.maxES ? `<span class="es-text">ES ${Math.ceil(p.es)} / ${s.maxES}</span>` : ''}`;
    const maxMana = Math.max(1, s.maxMana);
    this.manaFill.style.height = `${Math.max(0, Math.min(100, (p.mana / maxMana) * 100))}%`;
    this.manaReserved.style.height = `${(p.reserved / maxMana) * 100}%`;
    this.manaText.textContent = s.maxMana ? `${Math.floor(p.mana)} / ${p.unreservedMana}${p.reserved ? `（保留 ${p.reserved}）` : ''}` : '血之契約';
    this.xpFill.style.width = `${Math.min(100, (g.char.xp / xpToNext(g.char.level)) * 100)}%`;

    // flask durations / active glow
    this.flaskEls.forEach((el, i) => {
      const it = g.char.equipment[`flask${i + 1}` as EquipSlot];
      const buff = it ? p.buffs.find((b) => b.id === `flask:${it.uid}`) : undefined;
      el.classList.toggle('active', !!buff);
      const dur = el.querySelector('.dur') as HTMLElement | null;
      if (dur && it) {
        const fp = flaskProps(it);
        dur.style.height = buff && fp ? `${Math.min(100, (buff.time / Math.max(0.1, fp.duration || 3)) * 100)}%` : '0';
      }
    });

    this.slowTimer -= dt;
    if (this.slowTimer <= 0) {
      this.slowTimer = 0.25;
      this.slowUpdate();
    }

    // log fade
    for (const l of this.logLines) {
      l.t += dt;
      if (l.t > 9) l.el.style.opacity = '0';
    }

    this.updateTarget();
    this.updateLabels();
    this.updateHpBars();
    this.updateTexts(dt);
    this.exploredTimer -= dt;
    if (this.exploredTimer <= 0) {
      this.exploredTimer = 0.3;
      this.drawExplored();
    }
    this.drawMinimap();
    if (this.showOverlay) this.drawOverlay();
  }

  private slowUpdate(): void {
    const g = this.ui.game;
    const p = g.player;
    // passive points
    const pts = passivePointsUnspent(g.char);
    this.points.style.display = pts > 0 ? '' : 'none';
    this.points.textContent = `+${pts} 天賦點數`;
    // buffs & debuffs
    clear(this.buffs);
    for (const uid of g.char.activeAuras) {
      const sk = p.skills.get(uid);
      if (sk) this.buffs.append(h('span', { class: 'buff' }, sk.gem.name));
    }
    for (const b of p.buffs) {
      if (!b.id.startsWith('flask:')) continue;
      const it = Object.values(g.char.equipment).find((x) => x && `flask:${x.uid}` === b.id);
      if (it) this.buffs.append(h('span', { class: 'buff' }, `${displayName(it)} ${b.time.toFixed(1)}s`));
    }
    const a = p.ailments;
    if (a.ignite) this.buffs.append(h('span', { class: 'buff debuff' }, '點燃'));
    if (a.chill) this.buffs.append(h('span', { class: 'buff debuff' }, '冰緩'));
    if (a.freeze) this.buffs.append(h('span', { class: 'buff debuff' }, '冰凍'));
    if (a.shock) this.buffs.append(h('span', { class: 'buff debuff' }, '感電'));
    if (a.poison.length) this.buffs.append(h('span', { class: 'buff debuff' }, `中毒 ×${a.poison.length}`));
    if (a.bleed) this.buffs.append(h('span', { class: 'buff debuff' }, '流血'));
    // skill bar: mana availability
    this.skillEls.forEach((el, i) => {
      const uid = g.skillSlotUid(i);
      const st = uid ? p.skillStats.get(uid) : undefined;
      el.classList.toggle('nomana', !!st && st.manaCost > p.mana);
    });
    // gem level ups
    clear(this.gemLevels);
    for (const { gem } of equippedGems(g.char)) {
      if (!canLevelGem(gem, g.char.level)) continue;
      const btn = h('div', { class: 'gl', onclick: () => g.levelUpGem(gem) }, `▲ ${getGem(gem.gem!.id).name} → ${gem.gem!.level + 1}`);
      this.gemLevels.append(btn);
    }
  }

  private updateTarget(): void {
    const g = this.ui.game;
    const m = g.input.hoverMonster && !g.input.hoverMonster.dead ? g.input.hoverMonster : null;
    const boss = g.area.monsters.find((x) => x.id === g.area.bossId && !x.dead && x.aggro);
    if (boss) {
      this.boss.style.display = '';
      this.boss.innerHTML = `<div class="name">${boss.name}</div><div class="hp"><div class="fill" style="width:${(boss.life / boss.stats.maxLife) * 100}%"></div></div>`;
    } else this.boss.style.display = 'none';
    if (!m || (boss && m === boss)) {
      this.target.style.display = 'none';
      return;
    }
    this.target.style.display = '';
    const cls = m.def.boss ? 'unique' : m.rarity;
    const mods = m.mods.map((x) => x.name).join(', ');
    this.target.innerHTML = `<div class="name ${cls}">${m.name}</div>${mods ? `<div class="mods">${mods}</div>` : ''}<div class="hp"><div class="fill" style="width:${(m.life / m.stats.maxLife) * 100}%"></div><div class="txt">等級 ${m.level}</div></div>`;
  }

  private updateLabels(): void {
    const g = this.ui.game;
    const r = this.ui.renderer;
    const p = g.player;
    const seen = new Set<number>();
    const want: { id: number; x: number; y: number; entry: { el: HTMLElement; w: number; h: number } }[] = [];
    const showItems = this.showLabels || this.ui.alt;
    if (showItems) {
      for (const gi of g.area.groundItems) {
        if (dist(gi.pos, p.pos) > 26) continue;
        const it = gi.item;
        if (g.settings.hideNormalItems && it.rarity === 'normal' && !it.gem && !currencyId(it) && !it.map && it.sockets.length < 6 && !this.ui.alt) continue;
        const pr = r.project(gi.pos, 0.35);
        if (!pr.visible) continue;
        seen.add(gi.id);
        let entry = this.labelMap.get(gi.id);
        if (!entry) {
          const el = h('div', { class: `label ${labelClass(it)}` }, labelText(it));
          el.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (e.button === 0) g.clickGroundItem(gi);
          });
          el.addEventListener('mouseenter', () => this.ui.showItemTooltip(it, null));
          el.addEventListener('mouseleave', () => this.ui.tooltip.hide());
          this.labels.append(el);
          entry = { el, w: 0, h: 0 };
          this.labelMap.set(gi.id, entry);
        }
        want.push({ id: gi.id, x: pr.x, y: pr.y, entry });
      }
    }
    for (const it of g.area.interactables) {
      const pr = r.project(it.pos, it.kind === 'vendor' || it.kind === 'npc' ? 3 : 2.4);
      if (!pr.visible || dist(it.pos, p.pos) > 30) continue;
      const id = -it.id;
      seen.add(id);
      let entry = this.labelMap.get(id);
      if (!entry) {
        const el = h('div', { class: `label interact${it.kind === 'quest' ? ' quest-obj' : ''}` }, it.label);
        el.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          if (e.button === 0) g.clickInteractable(it);
        });
        this.labels.append(el);
        entry = { el, w: 0, h: 0 };
        this.labelMap.set(id, entry);
      }
      if (entry.el.textContent !== it.label) {
        // NPC quest markers (！/？) change as quests progress
        entry.el.textContent = it.label;
        entry.w = 0;
      }
      entry.el.classList.toggle('quest-mark', it.kind === 'npc' && /^[！？]/.test(it.label));
      want.push({ id, x: pr.x, y: pr.y, entry });
    }
    for (const [id, e] of this.labelMap) {
      if (!seen.has(id)) {
        e.el.remove();
        this.labelMap.delete(id);
      }
    }
    // measure (batched), then resolve overlaps greedily top-to-bottom
    for (const w of want) {
      if (!w.entry.w) {
        w.entry.w = w.entry.el.offsetWidth;
        w.entry.h = w.entry.el.offsetHeight;
      }
    }
    want.sort((a, b) => a.y - b.y);
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const w of want) {
      let y = w.y;
      const x0 = w.x - w.entry.w / 2;
      const x1 = w.x + w.entry.w / 2;
      for (let iter = 0; iter < 20; iter++) {
        const hit = placed.find((q) => x0 < q.x1 && x1 > q.x0 && y - w.entry.h < q.y1 && y > q.y0);
        if (!hit) break;
        y = hit.y1 + w.entry.h + 1;
      }
      placed.push({ x0, x1, y0: y - w.entry.h, y1: y });
      w.entry.el.style.left = `${w.x}px`;
      w.entry.el.style.top = `${y}px`;
    }
  }

  private updateHpBars(): void {
    const g = this.ui.game;
    const r = this.ui.renderer;
    const seen = new Set<number>();
    for (const m of g.area.monsters) {
      if (m.dead || m.id === g.area.bossId) continue;
      const show = m.isMinion || m.rarity !== 'normal' || m.life < m.stats.maxLife;
      if (!show || dist(m.pos, g.player.pos) > 24) continue;
      const pr = r.project(m.pos, 2.6 * m.def.scale);
      if (!pr.visible) continue;
      seen.add(m.id);
      let el = this.hpMap.get(m.id);
      if (!el) {
        el = h('div', { class: `hpbar ${m.isMinion ? 'minion' : m.rarity}` }, h('div', { class: 'fill' }));
        this.labels.append(el);
        this.hpMap.set(m.id, el);
      }
      el.style.left = `${pr.x}px`;
      el.style.top = `${pr.y}px`;
      (el.firstChild as HTMLElement).style.width = `${(m.life / m.stats.maxLife) * 100}%`;
    }
    for (const [id, el] of this.hpMap) {
      if (!seen.has(id)) {
        el.remove();
        this.hpMap.delete(id);
      }
    }
  }

  private updateTexts(dt: number): void {
    const r = this.ui.renderer;
    for (const t of this.texts) {
      t.t += dt;
      const pr = r.project({ x: t.x, y: t.y }, 2 + t.t * 1.6);
      t.el.style.left = `${pr.x}px`;
      t.el.style.top = `${pr.y}px`;
      t.el.style.opacity = String(Math.max(0, 1 - Math.max(0, t.t - 0.5) / 0.4));
    }
    const dead = this.texts.filter((t) => t.t > 0.9);
    for (const t of dead) t.el.remove();
    if (dead.length) this.texts = this.texts.filter((t) => t.t <= 0.9);
  }

  // ------------------------------------------------------------------------------------------
  // Minimap
  // ------------------------------------------------------------------------------------------

  private drawExplored(): void {
    const map = this.ui.game.area.map;
    const c = this.explored;
    if (c.width !== map.w || c.height !== map.h) {
      c.width = map.w;
      c.height = map.h;
    }
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(map.w, map.h);
    const d = img.data;
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const i = y * map.w + x;
        const t = map.tiles[i];
        let explored = map.explored[i] === 1;
        if (!explored && t !== FLOOR) {
          // walls become visible when an adjacent floor is explored
          for (let dy = -1; dy <= 1 && !explored; dy++) for (let dx = -1; dx <= 1 && !explored; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < map.w && ny < map.h && map.explored[ny * map.w + nx] && map.tiles[ny * map.w + nx] === FLOOR) explored = true;
          }
        }
        if (!explored) continue;
        const o = i * 4;
        if (t === FLOOR) {
          d[o] = 90; d[o + 1] = 80; d[o + 2] = 64; d[o + 3] = 150;
        } else if (t === PROP) {
          d[o] = 120; d[o + 1] = 110; d[o + 2] = 90; d[o + 3] = 200;
        } else {
          d[o] = 200; d[o + 1] = 185; d[o + 2] = 140; d[o + 3] = 230;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private drawMarkers(ctx: CanvasRenderingContext2D, ox: number, oy: number, scale: number, big: boolean): void {
    const g = this.ui.game;
    const map = g.area.map;
    const toX = (x: number) => ox + x * scale;
    const toY = (y: number) => oy + y * scale;
    for (const it of g.area.interactables) {
      if (!map.explored[Math.floor(it.pos.y) * map.w + Math.floor(it.pos.x)] && !g.area.town) continue;
      ctx.fillStyle = it.kind === 'map_device' ? '#c080ff' : it.kind === 'stash' ? '#e0c080' : it.kind === 'vendor' ? '#80ff80' : it.kind === 'quest' || (it.kind === 'npc' && /^[！？]/.test(it.label)) ? '#ffd040' : it.kind === 'npc' ? '#d8d0b0' : '#60b0ff';
      ctx.beginPath();
      ctx.arc(toX(it.pos.x), toY(it.pos.y), big ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const m of g.area.monsters) {
      if (m.dead || dist(m.pos, g.player.pos) > 18) continue;
      ctx.fillStyle = m.isMinion ? '#40d040' : m.def.boss ? '#ff8030' : m.rarity === 'rare' ? '#ffe040' : m.rarity === 'magic' ? '#6070ff' : '#e03030';
      const r = m.def.boss ? 4 : m.rarity !== 'normal' ? 2.5 : 1.8;
      ctx.fillRect(toX(m.pos.x) - r, toY(m.pos.y) - r, r * 2, r * 2);
    }
    for (const gi of g.area.groundItems) {
      const beam = gi.item.rarity === 'unique' || (currencyId(gi.item) && CURRENCY_BY_ID[currencyId(gi.item)!].tier >= 2);
      if (!beam) continue;
      ctx.fillStyle = gi.item.rarity === 'unique' ? '#ff8a30' : '#ffe0a0';
      ctx.fillRect(toX(gi.pos.x) - 2, toY(gi.pos.y) - 2, 4, 4);
    }
    const p = g.player;
    ctx.save();
    ctx.translate(toX(p.pos.x), toY(p.pos.y));
    ctx.rotate(p.facing);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(big ? 8 : 5, 0);
    ctx.lineTo(big ? -5 : -3, big ? -5 : -3.5);
    ctx.lineTo(big ? -5 : -3, big ? 5 : 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawMinimap(): void {
    const c = this.minimap;
    const ctx = c.getContext('2d')!;
    const g = this.ui.game;
    const scale = 3;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    const ox = c.width / 2 - g.player.pos.x * scale;
    const oy = c.height / 2 - g.player.pos.y * scale;
    ctx.drawImage(this.explored, ox, oy, this.explored.width * scale, this.explored.height * scale);
    this.drawMarkers(ctx, ox, oy, scale, false);
  }

  private drawOverlay(): void {
    const c = this.overlay;
    if (c.width !== window.innerWidth || c.height !== window.innerHeight) {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    }
    const ctx = c.getContext('2d')!;
    const g = this.ui.game;
    const scale = 7;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    const ox = c.width / 2 - g.player.pos.x * scale;
    const oy = c.height / 2 - g.player.pos.y * scale;
    ctx.globalAlpha = 0.75;
    ctx.drawImage(this.explored, ox, oy, this.explored.width * scale, this.explored.height * scale);
    ctx.globalAlpha = 1;
    this.drawMarkers(ctx, ox, oy, scale, true);
  }

  toggleOverlay(): void {
    this.showOverlay = !this.showOverlay;
    if (!this.showOverlay) this.overlay.getContext('2d')!.clearRect(0, 0, this.overlay.width, this.overlay.height);
  }
}
