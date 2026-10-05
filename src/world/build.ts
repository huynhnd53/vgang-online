import * as THREE from 'three';
import type { Rect } from '../game/geometry';

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

export function mat(color: number, opts: { emissive?: number; roughness?: number } = {}): THREE.MeshStandardMaterial {
  const key = `${color}-${opts.emissive ?? 0}-${opts.roughness ?? 0.8}`;
  let m = materialCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.8,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissive ? 1 : 0,
    });
    materialCache.set(key, m);
  }
  return m;
}

export function box(
  w: number,
  h: number,
  d: number,
  color: number | THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color) : color);
  mesh.position.set(x, y, z);
  return mesh;
}

export function cylinder(rTop: number, rBottom: number, h: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 20), mat(color));
  mesh.position.set(x, y, z);
  return mesh;
}

export type WallSide = 'n' | 's' | 'e' | 'w';

export interface Room {
  group: THREE.Group;
  /** Wall footprints for player collision. */
  walls: Rect[];
  /** Adds an object that belongs to a wall (door, window, sign) so it hides with that wall. */
  attach(side: WallSide, obj: THREE.Object3D): void;
  /** Hides each wall the camera is behind, so the third-person view looks into the room. */
  updateWalls(camera: THREE.Vector3): void;
}

const WALL_H = 2.8;
const WALL_T = 0.2;

/** Floor plus four walls around an interior rectangle centred at the origin. */
export function buildRoom(interior: Rect, floorColor: number, wallColor: number): Room {
  const group = new THREE.Group();
  const floor = box(interior.w, 0.1, interior.d, floorColor, interior.x, -0.05, interior.z);
  group.add(floor);

  const halfW = interior.w / 2 + WALL_T / 2;
  const halfD = interior.d / 2 + WALL_T / 2;
  const sides: WallSide[] = ['n', 's', 'w', 'e'];
  const wallRects: Rect[] = [
    { x: interior.x, z: interior.z - halfD, w: interior.w + WALL_T * 2, d: WALL_T },
    { x: interior.x, z: interior.z + halfD, w: interior.w + WALL_T * 2, d: WALL_T },
    { x: interior.x - halfW, z: interior.z, w: WALL_T, d: interior.d },
    { x: interior.x + halfW, z: interior.z, w: WALL_T, d: interior.d },
  ];
  const parts = new Map<WallSide, THREE.Object3D[]>();
  wallRects.forEach((r, i) => {
    const wall = box(r.w, WALL_H, r.d, wallColor, r.x, WALL_H / 2, r.z);
    // Skirting board for a bit of depth.
    const inset = 0.03;
    const sx = r.w > r.d ? r.w - WALL_T * 2 : r.w + inset * 2;
    const sz = r.w > r.d ? r.d + inset * 2 : r.d;
    const skirting = box(sx, 0.12, sz, 0xf3ede2, r.x, 0.06, r.z);
    group.add(wall, skirting);
    parts.set(sides[i], [wall, skirting]);
  });

  const inner = {
    n: interior.z - interior.d / 2,
    s: interior.z + interior.d / 2,
    w: interior.x - interior.w / 2,
    e: interior.x + interior.w / 2,
  };
  return {
    group,
    walls: wallRects,
    attach(side, obj) {
      group.add(obj);
      parts.get(side)!.push(obj);
    },
    updateWalls(cam) {
      const behind: Record<WallSide, boolean> = {
        n: cam.z < inner.n + 0.05,
        s: cam.z > inner.s - 0.05,
        w: cam.x < inner.w + 0.05,
        e: cam.x > inner.e - 0.05,
      };
      for (const side of sides) for (const o of parts.get(side)!) o.visible = !behind[side];
    },
  };
}

/** A door panel set into the south wall (z = southZ) at x. */
export function doorPanel(x: number, southZ: number, color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.3, 2.25, 0.08, 0x5b4636, 0, 1.125, 0));
  g.add(box(1.1, 2.1, 0.1, color, 0, 1.05, -0.02));
  g.add(box(0.08, 0.08, 0.12, 0xd4af37, 0.4, 1.05, -0.08));
  g.position.set(x, 0, southZ - 0.02);
  return g;
}

export function rug(w: number, d: number, color: number, x: number, z: number): THREE.Mesh {
  return box(w, 0.02, d, color, x, 0.01, z);
}
