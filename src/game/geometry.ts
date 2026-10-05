/** Axis-aligned rectangle on the floor plane, centred at (x, z). */
export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap - 1e-6 &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + gap - 1e-6
  );
}

export function rectInside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x - inner.w / 2 >= outer.x - outer.w / 2 - 1e-6 &&
    inner.x + inner.w / 2 <= outer.x + outer.w / 2 + 1e-6 &&
    inner.z - inner.d / 2 >= outer.z - outer.d / 2 - 1e-6 &&
    inner.z + inner.d / 2 <= outer.z + outer.d / 2 + 1e-6
  );
}

/** True when a circle of radius r at (x, z) intersects the rectangle. */
export function circleHitsRect(x: number, z: number, r: number, rect: Rect): boolean {
  const cx = Math.max(rect.x - rect.w / 2, Math.min(x, rect.x + rect.w / 2));
  const cz = Math.max(rect.z - rect.d / 2, Math.min(z, rect.z + rect.d / 2));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < r * r;
}

export function distanceToRect(x: number, z: number, rect: Rect): number {
  const dx = Math.max(Math.abs(x - rect.x) - rect.w / 2, 0);
  const dz = Math.max(Math.abs(z - rect.z) - rect.d / 2, 0);
  return Math.hypot(dx, dz);
}
