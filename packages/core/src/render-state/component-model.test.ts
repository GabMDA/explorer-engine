import { describe, it, expect } from 'vitest';
import { createComponentModel, nodeRefIdentity } from './component-model';
import type { ComponentConfig, ResolvedConfig } from '@explorer-engine/schema';

function comp(partial: Partial<ComponentConfig> & { id: string }): ComponentConfig {
  return {
    nodes: [{ explorerId: partial.id }],
    selectable: true,
    pickTarget: partial.id,
    group: null,
    ...partial,
  };
}

function model(components: ComponentConfig[]) {
  return createComponentModel({ components } as unknown as ResolvedConfig);
}

describe('nodeRefIdentity', () => {
  it('prefers explorerId, falls back to name', () => {
    expect(nodeRefIdentity({ explorerId: 'gpu' })).toBe('gpu');
    expect(nodeRefIdentity({ name: 'GPU' })).toBe('GPU');
  });
});

describe('createComponentModel', () => {
  it('expands a component address to its node identities', () => {
    const m = model([
      comp({ id: 'gpu', nodes: [{ explorerId: 'gpu' }, { explorerId: 'gpu_fans' }] }),
    ]);
    expect(m.expand({ kind: 'component', id: 'gpu' })).toEqual(['gpu', 'gpu_fans']);
    expect(m.expand({ kind: 'component', id: 'ghost' })).toEqual([]);
  });

  it('expands a node address to itself, and a group to all member identities', () => {
    const m = model([
      comp({ id: 'gpu', nodes: [{ explorerId: 'gpu' }], group: 'internals' }),
      comp({
        id: 'cpu',
        nodes: [{ explorerId: 'cpu' }, { explorerId: 'cooler' }],
        group: 'internals',
      }),
      comp({ id: 'panel', nodes: [{ explorerId: 'panel' }], group: 'shell' }),
    ]);
    expect(m.expand({ kind: 'node', id: 'anything' })).toEqual(['anything']);
    expect(m.expand({ kind: 'group', id: 'internals' })).toEqual(['gpu', 'cpu', 'cooler']);
    expect(m.groupMembers('internals')).toEqual(['gpu', 'cpu']);
  });

  it('resolves picking to the pickTarget granularity and honours selectable', () => {
    const m = model([
      comp({ id: 'gpu', nodes: [{ explorerId: 'gpu' }] }),
      comp({ id: 'gpu-fan', nodes: [{ explorerId: 'gpu_fan' }], pickTarget: 'gpu' }),
      comp({ id: 'decor', nodes: [{ explorerId: 'decor' }], selectable: false }),
    ]);
    expect(m.resolvePick('gpu')).toBe('gpu'); // self
    expect(m.resolvePick('gpu_fan')).toBe('gpu'); // rolled up to assembly
    expect(m.resolvePick('decor')).toBeUndefined(); // not selectable
    expect(m.resolvePick('unknown')).toBeUndefined();
    expect(m.componentOfNode('gpu_fan')).toBe('gpu-fan');
  });
});
