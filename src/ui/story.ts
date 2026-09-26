import { CURRENCY_BY_ID } from '../data/currency';
import { GEM_BY_ID } from '../data/gems';
import { NPC_BY_ID, PROLOGUE, QUESTS, type NpcId, type QuestDef } from '../data/quests';
import { npcQuests, questGoal, questProgress, questStates } from '../game/quests';
import { h } from './dom';
import type { UI } from './ui';

const GEM_TEXT: Record<string, string> = { R: '#ff7070', G: '#70e070', B: '#80a0ff', W: '#e0e0e0' };

/** NPC conversations, quest rewards, the quest journal and the prologue. */
export class StoryDialogs {
  constructor(private ui: UI) {}

  private get game() {
    return this.ui.game;
  }

  private page(title: string, sub: string, lines: string[], ...rest: (HTMLElement | null)[]): HTMLElement {
    return h('div', { class: 'dialog' },
      h('h2', {}, title),
      sub ? h('div', { class: 'dialog-sub' }, sub) : null,
      h('div', { class: 'dialog-text' }, ...lines.map((l) => h('p', {}, l))),
      ...rest,
    );
  }

  /** Talk to a quest giver: hand out waiting rewards, then new quests, then small talk. */
  talk(npc: NpcId): void {
    const c = this.game.char;
    const { ready, fresh, open } = npcQuests(c, npc);
    if (ready.length) return this.reward(ready[0]);
    if (fresh.length) return this.intro(fresh[0]);
    const def = NPC_BY_ID[npc];
    const line = def.greeting[Math.floor(Math.random() * def.greeting.length)];
    const buttons = h('div', { class: 'row-buttons wrap' });
    for (const q of open) buttons.append(h('button', { onclick: () => this.intro(q) }, `關於「${q.name}」`));
    buttons.append(h('button', { onclick: () => this.ui.modals.close() }, '再見'));
    const reminders = open.map((q) => h('div', { class: 'dialog-task' }, `◆ ${q.name}：${q.task}${this.progressText(q)}`));
    this.ui.modals.show('dialog', this.page(def.name, def.title, [line], ...reminders, buttons));
  }

  private intro(q: QuestDef): void {
    const npc = NPC_BY_ID[q.giver];
    this.game.markQuestSeen(q.id);
    const next = () => {
      const { ready, fresh } = npcQuests(this.game.char, q.giver);
      if (ready.length || fresh.length) this.talk(q.giver);
      else this.ui.modals.close();
    };
    this.ui.modals.show('dialog', this.page(npc.name, `任務：${q.name}`, q.intro,
      h('div', { class: 'dialog-task' }, `◆ 目標：${q.task}`),
      h('div', { class: 'dialog-reward' }, `獎勵：${this.rewardText(q)}`),
      h('div', { class: 'row-buttons' }, h('button', { onclick: next }, '我會處理的')),
    ));
  }

  private reward(q: QuestDef): void {
    const npc = NPC_BY_ID[q.giver];
    const g = this.game;
    const r = q.reward;
    const finish = (pick?: string) => {
      if (!g.turnInQuest(q.id, pick)) return;
      this.ui.refreshItems();
      const { ready, fresh } = npcQuests(g.char, q.giver);
      if (ready.length || fresh.length) this.talk(q.giver);
      else this.ui.modals.close();
    };
    const extra = this.rewardText({ ...q, reward: { ...r, gems: undefined, choices: undefined } });
    let body: HTMLElement;
    if (r.gems) {
      body = h('div', { class: 'reward-pick' });
      for (const id of r.gems) {
        const gem = GEM_BY_ID[id];
        if (!gem) continue;
        body.append(h('button', { class: 'reward-opt', onclick: () => finish(id) },
          h('span', { style: `color:${GEM_TEXT[gem.color]}` }, gem.name),
          h('span', { class: 'muted' }, gem.description),
        ));
      }
    } else if (r.choices) {
      body = h('div', { class: 'reward-pick' });
      for (const ch of r.choices) {
        body.append(h('button', { class: 'reward-opt', onclick: () => finish(ch.id) }, h('span', {}, ch.label), h('span', { class: 'muted' }, ch.desc)));
      }
    } else body = h('div', { class: 'row-buttons' }, h('button', { onclick: () => finish() }, '領取獎勵'));
    this.ui.modals.show('dialog', this.page(npc.name, `任務完成：${q.name}`, q.outro,
      r.gems || r.choices ? h('div', { class: 'dialog-reward' }, r.gems ? '選擇一顆寶石作為獎勵：' : '做出你的選擇：') : null,
      body,
      extra && (r.gems || r.choices) ? h('div', { class: 'dialog-reward' }, `另外獲得：${extra}`) : null,
    ), false);
  }

