import { describe, it, expect, vi } from 'vitest';
import { createRenderStateResolver } from './resolver';
import { createComponentModel } from './component-model';
import { REST_VISUAL_STATE } from './channels';
import type { NodeStateUpdate, RenderStatePort } from './render-state-port';
import type { ComponentConfig, ResolvedConfig } from '@explorer-engine/schema';

function comp(id: string, nodes: string[], group: string | null = null): ComponentConfig {
  return {
    id,
    nodes: nodes.map((n) => ({ explorerId: n })),
    selectable: true,
    pickTarget: id,
    group,
  };
}

function setup(components: ComponentConfig[]) {
  const model = createComponentModel({ components } as unknown as ResolvedConfig);
  const applied: NodeStateUpdate[][] = [];
  const port: RenderStatePort = { applyNodeStates: (u) => applied.push(u.map((x) => ({ ...x }))) };
  const requestRender = vi.fn();
  const resolver = createRenderStateResolver({ components: model, port, requestRender });
  return { resolver, applied, requestRender };
}

describe('createRenderStateResolver', () => {
  it('composes opacity by min at the node level and requests a render', () => {
    const { resolver, requestRender } = setup([comp('shell', ['a', 'b'])]);
    resolver.addLayer({
      source: 'modifier:xray',
      target: { kind: 'component', id: 'shell' },
      channel: 'opacity',
      value: 0.5,
    });
    resolver.addLayer({
      source: 'focus',
      target: { kind: 'node', id: 'a' },
      channel: 'opacity',
      value: 0.1,
    });
    expect(requestRender).toHaveBeenCalled();
    expect(resolver.resolveNode('a').opacity).toBe(0.1); // min(0.5, 0.1)
    expect(resolver.resolveNode('b').opacity).toBe(0.5);
  });

  it('flushes only CHANGED node states to the port (dirty propagation)', () => {
    const { resolver, applied } = setup([comp('shell', ['a', 'b'])]);
    const h = resolver.addLayer({
      source: 'modifier:xray',
      target: { kind: 'component', id: 'shell' },
      channel: 'opacity',
      value: 0.3,
    });
    resolver.flush();
    expect(applied).toHaveLength(1);
    expect(applied[0]?.map((u) => u.identity).sort()).toEqual(['a', 'b']);
    expect(applied[0]?.[0]?.state.opacity).toBe(0.3);

    resolver.flush(); // nothing dirty
    expect(applied).toHaveLength(1);

    // Removing the layer recomposes to rest and pushes the reset (reversibility, L6).
    resolver.removeLayer(h);
    resolver.flush();
    expect(applied).toHaveLength(2);
    expect(applied[1]?.every((u) => u.state === REST_VISUAL_STATE || u.state.opacity === 1)).toBe(
      true,
    );
  });

  it('is order-independent: X-ray then focus == focus then X-ray', () => {
    const build = (reverse: boolean) => {
      const { resolver } = setup([comp('shell', ['a'])]);
      const ops = [
        () =>
          resolver.addLayer({
            source: 'modifier:xray',
            target: { kind: 'component', id: 'shell' },
            channel: 'opacity',
            value: 0.2,
          }),
        () =>
          resolver.addLayer({
            source: 'focus',
            target: { kind: 'node', id: 'a' },
            channel: 'outline',
            value: { color: '#fff', thickness: 1 },
          }),
      ];
      if (reverse) ops.reverse();
      ops.forEach((op) => op());
      return resolver.resolveNode('a');
    };
    expect(build(false)).toEqual(build(true));
  });

  it('removeBySource drops every layer of a source', () => {
    const { resolver } = setup([comp('shell', ['a'])]);
    resolver.addLayer({
      source: 'selection:hover',
      target: { kind: 'node', id: 'a' },
      channel: 'outline',
      value: { color: '#fff', thickness: 1 },
    });
    resolver.addLayer({
      source: 'selection:hover',
      target: { kind: 'node', id: 'a' },
      channel: 'colorOverride',
      value: { color: '#fff', intensity: 1 },
    });
    expect(resolver.layerCount).toBe(2);
    resolver.removeBySource('selection:hover');
    expect(resolver.layerCount).toBe(0);
    expect(resolver.resolveNode('a')).toBe(REST_VISUAL_STATE);
  });

  it('resolves exclusive camera intent by priority and reverts on removal', () => {
    const { resolver } = setup([comp('shell', ['a'])]);
    resolver.addLayer({
      source: 'state:base',
      target: { kind: 'component', id: 'shell' },
      channel: 'cameraIntent',
      value: { position: [0, 0, 5], target: [0, 0, 0] },
    });
    const focus = resolver.addLayer({
      source: 'focus',
      target: { kind: 'node', id: 'a' },
      channel: 'cameraIntent',
      value: { position: [1, 1, 1], target: [0, 0, 0] },
    });
    expect(resolver.getCameraIntent()?.source).toBe('focus'); // 100 > 30
    resolver.removeLayer(focus);
    expect(resolver.getCameraIntent()?.source).toBe('state:base'); // next intent resumes
  });

  it('applies the normative default priority bands (focus > selection > modifier > state)', () => {
    const { resolver } = setup([comp('shell', ['a'])]);
    // colorOverride resolved by priority; add out of order, focus must still win.
    resolver.addLayer({
      source: 'state:base',
      target: { kind: 'node', id: 'a' },
      channel: 'colorOverride',
      value: { color: '#state', intensity: 1 },
    });
    resolver.addLayer({
      source: 'focus',
      target: { kind: 'node', id: 'a' },
      channel: 'colorOverride',
      value: { color: '#focus', intensity: 1 },
    });
    resolver.addLayer({
      source: 'modifier:xray',
      target: { kind: 'node', id: 'a' },
      channel: 'colorOverride',
      value: { color: '#mod', intensity: 1 },
    });
    expect(resolver.resolveNode('a').colorOverride?.color).toBe('#focus');
  });
});
