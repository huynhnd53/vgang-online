import { describe, expect, it } from 'vitest';
import { DEFAULT_GAUGE, GAUGE_THEMES, gaugeTheme } from '../src/cockpit/gauges';

describe('gauge themes', () => {
  it('have unique ids and names', () => {
    expect(new Set(GAUGE_THEMES.map((t) => t.id)).size).toBe(GAUGE_THEMES.length);
    expect(new Set(GAUGE_THEMES.map((t) => t.name)).size).toBe(GAUGE_THEMES.length);
    expect(GAUGE_THEMES.length).toBeGreaterThanOrEqual(4);
  });

  it('falls back to the default face for unknown or stale saved ids', () => {
    expect(gaugeTheme('does-not-exist').id).toBe(DEFAULT_GAUGE);
    expect(gaugeTheme('neon').id).toBe('neon');
  });
});
