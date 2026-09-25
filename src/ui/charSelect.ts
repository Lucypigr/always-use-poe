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
    screen.append(h('h1', {}, 'HOLLOWREACH'), h('div', { class: 'subtitle' }, 'An action RPG of exiles, orbs and endless loot'));
    if (!creating) {
      const list = h('div', { class: 'char-list' });
      for (const c of save.characters) {
        const last = c.completedAreas[c.completedAreas.length - 1];
        const row = h('div', { class: `char-row${c === selected ? ' sel' : ''}` },
          h('div', {}, h('div', { class: 'nm' }, c.name), h('div', { class: 'info' }, `Level ${c.level} ${CLASS_BY_ID[c.classId].name}${last ? ` · Cleared ${AREA_BY_ID[last]?.name ?? ''}` : ''}`)),
          h('div', { class: 'info' }, `${Math.floor(c.playTime / 60)} min`),
        );
        row.addEventListener('click', () => ((selected = c), render()));
        row.addEventListener('dblclick', () => onPlay(c));
        list.append(row);
      }
      screen.append(list);
      screen.append(
        h('div', { class: 'row-buttons' },
          h('button', { disabled: !selected, onclick: () => selected && onPlay(selected) }, 'Play'),
          h('button', { onclick: () => ((creating = true), render()) }, 'Create Character'),
          h('button', {
            disabled: !selected,
            onclick: () => {
              if (!selected || !confirm(`Delete ${selected.name}? This cannot be undone.`)) return;
              save.characters = save.characters.filter((c) => c !== selected);
              selected = save.characters[0] ?? null;
              if (!selected) creating = true;
              onChange();
              render();
            },
          }, 'Delete'),
        ),
      );
    } else {
      const name = h('input', { type: 'text', placeholder: 'Character name', maxlength: '20' }) as HTMLInputElement;
      name.value = ['Ashka', 'Veyra', 'Doran', 'Kestrel', 'Mirel', 'Taal', 'Oswin', 'Ysolde'][Math.floor(Math.random() * 8)];
      const grid = h('div', { class: 'class-grid' });
      for (const c of CLASSES) {
        const card = h('div', { class: `class-card${c.id === cls ? ' sel' : ''}` },
          h('div', { class: 'cn', style: `color:${c.color}` }, c.name),
          h('div', { class: 'attrs' }, h('span', { class: 's' }, `Str ${c.str}`), ' · ', h('span', { class: 'd' }, `Dex ${c.dex}`), ' · ', h('span', { class: 'i' }, `Int ${c.int}`)),
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
        const nm = name.value.trim() || 'Exile';
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
        h('div', { style: 'text-align:center' }, h('div', { class: 'section-title' }, 'Choose your class'), grid, name),
        h('div', { class: 'row-buttons' },
          h('button', { onclick: create }, 'Create & Play'),
          save.characters.length ? h('button', { onclick: () => ((creating = false), render()) }, 'Back') : null,
        ),
      );
      setTimeout(() => name.focus(), 0);
    }
    screen.append(h('div', { class: 'muted', style: 'margin:20px 0 30px' }, 'Progress is saved in your browser automatically.'));
  };
  render();
}
