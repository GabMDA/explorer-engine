import { describe, it, expect, vi } from 'vitest';
import { createPluginRenderStateFacade, PLUGIN_MIN_PRIORITY } from './plugin-render-state-facade';
import type { RenderStateResolver } from '../render-state/resolver';

function fakeResolver(): RenderStateResolver {
  return {
    addLayer: vi.fn(() => ({ id: 1 })),
    updateLayer: vi.fn(),
    removeLayer: vi.fn(),
    removeBySource: vi.fn(),
    resolveNode: vi.fn(),
    getCameraIntent: vi.fn(() => null),
    getLightingIntent: vi.fn(() => null),
    flush: vi.fn(),
    layerCount: 0,
    dispose: vi.fn(),
  } as unknown as RenderStateResolver;
}

describe('createPluginRenderStateFacade', () => {
  it('tags every layer with the plugin-namespaced source', () => {
    const resolver = fakeResolver();
    const facade = createPluginRenderStateFacade(resolver, 'measure');

    facade.addLayer({ target: { kind: 'component', id: 'gpu' }, channel: 'opacity', value: 0.5 });

    expect(resolver.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'plugin:measure' }),
    );
  });

  it('floors the priority at PLUGIN_MIN_PRIORITY when omitted or too low', () => {
    const resolver = fakeResolver();
    const facade = createPluginRenderStateFacade(resolver, 'measure');

    facade.addLayer({ target: { kind: 'component', id: 'gpu' }, channel: 'opacity', value: 0.5 });
    expect(resolver.addLayer).toHaveBeenLastCalledWith(
      expect.objectContaining({ priority: PLUGIN_MIN_PRIORITY }),
    );

    facade.addLayer({
      target: { kind: 'component', id: 'gpu' },
      channel: 'opacity',
      value: 0.5,
      priority: 10,
    });
    expect(resolver.addLayer).toHaveBeenLastCalledWith(
      expect.objectContaining({ priority: PLUGIN_MIN_PRIORITY }),
    );
  });

  it('lets an explicit priority above the floor pass through unchanged', () => {
    const resolver = fakeResolver();
    const facade = createPluginRenderStateFacade(resolver, 'measure');

    facade.addLayer({
      target: { kind: 'component', id: 'gpu' },
      channel: 'opacity',
      value: 0.5,
      priority: 500,
    });

    expect(resolver.addLayer).toHaveBeenLastCalledWith(expect.objectContaining({ priority: 500 }));
  });

  it('delegates updateLayer/removeLayer unchanged', () => {
    const resolver = fakeResolver();
    const facade = createPluginRenderStateFacade(resolver, 'measure');
    const handle = { id: 1 };

    facade.updateLayer(handle, 0.2);
    facade.removeLayer(handle);

    expect(resolver.updateLayer).toHaveBeenCalledWith(handle, 0.2);
    expect(resolver.removeLayer).toHaveBeenCalledWith(handle);
  });

  it("clear() removes every layer under this plugin's source", () => {
    const resolver = fakeResolver();
    const facade = createPluginRenderStateFacade(resolver, 'measure');

    facade.clear();

    expect(resolver.removeBySource).toHaveBeenCalledWith('plugin:measure');
  });
});
