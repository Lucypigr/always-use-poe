import { isTouchDevice } from './touch';
import { AREA_BY_ID } from '../data/areas';
import { CLASSES, CLASS_BY_ID, type ClassId } from '../data/classes';
import { newCharacter, type CharacterData } from '../game/character';
import type { SaveData } from '../game/save';
import { clear, h } from './dom';

/** Title screen: pick an existing character or create a new one. */
export function showCharSelect(root: HTMLElement, save: SaveData, onPlay: (c: CharacterData) => void, onChange: () => void): void {
  clear(root);
  const screen = h('div', { class: 'title-screen' });
  root.append(screen);
  let selected: CharacterData | null = save.characters[0] ?? null;
  let creating = save.characters.length === 0;
  let cls: ClassId = 'brute';

  const render = () => {
    clear(screen);
    screen.append(h('h1', {}, 'HOLLOWREACH'), h('div', { class: 'subtitle' }, '一款關於流亡者、寶石與無盡戰利品的動作角色扮演遊戲'));
    if (!creating) {
      const list = h('div', { class: 'char-list' });
      for (const c of save.characters) {
        const last = c.completedAreas[c.completedAreas.length - 1];
        const row = h('div', { class: `char-row${c === selected ? ' sel' : ''}` },
          h('div', {}, h('div', { class: 'nm' }, c.name), h('div', { class: 'info' }, `等級 ${c.level} ${CLASS_BY_ID[c.classId].name}${last ? ` · 已通過 ${AREA_BY_ID[last]?.name ?? ''}` : ''}`)),
          h('div', { class: 'info' }, `${Math.floor(c.playTime / 60)} 分鐘`),
        );
        row.addEventListener('click', () => ((selected = c), render()));
        row.addEventListener('dblclick', () => onPlay(c));
        list.append(row);
      }
      screen.append(list);
      screen.append(
        h('div', { class: 'row-buttons' },
          h('button', { disabled: !selected, onclick: () => selected && onPlay(selected) }, '開始遊戲'),
          h('button', { onclick: () => ((creating = true), render()) }, '建立角色'),
          h('button', {
            disabled: !selected,
            onclick: () => {
              if (!selected || !confirm(`刪除 ${selected.name}？此操作無法復原。`)) return;
              save.characters = save.characters.filter((c) => c !== selected);
              selected = save.characters[0] ?? null;
              if (!selected) creating = true;
              onChange();
              render();
            },
          }, '刪除'),
        ),
      );
    } else {
      const name = h('input', { type: 'text', placeholder: '角色名稱', maxlength: '20' }) as HTMLInputElement;
      name.value = ['艾許卡', '薇拉', '多蘭', '紅隼', '米蕾兒', '塔爾', '奧斯溫', '伊索德'][Math.floor(Math.random() * 8)];
      const grid = h('div', { class: 'class-grid' });
      for (const c of CLASSES) {
        const card = h('div', { class: `class-card${c.id === cls ? ' sel' : ''}` },
          h('div', { class: 'cn', style: `color:${c.color}` }, c.name),
          h('div', { class: 'attrs' }, h('span', { class: 's' }, `力量 ${c.str}`), ' · ', h('span', { class: 'd' }, `敏捷 ${c.dex}`), ' · ', h('span', { class: 'i' }, `智慧 ${c.int}`)),
          h('div', { class: 'desc' }, c.description),
        );
        card.addEventListener('click', () => {
          cls = c.id;
          for (const el of grid.querySelectorAll('.class-card')) el.classList.remove('sel');
          card.classList.add('sel');
        });
        grid.append(card);
      }
      const create = () => {
        const nm = name.value.trim() || '流亡者';
        const ch = newCharacter(nm, cls);
        save.characters.push(ch);
        onChange();
        onPlay(ch);
      };
      name.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') create();
      });
      screen.append(
        h('div', { style: 'text-align:center' }, h('div', { class: 'section-title' }, '選擇職業'), grid, name),
        h('div', { class: 'row-buttons' },
          h('button', { onclick: create }, '建立並開始'),
          save.characters.length ? h('button', { onclick: () => ((creating = false), render()) }, '返回') : null,
        ),
      );
      if (!isTouchDevice()) setTimeout(() => name.focus(), 0);
    }
    screen.append(h('div', { class: 'muted', style: 'margin:20px 0 30px' }, '進度會自動儲存在你的瀏覽器中。'));
  };
  render();
}
