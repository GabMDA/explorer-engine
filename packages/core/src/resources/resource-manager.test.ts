import { describe, it, expect, vi } from 'vitest';
import { createResourceManager, ResourceCancelledError } from './resource-manager';
import type { ResourceData, ResourceTransport, TimeoutScheduler } from './resource-transport';
import type { CancellationSignal } from './cancellation';

const B = (...n: number[]) => new Uint8Array(n);

/** Transport whose fetches stay pending until the test resolves/rejects them, and
 *  which rejects automatically when its per-attempt signal is cancelled. */
function deferredTransport() {
  const calls: { url: string; signal: CancellationSignal }[] = [];
  const controls: { resolve: (d?: ResourceData) => void; reject: (e?: unknown) => void }[] = [];
  const transport: ResourceTransport = {
    fetch({ url, signal }) {
      calls.push({ url, signal });
      return new Promise<ResourceData>((resolve, reject) => {
        signal.onCancel(() => reject(new Error('aborted')));
        controls.push({
          resolve: (d) =>
            resolve(d ?? { url, bytes: B(1, 2, 3), mimeType: 'application/octet-stream' }),
          reject: (e) => reject(e ?? new Error('boom')),
        });
      });
    },
  };
  return { transport, calls, controls };
}

/** Deterministic timeout scheduler: timers fire only when the test asks. */
function manualTimeouts() {
  let id = 0;
  const timers = new Map<number, () => void>();
  const scheduler: TimeoutScheduler = {
    schedule(cb) {
      const myId = ++id;
      timers.set(myId, cb);
      return () => timers.delete(myId);
    },
  };
  return {
    scheduler,
    size: () => timers.size,
    fireAll: () => {
      const cbs = [...timers.values()];
      timers.clear();
      for (const cb of cbs) cb();
    },
  };
}

describe('createResourceManager — path + load', () => {
  it('resolves a relative path and loads bytes through the transport', async () => {
    const calls: string[] = [];
    const transport: ResourceTransport = {
      async fetch({ url }) {
        calls.push(url);
        return { url, bytes: B(9, 8, 7), mimeType: 'text/plain' };
      },
    };
    const rm = createResourceManager({ transport, baseUrl: 'https://cdn/pkg/' });
    const data = await rm.load('models/a.bin');
    expect(calls).toEqual(['https://cdn/pkg/models/a.bin']);
    expect(Array.from(data.bytes)).toEqual([9, 8, 7]);
    expect(data.mimeType).toBe('text/plain');
  });

  it('keeps an absolute URL as the cache key', async () => {
    const calls: string[] = [];
    const transport: ResourceTransport = {
      async fetch({ url }) {
        calls.push(url);
        return { url, bytes: B(1) };
      },
    };
    const rm = createResourceManager({ transport, baseUrl: 'https://cdn/pkg/' });
    await rm.load('https://other/x.bin');
    expect(calls).toEqual(['https://other/x.bin']);
  });
});

describe('createResourceManager — cache + dedup', () => {
  it('serves a second load from cache without hitting the transport again', async () => {
    let count = 0;
    const transport: ResourceTransport = {
      async fetch({ url }) {
        count += 1;
        return { url, bytes: B(4, 2) };
      },
    };
    const rm = createResourceManager({ transport });
    const first = await rm.load('a.bin');
    const second = await rm.load('a.bin');
    expect(count).toBe(1);
    expect(second).toBe(first); // same cached instance
  });

  it('de-duplicates concurrent loads into a single request, then caches', async () => {
    const t = deferredTransport();
    const rm = createResourceManager({ transport: t.transport });

    const p1 = rm.load('a.bin');
    const p2 = rm.load('a.bin');
    expect(t.calls).toHaveLength(1); // shared, single in-flight request

    t.controls[0]?.resolve();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(r2);

    await rm.load('a.bin'); // now cached
    expect(t.calls).toHaveLength(1);
  });

  it('removes the in-flight entry after a failure so a later call retries', async () => {
    const t = deferredTransport();
    const rm = createResourceManager({ transport: t.transport, isRetryable: () => false });

    const p1 = rm.load('a.bin');
    t.controls[0]?.reject(new Error('boom'));
    await expect(p1).rejects.toThrow('boom');

    const p2 = rm.load('a.bin'); // failure was not cached → new request issued
    expect(t.calls).toHaveLength(2);
    t.controls[1]?.resolve();
    await expect(p2).resolves.toBeDefined();
  });
});

describe('createResourceManager — retry + timeout', () => {
  it('retries a retryable failure then succeeds', async () => {
    let attempt = 0;
    const transport: ResourceTransport = {
      async fetch({ url }) {
        attempt += 1;
        if (attempt === 1) throw new Error('transient');
        return { url, bytes: B(7) };
      },
    };
    const rm = createResourceManager({ transport, maxAttempts: 3 });
    const data = await rm.load('a.bin');
    expect(attempt).toBe(2);
    expect(Array.from(data.bytes)).toEqual([7]);
  });

  it('does not retry a non-retryable failure', async () => {
    let attempt = 0;
    const transport: ResourceTransport = {
      async fetch() {
        attempt += 1;
        throw new Error('fatal');
      },
    };
    const rm = createResourceManager({ transport, maxAttempts: 3, isRetryable: () => false });
    await expect(rm.load('a.bin')).rejects.toThrow('fatal');
    expect(attempt).toBe(1);
  });

  it('times out an attempt by cancelling its signal', async () => {
    const t = deferredTransport();
    const timers = manualTimeouts();
    const rm = createResourceManager({
      transport: t.transport,
      maxAttempts: 1,
      timeoutMs: 1000,
      timeoutScheduler: timers.scheduler,
    });

    const p = rm.load('slow.bin');
    expect(timers.size()).toBe(1);
    expect(t.calls[0]?.signal.isCancelled).toBe(false);

    timers.fireAll(); // timeout → attempt signal cancelled → transport aborts
    await expect(p).rejects.toThrow('aborted');
    expect(t.calls[0]?.signal.isCancelled).toBe(true);
  });
});

describe('createResourceManager — dispose', () => {
  it('cancels in-flight loads and rejects them as cancelled', async () => {
    const t = deferredTransport();
    const rm = createResourceManager({ transport: t.transport });

    const p = rm.load('a.bin');
    expect(t.calls).toHaveLength(1);

    rm.dispose();
    await expect(p).rejects.toBeInstanceOf(ResourceCancelledError);
  });

  it('empties the cache and refuses new loads after dispose (idempotent)', async () => {
    const transport: ResourceTransport = {
      async fetch({ url }) {
        return { url, bytes: B(1) };
      },
    };
    const rm = createResourceManager({ transport });
    await rm.load('a.bin'); // cached

    rm.dispose();
    await expect(rm.load('a.bin')).rejects.toBeInstanceOf(ResourceCancelledError);
    await expect(rm.load('b.bin')).rejects.toBeInstanceOf(ResourceCancelledError);
    expect(() => rm.dispose()).not.toThrow(); // idempotent
  });

  it('does not retry after dispose', async () => {
    const t = deferredTransport();
    const onRetry = vi.fn();
    const rm = createResourceManager({
      transport: {
        fetch(req) {
          onRetry();
          return t.transport.fetch(req);
        },
      },
      maxAttempts: 5,
    });

    const p = rm.load('a.bin');
    rm.dispose();
    await expect(p).rejects.toBeInstanceOf(ResourceCancelledError);
    expect(onRetry).toHaveBeenCalledTimes(1); // aborted attempt, no further tries
  });
});
