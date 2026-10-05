import { describe, expect, it } from 'vitest';
import { checkPlacement, footprint } from '../src/game/placement';
import { loadGame, saveGame, type StorageLike } from '../src/game/save';
import {
  buy,
  completeTransaction,
  createInitialState,
  type GameState,
  placeItem,
  restockShelf,
  startShift,
  storeItem,
  takeFromShelf,
} from '../src/game/state';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function finishShift(state: GameState): GameState {
  let s = startShift(state).state;
  for (let i = 0; i < 3; i++) s = completeTransaction(s, s.shift.id, i).state;
  return s;
}

describe('acceptance scenario from the gameplay plan', () => {
  it('earns 60, buys a plant, places it, and survives a reload without double pay', () => {
    const storage = memoryStorage();
    let s = createInitialState();
    expect(s.money).toBe(0);

    // Buying the 120 table before having enough money is refused and changes nothing.
    const refused = buy(s, 'table');
    expect(refused.ok).toBe(false);
    expect(refused.state).toBe(s);

    s = startShift(s).state;
    const shiftId = s.shift.id;
    s = completeTransaction(s, shiftId, 0).state;
    s = completeTransaction(s, shiftId, 1).state;
    expect(s.money).toBe(0);
    s = completeTransaction(s, shiftId, 2).state;
    expect(s.money).toBe(60);
    expect(s.shift).toMatchObject({ completed: 3, paid: true, active: false });

    const bought = buy(s, 'plant');
    expect(bought.ok).toBe(true);
    s = bought.state;
    expect(s.money).toBe(0);
    expect(s.items).toHaveLength(1);

    const plantId = s.items[0].id;
    const spot = { x: 2, z: -2, rot: 0 };
    expect(checkPlacement('plant', spot, { items: s.items, ignoreId: plantId }).valid).toBe(true);
    s = placeItem(s, plantId, spot).state;
    saveGame(s, storage);

    // Reload.
    let loaded = loadGame(storage);
    expect(loaded.money).toBe(0);
    expect(loaded.items).toEqual([{ id: plantId, type: 'plant', placed: spot }]);

    // Replaying the last transaction of the paid shift pays nothing.
    const replay = completeTransaction(loaded, shiftId, 2);
    expect(replay.ok).toBe(false);
    expect(replay.state.money).toBe(0);

    loaded = buy(loaded, 'table').state;
    expect(loaded.items).toHaveLength(1);
  });
});

describe('shift rules', () => {
  it('counts each transaction once and only in order', () => {
    let s = startShift(createInitialState()).state;
    s = completeTransaction(s, s.shift.id, 0).state;
    const dup = completeTransaction(s, s.shift.id, 0);
    expect(dup.ok).toBe(false);
    expect(dup.state.shift.completed).toBe(1);
    expect(completeTransaction(s, s.shift.id + 1, 1).ok).toBe(false);
  });

  it('cannot start a second shift while one is running, and pays each finished shift once', () => {
    let s = startShift(createInitialState()).state;
    expect(startShift(s).ok).toBe(false);
    s = completeTransaction(s, s.shift.id, 0).state;
    s = completeTransaction(s, s.shift.id, 1).state;
    s = completeTransaction(s, s.shift.id, 2).state;
    s = finishShift(s);
    expect(s.money).toBe(120);
    expect(s.shift.id).toBe(2);
  });

  it('keeps shelf stock within 0..capacity', () => {
    let s = startShift(createInitialState()).state;
    expect(takeFromShelf(s, 2).ok).toBe(false);
    for (let i = 0; i < 10; i++) s = restockShelf(s, 2).state;
    expect(s.shift.stock[2]).toBe(4);
    s = takeFromShelf(s, 2).state;
    expect(s.shift.stock[2]).toBe(3);
  });
});

describe('furniture', () => {
  it('stores a placed item back into inventory and allows re-placing without buying again', () => {
    let s = finishShift(createInitialState());
    s = buy(s, 'lamp').state;
    const id = s.items[0].id;
    s = placeItem(s, id, { x: 0, z: 0, rot: 0 }).state;
    s = storeItem(s, id).state;
    expect(s.items[0].placed).toBeNull();
    expect(s.money).toBe(20);
    s = placeItem(s, id, { x: 1, z: 0, rot: 1 }).state;
    expect(s.items[0].placed).toEqual({ x: 1, z: 0, rot: 1 });
    expect(s.money).toBe(20);
  });

  it('rejects placement through walls, on the doorway, on fixed furniture and on other items', () => {
    const items = [{ id: 1, type: 'table' as const, placed: { x: 2, z: -1, rot: 0 } }];
    expect(checkPlacement('plant', { x: 4.9, z: 0, rot: 0 }, { items }).valid).toBe(false);
    expect(checkPlacement('plant', { x: 0, z: 3.5, rot: 0 }, { items }).valid).toBe(false);
    expect(checkPlacement('plant', { x: -3.6, z: -2.75, rot: 0 }, { items }).valid).toBe(false);
    expect(checkPlacement('plant', { x: 2.5, z: -1, rot: 0 }, { items }).valid).toBe(false);
    expect(checkPlacement('plant', { x: 2.5, z: -1, rot: 0 }, { items, ignoreId: 1 }).valid).toBe(true);
    expect(checkPlacement('plant', { x: 0, z: 0, rot: 0 }, { items, player: { x: 0, z: 0, radius: 0.3 } }).valid).toBe(
      false,
    );
  });

  it('swaps the footprint when rotated a quarter turn', () => {
    expect(footprint('table', { x: 0, z: 0, rot: 1 })).toMatchObject({ w: 0.8, d: 1.4 });
  });
});

describe('save parsing', () => {
  it('falls back to a new game on corrupt data and drops invalid items', () => {
    const storage = memoryStorage();
    storage.setItem('vgang-online/save/v1', '{not json');
    expect(loadGame(storage)).toEqual(createInitialState());
    storage.setItem(
      'vgang-online/save/v1',
      JSON.stringify({ money: 30, items: [{ id: 3, type: 'sofa' }, { id: 4, type: 'lamp', placed: null }], nextItemId: 1 }),
    );
    const s = loadGame(storage);
    expect(s.money).toBe(30);
    expect(s.items).toEqual([{ id: 4, type: 'lamp', placed: null }]);
    expect(s.nextItemId).toBe(5);
  });

  it('survives a storage that throws', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadGame(throwing)).toEqual(createInitialState());
    expect(saveGame(createInitialState(), throwing)).toBe(false);
  });
});
