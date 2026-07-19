// Resource transport contract (roadmap P2-T1 ; chapter 02 §2.19.2). Backend- and
// DOM-agnostic: the headless Resource Manager fetches raw bytes through this port
// instead of calling `fetch` directly, so the Core stays free of DOM/browser APIs
// (ENGINE_CONSTITUTION L8/L9). A network adapter (@explorer-engine/resource-fetch)
// implements it with fetch + AbortController. No Three.js/DOM types cross this
// boundary — bytes are plain `Uint8Array`; there is no Blob/ObjectURL here.
import type { CancellationSignal } from './cancellation';

/** A single resource request handed to a {@link ResourceTransport}. */
export interface ResourceRequest {
  /** Fully-resolved absolute (or already-canonical) URL to fetch. */
  readonly url: string;
  /** Fires when the attempt must be aborted (timeout or manager dispose). */
  readonly signal: CancellationSignal;
}

/** The raw bytes and simple metadata of a fetched resource. */
export interface ResourceData {
  /** The URL the bytes came from (echoed/resolved by the transport). */
  readonly url: string;
  /** The resource payload as raw bytes. */
  readonly bytes: Uint8Array;
  /** MIME type when the transport can determine it (e.g. HTTP Content-Type). */
  readonly mimeType?: string;
}

/** Fetches raw resource bytes. Implemented by a network adapter, never the Core. */
export interface ResourceTransport {
  /**
   * Fetch `request.url`. Rejects on a failed request (e.g. non-2xx HTTP status)
   * or when `request.signal` is cancelled. Never caches or retries — that is the
   * Resource Manager's job.
   */
  fetch(request: ResourceRequest): Promise<ResourceData>;
}

/**
 * Injected timeout scheduler (DOM-free): the Core schedules per-attempt timeouts
 * through this instead of touching `setTimeout` (whose types need the DOM/Node
 * libs). The host wraps `setTimeout`; tests supply a deterministic fake.
 */
export interface TimeoutScheduler {
  /** Run `callback` after `delayMs`; returns a function that cancels it. */
  schedule(callback: () => void, delayMs: number): () => void;
}
