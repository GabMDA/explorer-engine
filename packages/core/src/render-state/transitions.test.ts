import { describe, it, expect } from 'vitest';
import { createRenderStateResolver } from './resolver';
import { createComponentModel } from './component-model';
import { createAnimationEngine } from '../animation/engine';
import { REST_VISUAL_STATE } from './channels';
import type { NodeStateUpdate, RenderStatePort } from './render-state-port';
import type { TransitionSpec } from '@explorer-engine/schema';
import type { ComponentConfig, ResolvedConfig } from '@explorer-engine/schema';

function comp(id: string, nodes: string[]): ComponentConfig {
  return {
    id,
    nodes: nodes.map((n) => ({ explorerId: n })),
    selectable: true,
    pickTarget: id,
    group: null,
  };
}

const linear = (duration: number): TransitionSpec => ({ duration, easing: 'linear', delay: 0 });

function setup() {
  const model = createComponentModel({
    components: [comp('shell', ['a'])],
  } as unknown as ResolvedConfig);
  const applied: NodeStateUpdate[] = [];
  const port: RenderStatePort = { applyNodeStates: (u) => applied.push(...u) };
  const engine = createAnimationEngine({ maxDeltaMs: 1e9 });
  const resolver = createRenderStateResolver({ components: model, port, animation: engine });
  const latest = () => applied.filter((u) => u.identity === 'a').at(-1)?.state;
  return { resolver, engine, applied, latest };
}

describe('RSR transitions (opacity interpolation)', () => {
  it('interpolates a continuous channel over the transition instead of snapping', () => {
    const { resolver, engine, latest } = setup();
    resolver.addLayer({
      source: 'modifier:xray',
      target: { kind: 'component', id: 'shell' },
      channel: 'opacity',
      value: 0,
      transition: linear(1000),
    });
    resolver.flush(); // start value equals rest (opacity 1) → nothing to apply yet

    engine.update(0);
    engine.update(500);
    resolver.flush();
    expect(latest()?.opacity).toBeCloseTo(0.5, 6); // half-way, not snapped to 0

    engine.update(1000);
    resolver.flush();
    expect(latest()?.opacity).toBeCloseTo(0, 6); // settled at the target
  });

  it('reverses by recomposition: removing the layer fades opacity back to rest', () => {
    const { resolver, engine, latest } = setup();
    const h = resolver.addLayer({
      source: 'modifier:xray',
      target: { kind: 'node', id: 'a' },
      channel: 'opacity',
      value: 0,
      transition: linear(1000),
    });
    resolver.flush();
    engine.update(0);
    engine.update(1000);
    resolver.flush();
    expect(latest()?.opacity).toBeCloseTo(0, 6);

    resolver.removeLayer(h); // recompose toward rest (opacity 1), animated
    resolver.flush();
    engine.update(1000);
    engine.update(1500);
    resolver.flush();
    expect(latest()?.opacity).toBeCloseTo(0.5, 6); // fading back up
    engine.update(2000);
    resolver.flush();
    expect(latest()?.opacity).toBeCloseTo(1, 6);
  });

  it('snaps DISCRETE channels immediately while continuous ones interpolate', () => {
    const { resolver, latest } = setup();
    resolver.addLayer({
      source: 'focus',
      target: { kind: 'node', id: 'a' },
      channel: 'outline',
      value: { color: '#fff', thickness: 1 },
      transition: linear(1000),
    });
    resolver.flush();
    // Outline (discrete) is present from the very first frame of the transition.
    expect(latest()?.outline).not.toBeNull();
  });

  it('applies immediately when no transition is given (unchanged behaviour)', () => {
    const { resolver, latest } = setup();
    resolver.addLayer({
      source: 'modifier:xray',
      target: { kind: 'node', id: 'a' },
      channel: 'opacity',
      value: 0.3,
    });
    resolver.flush();
    expect(latest()?.opacity).toBe(0.3); // snapped, no animation
  });

  it('replaces an in-flight transition cleanly (retargets from the current value)', () => {
    const { resolver, engine, latest } = setup();
    const h = resolver.addLayer({
      source: 'modifier:xray',
      target: { kind: 'node', id: 'a' },
      channel: 'opacity',
      value: 0,
      transition: linear(1000),
    });
    resolver.flush();
    engine.update(0);
    engine.update(500);
    resolver.flush();
    expect(latest()?.opacity).toBeCloseTo(0.5, 6);

    // Retarget mid-flight: opacity 0.5 → 1 over a new transition.
    resolver.updateLayer(h, 1);
    resolver.flush();
    engine.update(1000); // +500 into the new 1000ms transition from 0.5 → 1
    resolver.flush();
    expect(latest()?.opacity).toBeGreaterThan(0.5);
    expect(latest()?.opacity).toBeLessThan(1);
  });

  it('an immediate (no-transition) layer change cancels an in-flight transition and snaps', () => {
    const { resolver, engine, latest } = setup();
    resolver.addLayer({
      source: 'modifier:xray',
      target: { kind: 'node', id: 'a' },
      channel: 'opacity',
      value: 0.2,
      transition: linear(1000),
    });
    resolver.flush();
    engine.update(0);
    engine.update(300); // fading 1 → 0.2, mid-flight
    resolver.flush();
    expect(engine.hasActive).toBe(true);

    // A separate layer with NO transition changes composition → snap, cancel tween.
    resolver.addLayer({
      source: 'focus',
      target: { kind: 'node', id: 'a' },
      channel: 'opacity',
      value: 0.2,
    });
    resolver.flush();
    expect(latest()?.opacity).toBe(0.2); // snapped to the composed target
    expect(engine.hasActive).toBe(false); // the tween was cancelled
  });

  it('does not push while at rest and idle (REST unchanged)', () => {
    const { resolver } = setup();
    resolver.flush();
    expect(resolver.resolveNode('a')).toBe(REST_VISUAL_STATE);
  });
});
