import { runtimeConsole } from '../internal/console';

/** A handler for a bus event carrying `TPayload`. */
export type EventHandler<TPayload> = (payload: TPayload) => void;

/** Returned by `on`/`once`; call it to remove the subscription. */
export type Unsubscribe = () => void;

export interface EventBusOptions {
  /**
   * Called when a handler throws. Emission continues for the remaining handlers
   * (fail gracefully — ENGINE_CONSTITUTION P6) and the error is never swallowed
   * silently (L24). Defaults to reporting via the runtime console.
   */
  onError?: (error: unknown, context: { readonly event: string }) => void;
}

/**
 * Minimal, typed publish/subscribe event bus (ADR-004).
 *
 * Events are keyed by a compile-time catalog `TEventMap` (event name → payload
 * type): emitting or subscribing to an unknown name, or with a mismatched
 * payload, is a compile error.
 *
 * Headless: no DOM, no timers, no per-frame data — hot per-frame data flows
 * through ports, never through the bus (ENGINE_CONSTITUTION L11).
 */
export class EventBus<TEventMap> {
  readonly #handlers = new Map<keyof TEventMap, Set<EventHandler<never>>>();
  readonly #onError: NonNullable<EventBusOptions['onError']>;

  constructor(options: EventBusOptions = {}) {
    this.#onError =
      options.onError ??
      ((error, context) => {
        runtimeConsole()?.error(`[event-bus] handler for "${context.event}" threw`, error);
      });
  }

  /** Subscribe to `event`. Returns an unsubscribe function. */
  on<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): Unsubscribe {
    let set = this.#handlers.get(event);
    if (set === undefined) {
      set = new Set();
      this.#handlers.set(event, set);
    }
    set.add(handler as EventHandler<never>);
    return () => {
      this.off(event, handler);
    };
  }

  /** Subscribe to the next `event` only, then auto-unsubscribe. */
  once<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): Unsubscribe {
    const wrapper: EventHandler<TEventMap[K]> = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    return this.on(event, wrapper);
  }

  /** Remove a previously registered handler. No-op if it is not registered. */
  off<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
    const set = this.#handlers.get(event);
    if (set === undefined) return;
    set.delete(handler as EventHandler<never>);
    if (set.size === 0) this.#handlers.delete(event);
  }

  /** Emit `event` with `payload` to all current handlers. */
  emit<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void {
    const set = this.#handlers.get(event);
    if (set === undefined || set.size === 0) return;
    // Iterate a snapshot so handlers may (un)subscribe during emission safely.
    for (const handler of [...set]) {
      try {
        (handler as EventHandler<TEventMap[K]>)(payload);
      } catch (error) {
        this.#onError(error, { event: String(event) });
      }
    }
  }

  /** Number of handlers for `event`, or for all events when omitted. */
  listenerCount(event?: keyof TEventMap): number {
    if (event !== undefined) return this.#handlers.get(event)?.size ?? 0;
    let total = 0;
    for (const set of this.#handlers.values()) total += set.size;
    return total;
  }

  /** Remove every handler. Used during teardown to guarantee no leaks (L20). */
  clear(): void {
    this.#handlers.clear();
  }
}
