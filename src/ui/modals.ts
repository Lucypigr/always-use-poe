import { AREAS } from '../data/areas';
import { CURRENCY } from '../data/currency';
import { SKILL_KEYS } from '../game/character';
import { addItem } from '../items/grid';
import { buildTooltip } from '../items/tooltip';
import { h } from './dom';
import { itemEl, tooltipEl } from './itemView';
import type { UI } from './ui';

export class Modals {
  private back: HTMLElement | null = null;
  private kind = '';

  constructor(private ui: UI) {}

  get isOpen(): boolean {
    return !!this.back;
  }

  get isDeviceOpen(): boolean {
    return this.kind === 'device';
  }

  close(): void {
    if (this.kind === 'device') {
      const m = this.ui.takeDeviceMap();
      if (m) {
        if (!addItem(this.ui.game.char.inventory, m)) this.ui.game.dropItem(m, this.ui.game.player.pos);
        this.ui.refreshItems();
      }
    }
    this.back?.remove();
    this.back = null;
    this.kind = '';
  }

  private show(kind: string, content: HTMLElement, dismissable = true, overlayOnly = false): void {
    this.back?.remove();
    this.kind = kind;
    const back = h('div', { class: 'modal-back', style: overlayOnly ? 'background:transparent;pointer-events:none' : '' });
    const modal = h('div', { class: 'modal', style: overlayOnly ? 'pointer-events:auto' : '' }, content);
    back.append(modal);
    if (dismissable) back.addEventListener('mousedown', (e) => e.target === back && this.close());
    this.ui.root.append(back);
    this.back = back;
  }

  waypoint(): void {
    const g = this.ui.game;
    const list = h('div', { class: 'area-list' });
    let act = 0;
    for (const a of AREAS) {
      if (a.act !== act) {
        act = a.act;
        list.append(h('div', { class: 'act-title' }, `Act ${act}`));
      }
      const unlocked = g.char.unlockedAreas.includes(a.id);
      const done = g.char.completedAreas.includes(a.id);
      const row = h('div', { class: `area-row${unlocked ? '' : ' locked'}` },
        h('div', {}, h('div', {}, unlocked ? a.name : '???'), unlocked ? h('div', { class: 'lvl' }, a.description) : null),
        h('div', {}, h('span', { class: 'lvl' }, `Level ${a.level}`), done ? h('span', { class: 'done' }, '✔ Boss slain') : null),
      );
      if (unlocked) row.addEventListener('click', () => {
        this.close();
        g.travelToArea(a.id);
      });
      list.append(row);
    }
    this.show('waypoint', h('div', {}, h('h2', {}, 'Waypoint'), list, h('div', { class: 'row-buttons' }, h('button', { onclick: () => this.close() }, 'Close'))));
  }

  mapDevice(): void {
    const ui = this.ui;
    const g = ui.game;
    ui.openPanel('inventory');
    const box = h('div', { style: 'min-width:420px' }, h('h2', {}, 'Map Device'));
    const slot = h('div', { class: 'equip-slot', style: 'position:relative;width:92px;height:92px;margin:0 auto;cursor:pointer' });
    const map = ui.deviceMap;
    if (map) {
      slot.append(itemEl(map, 92));
      box.append(slot);
      box.append(tooltipEl(buildTooltip(map, ui.tctx), ui.alt));
    } else {
      slot.append(h('div', { class: 'slot-label' }, 'Map'));
      box.append(slot);
      const hasCompleted = g.char.completedAreas.includes('throne');
      box.append(h('p', { class: 'muted', style: 'text-align:center' }, 'Right-click a Map in your inventory, or click the slot while holding one.'));
      if (!hasCompleted) box.append(h('p', { class: 'muted', style: 'text-align:center' }, 'Maps drop from monsters in areas of level 36 and above. Defeat the Forsaken King to master them.'));
    }
    slot.addEventListener('mousedown', () => {
      if (ui.cursor?.item.map) {
        const prev = ui.deviceMap;
        ui.deviceMap = ui.cursor.item;
        ui.cursor = prev ? { item: prev, from: null } : null;
        ui.refreshItems();
        this.mapDevice();
      } else if (!ui.cursor && ui.deviceMap) {
        ui.cursor = { item: ui.deviceMap, from: null };
        ui.deviceMap = null;
        ui.refreshItems();
        this.mapDevice();
      }
    });
    box.append(
      h('div', { class: 'row-buttons' },
        h('button', {
          disabled: !map,
          onclick: () => {
            const m = ui.takeDeviceMap();
            this.back?.remove();
            this.back = null;
            this.kind = '';
            ui.closeAll();
            if (m) g.openMap(m);
          },
        }, 'Activate'),
        h('button', { onclick: () => this.close() }, 'Close'),
      ),
    );
    this.show('device', box, true, true);
    if (this.back) {
      const modal = this.back.firstChild as HTMLElement;
      modal.style.position = 'absolute';
      modal.style.left = '16px';
      modal.style.top = '16px';
      this.back.style.display = 'block';
    }
  }

  death(): void {
    const g = this.ui.game;
    if (!g.player.dead) return;
    this.show('death', h('div', { class: 'death' },
      h('h1', {}, 'You have died'),
      h('p', { class: 'muted' }, g.area.level >= 28 ? 'You will lose some experience.' : 'Your journey continues in town.'),
      h('div', { class: 'row-buttons' }, h('button', { onclick: () => {
        this.close();
        g.respawn();
      } }, 'Resurrect in Town')),
    ), false);
  }

