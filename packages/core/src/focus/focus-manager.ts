// Focus Manager (chapter 08, roadmap P5-T4) — a MECHANISM, never a state (C4). It
// turns "highlight this target" into DECLARATIVE LAYERS published to the Render
// State Resolver: a `cameraIntent` (priority focus, executed by the camera adapter),
// plus optional dim (`opacity`) / isolate (`visibility`) on the rest and an
// `outline` on the target. It NEVER touches the camera, an Object3D or a material
// (L5) and NEVER restores imperatively — exiting a focus REMOVES its layers and the
// resolver recomposes (L6). Headless (L8/L9): bounds come from a BoundsProvider.
import type { Address } from '@explorer-engine/schema';
import type { FocusConfig } from '@explorer-engine/schema';
import { computeCameraFraming } from '../model/framing';
import type { ComponentModel } from '../render-state/component-model';
import type { RenderStateResolver } from '../render-state/resolver';
import type { CameraIntentValue } from '../render-state/channels';
import type { BoundsProvider, FrameHint } from './bounds-provider';
import type { EventBus } from '../events/event-bus';
import type { EngineEventMap } from '../types/events';
import type { Vec3 } from '../ports/camera-port';

/** The layer source Focus publishes under (removeBySource clears every level). */
export const FOCUS_SOURCE = 'focus';

export interface FocusFrameOptions {
  /** Approach direction (target → camera); defaults to the framing default. */
  readonly direction?: Vec3;
}

export interface FocusManagerOptions {
  readonly resolver: RenderStateResolver;
  readonly components: ComponentModel;
  readonly config: FocusConfig;
  readonly boundsProvider: BoundsProvider;
  readonly frameHint: FrameHint;
  readonly events?: EventBus<EngineEventMap>;
  readonly frameOptions?: FocusFrameOptions;
}

export interface FocusManager {
  /** Enter a focus level on `target` (nests onto the focus stack). */
  focus(target: Address): boolean;
  /** Exit the current level; re-applies the parent, or clears if the stack empties. */
  back(): void;
  /** Clear the whole focus stack (home). */
  clear(): void;
  /** Compute (without publishing) the camera intent for a target, or null. */
  computeIntent(target: Address): CameraIntentValue | null;
  getStack(): readonly Address[];
  getCurrent(): Address | null;
  readonly depth: number;
  dispose(): void;
}

export function createFocusManager(options: FocusManagerOptions): FocusManager {
  const { resolver, components, config, boundsProvider, frameHint, events } = options;
  const stack: Address[] = [];
  let disposed = false;

  const computeIntent = (target: Address): CameraIntentValue | null => {
    const box = boundsProvider.boundsOf(target);
    if (box === null) return null;
    const { fovYRadians, aspect } = frameHint();
    const framing = computeCameraFraming(box, {
      fovYRadians,
      aspect,
      margin: config.padding,
      ...(options.frameOptions?.direction ? { direction: options.frameOptions.direction } : {}),
    });
    return { position: framing.position, target: framing.target };
  };

  /** Node identities covered by the focus target (kept fully lit). */
  const targetIdentities = (target: Address): Set<string> => new Set(components.expand(target));

  const publishLayers = (target: Address): boolean => {
    const intent = computeIntent(target);
    if (intent === null) return false;

    // Camera intent (exclusive by priority; the camera adapter executes the move).
    resolver.addLayer({ source: FOCUS_SOURCE, target, channel: 'cameraIntent', value: intent });

    // Outline the target.
    if (config.outline.enabled) {
      resolver.addLayer({
        source: FOCUS_SOURCE,
        target,
        channel: 'outline',
        value: { color: config.outline.color, thickness: config.outline.thickness },
        transition: config.transition,
      });
    }

    // Dim / isolate everything that is NOT part of the target.
    if (config.dimOthers || config.isolate) {
      const kept = targetIdentities(target);
      for (const componentId of components.componentIds()) {
        const identities = components.expand({ kind: 'component', id: componentId });
        if (identities.length === 0) continue;
        if (identities.some((id) => kept.has(id))) continue; // part of the focus
        const addr: Address = { kind: 'component', id: componentId };
        if (config.isolate) {
          resolver.addLayer({
            source: FOCUS_SOURCE,
            target: addr,
            channel: 'visibility',
            value: 'hidden',
            transition: config.transition,
          });
        } else {
          resolver.addLayer({
            source: FOCUS_SOURCE,
            target: addr,
            channel: 'opacity',
            value: config.dimOpacity,
            transition: config.transition,
          });
        }
      }
    }
    return true;
  };

  const applyTop = () => {
    resolver.removeBySource(FOCUS_SOURCE);
    const top = stack[stack.length - 1];
    if (top) publishLayers(top);
  };

  return {
    focus(target) {
      if (disposed) return false;
      // Validate the target resolves to something before committing.
      if (computeIntent(target) === null) return false;
      resolver.removeBySource(FOCUS_SOURCE);
      stack.push(target);
      const ok = publishLayers(target);
      if (!ok) {
        stack.pop();
        applyTop();
        return false;
      }
      events?.emit('focus:started', { target });
      return true;
    },

    back() {
      if (disposed || stack.length === 0) return;
      const exited = stack.pop() as Address;
      applyTop();
      events?.emit('focus:ended', { target: exited, current: stack[stack.length - 1] ?? null });
    },

    clear() {
      if (disposed || stack.length === 0) return;
      const exited = stack[stack.length - 1] as Address;
      stack.length = 0;
      resolver.removeBySource(FOCUS_SOURCE);
      events?.emit('focus:ended', { target: exited, current: null });
    },

    computeIntent,
    getStack: () => [...stack],
    getCurrent: () => stack[stack.length - 1] ?? null,
    get depth() {
      return stack.length;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      stack.length = 0;
      resolver.removeBySource(FOCUS_SOURCE);
    },
  };
}
