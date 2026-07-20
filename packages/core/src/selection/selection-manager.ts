// Selection Manager (chapter 08 §8.2, roadmap P4-T1) — resolves picking to the
// right LOGICAL granularity and expresses hover/selection as RENDER LAYERS. It
// never touches an Object3D or a material (L5): hover publishes an `outline` layer
// (selection:hover), selection publishes a `colorOverride` layer (selection:active),
// and clearing removes them (reversibility by recomposition, L6). Granularity comes
// from the component model's `pickTarget` (chapter 05 §5.3.7). Headless (L8/L9).
import type { ColorOverrideValue, OutlineValue } from '../render-state/channels';
import type { ComponentModel } from '../render-state/component-model';
import type { LayerHandle, RenderStateResolver } from '../render-state/resolver';
import type { RaycasterPort } from './raycaster-port';
import type { EventBus } from '../events/event-bus';
import type { EngineEventMap } from '../types/events';

export interface SelectionStyle {
  readonly hoverOutline: OutlineValue;
  readonly selectedColor: ColorOverrideValue;
}

const DEFAULT_STYLE: SelectionStyle = {
  hoverOutline: { color: '#3ba7ff', thickness: 1 },
  selectedColor: { color: '#3ba7ff', intensity: 0.6 },
};

export interface SelectionManagerOptions {
  readonly components: ComponentModel;
  readonly resolver: RenderStateResolver;
  /** Adapter that resolves a screen point to a node identity. */
  readonly raycaster: RaycasterPort;
  /** Typed bus for selection:changed / selection:cleared / selection:hover. */
  readonly events?: EventBus<EngineEventMap>;
  readonly style?: Partial<SelectionStyle>;
}

export interface SelectionManager {
  /** Pick at NDC and set hover to the resolved component (or clear). */
  hoverAt(ndcX: number, ndcY: number): void;
  /** Pick at NDC and set selection to the resolved component (or clear). */
  selectAt(ndcX: number, ndcY: number): void;
  /** Set hover to a component id (or null to clear). Programmatic. */
  hoverComponent(componentId: string | null): void;
  /** Set selection to a component id (or null to clear). Programmatic. */
  selectComponent(componentId: string | null): void;
  clearHover(): void;
  clearSelection(): void;
  getHovered(): string | null;
  getSelected(): string | null;
  /** Remove any published layers and reset state. Idempotent. */
  dispose(): void;
}

export function createSelectionManager(options: SelectionManagerOptions): SelectionManager {
  const { components, resolver, raycaster } = options;
  const events = options.events;
  const style: SelectionStyle = {
    hoverOutline: options.style?.hoverOutline ?? DEFAULT_STYLE.hoverOutline,
    selectedColor: options.style?.selectedColor ?? DEFAULT_STYLE.selectedColor,
  };

  let hovered: string | null = null;
  let selected: string | null = null;
  let hoverHandle: LayerHandle | null = null;
  let selectHandle: LayerHandle | null = null;
  let disposed = false;

  const pick = (ndcX: number, ndcY: number): string | null => {
    const hit = raycaster.pick(ndcX, ndcY);
    if (hit === null) return null;
    return components.resolvePick(hit.identity) ?? null;
  };

  const setHover = (componentId: string | null) => {
    if (disposed || componentId === hovered) return;
    if (hoverHandle) {
      resolver.removeLayer(hoverHandle);
      hoverHandle = null;
    }
    hovered = componentId;
    if (componentId !== null) {
      hoverHandle = resolver.addLayer({
        source: 'selection:hover',
        target: { kind: 'component', id: componentId },
        channel: 'outline',
        value: style.hoverOutline,
      });
    }
    events?.emit('selection:hover', { component: componentId });
  };

  const setSelection = (componentId: string | null) => {
    if (disposed || componentId === selected) return;
    if (selectHandle) {
      resolver.removeLayer(selectHandle);
      selectHandle = null;
    }
    selected = componentId;
    if (componentId !== null) {
      selectHandle = resolver.addLayer({
        source: 'selection:active',
        target: { kind: 'component', id: componentId },
        channel: 'colorOverride',
        value: style.selectedColor,
      });
      events?.emit('selection:changed', { component: componentId });
    } else {
      events?.emit('selection:cleared', {});
    }
  };

  return {
    hoverAt: (x, y) => setHover(pick(x, y)),
    selectAt: (x, y) => setSelection(pick(x, y)),
    hoverComponent: (id) => setHover(id !== null && components.component(id) ? id : null),
    selectComponent: (id) => setSelection(id !== null && components.component(id) ? id : null),
    clearHover: () => setHover(null),
    clearSelection: () => setSelection(null),
    getHovered: () => hovered,
    getSelected: () => selected,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (hoverHandle) resolver.removeLayer(hoverHandle);
      if (selectHandle) resolver.removeLayer(selectHandle);
      hoverHandle = null;
      selectHandle = null;
      hovered = null;
      selected = null;
    },
  };
}
