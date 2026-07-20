import { describe, it, expect, vi } from 'vitest';
import { createSelectionManager } from './selection-manager';
import type { RaycasterPort, PickHit } from './raycaster-port';
import { createComponentModel } from '../render-state/component-model';
import { createRenderStateResolver } from '../render-state/resolver';
import { EventBus } from '../events/event-bus';
import type { NodeStateUpdate, RenderStatePort } from '../render-state/render-state-port';
import type { EngineEventMap } from '../types/events';
import type { ComponentConfig, ResolvedConfig } from '@explorer-engine/schema';

function comp(id: string, nodes: string[], extra: Partial<ComponentConfig> = {}): ComponentConfig {
  return {
    id,
    nodes: nodes.map((n) => ({ explorerId: n })),
    selectable: true,
    pickTarget: id,
    group: null,
    ...extra,
  };
}

function setup(components: ComponentConfig[]) {
  const model = createComponentModel({ components } as unknown as ResolvedConfig);
  const applied: NodeStateUpdate[] = [];
  const port: RenderStatePort = { applyNodeStates: (u) => applied.push(...u) };
  const resolver = createRenderStateResolver({ components: model, port });
  const events = new EventBus<EngineEventMap>();
  let nextHit: PickHit | null = null;
  const raycaster: RaycasterPort = { pick: vi.fn(() => nextHit) };
  const selection = createSelectionManager({ components: model, resolver, raycaster, events });
  return { selection, resolver, events, applied, setHit: (h: PickHit | null) => (nextHit = h) };
}

const hit = (identity: string): PickHit => ({ identity, point: [0, 0, 0], distance: 1 });

describe('createSelectionManager', () => {
  it('resolves a pick to the pickTarget component and publishes a hover outline layer', () => {
    const { selection, resolver, applied, setHit } = setup([
      comp('gpu', ['gpu']),
      comp('gpu-fan', ['gpu_fan'], { pickTarget: 'gpu' }),
    ]);
    setHit(hit('gpu_fan'));
    selection.hoverAt(0, 0);
    expect(selection.getHovered()).toBe('gpu'); // rolled up via pickTarget
    resolver.flush();
    expect(applied.some((u) => u.identity === 'gpu' && u.state.outline)).toBe(true);
  });

  it('emits selection:changed and publishes a colorOverride on select, clears on empty pick', () => {
    const { selection, resolver, events, applied, setHit } = setup([comp('gpu', ['gpu'])]);
    const changed = vi.fn();
    const cleared = vi.fn();
    events.on('selection:changed', changed);
    events.on('selection:cleared', cleared);

    setHit(hit('gpu'));
    selection.selectAt(0, 0);
    expect(selection.getSelected()).toBe('gpu');
    expect(changed).toHaveBeenCalledWith({ component: 'gpu' });
    resolver.flush();
    expect(applied.some((u) => u.identity === 'gpu' && u.state.colorOverride)).toBe(true);

    setHit(null); // click on empty space
    selection.selectAt(0, 0);
    expect(selection.getSelected()).toBeNull();
    expect(cleared).toHaveBeenCalled();
  });

  it('does not churn layers when hovering the same component twice', () => {
    const { selection, resolver, setHit } = setup([comp('gpu', ['gpu'])]);
    setHit(hit('gpu'));
    selection.hoverAt(0, 0);
    const count = resolver.layerCount;
    selection.hoverAt(0, 0);
    expect(resolver.layerCount).toBe(count); // no add/remove
  });

  it('ignores picks on non-selectable components (resolvePick undefined)', () => {
    const { selection, setHit } = setup([comp('decor', ['decor'], { selectable: false })]);
    setHit(hit('decor'));
    selection.selectAt(0, 0);
    expect(selection.getSelected()).toBeNull();
  });

  it('removes its layers on dispose (reversibility)', () => {
    const { selection, resolver, setHit } = setup([comp('gpu', ['gpu'])]);
    setHit(hit('gpu'));
    selection.hoverAt(0, 0);
    selection.selectComponent('gpu');
    expect(resolver.layerCount).toBeGreaterThan(0);
    selection.dispose();
    expect(resolver.layerCount).toBe(0);
  });
});
