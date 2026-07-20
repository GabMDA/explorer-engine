import { describe, it, expect, vi } from 'vitest';
import { createHotspotManager } from './hotspot-manager';
import { createComponentModel } from '../render-state/component-model';
import { EventBus } from '../events/event-bus';
import type { ProjectionResult } from './projection-port';
import type { EngineEventMap } from '../types/events';
import type { ComponentConfig, HotspotConfig, ResolvedConfig } from '@explorer-engine/schema';

function comp(id: string, nodes: string[]): ComponentConfig {
  return {
    id,
    nodes: nodes.map((n) => ({ explorerId: n })),
    selectable: true,
    pickTarget: id,
    group: null,
  };
}

function hs(partial: Partial<HotspotConfig> & { id: string }): HotspotConfig {
  return {
    label: partial.id,
    anchor: { kind: 'component', id: partial.id },
    offset: null,
    action: { type: 'emit', event: `hotspot:${partial.id}` },
    visibleInStates: null,
    occludable: true,
    priority: 0,
    ...partial,
  };
}

function setup(components: ComponentConfig[], hotspots: HotspotConfig[]) {
  const model = createComponentModel({ components } as unknown as ResolvedConfig);
  const events = new EventBus<EngineEventMap>();
  const config = { components, hotspots } as unknown as ResolvedConfig;
  const manager = createHotspotManager({ config, components: model, events });
  return { manager, events };
}

const proj = (id: string, over: Partial<ProjectionResult> = {}): ProjectionResult => ({
  id,
  x: 100,
  y: 50,
  depth: 5,
  onScreen: true,
  occluded: false,
  ...over,
});

describe('createHotspotManager', () => {
  it('resolves anchors to node identities and skips empty anchors', () => {
    const { manager } = setup(
      [comp('gpu', ['gpu', 'gpu_fans'])],
      [
        hs({ id: 'gpu' }),
        hs({ id: 'free', anchor: { kind: 'position', position: [0, 1, 0] } }),
        hs({ id: 'ghost', anchor: { kind: 'component', id: 'nope' } }),
      ],
    );
    const anchors = manager.anchors();
    expect(anchors.find((a) => a.id === 'gpu')?.identities).toEqual(['gpu', 'gpu_fans']);
    expect(anchors.find((a) => a.id === 'free')?.position).toEqual([0, 1, 0]);
    // 'ghost' resolves to no identities and no position → not projectable.
    expect(anchors.some((a) => a.id === 'ghost')).toBe(false);
  });

  it('reflects projection results in the view and hides occluded/off-screen markers', () => {
    const { manager } = setup(
      [comp('gpu', ['gpu'])],
      [hs({ id: 'gpu' }), hs({ id: 'other', anchor: { kind: 'component', id: 'gpu' } })],
    );
    manager.applyProjection([proj('gpu'), proj('other', { onScreen: false })]);
    const view = manager.view();
    const gpu = view.find((v) => v.id === 'gpu');
    const other = view.find((v) => v.id === 'other');
    expect(gpu?.visible).toBe(true);
    expect(gpu?.state).toBe('idle');
    expect(other?.visible).toBe(false);
    expect(other?.state).toBe('hidden');

    manager.applyProjection([proj('gpu', { occluded: true })]);
    expect(manager.view().find((v) => v.id === 'gpu')?.state).toBe('occluded');
    expect(manager.view().find((v) => v.id === 'gpu')?.visible).toBe(false);
  });

  it('keeps an occludable=false hotspot visible even when reported occluded', () => {
    const { manager } = setup([comp('gpu', ['gpu'])], [hs({ id: 'gpu', occludable: false })]);
    manager.applyProjection([proj('gpu', { occluded: true })]);
    expect(manager.view().find((v) => v.id === 'gpu')?.visible).toBe(true);
  });

  it('emits a typed activation carrying the config action, and marks hover', () => {
    const { manager, events } = setup(
      [comp('gpu', ['gpu'])],
      [hs({ id: 'gpu', action: { type: 'focus', target: { kind: 'component', id: 'gpu' } } })],
    );
    manager.applyProjection([proj('gpu')]);
    const activated = vi.fn();
    const hovered = vi.fn();
    events.on('hotspot:activated', activated);
    events.on('hotspot:hover', hovered);

    manager.hover('gpu');
    expect(hovered).toHaveBeenCalledWith({ id: 'gpu' });
    expect(manager.view().find((v) => v.id === 'gpu')?.state).toBe('hover');

    manager.activate('gpu');
    expect(activated).toHaveBeenCalledWith({
      id: 'gpu',
      action: { type: 'focus', target: { kind: 'component', id: 'gpu' } },
    });
    expect(manager.view().find((v) => v.id === 'gpu')?.state).toBe('active');
  });

  it('activates an off-screen hotspot (accessible list) but not a state-hidden one', () => {
    const { manager, events } = setup(
      [comp('gpu', ['gpu'])],
      [hs({ id: 'gpu', visibleInStates: ['open'] })],
    );
    const activated = vi.fn();
    events.on('hotspot:activated', activated);

    // Off-screen but state-visible → activatable via the alternative list.
    manager.applyProjection([proj('gpu', { onScreen: false })]);
    manager.activate('gpu');
    expect(activated).toHaveBeenCalledTimes(1);

    // State-hidden → not activatable.
    manager.setActiveState('closed');
    manager.activate('gpu');
    expect(activated).toHaveBeenCalledTimes(1);
  });

  it('honours visibleInStates via setActiveState', () => {
    const { manager } = setup(
      [comp('gpu', ['gpu'])],
      [hs({ id: 'gpu', visibleInStates: ['open'] })],
    );
    manager.applyProjection([proj('gpu')]);
    expect(manager.view().find((v) => v.id === 'gpu')?.visible).toBe(true); // no active state → visible

    manager.setActiveState('closed');
    manager.applyProjection([proj('gpu')]);
    expect(manager.view().find((v) => v.id === 'gpu')?.visible).toBe(false);

    manager.setActiveState('open');
    manager.applyProjection([proj('gpu')]);
    expect(manager.view().find((v) => v.id === 'gpu')?.visible).toBe(true);
  });

  it('sorts the view by priority then depth (near renders last / on top)', () => {
    const { manager } = setup(
      [comp('gpu', ['gpu'])],
      [
        hs({ id: 'far', anchor: { kind: 'component', id: 'gpu' }, priority: 0 }),
        hs({ id: 'near', anchor: { kind: 'component', id: 'gpu' }, priority: 0 }),
        hs({ id: 'top', anchor: { kind: 'component', id: 'gpu' }, priority: 5 }),
      ],
    );
    manager.applyProjection([
      proj('far', { depth: 10 }),
      proj('near', { depth: 2 }),
      proj('top', { depth: 8 }),
    ]);
    expect(manager.view().map((v) => v.id)).toEqual(['far', 'near', 'top']);
  });
});
