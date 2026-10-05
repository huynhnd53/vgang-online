import * as THREE from 'three';
import { PRODUCTS, type ProductId } from '../game/catalog';
import { box, mat } from './build';

export function createPerson(shirt: number, pants = 0x3b4a6b, skin = 0xf0c8a0, hair = 0x2b2118): THREE.Group {
  const g = new THREE.Group();
  const legs = box(0.34, 0.8, 0.22, pants, 0, 0.4, 0);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 6, 12), mat(shirt));
  body.position.y = 1.12;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), mat(skin));
  head.position.y = 1.6;
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(hair));
  hairCap.position.y = 1.62;
  // A nose so facing direction is readable from the third-person camera.
  const nose = box(0.05, 0.05, 0.06, skin, 0, 1.6, -0.18);
  g.add(legs, body, head, hairCap, nose);
  return g;
}

export function createProductMesh(product: ProductId): THREE.Mesh {
  const def = PRODUCTS[product];
  if (product === 2) {
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), mat(def.color, { roughness: 0.5 }));
    apple.position.y = 0.09;
    return apple;
  }
  if (product === 1) {
    const bread = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 4, 10), mat(def.color));
    bread.rotation.z = Math.PI / 2;
    bread.position.y = 0.07;
    return bread;
  }
  const milk = box(0.12, 0.22, 0.12, def.color, 0, 0.11, 0);
  milk.add(box(0.125, 0.06, 0.125, 0x3b7dd8, 0, 0.02, 0));
  return milk;
}

/** Cardboard box with a product on top, used for carrying stock. */
export function createCarryBox(product: ProductId): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.36, 0.24, 0.28, 0xc79a62, 0, 0, 0));
  g.add(box(0.37, 0.03, 0.06, 0xa77a45, 0, 0.12, 0));
  const p = createProductMesh(product);
  p.position.y += 0.12;
  g.add(p);
  return g;
}
