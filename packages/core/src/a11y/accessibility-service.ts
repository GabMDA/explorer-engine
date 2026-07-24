// Accessibility Service (chapter 12 §12.8.1, decision C17). Headless, CENTRAL
// coordinator: a single announcer every module routes through — v1 had Focus,
// Hotspot, State etc. write their own live regions, causing concurrent/
// contradictory announcements. Rather than give every manager a new direct
// dependency on this service, it listens to the SAME typed event bus they already
// emit on (L10/L11) and translates known transitions into announcements. It also
// owns the unified alternative-navigation registry (ch.07/12) the UI adapter
// materializes as a navigable list. No DOM: the live region and list are the UI
// adapter's job (L8/L9) — this module only ever emits data.
import type { EventBus, Unsubscribe } from '../events/event-bus';
import type { EngineEventMap, A11yPoliteness, A11yNavigableEntry } from '../types/events';
import type { Address } from '@explorer-engine/schema';

export interface AccessibilityServiceOptions {
  readonly events: EventBus<EngineEventMap>;
  /** Initial alternative-navigation registry (ch.12 §12.8.1). */
  readonly navigable?: readonly A11yNavigableEntry[];
  /** Human label for an Address, used to phrase built-in announcements. Defaults
   * to the address id. */
  readonly describeTarget?: (target: Address) => string;
  /** Injected clock (deterministic tests; mirrors the Animation Engine convention). */
  readonly now?: () => number;
}

export interface AccessibilityService {
  /** Raise an announcement through the single central announcer. */
  announce(message: string, politeness?: A11yPoliteness): void;
  getNavigable(): readonly A11yNavigableEntry[];
  /** Replace the alt-nav registry (e.g. after hotspot visibility changes per-state). */
  setNavigable(entries: readonly A11yNavigableEntry[]): void;
  dispose(): void;
}

export function createAccessibilityService(
  options: AccessibilityServiceOptions,
): AccessibilityService {
  const { events, describeTarget = (target) => target.id, now = () => Date.now() } = options;
  let navigable = options.navigable ?? [];
  let disposed = false;

  const announce = (message: string, politeness: A11yPoliteness = 'polite'): void => {
    if (disposed) return;
    events.emit('a11y:announce', { message, politeness, at: now() });
  };

  // Built-in translations of the existing typed events into announcements — the
  // "all modules send their messages" coordination from ch.12 §12.8.1, achieved
  // via the bus instead of a new direct dependency from Focus/State/etc.
  const unsubscribers: Unsubscribe[] = [
    events.on('focus:started', (event) => {
      announce(`Focused on ${describeTarget(event.target)}`);
    }),
    events.on('focus:ended', (event) => {
      announce(event.current ? `Back to ${describeTarget(event.current)}` : 'Back to overview');
    }),
    events.on('state:changed', (event) => {
      announce(event.base !== null ? `View: ${event.base}` : 'View: default');
    }),
    events.on('modifier:changed', (event) => {
      announce(`${event.id} ${event.on ? 'enabled' : 'disabled'}`);
    }),
    events.on('model:loaded', () => {
      announce('Model loaded');
    }),
    events.on('model:error', (event) => {
      announce(`Loading error: ${event.message}`, 'assertive');
    }),
    // Official plugin overlays (ch.10 §10.7) render their own status via a
    // generic UI slot — plain DOM, invisible to assistive tech on its own
    // (ch.12 §12.8.1: "les modules ne créent jamais leur propre live region").
    // Both already emit these typed events; translating them here needs no
    // new plugin dependency, matching every other module in this list.
    events.on('tour:step', (event) => {
      announce(`Tour step ${event.index + 1} of ${event.total}: ${event.target}`);
    }),
    events.on('tour:completed', (event) => {
      announce(event.interrupted ? 'Tour ended' : 'Tour completed');
    }),
    events.on('measure:point-added', (event) => {
      announce(`Measurement point ${event.index + 1} of 2 placed`);
    }),
    events.on('measure:completed', (event) => {
      announce(`Measured distance: ${event.distance.toFixed(3)}`);
    }),
  ];

  return {
    announce,
    getNavigable: () => navigable,
    setNavigable(entries) {
      if (disposed) return;
      navigable = entries;
      events.emit('a11y:navigable-changed', { entries });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const unsubscribe of unsubscribers) unsubscribe();
    },
  };
}
