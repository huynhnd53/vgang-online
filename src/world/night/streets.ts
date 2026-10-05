import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type City, GRID, HALF, ROAD, SIDEWALK } from '../../sim/city';
import { mulberry32 } from '../../sim/geometry';
import { QuadBuilder } from './houses';
import type { StreetLight } from './lighting';
import { makeNoise, canvas, paint, toTexture } from './proc';

const CURB_H = 0.16;
const UP = new THREE.Vector3(0, 1, 0);
export const SODIUM = new THREE.Color(1.0, 0.45, 0.13);
const LAMP_HEIGHT = 7.6;

export interface Lamp {
  base: THREE.Vector3;
  head: THREE.Vector3;
  /** Horizontal direction from the pole towards the road. */
  out: THREE.Vector3;
}

export interface TrafficHead {
  /** Lamp centres: red, yellow, green. */
  lamps: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  /** True when the head controls traffic moving along z. */
  northSouth: boolean;
}

/** Positions along one road where furniture may go (away from intersections). */
function alongRoad(city: City, spacing: number, offset: number, margin: number): number[] {
  const out: number[] = [];
  const lo = city.roads[0];
  const hi = city.roads[city.roads.length - 1];
  for (let t = lo + offset; t <= hi; t += spacing) {
    if (city.roads.some((r) => Math.abs(t - r) < ROAD / 2 + margin)) continue;
    out.push(t);
  }
  return out;
}

/** Worn paint alpha (white = paint). */
export function wearTexture(): THREE.Texture {
  const size = 256;
  const { fbm } = makeNoise(91);
  const [c, ctx] = canvas(size, size);
  paint(ctx, size, size, (x, y) => {
    const n = fbm(x / size, y / size, 8, 5);
    const v = n > 0.3 ? 255 : 0;
    return [v, v, v];
  });
  return toTexture(c, false);
}

export function layoutLamps(city: City): Lamp[] {
  const lamps: Lamp[] = [];
  for (const r of city.roads) {
    for (const side of [-1, 1]) {
      const ts = alongRoad(city, 26, side < 0 ? 6 : 19, 2.5);
      for (const t of ts) {
        for (const axis of ['x', 'z'] as const) {
          // Road along z at x = r (axis 'x' fixed), or along x at z = r.
          const across = r + side * (ROAD / 2 + 0.45);
          const base = axis === 'x' ? new THREE.Vector3(across, CURB_H, t) : new THREE.Vector3(t, CURB_H, across);
          const out = axis === 'x' ? new THREE.Vector3(-side, 0, 0) : new THREE.Vector3(0, 0, -side);
          const head = base.clone().addScaledVector(out, 1.7).setY(LAMP_HEIGHT);
          lamps.push({ base, head, out });
        }
      }
    }
  }
  return lamps;
}

export interface StreetMeshes {
  group: THREE.Group;
  lights: StreetLight[];
  glows: { pos: THREE.Vector3; color: THREE.Color }[];
  reflections: { pos: THREE.Vector3; color: THREE.Color; strength: number }[];
  traffic: TrafficHead[];
  trafficLampMeshes: THREE.InstancedMesh[];
  lamps: Lamp[];
}

export interface StreetMaterials {
  road: THREE.MeshStandardMaterial;
  sidewalk: THREE.MeshStandardMaterial;
  curb: THREE.MeshStandardMaterial;
  paint: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial;
  leaves: THREE.MeshStandardMaterial;
  pot: THREE.MeshStandardMaterial;
  soil: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
}

