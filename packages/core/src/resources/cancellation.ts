// Headless cancellation primitive (roadmap P2-T1). The Core MUST NOT expose
// AbortController/AbortSignal (DOM types), so it defines its own minimal, DOM-free
// abstraction (ENGINE_CONSTITUTION L8/L9). A network adapter maps a real
// AbortController onto this signal; the Core only ever sees the abstraction.

/** A one-shot cancellation signal. Fires its listeners at most once. */
export interface CancellationSignal {
  /** Whether cancellation has already happened. */
  readonly isCancelled: boolean;
  /**
   * Register `listener`, invoked once when cancellation happens — or synchronously
   * right now if already cancelled. Returns a function that unregisters it.
   */
  onCancel(listener: () => void): () => void;
}

/** A cancellation signal together with the trigger that fires it. */
export interface CancellationSource {
  readonly signal: CancellationSignal;
  /** Fire the signal. Idempotent (subsequent calls are no-ops). */
  cancel(): void;
}

export function createCancellationSource(): CancellationSource {
  let cancelled = false;
  const listeners = new Set<() => void>();

  const signal: CancellationSignal = {
    get isCancelled() {
      return cancelled;
    },
    onCancel(listener) {
      if (cancelled) {
        listener();
        return () => {};
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return {
    signal,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      const pending = [...listeners];
      listeners.clear();
      for (const listener of pending) listener();
    },
  };
}
