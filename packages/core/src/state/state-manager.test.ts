import { describe, it, expect, vi } from 'vitest';
import { createStateManager } from './state-manager';
import { createComponentModel } from '../render-state/component-model';
import { createRenderStateResolver } from '../render-state/resolver';
import { EventBus } from '../events/event-bus';
import type { NodeStateUpdate, RenderStatePort } from '../render-state/render-state-port';
import type { EngineEventMap } from '../types/events';
import type { ComponentConfig, ResolvedConfig, StateConfig } from '@explorer-engine/schema';

function comp(id: string, nodes: string[], group: string | null = null): ComponentConfig {
  return {
    id,
    nodes: nodes.map((n) => ({ explorerId: n })),
    selectable: true,
    pickTarget: id,
    group,
  };
}

function state(partial: Partial<StateConfig> & { id: string }): StateConfig {
  return {
    label: partial.id,
    region: 'base',
    allowedFrom: null,
    excludes: [],
    layers: [],
    cameraIntent: null,
    transition: null,
    ...partial,
  };
}

const COMPONENTS = [comp('gpu', ['gpu'], 'internals'), comp('shell', ['panel'], 'shell')];

function setup(states: StateConfig[], initialState: string | null = null) {
  const model = createComponentModel({ components: COMPONENTS } as unknown as ResolvedConfig);
  const applied: NodeStateUpdate[] = [];
  const port: RenderStatePort = { applyNodeStates: (u) => applied.push(...u) };
  const resolver = createRenderStateResolver({ components: model, port });
  const events = new EventBus<EngineEventMap>();
  const manager = createStateManager({ resolver, states, initialState, events });
  return { manager, resolver, events, applied };
}

const closed = state({ id: 'closed', region: 'base' });
const exploded = state({
  id: 'exploded',
  region: 'base',
  allowedFrom: ['closed'],
  layers: [
    {
      target: { kind: 'component', id: 'gpu' },
      channel: 'transform',
      value: { translate: [0, -0.3, 0] },
    },
  ],
});
const xray = state({
  id: 'xray',
  region: 'modifier-opacity',
  layers: [{ target: { kind: 'group', id: 'shell' }, channel: 'opacity', value: 0.2 }],
});