/** A canopy made of crossed leaf cards with normals pointing out from the centre for soft shading. */
function canopyGeometry(cards: number, radius: number, height: number, cardSize: number, seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < cards; k++) {
    const p = new THREE.PlaneGeometry(cardSize, cardSize);
    p.rotateX((rand() - 0.5) * Math.PI);
    p.rotateY(rand() * Math.PI * 2);
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    const y = (rand() - 0.4) * height;
    p.translate(Math.cos(a) * r, y, Math.sin(a) * r);
    parts.push(p);
  }
  const g = mergeGeometries(parts);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i) * 1.6, pos.getZ(i)).normalize();
    v.y = v.y * 0.7 + 0.3;
    v.normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[], shadows = false): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, matrices.length));
  m.count = matrices.length;
  matrices.forEach((mat4, i) => m.setMatrixAt(i, mat4));
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = shadows;
  m.receiveShadow = shadows;
  m.computeBoundingSphere();
  return m;
}

const tmpQ = new THREE.Quaternion();
const M = (p: THREE.Vector3, rotY = 0, s = 1, sy = s) =>
  new THREE.Matrix4().compose(p, tmpQ.setFromAxisAngle(UP, rotY).clone(), new THREE.Vector3(s, sy, s));

export function buildStreets(city: City, mats: StreetMaterials, pots: THREE.Vector3[]): StreetMeshes {
  const group = new THREE.Group();
  const rand = mulberry32(4242);
  const lights: StreetLight[] = [];
  const glows: { pos: THREE.Vector3; color: THREE.Color }[] = [];
  const reflections: { pos: THREE.Vector3; color: THREE.Color; strength: number }[] = [];
  const edge = HALF + ROAD / 2;
  const outerEdge = edge + SIDEWALK + 16;

  // Road surface with a fine UV set (texture detail) and a coarse one (wet patches).
  {
    const size = outerEdge * 2;
    const g = new THREE.PlaneGeometry(size, size, 1, 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute('position');
    const uv0: number[] = [];
    const uv1: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      uv0.push(pos.getX(i) / 6, pos.getZ(i) / 6);
      uv1.push(pos.getX(i) / 70, pos.getZ(i) / 70);
    }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv0, 2));
    g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
    const road = new THREE.Mesh(g, mats.road);
    road.receiveShadow = true;
    group.add(road);
  }

  // Sidewalk slabs: every block plus a strip around the outside of the ring road.
  const walk = new QuadBuilder();
  const curb = new QuadBuilder();
  const white = new THREE.Color(1, 1, 1);
  const slab = (x0: number, z0: number, x1: number, z1: number, curbSides: boolean[]) => {
    const w = x1 - x0;
    const d = z1 - z0;
    walk.quad(new THREE.Vector3(x0, CURB_H, z1), new THREE.Vector3(w, 0, 0), new THREE.Vector3(0, 0, -d), UP, [x0 / 2, z1 / -2, x1 / 2, z0 / -2], white);
    // Curb faces: north, south, west, east.
    const sides: [THREE.Vector3, THREE.Vector3, THREE.Vector3, number][] = [
      [new THREE.Vector3(x1, 0, z0), new THREE.Vector3(-w, 0, 0), new THREE.Vector3(0, 0, -1), w],
      [new THREE.Vector3(x0, 0, z1), new THREE.Vector3(w, 0, 0), new THREE.Vector3(0, 0, 1), w],
      [new THREE.Vector3(x0, 0, z0), new THREE.Vector3(0, 0, d), new THREE.Vector3(-1, 0, 0), d],
      [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(0, 0, -d), new THREE.Vector3(1, 0, 0), d],
    ];
    sides.forEach(([o, r, n, len], k) => {
      if (curbSides[k]) curb.quad(o, r, new THREE.Vector3(0, CURB_H, 0), n, [0, 0, len / 2, 1], white);
    });
    // Curb top band (lighter stone along the edge).
    if (curbSides[0]) curb.quad(new THREE.Vector3(x0, CURB_H + 0.002, z0 + 0.25), new THREE.Vector3(w, 0, 0), new THREE.Vector3(0, 0, -0.25), UP, [0, 0, w / 2, 0.3], white);
    if (curbSides[1]) curb.quad(new THREE.Vector3(x0, CURB_H + 0.002, z1), new THREE.Vector3(w, 0, 0), new THREE.Vector3(0, 0, -0.25), UP, [0, 0, w / 2, 0.3], white);
    if (curbSides[2]) curb.quad(new THREE.Vector3(x0, CURB_H + 0.002, z1), new THREE.Vector3(0.25, 0, 0), new THREE.Vector3(0, 0, -d), UP, [0, 0, 0.3, d / 2], white);
    if (curbSides[3]) curb.quad(new THREE.Vector3(x1 - 0.25, CURB_H + 0.002, z1), new THREE.Vector3(0.25, 0, 0), new THREE.Vector3(0, 0, -d), UP, [0, 0, 0.3, d / 2], white);
  };
  for (const b of city.blocks) {
    slab(b.rect.x - b.rect.w / 2, b.rect.z - b.rect.d / 2, b.rect.x + b.rect.w / 2, b.rect.z + b.rect.d / 2, [true, true, true, true]);
  }
  const o0 = edge;
  const o1 = edge + SIDEWALK + 16;
  slab(-o1, -o1, o1, -o0, [false, true, false, false]);
  slab(-o1, o0, o1, o1, [true, false, false, false]);
  slab(-o1, -o0, -o0, o0, [false, false, false, true]);
  slab(o0, -o0, o1, o0, [false, false, true, false]);
  const walkMesh = new THREE.Mesh(walk.build(), mats.sidewalk);
  walkMesh.receiveShadow = true;
  const curbMesh = new THREE.Mesh(curb.build(), mats.curb);
  curbMesh.receiveShadow = true;
  group.add(walkMesh, curbMesh);

  // Road markings: centre dashes, edge lines, zebra crossings and stop lines.
  const paintQ = new QuadBuilder();
  const flat = (cx: number, cz: number, w: number, d: number) =>
    paintQ.quad(new THREE.Vector3(cx - w / 2, 0.012, cz + d / 2), new THREE.Vector3(w, 0, 0), new THREE.Vector3(0, 0, -d), UP, [cx / 3, cz / 3, (cx + w) / 3, (cz + d) / 3], white);
  for (const r of city.roads) {
    for (let k = 0; k < GRID; k++) {
      const a = city.roads[k] + ROAD / 2 + 4.2;
      const b = city.roads[k + 1] - ROAD / 2 - 4.2;
      for (let t = a; t + 3 <= b; t += 7) {
        flat(r, t + 1.5, 0.14, 3);
        flat(t + 1.5, r, 3, 0.14);
      }
      for (const s of [-1, 1]) {
        const off = r + s * (ROAD / 2 - 0.5);
        flat(off, (a + b) / 2, 0.12, b - a);
        flat((a + b) / 2, off, b - a, 0.12);
      }
    }
  }
  for (const rx of city.roads) {
    for (const rz of city.roads) {
      for (const dir of [-1, 1]) {
        // Zebra on the z-road (north/south of the junction) and on the x-road (east/west).
        const zc = rz + dir * (ROAD / 2 + 2.2);
        if (Math.abs(zc) < edge) for (let s = -ROAD / 2 + 0.8; s < ROAD / 2 - 0.5; s += 1.1) flat(rx + s + 0.25, zc, 0.5, 3);
        const xc = rx + dir * (ROAD / 2 + 2.2);
        if (Math.abs(xc) < edge) for (let s = -ROAD / 2 + 0.8; s < ROAD / 2 - 0.5; s += 1.1) flat(xc, rz + s + 0.25, 3, 0.5);
        // Stop lines across the incoming half of each road.
        const zs = rz + dir * (ROAD / 2 + 4.1);
        if (Math.abs(zs) < edge) flat(rx - (dir * ROAD) / 4, zs, ROAD / 2 - 0.2, 0.3);
        const xs = rx + dir * (ROAD / 2 + 4.1);
        if (Math.abs(xs) < edge) flat(xs, rz + (dir * ROAD) / 4, 0.3, ROAD / 2 - 0.2);
      }
    }
  }
  const paintMesh = new THREE.Mesh(paintQ.build(), mats.paint);
  paintMesh.receiveShadow = true;
  group.add(paintMesh);

  // Street lamps: tapered pole, curved arm, cobra head with a glowing lens.
  const lamps = layoutLamps(city);
  {
    const pole = new THREE.CylinderGeometry(0.075, 0.12, LAMP_HEIGHT - CURB_H + 0.1, 10);
    pole.translate(0, (LAMP_HEIGHT - CURB_H) / 2, 0);
    const foot = new THREE.CylinderGeometry(0.2, 0.24, 0.5, 10);
    foot.translate(0, 0.25, 0);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, LAMP_HEIGHT - 0.9 - CURB_H, 0),
      new THREE.Vector3(0.1, LAMP_HEIGHT - CURB_H + 0.1, 0),
      new THREE.Vector3(1.55, LAMP_HEIGHT - CURB_H + 0.02, 0),
    );
    const arm = new THREE.TubeGeometry(curve, 12, 0.045, 6, false);
    const head = new THREE.BoxGeometry(0.7, 0.14, 0.3);
    head.translate(1.75, LAMP_HEIGHT - CURB_H, 0);
    const metalGeo = mergeGeometries([pole.toNonIndexed(), foot.toNonIndexed(), arm.toNonIndexed(), head.toNonIndexed()]);
    const lens = new THREE.PlaneGeometry(0.55, 0.22);
    lens.rotateX(Math.PI / 2);
    lens.translate(1.75, LAMP_HEIGHT - CURB_H - 0.075, 0);
    const mats4 = lamps.map((l) => M(l.base, Math.atan2(-l.out.z, l.out.x)));
    group.add(instanced(metalGeo, mats.metal, mats4, true));
    const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.66, 0.34).multiplyScalar(14) });
    group.add(instanced(lens, lensMat, mats4));
    for (const l of lamps) {
      lights.push({
        pos: l.head.clone().setY(LAMP_HEIGHT - 0.15),
        dir: l.out.clone().multiplyScalar(0.3).setY(-1).normalize(),
        cosOuter: Math.cos(1.22),
        color: SODIUM,
        intensity: 1000,
        range: 28,
        real: true,
      });
      glows.push({ pos: l.head.clone().setY(LAMP_HEIGHT - 0.2), color: new THREE.Color(1.0, 0.6, 0.28) });
      reflections.push({ pos: l.head.clone(), color: SODIUM, strength: 1.6 });
    }
  }

  // Overhead wires strung between consecutive poles on the same side of a street.
  {
    const pts: number[] = [];
    const byLine = new Map<string, Lamp[]>();
    for (const l of lamps) {
      const key = l.out.x !== 0 ? `x${l.base.x.toFixed(2)}` : `z${l.base.z.toFixed(2)}`;
      const list = byLine.get(key) ?? [];
      list.push(l);
      byLine.set(key, list);
    }
    for (const list of byLine.values()) {
      list.sort((a, b) => a.base.x + a.base.z - (b.base.x + b.base.z));
      for (let k = 0; k + 1 < list.length; k++) {
        const a = list[k].base;
        const b = list[k + 1].base;
        if (a.distanceTo(b) > 40) continue;
        for (const [h, sag, off] of [
          [6.9, 0.45, 0],
          [6.6, 0.55, 0.12],
          [6.2, 0.6, -0.1],
        ]) {
          const seg = 10;
          for (let s = 0; s < seg; s++) {
            for (const t of [s / seg, (s + 1) / seg]) {
              const x = a.x + (b.x - a.x) * t + (list[k].out.x !== 0 ? off : 0);
              const z = a.z + (b.z - a.z) * t + (list[k].out.z !== 0 ? off : 0);
              pts.push(x, h - sag * 4 * t * (1 - t), z);
            }
          }
        }
      }
    }
    // Thin vertical ribbons rather than GL lines, which alias badly with MSAA and have no width control.
    const ribbon: number[] = [];
    for (let k = 0; k < pts.length; k += 6) {
      const [ax, ay, az, bx, by, bz] = pts.slice(k, k + 6);
      const t = 0.018;
      ribbon.push(ax, ay - t, az, bx, by - t, bz, bx, by + t, bz, ax, ay - t, az, bx, by + t, bz, ax, ay + t, az);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(ribbon, 3));
    group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x060606, side: THREE.DoubleSide })));
  }

  // Trees between the lamps, with a square pit of soil at the foot.
  const treeSpots: THREE.Matrix4[] = [];
  const pitQ = new QuadBuilder();
  for (const r of city.roads) {
    for (const side of [-1, 1]) {
      for (const t of alongRoad(city, 13, side < 0 ? 12.5 : 25.5, 3)) {
        for (const axis of ['x', 'z'] as const) {
          if (rand() < 0.22) continue;
          const across = r + side * (ROAD / 2 + 1.25);
          const p = axis === 'x' ? new THREE.Vector3(across, CURB_H, t) : new THREE.Vector3(t, CURB_H, across);
          const s = 0.85 + rand() * 0.35;
          treeSpots.push(M(p, rand() * Math.PI * 2, s, 0.9 + rand() * 0.3));
          pitQ.quad(new THREE.Vector3(p.x - 0.5, CURB_H + 0.004, p.z + 0.5), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), UP, [0, 0, 1, 1], white);
        }
      }
    }
  }
  // Park and lake trees.
  for (const b of city.blocks) {
    if (b.kind !== 'park' && b.kind !== 'lake') continue;
    const count = b.kind === 'park' ? 22 : 16;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + rand() * 0.3;
      const rr = b.kind === 'lake' ? b.inner.w / 2 - 1.8 : 4 + rand() * (b.inner.w / 2 - 6);
      const p = new THREE.Vector3(b.inner.x + Math.cos(a) * rr, CURB_H, b.inner.z + Math.sin(a) * rr);
      if (b.kind === 'park' && (Math.abs(p.x - b.inner.x) < 1.6 || Math.abs(p.z - b.inner.z) < 1.6)) continue;
      treeSpots.push(M(p, rand() * Math.PI * 2, 1 + rand() * 0.4));
    }
  }
  {
    const trunk = new THREE.CylinderGeometry(0.13, 0.2, 4.6, 7);
    trunk.translate(0, 2.3, 0);
    const branchA = new THREE.CylinderGeometry(0.05, 0.09, 1.8, 5);
    branchA.rotateZ(0.6);
    branchA.translate(0.45, 4.4, 0);
    const branchB = new THREE.CylinderGeometry(0.05, 0.09, 1.6, 5);
    branchB.rotateX(-0.6);
    branchB.translate(0, 4.3, 0.4);
    const trunkGeo = mergeGeometries([trunk.toNonIndexed(), branchA.toNonIndexed(), branchB.toNonIndexed()]);
    group.add(instanced(trunkGeo, mats.bark, treeSpots, true));
    const canopy = canopyGeometry(26, 2.7, 2.4, 2.4, 17);
    canopy.translate(0, 5.6, 0);
    const leafMesh = instanced(canopy, mats.leaves, treeSpots, true);
    leafMesh.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: mats.leaves.map,
      alphaTest: 0.5,
    });
    group.add(leafMesh);
    group.add(new THREE.Mesh(pitQ.build(), mats.soil));
  }

  // Potted plants in front of houses.
  {
    const potGeo = new THREE.CylinderGeometry(0.24, 0.17, 0.48, 12);
    potGeo.translate(0, 0.24, 0);
    const potMats = pots.map((p) => M(p, rand() * 6, 0.8 + rand() * 0.5));
    group.add(instanced(potGeo, mats.pot, potMats, true));
    const plant = canopyGeometry(10, 0.35, 0.6, 0.7, 23);
    plant.translate(0, 0.9, 0);
    group.add(instanced(plant, mats.leaves, potMats));
  }

  // Traffic lights at the inner junctions: one head per approach on a corner pole with an arm over the lanes.
  const traffic: TrafficHead[] = [];
  const trafficLampMeshes: THREE.InstancedMesh[] = [];
  {
    const poleMats: THREE.Matrix4[] = [];
    const headMats: THREE.Matrix4[] = [];
    const lampMats: THREE.Matrix4[][] = [[], [], []];
    const pole = new THREE.CylinderGeometry(0.1, 0.13, 6.2, 8);
    pole.translate(0, 3.1, 0);
    const arm = new THREE.CylinderGeometry(0.06, 0.06, 4.6, 6);
    arm.rotateZ(Math.PI / 2);
    arm.translate(-2.3, 5.9, 0);
    const poleGeo = mergeGeometries([pole.toNonIndexed(), arm.toNonIndexed()]);
    const headGeo = new THREE.BoxGeometry(0.36, 1.05, 0.3);
    const visor = new THREE.BoxGeometry(0.34, 0.03, 0.18);
    const visors = [0.36, 0.02, -0.32].map((y) => visor.clone().translate(0, y + 0.13, 0.22));
    const headFull = mergeGeometries([headGeo.toNonIndexed(), ...visors.map((v) => v.toNonIndexed())]);
    const disc = new THREE.CircleGeometry(0.11, 16);
    for (let i = 1; i < GRID; i++) {
      for (let j = 1; j < GRID; j++) {
        const c = new THREE.Vector3(city.roads[i], 0, city.roads[j]);
        for (const fwd of [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)]) {
          const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
          const base = c.clone().addScaledVector(fwd, ROAD / 2 + 0.8).addScaledVector(right, ROAD / 2 + 0.8).setY(CURB_H);
          // The arm is built along local −x; rotate local +x onto `right` so the arm reaches over the lanes.
          const rot = Math.atan2(-right.z, right.x);
          poleMats.push(M(base, rot));
          const headPos = base.clone().addScaledVector(right, -4.3).setY(5.25 + CURB_H);
          const faceRot = Math.atan2(-fwd.x, -fwd.z);
          headMats.push(M(headPos, faceRot));
          const lampsHere = [0.36, 0.02, -0.32].map((y) => headPos.clone().addScaledVector(fwd, -0.16).setY(headPos.y + y)) as [
            THREE.Vector3,
            THREE.Vector3,
            THREE.Vector3,
          ];
          lampsHere.forEach((p, k) => lampMats[k].push(M(p, faceRot)));
          traffic.push({ lamps: lampsHere, northSouth: fwd.z !== 0 });
        }
      }
    }
    group.add(instanced(poleGeo, mats.metal, poleMats, true));
    group.add(instanced(headFull, new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.6 }), headMats));
    // Discs face +z in local space; rotate so they face back along the approach.
    const discGeo = disc.clone();
    for (let k = 0; k < 3; k++) {
      const mesh = instanced(discGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true }), lampMats[k]);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(lampMats[k].length * 3), 3);
      trafficLampMeshes.push(mesh);
      group.add(mesh);
    }
  }

  // Landmarks at night.
  for (const b of city.blocks) {
    if (b.kind === 'houses') continue;
    const inner = new THREE.PlaneGeometry(b.inner.w, b.inner.d);
    inner.rotateX(-Math.PI / 2);
    inner.translate(b.inner.x, CURB_H + 0.006, b.inner.z);
    const parkLamp = (x: number, z: number) => {
      const p = new THREE.Vector3(x, CURB_H + 3.6, z);
      lights.push({ pos: p, dir: new THREE.Vector3(0, -1, 0), cosOuter: -0.2, color: new THREE.Color(1, 0.82, 0.62), intensity: 90, range: 14, real: false });
      glows.push({ pos: p, color: new THREE.Color(1, 0.85, 0.65).multiplyScalar(0.9) });
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.4, 8), mats.metal);
      post.position.set(x, CURB_H + 1.7, z);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.88, 0.7).multiplyScalar(6) }));
      globe.position.copy(p);
      group.add(post, globe);
    };
    if (b.kind === 'plaza') {
      group.add(new THREE.Mesh(inner, mats.sidewalk));
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.3, 0.6, 40), mats.curb);
      basin.position.set(b.inner.x, CURB_H + 0.3, b.inner.z);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(4.6, 40), mats.water);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(b.inner.x, CURB_H + 0.55, b.inner.z);
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 2.6, 16), mats.curb);
      column.position.set(b.inner.x, CURB_H + 1.6, b.inner.z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.55, 0.05, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.8, 1).multiplyScalar(1.8) }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(b.inner.x, CURB_H + 0.6, b.inner.z);
      group.add(basin, pool, column, ring);
      lights.push({ pos: new THREE.Vector3(b.inner.x, CURB_H + 0.8, b.inner.z), dir: UP.clone(), cosOuter: -1, color: new THREE.Color(0.7, 0.88, 1), intensity: 140, range: 12, real: false });
      for (const [dx, dz] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) parkLamp(b.inner.x + dx, b.inner.z + dz);
    } else {
      group.add(new THREE.Mesh(inner, mats.grass));
      if (b.kind === 'park') {
        const path = new THREE.PlaneGeometry(2.4, b.inner.d);
        path.rotateX(-Math.PI / 2);
        path.translate(b.inner.x, CURB_H + 0.01, b.inner.z);
        const path2 = new THREE.PlaneGeometry(b.inner.w, 2.4);
        path2.rotateX(-Math.PI / 2);
        path2.translate(b.inner.x, CURB_H + 0.011, b.inner.z);
        group.add(new THREE.Mesh(mergeGeometries([path, path2]), mats.sidewalk));
        for (const [dx, dz] of [[-8, 2], [8, -2], [2, 9], [-2, -9]]) parkLamp(b.inner.x + dx, b.inner.z + dz);
      } else {
        const water = new THREE.Mesh(new THREE.CircleGeometry(b.inner.w / 2 - 3.5, 64), mats.water);
        water.rotation.x = -Math.PI / 2;
        water.position.set(b.inner.x, CURB_H + 0.02, b.inner.z);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(b.inner.w / 2 - 3.5, 0.18, 6, 80), mats.curb);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(b.inner.x, CURB_H + 0.06, b.inner.z);
        group.add(water, rim);
        // Pavilion in the middle with a warm lantern.
        const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 16), mats.bark);
        deck.position.set(b.inner.x, CURB_H + 0.3, b.inner.z);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(3.3, 1.5, 4), new THREE.MeshStandardMaterial({ color: 0x5a2a20, roughness: 0.8 }));
        roof.position.set(b.inner.x, CURB_H + 4.1, b.inner.z);
        roof.rotation.y = Math.PI / 4;
        group.add(deck, roof);
        for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.1, 8), mats.bark);
          post.position.set(b.inner.x + dx, CURB_H + 1.95, b.inner.z + dz);
          group.add(post);
        }
        const lantern = new THREE.Vector3(b.inner.x, CURB_H + 3.0, b.inner.z);
        lights.push({ pos: lantern, dir: new THREE.Vector3(0, -1, 0), cosOuter: -1, color: new THREE.Color(1, 0.55, 0.25), intensity: 60, range: 10, real: false });
        glows.push({ pos: lantern, color: new THREE.Color(1, 0.5, 0.2) });
        const r = b.inner.w / 2 - 2.2;
        for (let k = 0; k < 6; k++) parkLamp(b.inner.x + Math.cos((k / 6) * Math.PI * 2) * r, b.inner.z + Math.sin((k / 6) * Math.PI * 2) * r);
      }
    }
  }

  return { group, lights, glows, reflections, traffic, trafficLampMeshes, lamps };
}

/** Traffic signal cycle shared by every junction (seconds). */
export function signalState(time: number, northSouth: boolean): 0 | 1 | 2 {
  const t = (time + (northSouth ? 0 : 15)) % 30;
  if (t < 12) return 2; // green
  if (t < 15) return 1; // yellow
  return 0; // red
}
