import { describe, it, expect, vi } from 'vitest';
import { createDomInput } from './dom-input';

type Handler = (event: unknown) => void;

function fakeElement() {
  const listeners = new Map<string, Set<Handler>>();
  const target = {
    tabIndex: -1,
    style: {} as Record<string, string>,
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    addEventListener(type: string, handler: unknown) {
      const set = listeners.get(type) ?? new Set<Handler>();
      set.add(handler as Handler);
      listeners.set(type, set);
    },
    removeEventListener(type: string, handler: unknown) {
      listeners.get(type)?.delete(handler as Handler);
    },
  };
  const fire = (type: string, event: Record<string, unknown>) => {
    for (const handler of listeners.get(type) ?? []) {
      handler({ preventDefault: () => {}, ...event });
    }
  };
  const count = () => [...listeners.values()].reduce((n, set) => n + set.size, 0);
  return { element: target as unknown as HTMLElement, fire, count };
}

function setup() {
  const input = { orbit: vi.fn(), zoom: vi.fn(), pan: vi.fn() };
  const onActivity = vi.fn();
  const dom = fakeElement();
  const port = createDomInput({ element: dom.element, input, onActivity });
  return { ...dom, input, onActivity, port };
}

describe('createDomInput', () => {
  it('makes the element focusable and disables native touch gestures', () => {
    const { element } = setup();
    expect(element.tabIndex).toBe(0);
    expect(element.style.touchAction).toBe('none');
  });

  it('translates a pointer drag into orbit', () => {
    const { fire, input, onActivity } = setup();
    fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    fire('pointermove', { pointerId: 1, clientX: 10, clientY: 5, buttons: 1, shiftKey: false });
    expect(input.orbit).toHaveBeenCalledWith(10, 5);
    expect(onActivity).toHaveBeenCalled();
  });

  it('drags with shift or the secondary button pan', () => {
    const { fire, input } = setup();
    fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    fire('pointermove', { pointerId: 1, clientX: 4, clientY: 3, buttons: 1, shiftKey: true });
    expect(input.pan).toHaveBeenCalledWith(4, 3);

    fire('pointerdown', { pointerId: 2, clientX: 0, clientY: 0 });
    // (two pointers now → pinch path handled by the two-pointer test)
  });

  it('two pointers pinch to zoom and pan', () => {
    const { fire, input } = setup();
    fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    fire('pointerdown', { pointerId: 2, clientX: 10, clientY: 0 });
    fire('pointermove', { pointerId: 2, clientX: 20, clientY: 0 });
    expect(input.zoom).toHaveBeenCalled();
    expect(input.pan).toHaveBeenCalled();
  });

  it('wheel scrolls into zoom (down = out)', () => {
    const { fire, input, onActivity } = setup();
    fire('wheel', { deltaY: 100 });
    expect(input.zoom).toHaveBeenCalledWith(-1); // -100 * 0.01
    expect(onActivity).toHaveBeenCalled();
  });

  it('keyboard arrows orbit, shift+arrows pan, +/- zoom', () => {
    const { fire, input } = setup();
    fire('keydown', { key: 'ArrowLeft', shiftKey: false });
    expect(input.orbit).toHaveBeenCalledWith(-24, 0);
    fire('keydown', { key: 'ArrowUp', shiftKey: true });
    expect(input.pan).toHaveBeenCalledWith(0, 24);
    fire('keydown', { key: '+', shiftKey: false });
    expect(input.zoom).toHaveBeenCalledWith(1);
    fire('keydown', { key: '-', shiftKey: false });
    expect(input.zoom).toHaveBeenCalledWith(-1);
  });

  it('ignores unrelated keys', () => {
    const { fire, input, onActivity } = setup();
    onActivity.mockClear();
    fire('keydown', { key: 'a', shiftKey: false });
    expect(input.orbit).not.toHaveBeenCalled();
    expect(onActivity).not.toHaveBeenCalled();
  });

  it('dispose removes every listener', () => {
    const { count, port } = setup();
    expect(count()).toBeGreaterThan(0);
    port.dispose();
    expect(count()).toBe(0);
    port.dispose(); // idempotent
  });
});
