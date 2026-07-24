// Measure (ch.10 §10.7.2) — the reference measuring-tool plugin: two picked
// points, a real-world distance, an overlay via the existing UI slot mechanism,
// and an optional visual mark on each picked node through the RSR facade
// ("éventuellement objet 3D" — ch.10). Depends only on plugin-sdk, never core
// directly (ch.03 §3.4).
//
// Scope notes for this phase (no host/Playground integration yet):
// - Picking is HOST-DRIVEN: `pickAt(ndcX, ndcY)` is called by whatever owns a
//   reference to this plugin instance (e.g. a canvas pointer handler in a later
//   integration phase) — the headless core has no DOM access to listen for
//   clicks itself.
// - Distance is raw Euclidean distance between the two world-space hit points,
//   assuming the standard glTF convention (1 unit = 1 meter). `model.scale`
//   does not exist in the schema (chapter 05 §5.3.3 lists no such field), so no
//   extra scaling is applied.
// - "Activated via the toolbar" (ch.10) becomes `setActive`, a host-driven
//   method — there is no generic, interactive toolbar slot for plugins yet
//   (UiPort descriptors are display-only; wiring a real button is a later
//   integration-phase concern).
import type { Plugin, PluginContext, Vec3, UiDescriptor } from '@explorer-engine/plugin-sdk';

export interface MeasurePluginOptions {
  /** Defaults to `'measure'`. */
  readonly id?: string;
  /** CSS colour used to mark a picked point via `colorOverride`. */
  readonly markColor?: string;
}

export interface MeasurePlugin extends Plugin {
  setActive(active: boolean): void;
  isActive(): boolean;
  /** Feed a pick gesture at normalized device coordinates. Returns `true` iff it
   * registered a point (inactive, no raycaster, or no hit → `false`). A third
   * pick after two points starts a new measurement. */
  pickAt(ndcX: number, ndcY: number): boolean;
  /** Clear the current measurement (points, marks, overlay) without changing
   * whether the tool is active. */
  reset(): void;
  getPoints(): readonly Vec3[];
  getDistance(): number | null;
}

/** Pure Euclidean distance — exported for standalone unit testing. */
export function distanceBetween(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function createMeasurePlugin(options: MeasurePluginOptions = {}): MeasurePlugin {
  const id = options.id ?? 'measure';
  const markColor = options.markColor ?? '#ffcc00';
  const slotId = `${id}-overlay`;

  let ctx: PluginContext | null = null;
  let active = false;
  const points: Vec3[] = [];

  const renderOverlay = (): void => {
    if (!ctx?.ui) return;
    if (points.length === 0) {
      ctx.ui.renderSlot(slotId, null);
      return;
    }
    const rows: UiDescriptor[] = points.map((p, i) => ({
      type: 'div',
      props: {
        text: `Point ${i + 1}: (${p[0].toFixed(3)}, ${p[1].toFixed(3)}, ${p[2].toFixed(3)})`,
      },
    }));
    if (points.length === 2) {
      const distance = distanceBetween(points[0] as Vec3, points[1] as Vec3);
      rows.push({
        type: 'div',
        props: { class: 'ee-measure-distance', text: `Distance: ${distance.toFixed(3)}` },
      });
    }
    ctx.ui.renderSlot(slotId, {
      type: 'div',
      props: { class: 'ee-measure-overlay' },
      children: rows,
    });
  };

  const clearMarks = (): void => ctx?.resolver.clear();

  const markPoint = (identity: string): void => {
    ctx?.resolver.addLayer({
      target: { kind: 'node', id: identity },
      channel: 'colorOverride',
      value: { color: markColor, intensity: 1 },
    });
  };

  const clearState = (): void => {
    points.length = 0;
    clearMarks();
    renderOverlay();
  };

  return {
    id,
    name: 'Measure',
    providesCapabilities: ['measure'],

    register(pluginContext) {
      ctx = pluginContext;
      ctx.ui?.registerSlot(slotId);
    },

    dispose(pluginContext) {
      points.length = 0;
      pluginContext.resolver.clear();
      pluginContext.ui?.renderSlot(slotId, null);
      active = false;
      ctx = null;
    },

    setActive(next) {
      active = next;
    },
    isActive: () => active,

    pickAt(ndcX, ndcY) {
      if (!active || !ctx?.raycaster) return false;
      const hit = ctx.raycaster.pick(ndcX, ndcY);
      if (!hit) return false;

      if (points.length === 2) {
        points.length = 0;
        clearMarks();
      }

      points.push(hit.point);
      const index = (points.length - 1) as 0 | 1;
      markPoint(hit.identity);
      renderOverlay();
      ctx.events.emit('measure:point-added', { id, index, point: hit.point });

      if (points.length === 2) {
        const distance = distanceBetween(points[0] as Vec3, points[1] as Vec3);
        ctx.events.emit('measure:completed', { id, distance });
      }
      return true;
    },

    reset: clearState,
    getPoints: () => [...points],
    getDistance: () =>
      points.length === 2 ? distanceBetween(points[0] as Vec3, points[1] as Vec3) : null,
  };
}
