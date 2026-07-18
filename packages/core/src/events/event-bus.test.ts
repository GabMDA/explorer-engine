import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './event-bus';

interface TestEvents {
  ping: { n: number };
  pong: void;
}

describe('EventBus', () => {
  it('on + emit delivers typed payloads in order', () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    bus.on('ping', (p) => received.push(p.n));
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(received).toEqual([1, 2]);
  });

  it('off (and the unsubscribe returned by on) stops delivery', () => {
    const bus = new EventBus<TestEvents>();
    const a = vi.fn();
    const unsub = bus.on('ping', a);
    bus.emit('ping', { n: 1 });
    unsub();
    bus.emit('ping', { n: 2 });
    expect(a).toHaveBeenCalledTimes(1);

    const b = vi.fn();
    bus.on('ping', b);
    bus.off('ping', b);
    bus.emit('ping', { n: 3 });
    expect(b).not.toHaveBeenCalled();
  });

  it('once delivers exactly one time and cleans up', () => {
    const bus = new EventBus<TestEvents>();
    const h = vi.fn();
    bus.once('ping', h);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(h).toHaveBeenCalledTimes(1);
    expect(bus.listenerCount('ping')).toBe(0);
  });

  it('listenerCount reports per-event and total; clear removes all', () => {
    const bus = new EventBus<TestEvents>();
    bus.on('ping', () => {});
    bus.on('ping', () => {});
    bus.on('pong', () => {});
    expect(bus.listenerCount('ping')).toBe(2);
    expect(bus.listenerCount()).toBe(3);
    bus.clear();
    expect(bus.listenerCount()).toBe(0);
  });

  it('a throwing handler does not stop others and is reported to onError', () => {
    const onError = vi.fn();
    const bus = new EventBus<TestEvents>({ onError });
    const after = vi.fn();
    bus.on('ping', () => {
      throw new Error('boom');
    });
    bus.on('ping', after);
    bus.emit('ping', { n: 1 });
    expect(after).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing during emit is safe (iterates a snapshot)', () => {
    const bus = new EventBus<TestEvents>();
    const order: string[] = [];
    let unsubB: () => void = () => {};
    bus.on('ping', () => {
      order.push('a');
      unsubB();
    });
    unsubB = bus.on('ping', () => {
      order.push('b');
    });

    bus.emit('ping', { n: 1 });
    expect(order).toEqual(['a', 'b']); // b still runs this pass (snapshot)

    order.length = 0;
    bus.emit('ping', { n: 2 });
    expect(order).toEqual(['a']); // b removed for subsequent emits
  });
});
