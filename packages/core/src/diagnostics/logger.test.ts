import { describe, it, expect } from 'vitest';
import { createLogger, type LogEntry } from './logger';

function capture() {
  const entries: LogEntry[] = [];
  const sink = (entry: LogEntry) => entries.push(entry);
  return { entries, sink };
}

describe('createLogger', () => {
  it('emits only at or above the configured level', () => {
    const { entries, sink } = capture();
    const log = createLogger({ level: 'warn', sink });
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(entries.map((entry) => entry.level)).toEqual(['warn', 'error']);
  });

  it("level 'silent' emits nothing (not even errors)", () => {
    const { entries, sink } = capture();
    const log = createLogger({ level: 'silent', sink });
    log.error('e');
    expect(entries).toHaveLength(0);
  });

  it('setLevel changes filtering at runtime', () => {
    const { entries, sink } = capture();
    const log = createLogger({ level: 'error', sink });
    log.info('i1');
    log.setLevel('info');
    log.info('i2');
    expect(entries.map((entry) => entry.message)).toEqual(['i2']);
  });

  it('child composes namespaces and forwards to the same sink', () => {
    const { entries, sink } = capture();
    const root = createLogger({ level: 'debug', namespace: 'engine', sink });
    root.child('events').warn('hey', { a: 1 });
    expect(entries[0]?.namespace).toBe('engine:events');
    expect(entries[0]?.context).toEqual({ a: 1 });
  });

  it('records a numeric timestamp', () => {
    const { entries, sink } = capture();
    createLogger({ level: 'debug', sink }).info('x');
    expect(typeof entries[0]?.timestamp).toBe('number');
  });
});
