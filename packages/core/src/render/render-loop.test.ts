import { describe, it, expect, vi } from 'vitest';
import { createRenderLoop } from './render-loop';
import type { FrameScheduler } from './frame-scheduler';

/** A deterministic FrameScheduler: frames run only when the test flushes them. */
function manualScheduler() {
  let nextId = 1;
  const pending = new Map<number, () => void>();
  const scheduler: FrameScheduler = {
    request(cb) {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancel(id) {
      pending.delete(id);
    },
  };
  return {
    scheduler,
    pendingCount: () => pending.size,
    /** Run every currently-scheduled frame once (in scheduling order). */
    flush() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const cb of callbacks) cb();
    },
  };
}

describe('createRenderLoop', () => {
  it('an invalidation schedules exactly one frame', () => {
    const sched = manualScheduler();
    const render = vi.fn();
    const loop = createRenderLoop({ render, scheduler: sched.scheduler });

    loop.requestRender();
    expect(sched.pendingCount()).toBe(1);
    expect(loop.hasPendingFrame).toBe(true);
    expect(render).not.toHaveBeenCalled(); // not until the frame runs
  });

  it('several invalidations before the frame schedule only one frame (coalesce)', () => {
    const sched = manualScheduler();
    const render = vi.fn();
    const loop = createRenderLoop({ render, scheduler: sched.scheduler });

    loop.requestRender();
    loop.requestRender();
    loop.requestRender();
    expect(sched.pendingCount()).toBe(1);

    sched.flush();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('the frame calls render and then the loop goes idle', () => {
    const sched = manualScheduler();
    const render = vi.fn();
    const loop = createRenderLoop({ render, scheduler: sched.scheduler });

    loop.requestRender();
    sched.flush();
    expect(render).toHaveBeenCalledTimes(1);
    expect(loop.hasPendingFrame).toBe(false);
    expect(sched.pendingCount()).toBe(0);
  });

  it('an invalidation during render schedules the next frame (never lost)', () => {
    const sched = manualScheduler();
    let invalidateOnce = true;
    const loop = createRenderLoop({
      render: () => {
        if (invalidateOnce) {
          invalidateOnce = false;
          loop.requestRender(); // re-invalidate mid-render (e.g. damping still moving)
        }
      },
      scheduler: sched.scheduler,
    });

    loop.requestRender();
    sched.flush(); // first frame renders and re-invalidates
    expect(loop.hasPendingFrame).toBe(true); // a follow-up frame is queued
    expect(sched.pendingCount()).toBe(1);

    sched.flush(); // second frame renders, no more invalidation
    expect(loop.hasPendingFrame).toBe(false); // loop settles to idle
  });

  it('never renders while idle (no invalidation → no frame)', () => {
    const sched = manualScheduler();
    const render = vi.fn();
    createRenderLoop({ render, scheduler: sched.scheduler });

    expect(sched.pendingCount()).toBe(0);
    sched.flush();
    expect(render).not.toHaveBeenCalled();
  });

  it('dispose cancels a pending frame', () => {
    const sched = manualScheduler();
    const render = vi.fn();
    const loop = createRenderLoop({ render, scheduler: sched.scheduler });

    loop.requestRender();
    expect(sched.pendingCount()).toBe(1);

    loop.dispose();
    expect(sched.pendingCount()).toBe(0); // pending frame cancelled
    expect(loop.isDisposed).toBe(true);
    sched.flush();
    expect(render).not.toHaveBeenCalled();
  });

  it('no frame can be scheduled after dispose; dispose is idempotent', () => {
    const sched = manualScheduler();
    const render = vi.fn();
    const loop = createRenderLoop({ render, scheduler: sched.scheduler });

    loop.dispose();
    loop.requestRender();
    expect(sched.pendingCount()).toBe(0);
    expect(loop.hasPendingFrame).toBe(false);

    expect(() => loop.dispose()).not.toThrow();
    expect(render).not.toHaveBeenCalled();
  });
});
