import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { type City, GRID, HALF, ROAD, SIDEWALK } from '../sim/city';
import { asphaltTexture, facadeTexture, shopTexture, sidewalkTexture } from './textures';

const FLOOR_H = 3.2;
const BAY_W = 4;
const CURB_H = 0.18;
const GROUND_FLOOR = 3.6;

/** A box whose side UVs repeat per bay/floor and whose top and bottom sample plain wall. */
function facadeBox(w: number, h: number, d: number, x: number, y: number, z: number, repeatV: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  // Face order: +x, -x, +y, -y, +z, -z; four vertices each.
  const faceWidths = [d, d, 0, 0, w, w];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      if (faceWidths[f] === 0) {
        uv.setXY(i, 0.01, 0.99);
      } else {
        uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(faceWidths[f] / BAY_W)), uv.getY(i) * repeatV);
      }
    }
  }
  g.translate(x, y, z);
  return g;
}

function mergeInto(group: THREE.Group, geos: THREE.BufferGeometry[], material: THREE.Material): void {
  if (geos.length === 0) return;
  const mesh = new THREE.Mesh(mergeGeometries(geos, false), material);
  group.add(mesh);
}

function instanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: THREE.Matrix4[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  transforms.forEach((m, k) => mesh.setMatrixAt(k, m));
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

const m4 = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
    new THREE.Vector3(sx, sy, sz),
  );

