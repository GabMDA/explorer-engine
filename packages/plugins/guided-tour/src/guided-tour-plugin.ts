// Guided Tour (ch.10 §10.7.1) — the reference scenario plugin: sequences a
// visit across `steps` (component ids) using ONLY the focus mechanism and the
// UI slot extension point, both reached exclusively through the plugin-sdk
// façade. Never imports @explorer-engine/core directly (ch.03 §3.4).
//
// Scope notes for this phase (no host/Playground integration yet):
// - `steps` name COMPONENT ids (focused via `ctx.focus`); hotspot-id steps are
//   a natural future extension once PluginContext grows a hotspots facet.
// - `narration` is shown as TEXT via the UI slot — there is no audio-playback
//   primitive in the headless core, so "play the narration" is a host/adapter
//   concern for a later phase, not this plugin's job.
// - Advancing between steps is host-driven (`next`/`previous`), never a timer:
//   the core has no injected-timer capability exposed to plugins yet. A future
//   phase's Playground integration can layer auto-advance UI on top.
// - The tour interrupts only on an EXPLICIT stop (`stopTour()` or the Plugin
//   Manager's own `stop()`) — it does not eavesdrop on unrelated focus changes,
//   which would risk self-interrupting on its own step transitions.
import type { Plugin, PluginContext, UiDescriptor } from '@explorer-engine/plugin-sdk';

export interface GuidedTourOptions {
  /** Defaults to `'guided-tour'`. */
  readonly id?: string;
  /** Component ids to visit, in order. */
  readonly steps: readonly string[];
  /** Start automatically once the plugin's `start` hook runs. Default `false`. */
  readonly autoStart?: boolean;
  /** Wrap from the last step back to the first instead of completing. Default `false`. */
  readonly loop?: boolean;
  /** Optional per-step caption, shown via the UI slot (text only, no audio). */
  readonly narration?: readonly (string | undefined)[];
}

export interface GuidedTourPlugin extends Plugin {
  /** (Re)start from step 0. Returns `false` if there are no steps. */
  startTour(): boolean;
  /** Advance one step. Returns `false` when not touring, or when this call
   * completed the tour instead of entering a new step. */
  next(): boolean;
  /** Step back. Returns `false` when not touring or already at step 0. */
  previous(): boolean;
  /** Interrupt the tour now (no-op if not touring). */
  stopTour(): void;
  getCurrentStepIndex(): number | null;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** Creates a Guided Tour plugin instance. Host-registered (ch.10 §10.5.1) — its
 * extra methods (`startTour`/`next`/…) are called directly by whatever owns the
 * reference (e.g. a future toolbar wiring), not through the generic Plugin
 * contract. */
export function createGuidedTourPlugin(options: GuidedTourOptions): GuidedTourPlugin {
  const id = options.id ?? 'guided-tour';
  const slotId = `${id}-status`;

  let steps = options.steps;
  let autoStart = options.autoStart ?? false;
  let loop = options.loop ?? false;
  let narration = options.narration;

  let ctx: PluginContext | null = null;
  let currentIndex: number | null = null;

  const renderStatus = (): void => {
    if (!ctx?.ui) return;
    if (currentIndex === null) {
      ctx.ui.renderSlot(slotId, null);
      return;
    }
    const target = steps[currentIndex] ?? '';
    const caption = narration?.[currentIndex];
    const children: UiDescriptor[] = [
      { type: 'span', props: { text: `Step ${currentIndex + 1}/${steps.length}: ${target}` } },
    ];
    if (caption) children.push({ type: 'p', props: { text: caption } });
    ctx.ui.renderSlot(slotId, { type: 'div', props: { class: 'ee-tour-status' }, children });
  };

  const goTo = (index: number): boolean => {
    if (!ctx || index < 0 || index >= steps.length) return false;
    const target = steps[index] as string;
    const ok = ctx.focus ? ctx.focus.focus({ kind: 'component', id: target }) : true;
    if (!ok) return false;
    currentIndex = index;
    renderStatus();
    ctx.events.emit('tour:step', { id, index, total: steps.length, target });
    return true;
  };

  const complete = (interrupted: boolean): void => {
    if (currentIndex === null) return;
    currentIndex = null;
    renderStatus();
    ctx?.events.emit('tour:completed', { id, interrupted });
  };

  const startTour = (): boolean => {
    if (steps.length === 0) return false;
    return goTo(0);
  };

  const next = (): boolean => {
    if (currentIndex === null) return false;
    if (currentIndex + 1 < steps.length) return goTo(currentIndex + 1);
    if (loop) return goTo(0);
    complete(false);
    return false;
  };

  const previous = (): boolean => {
    if (currentIndex === null || currentIndex === 0) return false;
    return goTo(currentIndex - 1);
  };

  const stopTour = (): void => complete(true);

  return {
    id,
    name: 'Guided Tour',
    providesCapabilities: ['scenario'],

    register(pluginContext) {
      ctx = pluginContext;
      ctx.ui?.registerSlot(slotId);
    },

    init(pluginContext) {
      const raw = pluginContext.config.options;
      if (isStringArray(raw['steps'])) steps = raw['steps'];
      if (typeof raw['autoStart'] === 'boolean') autoStart = raw['autoStart'];
      if (typeof raw['loop'] === 'boolean') loop = raw['loop'];
      if (isStringArray(raw['narration'])) narration = raw['narration'];
    },

    start() {
      if (autoStart) startTour();
    },

    stop() {
      complete(true);
    },

    dispose(pluginContext) {
      currentIndex = null;
      pluginContext.ui?.renderSlot(slotId, null);
      ctx = null;
    },

    startTour,
    next,
    previous,
    stopTour,
    getCurrentStepIndex: () => currentIndex,
  };
}