  private progressText(q: QuestDef): string {
    const st = questStates(this.game.char)[q.id];
    const goal = questGoal(q);
    if (!st || goal <= 1) return '';
    return `（${Math.min(goal, questProgress(st))}/${goal}）`;
  }

  rewardText(q: QuestDef): string {
    const r = q.reward;
    const parts: string[] = [];
    if (r.gems) parts.push('技能寶石（任選一）');
    if (r.choices) parts.push('特殊抉擇');
    for (const [id, n] of r.currency ?? []) parts.push(`${CURRENCY_BY_ID[id].name} ×${n}`);
    if (r.passives) parts.push(`${r.passives} 點天賦點數`);
    if (r.refunds) parts.push(`${r.refunds} 點天賦重置點數`);
    return parts.join('、');
  }

  /** Quest journal (J): every started quest, grouped by act. */
  journal(): void {
    const states = questStates(this.game.char);
    const list = h('div', { class: 'journal' });
    let act = 0;
    for (const q of QUESTS) {
      const st = states[q.id];
      if (!st) continue;
      if (q.act !== act) {
        act = q.act;
        list.append(h('div', { class: 'act-title' }, `第 ${act} 章`));
      }
      const status = st.s === 'done' ? '✔ 已完成' : st.s === 'ready' ? `回報${NPC_BY_ID[q.giver].name}` : `進行中${this.progressText(q)}`;
      list.append(h('div', { class: `journal-row ${st.s}` },
        h('div', {}, h('span', { class: q.main ? 'q-main' : '' }, q.name), h('div', { class: 'lvl' }, `${q.task} · ${NPC_BY_ID[q.giver].name}`)),
        h('span', { class: 'q-status' }, status),
      ));
    }
    const total = QUESTS.length;
    const done = QUESTS.filter((q) => states[q.id]?.s === 'done').length;
    this.ui.modals.show('journal', h('div', {},
      h('h2', {}, '任務日誌'),
      h('div', { class: 'dialog-sub' }, `已完成 ${done} / ${total}`),
      list,
      h('div', { class: 'row-buttons' },
        h('button', { onclick: () => this.prologue(false) }, '序章'),
        h('button', { onclick: () => this.ui.modals.close() }, '關閉'),
      ),
    ));
  }

  /** The opening narration, shown once for new characters. */
  prologue(first = true): void {
    const lines = [...PROLOGUE];
    if (first) {
      lines.push(this.ui.touch
        ? '操作：左下拖曳或點擊地面移動，按住右下技能鍵攻擊。頭上有「！」的人有任務給你。'
        : '操作：左鍵移動與互動，右鍵 / 空白鍵 / QWERT 施放技能。頭上有「！」的人有任務給你，按 J 開啟任務日誌。');
    }
    this.ui.modals.show('dialog', this.page('序章', '流放', lines,
      h('div', { class: 'row-buttons' }, h('button', { onclick: () => this.ui.modals.close() }, first ? '開始旅程' : '關閉')),
    ));
  }
}
