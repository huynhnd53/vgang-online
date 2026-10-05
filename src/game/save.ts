import { isFurnitureType } from './catalog';
import { type GameState, type OwnedItem, createInitialState, INITIAL_STOCK } from './state';

export const SAVE_KEY = 'vgang-online/save/v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Rebuilds a GameState from untrusted JSON, falling back to defaults field by field. */
export function parseSave(raw: string | null): GameState {
  const base = createInitialState();
  if (!raw) return base;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!data || typeof data !== 'object') return base;
  const d = data as Record<string, unknown>;

  const items: OwnedItem[] = [];
  const seen = new Set<number>();
  if (Array.isArray(d.items)) {
    for (const entry of d.items) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      if (!isNum(e.id) || seen.has(e.id) || !isFurnitureType(e.type)) continue;
      let placed: OwnedItem['placed'] = null;
      const p = e.placed as Record<string, unknown> | null | undefined;
      if (p && isNum(p.x) && isNum(p.z) && isNum(p.rot)) {
        placed = { x: p.x, z: p.z, rot: ((Math.round(p.rot) % 4) + 4) % 4 };
      }
      seen.add(e.id);
      items.push({ id: e.id, type: e.type, placed });
    }
  }
  const maxId = items.reduce((m, i) => Math.max(m, i.id), 0);

  const s = (d.shift ?? {}) as Record<string, unknown>;
  const stock =
    Array.isArray(s.stock) && s.stock.length === INITIAL_STOCK.length && s.stock.every(isNum)
      ? (s.stock as number[]).map((n) => Math.max(0, Math.round(n)))
      : [...INITIAL_STOCK];

  return {
    version: 1,
    money: isNum(d.money) ? Math.max(0, Math.round(d.money)) : base.money,
    items,
    nextItemId: Math.max(isNum(d.nextItemId) ? d.nextItemId : 1, maxId + 1),
    shift: {
      id: isNum(s.id) ? s.id : 0,
      active: s.active === true,
      completed: isNum(s.completed) ? s.completed : 0,
      paid: s.paid === true,
      stock,
    },
    location: d.location === 'store' ? 'store' : 'home',
    cameraMode: d.cameraMode === 'first' ? 'first' : 'third',
  };
}

export function loadGame(storage: StorageLike | null = defaultStorage()): GameState {
  try {
    return parseSave(storage?.getItem(SAVE_KEY) ?? null);
  } catch {
    return createInitialState();
  }
}

/** Returns false when the browser refuses to store data (private mode, quota, blocked site data). */
export function saveGame(state: GameState, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
