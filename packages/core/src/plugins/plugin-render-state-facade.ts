// Builds the `source`-pinned, priority-floored Render State Resolver facade
// handed to a single plugin (ch.10 §10.3, ch.19 §19.6 — priority band ≥200
// reserved for plugins). This is the ONLY way a plugin contributes visual state
// (L5/L16); it never mutates the scene, and it can never publish under another
// source. The Resolver itself is untouched — this only calls its existing public
// addLayer/updateLayer/removeLayer/removeBySource.
import type { Channel } from '../render-state/channels';
import type { LayerHandle, RenderLayer, RenderStateResolver } from '../render-state/resolver';
import type { PluginRenderStateFacade } from './plugin';

/** Priority floor for every plugin-published layer (ch.19 §19.6). */
export const PLUGIN_MIN_PRIORITY = 200;

export function createPluginRenderStateFacade(
  resolver: RenderStateResolver,
  pluginId: string,
): PluginRenderStateFacade {
  const source = `plugin:${pluginId}`;

  return {
    addLayer<C extends Channel>(layer: Omit<RenderLayer<C>, 'source'>): LayerHandle {
      const priority =
        layer.priority !== undefined
          ? Math.max(layer.priority, PLUGIN_MIN_PRIORITY)
          : PLUGIN_MIN_PRIORITY;
      return resolver.addLayer({ ...layer, source, priority } as RenderLayer<C>);
    },
    updateLayer: (handle, value) => resolver.updateLayer(handle, value),
    removeLayer: (handle) => resolver.removeLayer(handle),
    clear: () => resolver.removeBySource(source),
  };
}
