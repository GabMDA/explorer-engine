import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFetchTransport, HttpResourceError } from './fetch-transport';
import { createCancellationSource } from '@explorer-engine/core';

function response(init: {
  ok: boolean;
  status: number;
  statusText?: string;
  url?: string;
  contentType?: string | null;
  body?: Uint8Array;
}): Response {
  return {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText ?? '',
    url: init.url ?? '',
    headers: {
      get: (name: string) => (name === 'content-type' ? (init.contentType ?? null) : null),
    },
    arrayBuffer: async () => (init.body ?? new Uint8Array()).buffer,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createFetchTransport', () => {
  it('converts a successful response to bytes with url and mime type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          ok: true,
          status: 200,
          url: 'https://cdn/pkg/a.bin',
          contentType: 'application/octet-stream',
          body: new Uint8Array([1, 2, 3, 4]),
        }),
      ),
    );
    const transport = createFetchTransport();
    const src = createCancellationSource();
    const data = await transport.fetch({ url: 'https://cdn/pkg/a.bin', signal: src.signal });

    expect(Array.from(data.bytes)).toEqual([1, 2, 3, 4]);
    expect(data.url).toBe('https://cdn/pkg/a.bin');
    expect(data.mimeType).toBe('application/octet-stream');
  });

  it('rejects a non-successful HTTP response with an explicit error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ ok: false, status: 404, statusText: 'Not Found' })),
    );
    const transport = createFetchTransport();
    const src = createCancellationSource();
    await expect(
      transport.fetch({ url: 'https://cdn/pkg/missing.bin', signal: src.signal }),
    ).rejects.toBeInstanceOf(HttpResourceError);
  });

  it('maps the abstract cancellation onto AbortController (fetch sees an aborted signal)', async () => {
    let seenSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
        seenSignal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      }),
    );
    const transport = createFetchTransport();
    const src = createCancellationSource();
    const p = transport.fetch({ url: 'https://cdn/pkg/slow.bin', signal: src.signal });

    expect(seenSignal?.aborted).toBe(false);
    src.cancel();
    expect(seenSignal?.aborted).toBe(true);
    await expect(p).rejects.toThrow('aborted');
  });
});
