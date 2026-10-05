import { type Rect, mulberry32 } from './geometry';

/** City grid dimensions in metres. Roads run along x and z between square blocks. */
export const GRID = 6;
export const BLOCK = 46;
export const ROAD = 14;
export const SIDEWALK = 3.5;
export const PITCH = BLOCK + ROAD;
/** Distance from the city centre to the middle of the outermost road. */
export const HALF = (GRID * PITCH) / 2;

export type BlockKind = 'houses' | 'park' | 'lake' | 'plaza';

export interface Lot {
  rect: Rect;
  height: number;
  color: number;
  /** Which facade texture variant to use. */
  style: number;
  /** Side of the block the front faces: +x, -x, +z or -z. */
  facing: 'px' | 'nx' | 'pz' | 'nz';
  awning: number | null;
}

export interface Block {
  i: number;
  j: number;
  kind: BlockKind;
  /** Whole block including sidewalk (the curb outline). */
  rect: Rect;
  /** Area inside the sidewalk. */
  inner: Rect;
  lots: Lot[];
}

export interface City {
  blocks: Block[];
  /** Road centre lines (same values for x and z). */
  roads: number[];
  /** Solid areas the scooter cannot enter. */
  colliders: Rect[];
  /** Drivable extent (outer edge of the outermost roads). */
  bounds: Rect;
  spawn: { x: number; z: number; heading: number };
}

const HOUSE_COLORS = [0xf2d16b, 0xe8a7a0, 0x9fc5e8, 0xb6d7a8, 0xf6b26b, 0xf3efe6, 0xd9c2a6, 0xc9b3e6, 0x8fd3c7];
const AWNING_COLORS = [0xd9534f, 0x2f8f6f, 0x3b7dd8, 0xf0ad4e, 0x7d5ba6];

/** Special blocks give the city a few landmarks to ride to. */
function kindFor(i: number, j: number): BlockKind {
  if (i === 2 && j === 2) return 'lake';
  if ((i === 4 && j === 1) || (i === 1 && j === 4)) return 'park';
  if (i === 3 && j === 4) return 'plaza';
  return 'houses';
}

function buildHouses(inner: Rect, rand: () => number): Lot[] {
  const lots: Lot[] = [];
  const x0 = inner.x - inner.w / 2;
  const x1 = inner.x + inner.w / 2;
  const z0 = inner.z - inner.d / 2;
  const z1 = inner.z + inner.d / 2;
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];

  const make = (rect: Rect, facing: Lot['facing']): Lot => ({
    rect,
    facing,
    height: 7 + Math.floor(rand() * 5) * 3.2 + (rand() < 0.12 ? 12 : 0),
    color: pick(HOUSE_COLORS),
    style: Math.floor(rand() * 3),
    awning: rand() < 0.55 ? pick(AWNING_COLORS) : null,
  });

  // Narrow "nhà ống" tube houses along each street front; corners are owned by the x-facing rows.
  const depth = 14;
  const row = (from: number, to: number, place: (a: number, b: number) => Lot) => {
    let a = from;
    while (to - a > 3.5) {
      let w = 4 + rand() * 4;
      if (to - a - w < 3.5) w = to - a;
      lots.push(place(a, a + w));
      a += w;
    }
  };
  row(x0, x1, (a, b) => make({ x: (a + b) / 2, z: z0 + depth / 2, w: b - a, d: depth }, 'nz'));
  row(x0, x1, (a, b) => make({ x: (a + b) / 2, z: z1 - depth / 2, w: b - a, d: depth }, 'pz'));
  row(z0 + depth, z1 - depth, (a, b) => make({ x: x0 + depth / 2, z: (a + b) / 2, w: depth, d: b - a }, 'nx'));
  row(z0 + depth, z1 - depth, (a, b) => make({ x: x1 - depth / 2, z: (a + b) / 2, w: depth, d: b - a }, 'px'));
  return lots;
}

export function generateCity(seed = 20261005): City {
  const rand = mulberry32(seed);
  const roads: number[] = [];
  for (let k = 0; k <= GRID; k++) roads.push(-HALF + k * PITCH);

  const blocks: Block[] = [];
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const cx = roads[i] + PITCH / 2;
      const cz = roads[j] + PITCH / 2;
      const rect: Rect = { x: cx, z: cz, w: BLOCK, d: BLOCK };
      const inner: Rect = { x: cx, z: cz, w: BLOCK - SIDEWALK * 2, d: BLOCK - SIDEWALK * 2 };
      const kind = kindFor(i, j);
      blocks.push({ i, j, kind, rect, inner, lots: kind === 'houses' ? buildHouses(inner, rand) : [] });
    }
  }

  const edge = HALF + ROAD / 2;
  return {
    blocks,
    roads,
    colliders: blocks.map((b) => b.rect),
    bounds: { x: 0, z: 0, w: edge * 2, d: edge * 2 },
    // Middle of the road just south of the centre, heading north (-z), in the right-hand lane.
    spawn: { x: roads[GRID / 2] + ROAD / 4, z: roads[GRID / 2] + PITCH / 2, heading: 0 },
  };
}
