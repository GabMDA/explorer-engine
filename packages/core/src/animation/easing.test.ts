import { describe, it, expect } from 'vitest';
import { EASINGS, resolveEasing } from './easing';
import { EASE_NAMES } from '@explorer-engine/schema';

describe('easing', () => {
  it('provides a function for every EaseName in the closed set', () => {
    for (const name of EASE_NAMES) expect(typeof EASINGS[name]).toBe('function');
  });

  it('pins endpoints f(0)=0 and f(1)=1 for every easing', () => {
    for (const name of EASE_NAMES) {
      const f = EASINGS[name];
      expect(f(0)).toBeCloseTo(0, 6);
      expect(f(1)).toBeCloseTo(1, 6);
    }
  });

  it('linear is the identity', () => {
    expect(EASINGS.linear(0.25)).toBe(0.25);
    expect(EASINGS.linear(0.5)).toBe(0.5);
  });

  it('easeIn starts slower than linear, easeOut faster (at t=0.25)', () => {
    expect(EASINGS.easeIn(0.25)).toBeLessThan(0.25);
    expect(EASINGS.easeOut(0.25)).toBeGreaterThan(0.25);
  });

  it('easeInOut is symmetric around 0.5', () => {
    expect(EASINGS.easeInOut(0.5)).toBeCloseTo(0.5, 6);
    expect(EASINGS.easeInOut(0.25) + EASINGS.easeInOut(0.75)).toBeCloseTo(1, 6);
  });

  it('resolveEasing falls back to linear for an unknown name', () => {
    expect(resolveEasing('nope' as never)(0.4)).toBe(0.4);
  });
});
