import { NPC_BY_ID, QUESTS, QUEST_BY_ID, type NpcId, type QuestDef } from '../data/quests';
import type { StatMod } from '../stats/stats';
import type { CharacterData } from './character';

/** Per-character progress of one quest. */
export interface QuestState {
  /** active → objective in progress, ready → return to the quest giver, done → rewarded. */
  s: 'active' | 'ready' | 'done';
  /** Kill / boss progress. */
  n: number;
  /** Indices of collected objects / slain named targets. */
  got?: number[];
  /** The quest giver has told the player about this quest. */
  seen?: boolean;
  /** Reward choice taken (gem id or blessing id). */
  pick?: string;
}

export function questStates(c: CharacterData): Record<string, QuestState> {
  return (c.quests ??= {});
}

export function questGoal(q: QuestDef): number {
  const o = q.objective;
  switch (o.kind) {
    case 'boss':
      return 1;
    case 'kill':
      return o.count;
    case 'collect':
      return o.objects.length;
    case 'slay':
      return o.targets.length;
  }
}

export function questProgress(st: QuestState): number {
  return st.got ? st.got.length : st.n;
}

/** Start every quest whose area is reachable and whose prerequisites are fulfilled. */
export function refreshQuests(c: CharacterData): QuestDef[] {
  const states = questStates(c);
  const started: QuestDef[] = [];
  for (const q of QUESTS) {
    if (states[q.id]) continue;
    if (!c.unlockedAreas.includes(q.objective.area)) continue;
    if (q.requires?.some((r) => !states[r] || states[r].s === 'active')) continue;
    const st: QuestState = { s: 'active', n: 0 };
    // Characters from before the story existed may have beaten the boss already.
    if (q.objective.kind === 'boss' && c.completedAreas.includes(q.objective.area)) {
      st.s = 'ready';
      st.n = 1;
    }
    states[q.id] = st;
    started.push(q);
  }
  return started;
}

/** Record progress; returns true if the objective has just been completed. */
export function advanceQuest(c: CharacterData, q: QuestDef, index?: number): boolean {
  const st = questStates(c)[q.id];
  if (!st || st.s !== 'active') return false;
  if (index !== undefined) {
    st.got ??= [];
    if (st.got.includes(index)) return false;
    st.got.push(index);
  } else st.n++;
  if (questProgress(st) >= questGoal(q)) {
    st.s = 'ready';
    return true;
  }
  return false;
}

/** Active quests whose objective takes place in the given area. */
export function activeQuestsIn(c: CharacterData, areaId: string): QuestDef[] {
  const states = questStates(c);
  return QUESTS.filter((q) => q.objective.area === areaId && states[q.id]?.s === 'active');
}

/** Quests a giver has to talk about: rewards to hand out first, then new quests. */
export function npcQuests(c: CharacterData, npc: NpcId): { ready: QuestDef[]; fresh: QuestDef[]; open: QuestDef[] } {
  const states = questStates(c);
  const mine = QUESTS.filter((q) => q.giver === npc && states[q.id]);
  return {
    ready: mine.filter((q) => states[q.id].s === 'ready'),
    fresh: mine.filter((q) => states[q.id].s === 'active' && !states[q.id].seen),
    open: mine.filter((q) => states[q.id].s === 'active'),
  };
}

/** "？" when a reward is waiting, "！" when the NPC has a new quest to tell about. */
export function npcMarker(c: CharacterData, npc: NpcId): string {
  const { ready, fresh } = npcQuests(c, npc);
  return ready.length ? '？' : fresh.length ? '！' : '';
}

export function npcLabel(c: CharacterData, npc: NpcId): string {
  const m = npcMarker(c, npc);
  return m ? `${m} ${NPC_BY_ID[npc].name}` : NPC_BY_ID[npc].name;
}

/** Permanent stat blessings chosen as quest rewards (e.g. the bandit lords). */
export function questBonusMods(c: CharacterData): StatMod[] {
  const out: StatMod[] = [];
  for (const [id, st] of Object.entries(c.quests ?? {})) {
    if (st.s !== 'done' || !st.pick) continue;
    const choice = QUEST_BY_ID[id]?.reward.choices?.find((x) => x.id === st.pick);
    if (choice?.mods) out.push(...choice.mods);
  }
  return out;
}

/** Quests for the on-screen tracker: rewards waiting first, then the main story, then side quests. */
export function trackedQuests(c: CharacterData, max = 4): { q: QuestDef; st: QuestState }[] {
  const states = questStates(c);
  const list = QUESTS.filter((q) => states[q.id] && states[q.id].s !== 'done').map((q) => ({ q, st: states[q.id] }));
  const rank = (x: { q: QuestDef; st: QuestState }) => (x.st.s === 'ready' ? 0 : x.q.main ? 1 : 2);
  list.sort((a, b) => rank(a) - rank(b) || a.q.act - b.q.act);
  return list.slice(0, max);
}
