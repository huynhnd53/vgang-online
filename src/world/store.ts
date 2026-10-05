import * as THREE from 'three';
import { PRODUCTS, type ProductId, SHELF_CAPACITY } from '../game/catalog';
import type { Rect } from '../game/geometry';
import { box, buildRoom, doorPanel, mat } from './build';
import { createProductMesh } from './characters';

export const STORE_INTERIOR: Rect = { x: 0, z: 0, w: 14, d: 10 };
export const STORE_SPAWN = { x: 0, z: 3.6, yaw: 0 };

export interface Shelf {
  product: ProductId;
  rect: Rect;
  /** Where a customer stands to take an item. */
  stand: THREE.Vector3;
  stockRoot: THREE.Group;
}

export interface Crate {
  product: ProductId;
  rect: Rect;
}

export interface StoreScene {
  group: THREE.Group;
  colliders: Rect[];
  updateWalls(camera: THREE.Vector3): void;
  door: Rect;
  clock: Rect;
  counter: Rect;
  shelves: Shelf[];
  crates: Crate[];
  /** Customer route points. */
  entry: THREE.Vector3;
  aisle: THREE.Vector3;
  counterSpot: THREE.Vector3;
  setShelfStock(product: ProductId, count: number): void;
}

function label(text: string, color: string): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), new THREE.MeshBasicMaterial({ map: tex }));
}

export function buildStore(): StoreScene {
  const room = buildRoom(STORE_INTERIOR, 0xdfe3e6, 0xe9f1ee);
  const g = room.group;
  const south = STORE_INTERIOR.z + STORE_INTERIOR.d / 2;
  const north = STORE_INTERIOR.z - STORE_INTERIOR.d / 2;
  const east = STORE_INTERIOR.x + STORE_INTERIOR.w / 2;
  const west = STORE_INTERIOR.x - STORE_INTERIOR.w / 2;

  room.attach('s', doorPanel(0, south, 0x9fd3c7));
  // Store sign stripe.
  room.attach('n', box(STORE_INTERIOR.w, 0.3, 0.04, 0x2f8f6f, 0, 2.55, north + 0.02));

  // Shelves along the north wall.
  const shelves: Shelf[] = [];
  const shelfColors = ['#3b7dd8', '#b9772f', '#c4372f'];
  PRODUCTS.forEach((p, i) => {
    const x = (i - 1) * 3.5;
    const rect: Rect = { x, z: north + 1.4, w: 2.2, d: 0.6 };
    const shelf = new THREE.Group();
    shelf.position.set(rect.x, 0, rect.z);
    shelf.add(box(rect.w, 0.08, rect.d, 0xe8e8e8, 0, 0.45, 0));
    shelf.add(box(rect.w, 0.08, rect.d, 0xe8e8e8, 0, 1.05, 0));
    shelf.add(box(rect.w, 1.6, 0.05, 0xc8ced3, 0, 0.8, -rect.d / 2));
    for (const sx of [-1, 1]) shelf.add(box(0.05, 1.6, rect.d, 0xb0b8bf, (sx * rect.w) / 2, 0.8, 0));
    shelf.add(box(rect.w, 0.4, rect.d, 0x9aa3ab, 0, 0.2, 0));
    const sign = label(p.name, shelfColors[i]);
    sign.position.set(0, 1.85, -rect.d / 2 + 0.03);
    shelf.add(sign);
    const stockRoot = new THREE.Group();
    stockRoot.position.y = 1.09;
    shelf.add(stockRoot);
    g.add(shelf);
    shelves.push({ product: p.id, rect, stand: new THREE.Vector3(x, 0, rect.z + 1.0), stockRoot });
  });

  // Storage area (kho) along the east wall.
  g.add(box(2.4, 0.01, 5.2, 0xc4b59a, east - 1.2, 0.006, 0.4));
  const kho = label('Kho hàng', '#6b5b45');
  kho.position.set(east - 0.02, 2.0, 0.4);
  kho.rotation.y = -Math.PI / 2;
  room.attach('e', kho);
  const crates: Crate[] = PRODUCTS.map((p, i) => {
    const rect: Rect = { x: east - 0.75, z: -1.2 + i * 1.6, w: 0.9, d: 0.9 };
    g.add(box(rect.w, 0.6, rect.d, 0xc79a62, rect.x, 0.3, rect.z));
    g.add(box(rect.w + 0.02, 0.05, 0.15, 0xa77a45, rect.x, 0.6, rect.z));
    for (let k = 0; k < 3; k++) {
      const m = createProductMesh(p.id);
      m.position.x += rect.x - 0.22 + k * 0.22;
      m.position.y += 0.62;
      m.position.z += rect.z + 0.2;
      g.add(m);
    }
    return { product: p.id, rect };
  });

  // Counter near the entrance.
  const counter: Rect = { x: -4.5, z: 2.6, w: 2.4, d: 0.7 };
  g.add(box(counter.w, 1.0, counter.d, 0x2f8f6f, counter.x, 0.5, counter.z));
  g.add(box(counter.w + 0.06, 0.05, counter.d + 0.06, 0xf4f1ea, counter.x, 1.02, counter.z));
  const register = new THREE.Group();
  register.add(box(0.45, 0.18, 0.35, 0x333a40, 0, 0.09, 0));
  const screen = box(0.36, 0.24, 0.03, 0x1d2328, 0, 0.32, 0.05);
  screen.add(box(0.31, 0.19, 0.01, 0x7fe0b5, 0, 0, -0.02));
  register.add(screen);
  register.position.set(counter.x + 0.6, 1.045, counter.z);
  g.add(register);

  // Time clock on the west wall.
  const clock: Rect = { x: west + 0.15, z: -0.5, w: 0.3, d: 0.6 };
  g.add(box(0.12, 0.6, 0.45, 0x41505c, west + 0.06, 1.4, clock.z));
  g.add(box(0.02, 0.2, 0.3, 0xfff1a8, west + 0.13, 1.5, clock.z));
  const clockSign = label('Chấm công', '#41505c');
  clockSign.position.set(west + 0.03, 1.95, clock.z);
  clockSign.rotation.y = Math.PI / 2;
  room.attach('w', clockSign);

  const stockMeshes = new Map<ProductId, THREE.Mesh[]>();
  const setShelfStock = (product: ProductId, count: number) => {
    const shelf = shelves[product];
    let meshes = stockMeshes.get(product);
    if (!meshes) {
      meshes = [];
      for (let k = 0; k < SHELF_CAPACITY; k++) {
        const m = createProductMesh(product);
        m.position.x += -0.75 + k * 0.5;
        shelf.stockRoot.add(m);
        meshes.push(m);
      }
      stockMeshes.set(product, meshes);
    }
    meshes.forEach((m, k) => (m.visible = k < count));
  };

  const floorTrim = mat(0x2f8f6f);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.012, 0.6), floorTrim);
  trim.position.set(0, 0.006, south - 0.4);
  g.add(trim);

  return {
    group: g,
    colliders: [...room.walls, ...shelves.map((s) => s.rect), ...crates.map((c) => c.rect), counter, clock],
    updateWalls: room.updateWalls,
    door: { x: 0, z: south - 0.15, w: 1.3, d: 0.3 },
    clock,
    counter,
    shelves,
    crates,
    entry: new THREE.Vector3(0, 0, south - 0.6),
    aisle: new THREE.Vector3(-2.3, 0, 3.7),
    counterSpot: new THREE.Vector3(counter.x, 0, 3.55),
    setShelfStock,
  };
}