export function buildCityMesh(city: City): THREE.Group {
  const group = new THREE.Group();
  const span = HALF * 2 + ROAD;

  // Ground beyond the city and the asphalt under it.
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshLambertMaterial({ color: 0x7da35a }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.02;
  group.add(grass);
  const asphalt = asphaltTexture();
  asphalt.repeat.set(span / 6, span / 6);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(span, span), new THREE.MeshLambertMaterial({ map: asphalt }));
  road.rotation.x = -Math.PI / 2;
  group.add(road);

  // Low hedge around the outside of the ring road.
  const hedgeGeos: THREE.BufferGeometry[] = [];
  const edge = HALF + ROAD / 2 + 0.6;
  for (const [x, z, w, d] of [
    [0, -edge, edge * 2 + 1.2, 1.2],
    [0, edge, edge * 2 + 1.2, 1.2],
    [-edge, 0, 1.2, edge * 2],
    [edge, 0, 1.2, edge * 2],
  ]) {
    const g = new THREE.BoxGeometry(w, 1.1, d);
    g.translate(x, 0.55, z);
    hedgeGeos.push(g);
  }
  mergeInto(group, hedgeGeos, new THREE.MeshLambertMaterial({ color: 0x4f7d3a }));

  // Sidewalk slabs (all blocks) and block surfaces.
  const walk = sidewalkTexture();
  walk.repeat.set(1, 1);
  const curbGeos: THREE.BufferGeometry[] = [];
  const walkGeos: THREE.BufferGeometry[] = [];
  const grassGeos: THREE.BufferGeometry[] = [];
  const stoneGeos: THREE.BufferGeometry[] = [];
  const waterGeos: THREE.BufferGeometry[] = [];
  for (const b of city.blocks) {
    const curb = new THREE.BoxGeometry(b.rect.w, CURB_H, b.rect.d);
    curb.translate(b.rect.x, CURB_H / 2, b.rect.z);
    curbGeos.push(curb);
    const top = new THREE.PlaneGeometry(b.rect.w - 0.3, b.rect.d - 0.3);
    top.rotateX(-Math.PI / 2);
    const uv = top.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (b.rect.w / 2), uv.getY(i) * (b.rect.d / 2));
    top.translate(b.rect.x, CURB_H + 0.005, b.rect.z);
    walkGeos.push(top);

    const inner = new THREE.PlaneGeometry(b.inner.w, b.inner.d);
    inner.rotateX(-Math.PI / 2);
    inner.translate(b.inner.x, CURB_H + 0.01, b.inner.z);
    if (b.kind === 'park' || b.kind === 'lake') grassGeos.push(inner);
    else if (b.kind === 'plaza') stoneGeos.push(inner);
    if (b.kind === 'lake') {
      const water = new THREE.CircleGeometry(Math.min(b.inner.w, b.inner.d) / 2 - 3, 40);
      water.rotateX(-Math.PI / 2);
      water.translate(b.inner.x, CURB_H + 0.03, b.inner.z);
      waterGeos.push(water);
    }
  }
  mergeInto(group, curbGeos, new THREE.MeshLambertMaterial({ color: 0x9a948a }));
  mergeInto(group, walkGeos, new THREE.MeshLambertMaterial({ map: walk }));
  mergeInto(group, grassGeos, new THREE.MeshLambertMaterial({ color: 0x6fae55 }));
  mergeInto(group, stoneGeos, new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }));
  mergeInto(group, waterGeos, new THREE.MeshStandardMaterial({ color: 0x3f8fc0, roughness: 0.15, metalness: 0.1 }));

  // Houses, grouped by facade style so each style is one draw call.
  const styleGeos: THREE.BufferGeometry[][] = [[], [], []];
  const shopGeos: THREE.BufferGeometry[] = [];
  const awningByColor = new Map<number, THREE.BufferGeometry[]>();
  const roofGeos: THREE.BufferGeometry[] = [];
  for (const b of city.blocks) {
    for (const lot of b.lots) {
      const { rect, height } = lot;
      const upper = height - GROUND_FLOOR;
      const geo = facadeBox(rect.w, upper, rect.d, rect.x, CURB_H + GROUND_FLOOR + upper / 2, rect.z, upper / FLOOR_H);
      const color = new THREE.Color(lot.color);
      const colors = new Float32Array(geo.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      styleGeos[lot.style].push(geo);

      const shop = facadeBox(rect.w, GROUND_FLOOR, rect.d, rect.x, CURB_H + GROUND_FLOOR / 2, rect.z, 1);
      shopGeos.push(shop);

      // Parapet on the roof.
      const roof = new THREE.BoxGeometry(rect.w + 0.1, 0.4, rect.d + 0.1);
      roof.translate(rect.x, CURB_H + height + 0.2, rect.z);
      roofGeos.push(roof);

      if (lot.awning !== null) {
        const out = 1.4;
        const long = (lot.facing === 'px' || lot.facing === 'nx' ? rect.d : rect.w) - 0.4;
        const a = new THREE.BoxGeometry(lot.facing === 'px' || lot.facing === 'nx' ? out : long, 0.12, lot.facing === 'px' || lot.facing === 'nx' ? long : out);
        const tilt = 0.18;
        if (lot.facing === 'pz') a.rotateX(tilt);
        if (lot.facing === 'nz') a.rotateX(-tilt);
        if (lot.facing === 'px') a.rotateZ(-tilt);
        if (lot.facing === 'nx') a.rotateZ(tilt);
        const off = {
          px: [rect.w / 2 + out / 2, 0],
          nx: [-rect.w / 2 - out / 2, 0],
          pz: [0, rect.d / 2 + out / 2],
          nz: [0, -rect.d / 2 - out / 2],
        }[lot.facing];
        a.translate(rect.x + off[0], CURB_H + GROUND_FLOOR - 0.3, rect.z + off[1]);
        const list = awningByColor.get(lot.awning) ?? [];
        list.push(a);
        awningByColor.set(lot.awning, list);
      }
    }
  }
  styleGeos.forEach((geos, style) =>
    mergeInto(group, geos, new THREE.MeshLambertMaterial({ map: facadeTexture(style), vertexColors: true })),
  );
  mergeInto(group, shopGeos, new THREE.MeshLambertMaterial({ map: shopTexture(), color: 0xf1ece2 }));
  mergeInto(group, roofGeos, new THREE.MeshLambertMaterial({ color: 0x8c8378 }));
  for (const [color, geos] of awningByColor) mergeInto(group, geos, new THREE.MeshLambertMaterial({ color }));

  // Street furniture along the sidewalks: trees and lamps, skipping block corners.
  const trees: THREE.Matrix4[] = [];
  const lamps: THREE.Matrix4[] = [];
  for (const b of city.blocks) {
    const half = b.rect.w / 2 - SIDEWALK / 2;
    for (let t = -half + 6; t <= half - 6; t += 9) {
      for (const [x, z, ry] of [
        // Rotation points each lamp arm out over the road.
        [b.rect.x + t, b.rect.z - half, Math.PI],
        [b.rect.x + t, b.rect.z + half, 0],
        [b.rect.x - half, b.rect.z + t, -Math.PI / 2],
        [b.rect.x + half, b.rect.z + t, Math.PI / 2],
      ]) {
        const k = Math.round(t / 9);
        if (k % 2 === 0) trees.push(m4(x, CURB_H, z, 1, 0.9 + ((k * 7 + b.i * 3 + b.j) % 5) * 0.08, 1));
        else lamps.push(m4(x, CURB_H, z, 1, 1, 1, ry));
      }
    }
    if (b.kind === 'park' || b.kind === 'lake') {
      for (let n = 0; n < 14; n++) {
        const a = (n / 14) * Math.PI * 2 + b.i;
        const r = b.kind === 'lake' ? b.inner.w / 2 - 1.5 : 6 + ((n * 37) % 11);
        trees.push(m4(b.inner.x + Math.cos(a) * r, CURB_H, b.inner.z + Math.sin(a) * r, 1.3, 1.3, 1.3));
      }
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.2, 2.6, 7);
  trunkGeo.translate(0, 1.3, 0);
  const canopyGeo = new THREE.IcosahedronGeometry(1.6, 0);
  canopyGeo.translate(0, 3.6, 0);
  group.add(instanced(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x6b4f37 }), trees));
  group.add(instanced(canopyGeo, new THREE.MeshLambertMaterial({ color: 0x4e8f3e, flatShading: true }), trees));

  const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 5.5, 6);
  poleGeo.translate(0, 2.75, 0);
  const armGeo = new THREE.BoxGeometry(0.08, 0.08, 1.4);
  armGeo.translate(0, 5.4, 0.65);
  const headGeo = new THREE.BoxGeometry(0.3, 0.12, 0.5);
  headGeo.translate(0, 5.35, 1.3);
  group.add(instanced(mergeGeometries([poleGeo, armGeo]), new THREE.MeshLambertMaterial({ color: 0x55606a }), lamps));
  group.add(instanced(headGeo, new THREE.MeshLambertMaterial({ color: 0xfff3c4, emissive: 0x403a20 }), lamps));

  // Road markings: dashed centre lines and zebra crossings at every intersection.
  const dashes: THREE.Matrix4[] = [];
  const zebra: THREE.Matrix4[] = [];
  for (const r of city.roads) {
    for (let k = 0; k < GRID; k++) {
      const from = city.roads[k] + ROAD / 2 + 4;
      const to = city.roads[k + 1] - ROAD / 2 - 4;
      for (let t = from; t < to; t += 6) {
        dashes.push(m4(r, 0.02, t + 1.5, 1, 1, 1));
        dashes.push(m4(t + 1.5, 0.02, r, 1, 1, 1, Math.PI / 2));
      }
    }
  }
  for (const rx of city.roads) {
    for (const rz of city.roads) {
      for (let s = -ROAD / 2 + 1; s <= ROAD / 2 - 1; s += 1.2) {
        for (const [x, z, ry] of [
          [rx + s, rz - ROAD / 2 - 1.6, 0],
          [rx + s, rz + ROAD / 2 + 1.6, 0],
          [rx - ROAD / 2 - 1.6, rz + s, Math.PI / 2],
          [rx + ROAD / 2 + 1.6, rz + s, Math.PI / 2],
        ]) {
          if (Math.abs(x) > HALF + ROAD / 2 - 0.5 || Math.abs(z) > HALF + ROAD / 2 - 0.5) continue;
          zebra.push(m4(x, 0.02, z, 1, 1, 1, ry));
        }
      }
    }
  }
  const dashGeo = new THREE.PlaneGeometry(0.15, 3);
  dashGeo.rotateX(-Math.PI / 2);
  const zebraGeo = new THREE.PlaneGeometry(0.55, 2.6);
  zebraGeo.rotateX(-Math.PI / 2);
  const paint = new THREE.MeshLambertMaterial({ color: 0xf2f2ea });
  group.add(instanced(dashGeo, paint, dashes));
  group.add(instanced(zebraGeo, paint, zebra));

  // Landmarks: a fountain on the plaza and a pavilion by the lake.
  for (const b of city.blocks) {
    if (b.kind === 'plaza') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.3, 0.6, 32), new THREE.MeshLambertMaterial({ color: 0xbdb4a4 }));
      base.position.set(b.inner.x, CURB_H + 0.3, b.inner.z);
      const pool = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x5aa9d6, roughness: 0.1 }));
      pool.position.set(b.inner.x, CURB_H + 0.62, b.inner.z);
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 3, 16), new THREE.MeshLambertMaterial({ color: 0xd8d0c0 }));
      column.position.set(b.inner.x, CURB_H + 2, b.inner.z);
      group.add(base, pool, column);
    }
    if (b.kind === 'lake') {
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.6, 4), new THREE.MeshLambertMaterial({ color: 0xb5402f }));
      roof.position.set(b.inner.x, CURB_H + 4.2, b.inner.z);
      roof.rotation.y = Math.PI / 4;
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 16), new THREE.MeshLambertMaterial({ color: 0x8a5f39 }));
      deck.position.set(b.inner.x, CURB_H + 0.4, b.inner.z);
      group.add(roof, deck);
      for (const [dx, dz] of [
        [-1.6, -1.6],
        [1.6, -1.6],
        [-1.6, 1.6],
        [1.6, 1.6],
      ]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 8), new THREE.MeshLambertMaterial({ color: 0xa8382a }));
        post.position.set(b.inner.x + dx, CURB_H + 1.9, b.inner.z + dz);
        group.add(post);
      }
    }
  }
  return group;
}
