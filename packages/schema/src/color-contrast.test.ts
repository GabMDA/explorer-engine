import { describe, it, expect } from 'vitest';
import {
  parseHexColor,
  relativeLuminance,
  contrastRatio,
  meetsWcagAaNormalText,
} from './color-contrast';

describe('color-contrast', () => {
  it('parses 3/6/8-digit hex colors', () => {
    expect(parseHexColor('#fff')).toEqual([255, 255, 255]);
    expect(parseHexColor('#ffffff')).toEqual([255, 255, 255]);
    expect(parseHexColor('#ffffffaa')).toEqual([255, 255, 255]);
  });

  it('returns null for non-hex input', () => {
    expect(parseHexColor('blue')).toBeNull();
    expect(relativeLuminance('not-a-color')).toBeNull();
    expect(contrastRatio('#ffffff', 'nope')).toBeNull();
  });

  it('computes max contrast (black/white) as 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('computes identical colors as ratio 1', () => {
    expect(contrastRatio('#3ba7ff', '#3ba7ff')).toBeCloseTo(1, 5);
  });

  it('is order-independent', () => {
    expect(contrastRatio('#111111', '#eeeeee')).toBeCloseTo(
      contrastRatio('#eeeeee', '#111111') as number,
      5,
    );
  });

  it('flags AA pass/fail at the 4.5:1 threshold', () => {
    expect(meetsWcagAaNormalText('#000000', '#ffffff')).toBe(true);
    expect(meetsWcagAaNormalText('#dddddd', '#ffffff')).toBe(false);
  });
});
