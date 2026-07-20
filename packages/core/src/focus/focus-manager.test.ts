import { describe, it, expect, vi } from 'vitest';
import { createFocusManager } from './focus-manager';
import type { BoundsProvider } from './bounds-provider';
import { createComponentModel } from '../render-state/component-model';
import { createRenderStateResolver } from '../render-state/resolver';
import { EventBus } from '../events/event-bus';
import { DEFAULT_FOCUS } from '@explorer-engine/schema';
import type { NodeStateUpdate, RenderStatePort } from '../render-state/render-state-port';
import type { BoundingBox } from '../ports/scene-port';
import type { EngineEventMap } from '../types/events';
import type { Address, ComponentConfig, ResolvedConfig } from '@explorer-engine/schema';

function comp(id: string, nodes: string[]): ComponentConfig {
  return {
    id,
    nodes: nodes.map((n) => ({ explorerId: n })),
    selectable: true,
    pickTarget: id,
    group: null,
  };
}

const unitBox = (c: number): BoundingBox => ({
  min: [c - 0.5, -0.5, -0.5],
  max: [c + 0.5, 0.5, 0.5],
});

function setup(components: ComponentConfig[], known: Record<string, number>) {
  const model = createComponentModel({ components } as unknown as ResolvedConfig);
  const applied: NodeStateUpdate[] = [];
  const port: RenderStatePort = { applyNodeStates: (u) => applied.push(...u) };
  const resolver = createRenderStateResolver({ components: model, port });
  const events = new EventBus<EngineEventMap>();
  const boundsProvider: BoundsProvider = {
    boundsOf: (a: Address) => (a.id in known ? unitBox(known[a.id] as number) : null),
  };
  const focus = createFocusManager({
    resolver,
    components: model,
    config: DEFAULT_FOCUS,
    boundsProvider,
    frameHint: () => ({ fovYRadians: 0.8, aspect: 1 }),
    events,
  });
  return { focus, resolver, events, applied };
}

describe('createFocusManager', () => {
  it('publishes a focus cameraIntent, an outline on the target and dims the others', () => {
    const { focus, resolver } = setup([comp('gpu', ['gpu']), comp('cpu', ['cpu'])], {
      gpu: 0,
      cpu: 2,
    });
    expect(focus.focus({ kind: 'component', id: 'gpu' })).toBe(true);

    const intent = resolver.getCameraIntent();
    expect(intent?.source).toBe('focus');
    expect(intent?.priority).toBe(100); // normative focus priority
    expect(intent?.value.target[0]).toBeCloseTo(0, 3); // frames the gpu centre

    resolver.flush();
    expect(resolver.resolveNode('gpu').outline).not.toBeNull(); // target outlined
    expect(resolver.resolveNode('cpu').opacity).toBeCloseTo(DEFAULT_FOCUS.dimOpacity, 6); // other dimmed
  });

  it('refuses a target that resolves to no bounds and publishes nothing', () => {
    const { focus, resolver } = setup([comp('gpu', ['gpu'])], { gpu: 0 });
    expect(focus.focus({ kind: 'component', id: 'ghost' })).toBe(false);
    expect(resolver.getCameraIntent()).toBeNull();
    expect(focus.depth).toBe(0);
  });

  it('nests focus levels and returns to the parent on back() (no imperative restore)', () => {
    const { focus, resolver } = setup([comp('gpu', ['gpu']), comp('cpu', ['cpu'])], {
      gpu: 0,
      cpu: 5,
    });
    focus.focus({ kind: 'component', id: 'gpu' });
    const gpuIntent = resolver.getCameraIntent()?.value.target[0];
    focus.focus({ kind: 'component', id: 'cpu' });
    expect(focus.depth).toBe(2);
    expect(resolver.getCameraIntent()?.value.target[0]).toBeCloseTo(5, 3); // now framing cpu

    focus.back();
    expect(focus.depth).toBe(1);
    expect(resolver.getCameraIntent()?.value.target[0]).toBeCloseTo(gpuIntent!, 3); // parent resumes

    focus.back();
    expect(focus.depth).toBe(0);
    expect(resolver.getCameraIntent()).toBeNull(); // intent removed → camera adapter returns home
  });

  it('emits typed focus:started / focus:ended events', () => {
    const { focus, events } = setup([comp('gpu', ['gpu'])], { gpu: 0 });
    const started = vi.fn();
    const ended = vi.fn();
    events.on('focus:started', started);
    events.on('focus:ended', ended);
    focus.focus({ kind: 'component', id: 'gpu' });
    expect(started).toHaveBeenCalledWith({ target: { kind: 'component', id: 'gpu' } });
    focus.back();
    expect(ended).toHaveBeenCalledWith({ target: { kind: 'component', id: 'gpu' }, current: null });
  });

  it('clear() empties the stack and removes every focus layer (reversibility)', () => {
    const { focus, resolver } = setup([comp('gpu', ['gpu']), comp('cpu', ['cpu'])], {
      gpu: 0,
      cpu: 5,
    });
    focus.focus({ kind: 'component', id: 'gpu' });
    expect(resolver.layerCount).toBeGreaterThan(0);
    focus.clear();
    expect(focus.depth).toBe(0);
    expect(resolver.layerCount).toBe(0);
    resolver.flush();
    expect(resolver.resolveNode('cpu').opacity).toBe(1); // dim removed → back to rest
  });

  it('dispose() removes all focus layers', () => {
    const { focus, resolver } = setup([comp('gpu', ['gpu'])], { gpu: 0 });
    focus.focus({ kind: 'component', id: 'gpu' });
    focus.dispose();
    expect(resolver.layerCount).toBe(0);
  });
});