describe('createStateManager', () => {
  it('enters the initial base state at construction', () => {
    const { manager, resolver } = setup([closed, exploded], 'exploded');
    expect(manager.getBase()).toBe('exploded');
    resolver.flush();
    expect(resolver.resolveNode('gpu').transform?.translate).toEqual([0, -0.3, 0]);
  });

  it('transitions between bases and reverses by recomposition (no drift)', () => {
    const { manager, resolver } = setup([closed, exploded], 'closed');
    expect(resolver.resolveNode('gpu').transform).toBeNull(); // closed = rest

    expect(manager.goToState('exploded')).toBe(true);
    expect(resolver.resolveNode('gpu').transform?.translate).toEqual([0, -0.3, 0]);

    // Back to closed → gpu returns EXACTLY to rest (absolute offsets, no accumulation).
    expect(manager.goToState('closed')).toBe(true);
    expect(resolver.resolveNode('gpu').transform).toBeNull();

    // Repeat the cycle → still exactly the same offset (no drift).
    manager.goToState('exploded');
    expect(resolver.resolveNode('gpu').transform?.translate).toEqual([0, -0.3, 0]);
    expect(resolver.layerCount).toBe(1); // only the exploded layer, previous removed
  });

  it('rejects an unknown state and a transition not in allowedFrom', () => {
    const open = state({ id: 'open', region: 'base' });
    const { manager } = setup([closed, open, exploded], 'open');
    expect(manager.goToState('ghost')).toBe(false);
    // exploded.allowedFrom = ['closed'] → not reachable from 'open'.
    expect(manager.goToState('exploded')).toBe(false);
    expect(manager.getBase()).toBe('open');
  });

  it('is idempotent: re-entering the current base is a no-op', () => {
    const { manager, resolver } = setup([closed, exploded], 'exploded');
    const before = resolver.layerCount;
    expect(manager.goToState('exploded')).toBe(true);
    expect(resolver.layerCount).toBe(before);
  });

  it('toggles a modifier in parallel with the base (X-ray) and removes it cleanly', () => {
    const { manager, resolver } = setup([closed, xray], 'closed');
    expect(manager.toggleModifier('xray')).toBe(true);
    expect(manager.isModifierActive('xray')).toBe(true);
    resolver.flush();
    expect(resolver.resolveNode('panel').opacity).toBe(0.2); // shell group dimmed

    manager.toggleModifier('xray'); // off
    expect(manager.isModifierActive('xray')).toBe(false);
    resolver.flush();
    expect(resolver.resolveNode('panel').opacity).toBe(1); // recomposed to rest
  });

  it('honours modifier exclusions', () => {
    const a = state({ id: 'a', region: 'mod-a', excludes: ['mod-b'] });
    const b = state({ id: 'b', region: 'mod-b' });
    const { manager } = setup([closed, a, b], 'closed');
    manager.toggleModifier('a', true);
    manager.toggleModifier('b', true); // b's region conflicts with a.excludes → a turns off
    expect(manager.isModifierActive('a')).toBe(false);
    expect(manager.isModifierActive('b')).toBe(true);
  });

  it('publishes a cutaway clip layer and reverses it', () => {
    const cutaway = state({
      id: 'cutaway',
      region: 'modifier-clip',
      layers: [
        {
          target: { kind: 'group', id: 'internals' },
          channel: 'clip',
          value: [{ normal: [1, 0, 0], offset: 0 }],
        },
      ],
    });
    const { manager, resolver } = setup([closed, cutaway], 'closed');
    manager.toggleModifier('cutaway', true);
    resolver.flush();
    expect(resolver.resolveNode('gpu').clip).toEqual([{ normal: [1, 0, 0], offset: 0 }]);
    manager.toggleModifier('cutaway', false);
    resolver.flush();
    expect(resolver.resolveNode('gpu').clip).toEqual([]);
  });

  it('publishes a state cameraIntent at the state priority (focus outranks it)', () => {
    const view = state({
      id: 'view',
      region: 'base',
      cameraIntent: { position: [2, 1, 3], target: [0, 0, 0] },
    });
    const { manager, resolver } = setup([closed, view], 'view');
    expect(resolver.getCameraIntent()?.source).toBe('state:view');
    expect(resolver.getCameraIntent()?.priority).toBe(30);

    // A focus intent (100) wins; removing it restores the state intent (recomposition).
    const focus = resolver.addLayer({
      source: 'focus',
      target: { kind: 'component', id: 'gpu' },
      channel: 'cameraIntent',
      value: { position: [9, 9, 9], target: [0, 0, 0] },
    });
    expect(resolver.getCameraIntent()?.source).toBe('focus');
    resolver.removeLayer(focus);
    expect(resolver.getCameraIntent()?.source).toBe('state:view');
    void manager;
  });

  it('coexists with hover/selection layers (state opacity + selection outline compose)', () => {
    const { manager, resolver } = setup([closed, xray], 'closed');
    manager.toggleModifier('xray', true);
    resolver.addLayer({
      source: 'selection:hover',
      target: { kind: 'node', id: 'panel' },
      channel: 'outline',
      value: { color: '#fff', thickness: 1 },
    });
    const s = resolver.resolveNode('panel');
    expect(s.opacity).toBe(0.2); // from X-ray
    expect(s.outline).not.toBeNull(); // from selection — both apply
  });

  it('emits typed state:changing / state:changed / modifier:changed', () => {
    const { manager, events } = setup([closed, exploded, xray], 'closed');
    const changing = vi.fn();
    const changed = vi.fn();
    const modifier = vi.fn();
    events.on('state:changing', changing);
    events.on('state:changed', changed);
    events.on('modifier:changed', modifier);

    manager.goToState('exploded');
    expect(changing).toHaveBeenCalledWith({ from: 'closed', to: 'exploded' });
    expect(changed).toHaveBeenCalledWith({ base: 'exploded', modifiers: [] });

    manager.toggleModifier('xray', true);
    expect(modifier).toHaveBeenCalledWith({ id: 'xray', on: true });
    expect(changed).toHaveBeenLastCalledWith({ base: 'exploded', modifiers: ['xray'] });
  });

  it('supports back() history and reset() to the initial state', () => {
    const open = state({ id: 'open', region: 'base' });
    const { manager, resolver } = setup([closed, open, exploded, xray], 'closed');
    manager.goToState('open'); // closed → open (history: [closed])
    manager.back();
    expect(manager.getBase()).toBe('closed');

    manager.goToState('open');
    manager.toggleModifier('xray', true);
    manager.reset();
    expect(manager.getBase()).toBe('closed');
    expect(manager.getModifiers()).toEqual([]);
    resolver.flush();
    expect(resolver.resolveNode('panel').opacity).toBe(1);
  });

  it('serialises and restores base + modifiers', () => {
    const { manager } = setup([closed, exploded, xray], 'closed');
    manager.goToState('exploded');
    manager.toggleModifier('xray', true);
    const snap = manager.serialize();
    expect(snap).toEqual({ base: 'exploded', modifiers: ['xray'] });

    manager.clear();
    expect(manager.getBase()).toBeNull();
    manager.apply(snap);
    expect(manager.getBase()).toBe('exploded');
    expect(manager.isModifierActive('xray')).toBe(true);
  });

  it('dispose removes every state/modifier layer', () => {
    const { manager, resolver } = setup([closed, exploded, xray], 'exploded');
    manager.toggleModifier('xray', true);
    expect(resolver.layerCount).toBeGreaterThan(0);
    manager.dispose();
    expect(resolver.layerCount).toBe(0);
  });
});
