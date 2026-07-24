import { describe, it, expect, vi } from 'vitest';
import { createQualityManager } from './quality-manager';
import { EventBus } from '../events/event-bus';
import type { EngineEventMap } from '../types/events';
import type { RendererPort } from '../ports/renderer-port';

const LEVELS = {
  low: { maxPixelRatio: 1 },
  medium: { maxPixelRatio: 1.5 },
  high: { maxPixelRatio: 2 },
} as const;

function fakeRenderer(): Pick<RendererPort, 'setPixelRatio'> & { calls: number[] } {
  const calls: number[] = [];
  return {
    calls,
    setPixelRatio: (pixelRatio: number) => {
      calls.push(pixelRatio);
    },
  };
}

describe('createQualityManager', () => {
  it('applies the initial level lever immediately (declarative sync)', () => {
    const renderer = fakeRenderer();
    createQualityManager({ levels: LEVELS, renderer, frameBudgetMs: 16.6, initialLevel: 'medium' });
    expect(renderer.calls).toEqual([1.5]);
  });

  it('defaults to "high" and adaptive=true', () => {
    const renderer = fakeRenderer();
    const manager = createQualityManager({ levels: LEVELS, renderer, frameBudgetMs: 16.6 });
    expect(manager.level).toBe('high');
    expect(manager.adaptive).toBe(true);
  });

  it('degrades one tier after N consecutive over-budget samples, emitting quality:changed', () => {
    const renderer = fakeRenderer();
    const events = new EventBus<EngineEventMap>();
    const received: unknown[] = [];
    events.on('quality:changed', (e) => received.push(e));
    const manager = createQualityManager({
      levels: LEVELS,
      renderer,
      frameBudgetMs: 16.6,
      degradeAfterFrames: 3,
      events,
    });

    manager.sample(30);
    manager.sample(30);
    expect(manager.level).toBe('high'); // not yet (only 2 consecutive)
    manager.sample(30);
    expect(manager.level).toBe('medium');
    expect(received).toEqual([{ level: 'medium', reason: 'auto' }]);
    expect(renderer.calls.at(-1)).toBe(1.5);
  });

  it('never degrades past the lowest tier', () => {
    const renderer = fakeRenderer();
    const manager = createQualityManager({
      levels: LEVELS,
      renderer,
      frameBudgetMs: 16.6,
      initialLevel: 'low',
      degradeAfterFrames: 1,
    });
    manager.sample(100);
    manager.sample(100);
    expect(manager.level).toBe('low');
  });

  it('upgrades one tier after N consecutive under-budget samples', () => {
    const renderer = fakeRenderer();
    const manager = createQualityManager({
      levels: LEVELS,
      renderer,
      frameBudgetMs: 16.6,
      initialLevel: 'low',
      upgradeAfterFrames: 2,
    });
    manager.sample(5);
    expect(manager.level).toBe('low');
    manager.sample(5);
    expect(manager.level).toBe('medium');
  });

  it('never upgrades past the highest tier', () => {
    const renderer = fakeRenderer();
    const manager = createQualityManager({
      levels: LEVELS,
      renderer,
      frameBudgetMs: 16.6,
      initialLevel: 'high',
      upgradeAfterFrames: 1,
    });
    manager.sample(5);
    manager.sample(5);
    expect(manager.level).toBe('high');
  });

  it('a mixed over/under streak resets the opposite counter (no cross-contamination)', () => {
    const renderer = fakeRenderer();
    const manager = createQualityManager({
      levels: LEVELS,
      renderer,
      frameBudgetMs: 16.6,
      initialLevel: 'medium',
      degradeAfterFrames: 3,
    });
    manager.sample(30); // over
    manager.sample(30); // over
    manager.sample(5); // under — resets the over-budget streak
    manager.sample(30);
    manager.sample(30);
    expect(manager.level).toBe('medium'); // never reached 3 consecutive over-budget samples
  });

  it('sample() is a no-op once adaptive is disabled', () => {
    const renderer = fakeRenderer();
    const manager = createQualityManager({
      levels: LEVELS,
      renderer,
      frameBudgetMs: 16.6,
      degradeAfterFrames: 1,
      adaptive: false,
    });
    manager.sample(100);
    manager.sample(100);
    expect(manager.level).toBe('high');
  });

  it('setLevel() forces a tier, disables adaptive, and emits reason "manual"', () => {
    const renderer = fakeRenderer();
    const events = new EventBus<EngineEventMap>();
    const received: unknown[] = [];
    events.on('quality:changed', (e) => received.push(e));
    const manager = createQualityManager({ levels: LEVELS, renderer, frameBudgetMs: 16.6, events });

    manager.setLevel('low');
    expect(manager.level).toBe('low');
    expect(manager.adaptive).toBe(false);
    expect(received).toEqual([{ level: 'low', reason: 'manual' }]);
    expect(renderer.calls.at(-1)).toBe(1);

    // A subsequent sample() must NOT silently override the explicit choice.
    manager.sample(1000);
    expect(manager.level).toBe('low');
  });

  it('setAdaptive(true) resumes automatic adaptation after a manual override', () => {
    const renderer = fakeRenderer();
    const manager = createQualityManager({
      levels: LEVELS,
      renderer,
      frameBudgetMs: 16.6,
      degradeAfterFrames: 1,
    });
    manager.setLevel('high');
    manager.setAdaptive(true);
    manager.sample(100);
    expect(manager.level).toBe('medium');
  });

  it('dispose() is idempotent and stops any further effect', () => {
    const renderer = fakeRenderer();
    const manager = createQualityManager({
      levels: LEVELS,
      renderer,
      frameBudgetMs: 16.6,
      degradeAfterFrames: 1,
    });
    manager.dispose();
    manager.dispose(); // idempotent
    const callsBefore = renderer.calls.length;
    manager.sample(100);
    manager.setLevel('low');
    manager.setAdaptive(false);
    expect(renderer.calls.length).toBe(callsBefore); // no further lever calls after dispose
  });

  it('drives ONLY setPixelRatio — never calls any other renderer method', () => {
    const setPixelRatio = vi.fn();
    const renderer = { setPixelRatio } as Pick<RendererPort, 'setPixelRatio'>;
    const manager = createQualityManager({
      levels: LEVELS,
      renderer,
      frameBudgetMs: 16.6,
      degradeAfterFrames: 1,
    });
    manager.sample(100);
    expect(setPixelRatio).toHaveBeenCalled();
  });
});
