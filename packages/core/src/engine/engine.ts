import { EventBus } from '../events/event-bus';
import { createLogger, type Logger, type LogLevel, type LogSink } from '../diagnostics/logger';
import type { EngineEventMap } from '../types/events';

/** Coarse lifecycle state of the engine (extended in later phases). */
export type EngineLifecycleState = 'created' | 'disposed';

export interface EngineOptions {
  /** Diagnostics configuration. Defaults to production-quiet (errors only). */
  readonly diagnostics?: {
    readonly level?: LogLevel;
    readonly sink?: LogSink;
  };
}

/**
 * The headless engine (P0-T4 skeleton).
 *
 * At this stage it only wires the transverse services — a typed event bus and a
 * diagnostics logger — and a no-op create/dispose lifecycle. It contains NO DOM,
 * NO WebGL, NO Three.js, NO UI, NO renderer (ENGINE_CONSTITUTION L8/L9). Rendering,
 * adapters, states, focus, hotspots and the Render State Resolver arrive later.
 */
export interface Engine {
  /** Typed publish/subscribe bus for engine events. */
  readonly events: EventBus<EngineEventMap>;
  /** Structured diagnostics logger (namespace `engine`). */
  readonly diagnostics: Logger;
  /** Current lifecycle state. */
  readonly state: EngineLifecycleState;
  /** Whether `dispose` has been called. */
  isDisposed(): boolean;
  /** Tear down: emit `engine:disposed`, release all listeners, mark disposed. Idempotent. */
  dispose(): void;
}

/** Create a headless engine instance. */
export function createEngine(options: EngineOptions = {}): Engine {
  // Chapter 02 §2.19.3: silent in production except errors — hence the `error` default.
  const diagnostics = createLogger({
    level: options.diagnostics?.level ?? 'error',
    namespace: 'engine',
    ...(options.diagnostics?.sink !== undefined ? { sink: options.diagnostics.sink } : {}),
  });

  const events = new EventBus<EngineEventMap>({
    onError: (error, context) =>
      diagnostics.error(`event handler for "${context.event}" threw`, error),
  });

  let state: EngineLifecycleState = 'created';
  diagnostics.debug('engine created');

  return {
    events,
    diagnostics,
    get state() {
      return state;
    },
    isDisposed: () => state === 'disposed',
    dispose: () => {
      if (state === 'disposed') return; // idempotent
      events.emit('engine:disposed', { at: Date.now() });
      events.clear(); // release every listener — no leaks (ENGINE_CONSTITUTION L20)
      state = 'disposed';
      diagnostics.debug('engine disposed');
    },
  };
}
