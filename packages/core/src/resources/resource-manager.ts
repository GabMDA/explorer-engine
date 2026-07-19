// Resource Manager (roadmap P2-T1 ; chapter 02 §2.19.2). Headless service that
// resolves package-relative paths, loads resource bytes through an injected
// ResourceTransport, caches successes, de-duplicates concurrent requests, retries
// transient failures within a timeout budget, and releases everything on dispose
// (ENGINE_CONSTITUTION L20/C16 — cancellable loads, no leak). It knows nothing of
// the DOM, `fetch`, Three.js, GLB, textures or ObjectURL: only bytes cross its API.
import type { CancellationSource } from './cancellation';
import { createCancellationSource } from './cancellation';
import type { ResourceData, ResourceTransport, TimeoutScheduler } from './resource-transport';
import { resolveResourcePath } from './resolve-path';

/** Thrown when a load is aborted by `dispose()` (or issued after dispose). */
export class ResourceCancelledError extends Error {
  constructor(message = 'Resource load cancelled') {
    super(message);
    this.name = 'ResourceCancelledError';
  }
}

export interface ResourceManagerOptions {
  /** Transport that fetches raw bytes (injected; keeps the Core DOM-free). */
  readonly transport: ResourceTransport;
  /** Package base URL used to resolve relative paths. Optional. */
  readonly baseUrl?: string;
  /** Max attempts per load (>= 1). Default 3. */
  readonly maxAttempts?: number;
  /** Per-attempt timeout in ms. Requires `timeoutScheduler`. Default: no timeout. */
  readonly timeoutMs?: number;
  /** Injected timeout scheduler (host wraps setTimeout; tests fake it). */
  readonly timeoutScheduler?: TimeoutScheduler;
  /** Whether a transport error is worth retrying. Default: always retry. */
  readonly isRetryable?: (error: unknown) => boolean;
}

export interface ResourceManager {
  /** Load the resource at `path` (relative to the base URL, or absolute). */
  load(path: string): Promise<ResourceData>;
  /** Cancel all in-flight loads, clear the cache, and block further loads. Idempotent. */
  dispose(): void;
}

export function createResourceManager(options: ResourceManagerOptions): ResourceManager {
  const { transport } = options;
  const baseUrl = options.baseUrl;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const timeoutMs = options.timeoutMs;
  const timeoutScheduler = options.timeoutScheduler;
  const isRetryable = options.isRetryable ?? (() => true);

  const cache = new Map<string, ResourceData>();
  const inflight = new Map<string, Promise<ResourceData>>();
  const inflightSources = new Map<string, CancellationSource>();
  let disposed = false;

  async function runWithRetry(url: string, request: CancellationSource): Promise<ResourceData> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (request.signal.isCancelled) throw new ResourceCancelledError();

      // Each attempt gets its own signal: fired by the shared request (dispose) or
      // by this attempt's timeout, so a timeout aborts only the current attempt.
      const attemptSource = createCancellationSource();
      const unsub = request.signal.onCancel(() => attemptSource.cancel());
      const cancelTimeout =
        timeoutScheduler && timeoutMs !== undefined
          ? timeoutScheduler.schedule(() => attemptSource.cancel(), timeoutMs)
          : undefined;

      try {
        return await transport.fetch({ url, signal: attemptSource.signal });
      } catch (error) {
        // Dispose wins: never retry, report cancellation.
        if (request.signal.isCancelled) throw new ResourceCancelledError();
        lastError = error;
        if (attempt >= maxAttempts || !isRetryable(error)) throw error;
        // otherwise: loop and retry
      } finally {
        cancelTimeout?.();
        unsub();
      }
    }
    // Unreachable (the loop returns or throws), but satisfies the type checker.
    throw lastError instanceof Error ? lastError : new Error('Resource load failed');
  }

  return {
    load(path: string): Promise<ResourceData> {
      if (disposed) {
        return Promise.reject(new ResourceCancelledError('Resource manager disposed'));
      }

      const url = resolveResourcePath(baseUrl, path);

      const cached = cache.get(url);
      if (cached !== undefined) return Promise.resolve(cached);

      const shared = inflight.get(url);
      if (shared !== undefined) return shared; // de-duplicate concurrent loads

      const source = createCancellationSource();
      inflightSources.set(url, source);

      const promise = runWithRetry(url, source).then(
        (data) => {
          inflight.delete(url);
          inflightSources.delete(url);
          if (!disposed) cache.set(url, data); // never cache after dispose
          return data;
        },
        (error) => {
          inflight.delete(url); // never cache a failure; allow a future retry
          inflightSources.delete(url);
          throw error;
        },
      );

      inflight.set(url, promise);
      return promise;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const source of inflightSources.values()) source.cancel();
      inflightSources.clear();
      inflight.clear();
      cache.clear();
    },
  };
}
