import { describe, it, expect, vi } from 'vitest';
import { createEngine } from './engine';
import type { LogEntry } from '../diagnostics/logger';

describe('createEngine', () => {
  it('creates a headless engine exposing events and diagnostics', () => {
    const engine = createEngine();
    expect(engine.state).toBe('created');
    expect(engine.isDisposed()).toBe(false);
    expect(engine.events).toBeDefined();
    expect(engine.diagnostics).toBeDefined();
    engine.dispose();
  });

  it('dispose emits engine:disposed, releases all listeners (no leak) and is idempotent', () => {
    const engine = createEngine();
    const onDisposed = vi.fn();
    engine.events.on('engine:disposed', onDisposed);
    engine.events.on('engine:disposed', () => {});
    expect(engine.events.listenerCount()).toBe(2);

    engine.dispose();
    expect(onDisposed).toHaveBeenCalledTimes(1);
    expect(engine.state).toBe('disposed');
    expect(engine.isDisposed()).toBe(true);
    expect(engine.events.listenerCount()).toBe(0); // no leak

    engine.dispose(); // idempotent
    expect(onDisposed).toHaveBeenCalledTimes(1);
  });

  it('routes handler errors to diagnostics without throwing', () => {
    const entries: LogEntry[] = [];
    const engine = createEngine({
      diagnostics: { level: 'error', sink: (entry) => entries.push(entry) },
    });
    engine.events.on('engine:disposed', () => {
      throw new Error('boom');
    });
    expect(() => engine.dispose()).not.toThrow();
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0]?.level).toBe('error');
  });
});
