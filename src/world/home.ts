import * as THREE from 'three';
import { HOME_BASIC_LAMP, HOME_BED, HOME_CATALOG, HOME_INTERIOR } from '../game/homeLayout';
import type { Rect } from '../game/geometry';
import { box, buildRoom, cylinder, doorPanel, mat, rug } from './build';

export interface HomeScene {
  group: THREE.Group;
  colliders: Rect[];
  updateWalls(camera: THREE.Vector3): void;
  door: Rect;
  catalog: Rect;
  /** Parent for the player's own furniture. */
  furnitureRoot: THREE.Group;
}

export function buildHome(): HomeScene {
  const room = buildRoom(HOME_INTERIOR, 0xc9a77c, 0xf2e6d0);
  const g = room.group;
  const south = HOME_INTERIOR.z + HOME_INTERIOR.d / 2;

  room.attach('s', doorPanel(0, south, 0x8c6a4f));
  g.add(rug(2.6, 1.8, 0x7aa6a1, 0.6, -0.6));

  // Window on the north wall.
  const north = HOME_INTERIOR.z - HOME_INTERIOR.d / 2;
  room.attach('n', box(1.8, 1.2, 0.06, 0xbfe3f5, 1.5, 1.6, north + 0.02));
  room.attach('n', box(1.9, 0.08, 0.12, 0xffffff, 1.5, 0.98, north + 0.05));

  // Bed (pre-owned).
  const b = HOME_BED;
  g.add(box(b.w, 0.35, b.d, 0x8a5f39, b.x, 0.175, b.z));
  g.add(box(b.w - 0.1, 0.18, b.d - 0.1, 0xf5f2ea, b.x, 0.44, b.z));
  g.add(box(b.w - 0.1, 0.2, 1.3, 0x5b84c4, b.x, 0.46, b.z + 0.45));
  g.add(box(0.9, 0.14, 0.4, 0xffffff, b.x, 0.58, b.z - b.d / 2 + 0.35));
  g.add(box(b.w, 0.9, 0.08, 0x8a5f39, b.x, 0.45, b.z - b.d / 2 + 0.04));

  // Basic floor lamp (pre-owned).
  const l = HOME_BASIC_LAMP;
  g.add(cylinder(0.18, 0.2, 0.05, 0x777777, l.x, 0.025, l.z));
  g.add(cylinder(0.02, 0.02, 1.4, 0x777777, l.x, 0.72, l.z));
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.25, 20, 1, true), mat(0xfff4dc, { emissive: 0xffe6b0 }));
  shade.position.set(l.x, 1.45, l.z);
  g.add(shade);
  const lampLight = new THREE.PointLight(0xffe0a8, 3, 5, 1.5);
  lampLight.position.set(l.x, 1.4, l.z);
  g.add(lampLight);

  // Catalog stand next to the door.
  const c = HOME_CATALOG;
  g.add(box(c.w, 1.0, c.d, 0x6b4e3a, c.x, 0.5, c.z));
  const book = box(0.5, 0.05, 0.36, 0xe0564f, c.x, 1.03, c.z);
  book.rotation.x = -0.15;
  g.add(book);
  g.add(box(0.44, 0.052, 0.3, 0xfaf7f0, c.x, 1.035, c.z));

  const furnitureRoot = new THREE.Group();
  g.add(furnitureRoot);

  return {
    group: g,
    colliders: [...room.walls, HOME_BED, HOME_BASIC_LAMP, HOME_CATALOG],
    updateWalls: room.updateWalls,
    door: { x: 0, z: south - 0.15, w: 1.3, d: 0.3 },
    catalog: c,
    furnitureRoot,
  };
}
