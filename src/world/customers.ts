import * as THREE from 'three';
import { PRODUCTS, type ProductId, TRANSACTIONS_PER_SHIFT } from '../game/catalog';
import type { ShiftState } from '../game/state';
import { createPerson } from './characters';
import type { StoreScene } from './store';

const WALK_SPEED = 1.6;
const SPAWN_DELAY = 1.2;
const PICK_PAUSE = 0.6;

const ORDERS: ProductId[][] = [[0], [1, 2], [2, 0], [1], [0, 2], [2, 1]];
const SHIRTS = [0xe0a43a, 0x7d5ba6, 0x3e8ed0, 0xd0613e, 0x5aa36b, 0xc75b8d];

export function orderFor(shiftId: number, index: number): ProductId[] {
  return ORDERS[(((shiftId - 1) * TRANSACTIONS_PER_SHIFT + index) % ORDERS.length + ORDERS.length) % ORDERS.length];
}

type Phase = 'enter' | 'shopping' | 'toCounter' | 'atCounter' | 'leaving';

interface Customer {
  mesh: THREE.Group;
  shiftId: number;
  index: number;
  order: ProductId[];
  basket: ProductId[];
  scanned: number;
  phase: Phase;
  path: THREE.Vector3[];
  pause: number;
  waitingFor: ProductId | null;
}

export interface ShiftHooks {
  shift(): ShiftState;
  /** Takes one item off a shelf; returns false when the shelf is empty. */
  take(product: ProductId): boolean;
  /** Records the transaction (and pays the wage on the last one). */
  complete(shiftId: number, index: number): void;
}

export type CounterAction =
  | { kind: 'scan'; product: ProductId; n: number; total: number }
  | { kind: 'pay'; total: number };

export class CustomerController {
  private customer: Customer | null = null;
  private spawnTimer = SPAWN_DELAY;

  constructor(
    private store: StoreScene,
    private hooks: ShiftHooks,
  ) {}

  clear(): void {
    if (this.customer) this.store.group.remove(this.customer.mesh);
    this.customer = null;
    this.spawnTimer = SPAWN_DELAY;
  }

  update(dt: number): void {
    const shift = this.hooks.shift();
    if (!this.customer) {
      if (!shift.active || shift.completed >= TRANSACTIONS_PER_SHIFT) return;
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) this.spawn(shift);
      return;
    }
    const c = this.customer;
    if (c.pause > 0) {
      c.pause -= dt;
      return;
    }
    if (c.path.length > 0) {
      this.walk(c, dt);
      return;
    }
    switch (c.phase) {
      case 'enter':
      case 'shopping':
        this.shop(c);
        break;
      case 'toCounter':
        c.phase = 'atCounter';
        this.face(c, new THREE.Vector3(c.mesh.position.x, 0, c.mesh.position.z - 1));
        break;
      case 'leaving':
        this.store.group.remove(c.mesh);
        this.customer = null;
        this.spawnTimer = SPAWN_DELAY;
        break;
      case 'atCounter':
        break;
    }
  }

  private spawn(shift: ShiftState) {
    const index = shift.completed;
    const mesh = createPerson(SHIRTS[(shift.id * 3 + index) % SHIRTS.length], 0x4a4a55);
    mesh.position.copy(this.store.entry);
    this.store.group.add(mesh);
    const order = orderFor(shift.id, index);
    this.customer = {
      mesh,
      shiftId: shift.id,
      index,
      order,
      basket: [],
      scanned: 0,
      phase: 'enter',
      path: [this.store.shelves[order[0]].stand.clone()],
      pause: 0,
      waitingFor: null,
    };
  }

  private shop(c: Customer) {
    c.phase = 'shopping';
    const product = c.order[c.basket.length];
    const shelf = this.store.shelves[product];
    this.face(c, new THREE.Vector3(shelf.rect.x, 0, shelf.rect.z));
    if (!this.hooks.take(product)) {
      c.waitingFor = product;
      return;
    }
    c.waitingFor = null;
    c.basket.push(product);
    c.pause = PICK_PAUSE;
    if (c.basket.length < c.order.length) {
      c.path = [this.store.shelves[c.order[c.basket.length]].stand.clone()];
    } else {
      c.phase = 'toCounter';
      c.path = [this.store.aisle.clone(), this.store.counterSpot.clone()];
    }
  }

  private walk(c: Customer, dt: number) {
    const target = c.path[0];
    const pos = c.mesh.position;
    const to = target.clone().sub(pos);
    to.y = 0;
    const dist = to.length();
    const step = WALK_SPEED * dt;
    if (dist <= step) {
      pos.copy(target);
      c.path.shift();
    } else {
      pos.addScaledVector(to.normalize(), step);
    }
    this.face(c, target);
  }

  private face(c: Customer, target: THREE.Vector3) {
    const dx = target.x - c.mesh.position.x;
    const dz = target.z - c.mesh.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) c.mesh.rotation.y = Math.atan2(-dx, -dz);
  }

  /** What pressing interact at the counter would do right now, if anything. */
  counterAction(): CounterAction | null {
    const c = this.customer;
    if (!c || c.phase !== 'atCounter') return null;
    if (c.scanned < c.basket.length) {
      return { kind: 'scan', product: c.basket[c.scanned], n: c.scanned + 1, total: c.basket.length };
    }
    return { kind: 'pay', total: c.basket.length };
  }

  useCounter(): CounterAction | null {
    const action = this.counterAction();
    const c = this.customer;
    if (!action || !c) return null;
    if (action.kind === 'scan') {
      c.scanned++;
    } else {
      this.hooks.complete(c.shiftId, c.index);
      c.phase = 'leaving';
      c.path = [this.store.entry.clone()];
    }
    return action;
  }

  /** Short description for the HUD plus where the player should look next. */
  status(): { text: string; waitingFor: ProductId | null; atCounter: boolean } | null {
    const c = this.customer;
    if (!c) return null;
    const items = c.order.map((p) => PRODUCTS[p].name).join(', ');
    switch (c.phase) {
      case 'enter':
        return { text: `Khách đang vào, cần: ${items}`, waitingFor: null, atCounter: false };
      case 'shopping':
        if (c.waitingFor !== null) {
          const name = PRODUCTS[c.waitingFor].name;
          return {
            text: `Khách đang chờ ${name}. Lấy ${name} ở kho hàng rồi đưa lên kệ ${name}.`,
            waitingFor: c.waitingFor,
            atCounter: false,
          };
        }
        return { text: `Khách đang chọn hàng: ${items}`, waitingFor: null, atCounter: false };
      case 'toCounter':
        return { text: 'Khách đang ra quầy thanh toán.', waitingFor: null, atCounter: false };
      case 'atCounter':
        return { text: 'Khách đang chờ ở quầy. Quét hàng và xác nhận thanh toán.', waitingFor: null, atCounter: true };
      case 'leaving':
        return { text: 'Khách đã thanh toán. Cảm ơn quý khách!', waitingFor: null, atCounter: false };
    }
  }
}
