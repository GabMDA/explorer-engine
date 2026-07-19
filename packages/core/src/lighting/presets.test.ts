import { describe, it, expect } from 'vitest';
import {
  lightingPresets,
  getLightingPreset,
  STUDIO_LIGHTING,
  type LightingPresetId,
} from './presets';
import type { LightSpec } from '../ports/lighting-port';

const ids = Object.keys(lightingPresets) as LightingPresetId[];

describe('lighting presets', () => {
  it('exposes studio, outdoor and night', () => {
    expect(ids).toEqual(['studio', 'outdoor', 'night']);
  });

  it('getLightingPreset returns the preset whose id matches its key', () => {
    for (const id of ids) {
      const preset = getLightingPreset(id);
      expect(preset).toBe(lightingPresets[id]);
      expect(preset.id).toBe(id);
    }
  });

  it('every preset has at least one light with a known kind', () => {
    const kinds = new Set<LightSpec['kind']>(['ambient', 'hemisphere', 'directional', 'point']);
    for (const id of ids) {
      const { lights } = lightingPresets[id];
      expect(lights.length).toBeGreaterThan(0);
      for (const light of lights) expect(kinds.has(light.kind)).toBe(true);
    }
  });

  it('studio is a three-point setup (fill + key + rim), all data-only', () => {
    expect(STUDIO_LIGHTING.lights).toHaveLength(3);
    // Pure data: JSON round-trips without loss (no functions/backend objects).
    expect(JSON.parse(JSON.stringify(STUDIO_LIGHTING))).toEqual(STUDIO_LIGHTING);
  });
});
