import {
  FURNITURE,
  type FurnitureType,
  type ProductId,
  SHELF_CAPACITY,
  SHIFT_WAGE,
  TRANSACTIONS_PER_SHIFT,
} from './catalog';

export type Location = 'home' | 'store';
export type CameraMode = 'first' | 'third';

export interface Placement {
  x: number;
  z: number;
  /** Quarter turns, 0..3. */
  rot: number;
}

export interface OwnedItem {
  id: number;
  type: FurnitureType;
  /** null while the item sits in the personal inventory. */
  placed: Placement | null;
}

export interface ShiftState {
  /** Increments each time a new shift starts; 0 means no shift has been started yet. */
  id: number;
  active: boolean;
  completed: number;
  paid: boolean;
  /** Stock on each shelf, indexed by ProductId. */
  stock: number[];
}

export interface GameState {
  version: 1;
  money: number;
  items: OwnedItem[];
  nextItemId: number;
  shift: ShiftState;
  location: Location;
  cameraMode: CameraMode;
}

export const INITIAL_STOCK = [2, 1, 0];

export function createInitialState(): GameState {
  return {
    version: 1,
    money: 0,
    items: [],
    nextItemId: 1,
    shift: { id: 0, active: false, completed: 0, paid: false, stock: [...INITIAL_STOCK] },
    location: 'home',
    cameraMode: 'third',
  };
}

export type Result = { ok: true; state: GameState } | { ok: false; state: GameState; reason: string };

function ok(state: GameState): Result {
  return { ok: true, state };
}

function fail(state: GameState, reason: string): Result {
  return { ok: false, state, reason };
}

export function buy(state: GameState, type: FurnitureType): Result {
  const def = FURNITURE[type];
  if (state.money < def.price) {
    return fail(state, `Chưa đủ tiền mua ${def.name} (cần ${def.price}).`);
  }
  return ok({
    ...state,
    money: state.money - def.price,
    items: [...state.items, { id: state.nextItemId, type, placed: null }],
    nextItemId: state.nextItemId + 1,
  });
}

/** Placement validity is checked by the caller (see placement.ts); this only records it. */
export function placeItem(state: GameState, itemId: number, placement: Placement): Result {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return fail(state, 'Không tìm thấy món đồ.');
  return ok({
    ...state,
    items: state.items.map((i) => (i.id === itemId ? { ...i, placed: { ...placement } } : i)),
  });
}

export function storeItem(state: GameState, itemId: number): Result {
  const item = state.items.find((i) => i.id === itemId);
  if (!item || !item.placed) return fail(state, 'Món đồ này đang không được đặt.');
  return ok({
    ...state,
    items: state.items.map((i) => (i.id === itemId ? { ...i, placed: null } : i)),
  });
}

export function startShift(state: GameState): Result {
  if (state.shift.active) return fail(state, 'Ca làm đang diễn ra.');
  return ok({
    ...state,
    shift: { id: state.shift.id + 1, active: true, completed: 0, paid: false, stock: [...INITIAL_STOCK] },
  });
}

export function restockShelf(state: GameState, product: ProductId): Result {
  const stock = state.shift.stock[product];
  if (stock >= SHELF_CAPACITY) return fail(state, 'Kệ đã đầy.');
  const next = [...state.shift.stock];
  next[product] = stock + 1;
  return ok({ ...state, shift: { ...state.shift, stock: next } });
}

export function takeFromShelf(state: GameState, product: ProductId): Result {
  const stock = state.shift.stock[product];
  if (stock <= 0) return fail(state, 'Kệ hết hàng.');
  const next = [...state.shift.stock];
  next[product] = stock - 1;
  return ok({ ...state, shift: { ...state.shift, stock: next } });
}

/**
 * Completes transaction number `index` (0-based) of shift `shiftId`.
 * Idempotent: a transaction counts once, and the wage is paid in the same update
 * as the final transaction so a save/reload can never pay it twice.
 */
export function completeTransaction(state: GameState, shiftId: number, index: number): Result {
  const shift = state.shift;
  if (!shift.active || shift.id !== shiftId) return fail(state, 'Không có ca làm phù hợp.');
  if (index !== shift.completed) return fail(state, 'Giao dịch này đã được ghi nhận.');
  const completed = shift.completed + 1;
  if (completed < TRANSACTIONS_PER_SHIFT) {
    return ok({ ...state, shift: { ...shift, completed } });
  }
  const pay = shift.paid ? 0 : SHIFT_WAGE;
  return ok({
    ...state,
    money: state.money + pay,
    shift: { ...shift, completed, paid: true, active: false },
  });
}