  options(): void {
    const g = this.ui.game;
    const st = g.settings;
    const toggle = (label: string, key: 'showDamageNumbers' | 'alwaysShowLabels' | 'hideNormalItems') => {
      const cb = h('input', { type: 'checkbox' }) as HTMLInputElement;
      cb.checked = st[key];
      cb.addEventListener('change', () => {
        st[key] = cb.checked;
        if (key === 'alwaysShowLabels') this.ui.hud.showLabels = cb.checked;
        g.save();
      });
      return h('label', { style: 'display:block;margin:6px 0;cursor:pointer' }, cb, ` ${label}`);
    };
    const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', style: 'width:160px;vertical-align:middle' }) as HTMLInputElement;
    vol.value = String(st.volume);
    vol.addEventListener('input', () => {
      st.volume = Number(vol.value);
    });
    vol.addEventListener('change', () => g.save());
    this.show('options', h('div', { style: 'min-width:340px' },
      h('h2', {}, 'Menu'),
      h('label', { style: 'display:block;margin:6px 0' }, 'Sound volume ', vol),
      toggle('Show damage numbers', 'showDamageNumbers'),
      toggle('Always show item labels (Z toggles)', 'alwaysShowLabels'),
      toggle('Hide labels of plain white items', 'hideNormalItems'),
      h('div', { class: 'row-buttons' },
        h('button', { onclick: () => this.close() }, 'Resume'),
        h('button', { onclick: () => this.help() }, 'Controls & Guide'),
      ),
      h('div', { class: 'row-buttons' }, h('button', { onclick: () => {
        this.close();
        this.ui.onExit();
      } }, 'Save & Exit to Character Select')),
    ));
  }

  help(): void {
    const k = (s: string) => h('kbd', {}, s);
    const tr = (a: (Node | string)[], b: string) => h('tr', {}, h('td', {}, ...a), h('td', {}, b));
    const currencyRows = CURRENCY.map((c) => h('tr', {}, h('td', { style: 'color:#aa9e82' }, c.name), h('td', {}, c.description)));
    this.show('help', h('div', { class: 'help' },
      h('h2', {}, 'Controls & Guide'),
      h('table', {},
        tr([k('LMB')], 'Move / attack the monster under the cursor / pick up items / use objects'),
        tr([k('Shift'), '+', k('LMB')], 'Attack in place without moving'),
        tr([k('RMB'), ' ', k('Q'), k('W'), k('E'), k('R'), k('T'), ' ', k('MMB')], 'Skill slots (hold to repeat). Click a slot on the skill bar to change it.'),
        tr([k('1'), '–', k('5')], 'Drink flasks'),
        tr([k('I'), ' ', k('C'), ' ', k('P')], 'Inventory, Character sheet, Passive tree'),
        tr([k('Tab')], 'Toggle the overlay map'),
        tr([k('Z')], 'Toggle item labels · hold Alt to show them and advanced mod tiers'),
        tr([k('Esc')], 'Close panels / menu'),
        tr([k('Wheel')], 'Zoom the camera'),
      ),
      h('h3', { style: 'color:#c8aa6e' }, 'Items & crafting'),
      h('p', {}, 'Items drop Normal, Magic (1 prefix + 1 suffix), Rare (up to 3 prefixes + 3 suffixes) or Unique. Higher item levels can roll higher mod tiers. Magic and rare drops are unidentified — right-click a Scroll of Insight and click the item. Currency orbs are applied the same way; hold Shift to keep applying.'),
      h('table', {}, ...currencyRows),
      h('h3', { style: 'color:#c8aa6e' }, 'Gems & sockets'),
      h('p', {}, 'Active skill gems grant skills when placed in a socket of the matching colour (white sockets accept anything). Support gems modify every active gem in sockets linked to them. Gems gain experience and show a level-up button on the right when ready. Right-click a socketed gem to take it out.'),
      h('h3', { style: 'color:#c8aa6e' }, 'Progression'),
      h('p', {}, 'Each area boss rewards a passive point the first time and unlocks the next area. Resistances suffer a penalty in later acts (-20%, -40%, then -60% in the endgame) — keep them capped at 75%. After the Throne of the Forsaken, use Maps in the Map Device: their modifiers make monsters tougher but raise item quantity and rarity.'),
      h('div', { class: 'row-buttons' }, h('button', { onclick: () => this.close() }, 'Close')),
    ));
  }

  skillPicker(slot: number): void {
    const g = this.ui.game;
    const p = g.player;
    const list = h('div', { class: 'skill-pick' });
    const assign = (uid: string | null) => {
      g.char.skillBar[slot] = uid;
      this.close();
      this.ui.hud.refreshSkills();
    };
    for (const [uid, sk] of p.skills) {
      if (!sk.gem.active) continue;
      const aura = sk.gem.active.behaviour === 'aura';
      const opt = h('div', { class: 'opt' },
        h('span', {}, `${sk.gem.name}${sk.item ? ` (Lv ${sk.level})` : ''}${aura ? ' — Aura (toggle)' : ''}`),
        sk.usable ? h('span', { class: 'muted' }, sk.supports.length ? `${sk.supports.length} support${sk.supports.length > 1 ? 's' : ''}` : '') : h('span', { class: 'why' }, sk.reason ?? ''),
      );
      opt.addEventListener('click', () => assign(uid));
      list.append(opt);
    }
    const clearOpt = h('div', { class: 'opt' }, h('span', { class: 'muted' }, slot === 0 ? 'Reset to Default Attack' : 'Clear slot'));
    clearOpt.addEventListener('click', () => assign(null));
    list.append(clearOpt);
    this.show('skills', h('div', {}, h('h2', {}, `Skill for ${SKILL_KEYS[slot]}`), list));
  }
}
