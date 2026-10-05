import * as THREE from 'three';
import type { FurnitureType } from '../game/catalog';
import { box, cylinder, mat } from './build';

export function createFurnitureMesh(type: FurnitureType): THREE.Group {
  const g = new THREE.Group();
  switch (type) {
    case 'lamp': {
      g.add(cylinder(0.2, 0.22, 0.05, 0x3a3a3a, 0, 0.025, 0));
      g.add(cylinder(0.025, 0.025, 1.3, 0x3a3a3a, 0, 0.67, 0));
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.24, 0.3, 20, 1, true),
        mat(0xffe2a8, { emissive: 0xffc56b }),
      );
      shade.position.y = 1.4;
      g.add(shade);
      const light = new THREE.PointLight(0xffc77a, 4, 4, 1.6);
      light.position.y = 1.35;
      g.add(light);
      break;
    }
    case 'plant': {
      g.add(cylinder(0.24, 0.18, 0.4, 0xc0623b, 0, 0.2, 0));
      g.add(cylinder(0.22, 0.22, 0.04, 0x4a3426, 0, 0.39, 0));
      const leaf = mat(0x3f9a4f);
      for (const [x, y, z, r] of [
        [0, 0.75, 0, 0.3],
        [0.15, 0.6, 0.1, 0.2],
        [-0.14, 0.62, -0.08, 0.22],
        [0.05, 1.0, -0.05, 0.2],
      ]) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf);
        s.position.set(x, y, z);
        g.add(s);
      }
      break;
    }
    case 'table': {
      g.add(box(1.4, 0.06, 0.8, 0xb98552, 0, 0.74, 0));
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) g.add(box(0.06, 0.71, 0.06, 0x8a5f39, sx * 0.62, 0.355, sz * 0.32));
      }
      g.add(box(0.3, 0.12, 0.2, 0xe8e1d4, 0.35, 0.83, 0));
      break;
    }
  }
  return g;
}

const ghostMaterials = {
  valid: new THREE.MeshStandardMaterial({ color: 0x5ad17a, transparent: true, opacity: 0.55, depthWrite: false }),
  invalid: new THREE.MeshStandardMaterial({ color: 0xe0564f, transparent: true, opacity: 0.55, depthWrite: false }),
};

/** Translucent copy of a furniture mesh used while choosing where to put it. */
export function createGhost(type: FurnitureType): THREE.Group {
  const g = createFurnitureMesh(type);
  g.traverse((o) => {
    if (o instanceof THREE.PointLight) o.visible = false;
  });
  setGhostValid(g, true);
  return g;
}

export function setGhostValid(ghost: THREE.Group, valid: boolean): void {
  const m = valid ? ghostMaterials.valid : ghostMaterials.invalid;
  ghost.traverse((o) => {
    if (o instanceof THREE.Mesh) o.material = m;
  });
}
