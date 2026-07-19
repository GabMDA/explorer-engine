// Fetch-based ResourceTransport (roadmap P2-T1). The ONLY resource package that
// touches fetch/AbortController — the headless Core never sees them. It maps the
// Core's DOM-free CancellationSignal onto a real AbortController and returns raw
// bytes as a Uint8Array. Deliberately minimal: HTTP request → bytes → metadata,
// with an explicit error for non-2xx responses. No ObjectURL/Blob, no decoding,
// no Three.js.
import type { ResourceTransport, ResourceRequest, ResourceData } from '@explorer-engine/core';

/** Error thrown when the server returns a non-successful HTTP status. */
export class HttpResourceError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    statusText: string,
  ) {
    super(`resource-fetch: HTTP ${status} ${statusText} for ${url}`);
    this.name = 'HttpResourceError';
  }
}

export function createFetchTransport(): ResourceTransport {
  return {
    async fetch(request: ResourceRequest): Promise<ResourceData> {
      const controller = new AbortController();
      // Bridge the Core's abstract cancellation to a real AbortController.
      const unsub = request.signal.onCancel(() => controller.abort());
      try {
        const response = await fetch(request.url, { signal: controller.signal });
        if (!response.ok) {
          throw new HttpResourceError(response.status, request.url, response.statusText);
        }
        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type');
        return {
          url: response.url || request.url,
          bytes: new Uint8Array(buffer),
          mimeType: contentType ?? undefined,
        };
      } finally {
        unsub();
      }
    },
  };
}
