import { describe, it, expect } from 'vitest';
import {
  composeVisualState,
  visualStateEquals,
  REST_VISUAL_STATE,
  isVisualChannel,
  isIntentChannel,
  type VisualContribution,
} from './channels';

let seq = 0;
function c(
  channel: VisualContribution['channel'],
  value: unknown,
  priority = 0,
): VisualContribution {
  return { channel, value: value as never, priority, seq: seq++ };
}

describe('composeVisualState', () => {
  it('returns the shared rest state for no contributions', () => {
    expect(composeVisualState([])).toBe(REST_VISUAL_STATE);
  });

  it('takes the MIN opacity (most transparent wins) regardless of order', () => {
    const a = composeVisualState([c('opacity', 0.8), c('opacity', 0.2), c('opacity', 0.5)]);
    const b = composeVisualState([c('opacity', 0.2), c('opacity', 0.5), c('opacity', 0.8)]);
    expect(a.opacity).toBe(0.2);
    expect(b.opacity).toBe(0.2);
  });

  it('lets "hidden" win visibility over any number of "visible"', () => {
    expect(
      composeVisualState([c('visibility', 'visible'), c('visibility', 'hidden')]).visibility,
    ).toBe('hidden');
  });

  it('sums transform translate/rotate offsets and multiplies scale (additive channel)', () => {
    const s = composeVisualState([
      c('transform', { translate: [1, 0, 0], scale: 2 }),
      c('transform', { translate: [0, 3, 0], rotate: [0, 0, 1], scale: [1, 1, 4] }),
    ]);
    expect(s.transform?.translate).toEqual([1, 3, 0]);
    expect(s.transform?.rotate).toEqual([0, 0, 1]);
    expect(s.transform?.scale).toEqual([2, 2, 8]);
  });

  it('resolves colorOverride and outline by PRIORITY (higher wins; tie → later)', () => {
    const s = composeVisualState([
      c('colorOverride', { color: '#111', intensity: 0.3 }, 10),
      c('colorOverride', { color: '#222', intensity: 0.9 }, 70),
      c('colorOverride', { color: '#333', intensity: 0.5 }, 50),
    ]);
    expect(s.colorOverride).toEqual({ color: '#222', intensity: 0.9 });

    const tie = composeVisualState([
      c('outline', { color: '#a', thickness: 1 }, 70),
      c('outline', { color: '#b', thickness: 2 }, 70),
    ]);
    expect(tie.outline).toEqual({ color: '#b', thickness: 2 }); // later seq wins the tie
  });

  it('composes independent channels together (X-ray opacity + focus outline)', () => {
    const s = composeVisualState([
      c('opacity', 0.2, 50),
      c('outline', { color: '#3ba7ff', thickness: 1 }, 100),
    ]);
    expect(s.opacity).toBe(0.2);
    expect(s.outline).toEqual({ color: '#3ba7ff', thickness: 1 });
    expect(s.visibility).toBe('visible');
  });
});

describe('visualStateEquals', () => {
  it('treats scalar and per-axis identical scales as equal', () => {
    const a = composeVisualState([c('transform', { scale: 2 })]);
    const b = composeVisualState([c('transform', { scale: [2, 2, 2] })]);
    expect(visualStateEquals(a, b)).toBe(true);
  });

  it('distinguishes differing opacity / override', () => {
    expect(visualStateEquals(composeVisualState([c('opacity', 0.5)]), REST_VISUAL_STATE)).toBe(
      false,
    );
  });
});

describe('channel guards', () => {
  it('classifies visual vs intent channels', () => {
    expect(isVisualChannel('opacity')).toBe(true);
    expect(isVisualChannel('cameraIntent')).toBe(false);
    expect(isIntentChannel('cameraIntent')).toBe(true);
    expect(isIntentChannel('outline')).toBe(false);
  });
});
