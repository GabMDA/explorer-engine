import { describe, it, expect, vi } from 'vitest';
import { createAccessibilityService } from './accessibility-service';
import { EventBus } from '../events/event-bus';
import type { EngineEventMap } from '../types/events';

const address = (id: string) => ({ kind: 'component' as const, id });

describe('createAccessibilityService', () => {
  it('announce() emits a11y:announce with a timestamp from the injected clock', () => {
    const events = new EventBus<EngineEventMap>();
    const handler = vi.fn();
    events.on('a11y:announce', handler);
    const svc = createAccessibilityService({ events, now: () => 42 });

    svc.announce('Hello');

    expect(handler).toHaveBeenCalledWith({ message: 'Hello', politeness: 'polite', at: 42 });
  });

  it('defaults to "polite" and accepts "assertive"', () => {
    const events = new EventBus<EngineEventMap>();
    const handler = vi.fn();
    events.on('a11y:announce', handler);
    const svc = createAccessibilityService({ events });

    svc.announce('Urgent', 'assertive');

    expect(handler.mock.calls[0]?.[0]).toMatchObject({ politeness: 'assertive' });
  });

  it('translates focus:started/focus:ended into announcements using describeTarget', () => {
    const events = new EventBus<EngineEventMap>();
    const messages: string[] = [];
    events.on('a11y:announce', (e) => messages.push(e.message));
    createAccessibilityService({
      events,
      describeTarget: (target) => `component "${target.id}"`,
    });

    events.emit('focus:started', { target: address('gpu') });
    events.emit('focus:ended', { target: address('gpu'), current: null });

    expect(messages).toEqual(['Focused on component "gpu"', 'Back to overview']);
  });

  it('translates state:changed / modifier:changed / model:loaded / model:error', () => {
    const events = new EventBus<EngineEventMap>();
    const messages: Array<{ message: string; politeness: string }> = [];
    events.on('a11y:announce', (e) =>
      messages.push({ message: e.message, politeness: e.politeness }),
    );
    createAccessibilityService({ events });

    events.emit('state:changed', { base: 'exploded', modifiers: [] });
    events.emit('modifier:changed', { id: 'xray', on: true });
    events.emit('model:loaded', { url: 'm.glb', boundingBox: { min: [0, 0, 0], max: [1, 1, 1] } });
    events.emit('model:error', { url: 'm.glb', message: 'network down' });

    expect(messages).toEqual([
      { message: 'View: exploded', politeness: 'polite' },
      { message: 'xray enabled', politeness: 'polite' },
      { message: 'Model loaded', politeness: 'polite' },
      { message: 'Loading error: network down', politeness: 'assertive' },
    ]);
  });

  it('translates tour:step/tour:completed/measure:point-added/measure:completed', () => {
    const events = new EventBus<EngineEventMap>();
    const messages: string[] = [];
    events.on('a11y:announce', (e) => messages.push(e.message));
    createAccessibilityService({ events });

    events.emit('tour:step', { id: 'guided-tour', index: 0, total: 3, target: 'crown' });
    events.emit('tour:completed', { id: 'guided-tour', interrupted: false });
    events.emit('tour:completed', { id: 'guided-tour', interrupted: true });
    events.emit('measure:point-added', { id: 'measure', index: 0, point: [0, 0, 0] });
    events.emit('measure:completed', { id: 'measure', distance: 1.23456 });

    expect(messages).toEqual([
      'Tour step 1 of 3: crown',
      'Tour completed',
      'Tour ended',
      'Measurement point 1 of 2 placed',
      'Measured distance: 1.235',
    ]);
  });

  it('exposes and replaces the alt-nav registry, emitting a11y:navigable-changed', () => {
    const events = new EventBus<EngineEventMap>();
    const handler = vi.fn();
    events.on('a11y:navigable-changed', handler);
    const svc = createAccessibilityService({
      events,
      navigable: [{ target: address('gpu'), label: 'GPU' }],
    });

    expect(svc.getNavigable()).toEqual([{ target: address('gpu'), label: 'GPU' }]);

    const next = [
      { target: address('gpu'), label: 'GPU' },
      { target: address('fan'), label: 'Fan' },
    ];
    svc.setNavigable(next);

    expect(svc.getNavigable()).toEqual(next);
    expect(handler).toHaveBeenCalledWith({ entries: next });
  });

  it('dispose() unsubscribes from the bus and silences announce()', () => {
    const events = new EventBus<EngineEventMap>();
    const handler = vi.fn();
    events.on('a11y:announce', handler);
    const svc = createAccessibilityService({ events });

    svc.dispose();
    events.emit('focus:started', { target: address('gpu') });
    svc.announce('should not fire');

    expect(handler).not.toHaveBeenCalled();
  });
});
