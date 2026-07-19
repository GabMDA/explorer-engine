import { describe, it, expect, vi } from 'vitest';
import { createCancellationSource } from './cancellation';

describe('createCancellationSource', () => {
  it('fires listeners once on cancel and flips isCancelled', () => {
    const src = createCancellationSource();
    const listener = vi.fn();
    src.signal.onCancel(listener);
    expect(src.signal.isCancelled).toBe(false);

    src.cancel();
    expect(src.signal.isCancelled).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    src.cancel(); // idempotent
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('invokes a listener immediately if already cancelled', () => {
    const src = createCancellationSource();
    src.cancel();
    const listener = vi.fn();
    src.signal.onCancel(listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes a listener before cancellation', () => {
    const src = createCancellationSource();
    const listener = vi.fn();
    const unsub = src.signal.onCancel(listener);
    unsub();
    src.cancel();
    expect(listener).not.toHaveBeenCalled();
  });
});
