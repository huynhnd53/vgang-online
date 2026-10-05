import { describe, expect, it } from 'vitest';
import { generateCity, LIT_GROUND, LIT_UPPER, DOOR_LAMP_GROUND } from '../src/sim/city';
import { buildHouses } from '../src/world/night/houses';
import { signalState } from '../src/world/night/streets';

// A stand-in atlas: every cell maps to the unit square.
const atlas = { uv: () => [0, 0, 1, 1] as [number, number, number, number] } as never;

describe('night houses', () => {
  const city = generateCity();
  const lots = [...city.blocks.flatMap((b) => b.lots), ...city.outerLots];
  const houses = buildHouses(lots, atlas, 8);

  it('lines the outside of the ring road with houses too', () => {
    expect(city.outerLots.length).toBeGreaterThan(40);
  });

  it('only builds glow panels for lit cells', () => {
    const litFront = lots.reduce(
      (n, l) =>
        n +
        (LIT_GROUND.has(l.ground) || l.ground === DOOR_LAMP_GROUND ? 1 : 0) +
        l.upper.filter((u) => LIT_UPPER.has(u)).length,
      0,
    );
    const panels = houses.glowPanels.getAttribute('position').count / 6;
    // Front panels plus a few lit windows on exposed corner walls.
    expect(panels).toBeGreaterThanOrEqual(litFront);
    expect(panels).toBeLessThan(litFront * 1.5);
  });

  it('gives every open shop a light that spills onto the sidewalk', () => {
    const shops = lots.filter((l) => LIT_GROUND.has(l.ground)).length;
    expect(houses.lights.filter((l) => l.range === 9).length).toBe(shops);
  });

  it('builds geometry with matching attribute counts', () => {
    for (const g of [houses.facades, houses.trim, houses.awnings, houses.signs, houses.railings]) {
      const n = g.getAttribute('position').count;
      expect(n % 6).toBe(0);
      expect(g.getAttribute('uv').count).toBe(n);
      expect(g.getAttribute('normal').count).toBe(n);
    }
  });
});

describe('traffic signals', () => {
  it('never shows green both ways at once', () => {
    for (let t = 0; t < 60; t += 0.25) {
      const ns = signalState(t, true);
      const ew = signalState(t, false);
      expect(ns === 2 && ew === 2).toBe(false);
      expect(ns === 0 && ew === 0 && t % 30 < 30).toBe(false);
    }
  });
});
