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
        list.append(h('div', { class: 'act-title' }, `第 ${act} 章`));
      }
      const unlocked = g.char.unlockedAreas.includes(a.id);
      const done = g.char.completedAreas.includes(a.id);
      const row = h('div', { class: `area-row${unlocked ? '' : ' locked'}` },
        h('div', {}, h('div', {}, unlocked ? a.name : '???'), unlocked ? h('div', { class: 'lvl' }, a.description) : null),
        h('div', {}, h('span', { class: 'lvl' }, `等級 ${a.level}`), done ? h('span', { class: 'done' }, '✔ 已擊敗首領') : null),
      );
      if (unlocked) row.addEventListener('click', () => {
        this.close();
        g.travelToArea(a.id);
      });
      list.append(row);
    }
    this.show('waypoint', h('div', {}, h('h2', {}, '傳送點'), list, h('div', { class: 'row-buttons' }, h('button', { onclick: () => this.close() }, '關閉'))));
  }

  mapDevice(): void {
    const ui = this.ui;
    const g = ui.game;
    ui.openPanel('inventory');
    const box = h('div', { style: 'min-width:420px' }, h('h2', {}, '地圖裝置'));
    const slot = h('div', { class: 'equip-slot', style: 'position:relative;width:92px;height:92px;margin:0 auto;cursor:pointer' });
    const map = ui.deviceMap;
    if (map) {
      slot.append(itemEl(map, 92));
      box.append(slot);
      box.append(tooltipEl(buildTooltip(map, ui.tctx), ui.alt));
    } else {
      slot.append(h('div', { class: 'slot-label' }, '地圖'));
      box.append(slot);
      const hasCompleted = g.char.completedAreas.includes('throne');
      box.append(h('p', { class: 'muted', style: 'text-align:center' }, '對背包中的地圖按右鍵，或拿著地圖點擊此欄位。'));
      if (!hasCompleted) box.append(h('p', { class: 'muted', style: 'text-align:center' }, '地圖會從等級 36 以上區域的怪物身上掉落。擊敗被遺棄之王以精通地圖。'));
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
        }, '啟動'),
        h('button', { onclick: () => this.close() }, '關閉'),
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
      h('h1', {}, '你已死亡'),
      h('p', { class: 'muted' }, g.area.level >= 28 ? '你將失去部分經驗值。' : '你的旅程將在城鎮繼續。'),
      h('div', { class: 'row-buttons' }, h('button', { onclick: () => {
        this.close();
        g.respawn();
      } }, '在城鎮復活')),
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
      h('h2', {}, '選單'),
      h('label', { style: 'display:block;margin:6px 0' }, '音量 ', vol),
      toggle('顯示傷害數字', 'showDamageNumbers'),
      toggle('總是顯示物品標籤（Z 切換）', 'alwaysShowLabels'),
      toggle('隱藏普通白色物品的標籤', 'hideNormalItems'),
      h('div', { class: 'row-buttons' },
        h('button', { onclick: () => this.close() }, '繼續'),
        h('button', { onclick: () => this.help() }, '操作與指南'),
      ),
      h('div', { class: 'row-buttons' }, h('button', { onclick: () => {
        this.close();
        this.ui.onExit();
      } }, '儲存並返回角色選擇')),
    ));
  }

  help(): void {
    const k = (s: string) => h('kbd', {}, s);
    const tr = (a: (Node | string)[], b: string) => h('tr', {}, h('td', {}, ...a), h('td', {}, b));
    const currencyRows = CURRENCY.map((c) => h('tr', {}, h('td', { style: 'color:#aa9e82' }, c.name), h('td', {}, c.description)));
    this.show('help', h('div', { class: 'help' },
      h('h2', {}, '操作與指南'),
      this.ui.touch
        ? h('table', {},
            tr(['左下拖曳'], '虛擬搖桿：移動角色'),
            tr(['點擊畫面'], '移動到該處 / 攻擊怪物；點擊物品標籤撿取；雙指縮放鏡頭'),
            tr(['右下技能鍵'], '按住施放技能，會自動瞄準最近的敵人。按「編輯技能」後點擊欄位可更換技能'),
            tr(['藥劑'], '點擊下方藥劑欄飲用'),
            tr(['背包工具列'], '開啟背包時，下方可切換「拿取 / 使用 / 快速移動 / 查看」，取代滑鼠右鍵與 Ctrl+點擊'),
            tr(['天賦樹'], '拖曳平移、雙指縮放；點擊天賦查看，再點一次配置（已配置的再點一次為重置）'),
            tr(['回城'], '使用傳送卷軸開啟回城傳送門'),
          )
        : h('table', {},
        tr([k('LMB')], '移動 / 攻擊游標下的怪物 / 撿取物品 / 使用物件'),
        tr([k('Shift'), '+', k('LMB')], '原地攻擊不移動'),
        tr([k('RMB'), ' ', k('Q'), k('W'), k('E'), k('R'), k('T'), ' ', k('MMB')], '技能欄位（按住可連續施放）。點擊技能列上的欄位可更換技能。'),
        tr([k('1'), '–', k('5')], '飲用藥劑'),
        tr([k('I'), ' ', k('C'), ' ', k('P')], '背包、角色資訊、天賦樹'),
        tr([k('Tab')], '切換覆蓋地圖'),
        tr([k('Z')], '切換物品標籤 · 按住 Alt 顯示標籤與詞綴階級'),
        tr([k('Esc')], '關閉面板 / 選單'),
        tr([k('滾輪')], '縮放鏡頭'),
        ),
      h('h3', { style: 'color:#c8aa6e' }, '物品與工藝'),
      h('p', {}, '物品會以普通、魔法（1 前綴 + 1 後綴）、稀有（最多 3 前綴 + 3 後綴）或傳奇掉落。物品等級越高，可擰出的詞綴階級越高。魔法與稀有掉落物未鑑定 — 對洞察卷軸按右鍵（手機：切換「使用」模式後點擊）再點擊物品。通貨的使用方式相同；按住 Shift 可連續使用。'),
      h('table', {}, ...currencyRows),
      h('h3', { style: 'color:#c8aa6e' }, '寶石與插槽'),
      h('p', {}, '主動技能寶石放入同色插槽即可獲得技能（白色插槽可放任何寶石）。輔助寶石會強化所有與其相連插槽中的主動寶石。寶石會獲得經驗，可升級時右側會出現升級按鈕。對已鑲嵌的寶石按右鍵（手機：「使用」模式下點擊）可取下。'),
      h('h3', { style: 'color:#c8aa6e' }, '進程'),
      h('p', {}, '首次擊敗每個區域的首領可獲得 1 天賦點並解鎖下一區域。後期章節抗性會受到懲罰（-20%、-40%，終局為 -60%），記得把抗性堆到 75% 上限。擊敗「被遺棄者王座」後，可在地圖裝置使用地圖：地圖詞綴會讓怪物更強，但提高物品數量與稀有度。'),
      h('div', { class: 'row-buttons' }, h('button', { onclick: () => this.close() }, '關閉')),
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
        h('span', {}, `${sk.gem.name}${sk.item ? `（等級 ${sk.level}）` : ''}${aura ? ' — 光環（切換）' : ''}`),
        sk.usable ? h('span', { class: 'muted' }, sk.supports.length ? `${sk.supports.length} 個輔助` : '') : h('span', { class: 'why' }, sk.reason ?? ''),
      );
      opt.addEventListener('click', () => assign(uid));
      list.append(opt);
    }
    const clearOpt = h('div', { class: 'opt' }, h('span', { class: 'muted' }, slot === 0 ? '重設為普通攻擊' : '清空欄位'));
    clearOpt.addEventListener('click', () => assign(null));
    list.append(clearOpt);
    this.show('skills', h('div', {}, h('h2', {}, `${SKILL_KEYS[slot]} 的技能`), list));
  }
}
