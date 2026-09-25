import { newGrid, type Grid } from '../items/grid';
import type { CharacterData } from './character';

export const SAVE_KEY = 'hollowreach.save.v1';
export const STASH_TABS = 4;
export const STASH_W = 12;
export const STASH_H = 12;

export interface Settings {
  showDamageNumbers: boolean;
  alwaysShowLabels: boolean;
  hideNormalItems: boolean;
  volume: number;
}

export interface AccountData {
  stash: Grid[];
  stashNames: string[];
}

export interface SaveData {
  version: 1;
  characters: CharacterData[];
  account: AccountData;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { showDamageNumbers: true, alwaysShowLabels: true, hideNormalItems: false, volume: 0.5 };

export function newAccount(): AccountData {
  return {
    stash: Array.from({ length: STASH_TABS }, () => newGrid(STASH_W, STASH_H)),
    stashNames: ['1', '2', '3', '4'],
  };
}

export function emptySave(): SaveData {
  return { version: 1, characters: [], account: newAccount(), settings: { ...DEFAULT_SETTINGS } };
}

function storage(): Storage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function loadSave(): SaveData {
  const s = storage();
  if (!s) return emptySave();
  try {
    const raw = s.getItem(SAVE_KEY);
    if (!raw) return emptySave();
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1) return emptySave();
    data.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    while (data.account.stash.length < STASH_TABS) data.account.stash.push(newGrid(STASH_W, STASH_H));
    return data;
  } catch {
    return emptySave();
  }
}

export function writeSave(data: SaveData): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
