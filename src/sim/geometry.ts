/** Axis-aligned rectangle on the ground plane, centred at (x, z). */
export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export function circleHitsRect(x: number, z: number, r: number, rect: Rect): boolean {
  const cx = Math.max(rect.x - rect.w / 2, Math.min(x, rect.x + rect.w / 2));
  const cz = Math.max(rect.z - rect.d / 2, Math.min(z, rect.z + rect.d / 2));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

export function pointInRect(x: number, z: number, rect: Rect): boolean {
  return Math.abs(x - rect.x) <= rect.w / 2 && Math.abs(z - rect.z) <= rect.d / 2;
}

/** Small deterministic PRNG so the city is the same on every visit. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
