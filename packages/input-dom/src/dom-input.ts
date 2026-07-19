// DOM input adapter (InputPort). The ONLY place that touches DOM events for
// controls (ENGINE_CONSTITUTION: DOM confined to this adapter). It translates
// pointer / wheel / keyboard events on a target element into normalized
// ControlInput gestures. No Three.js here; depends on core only for the types.
import type { ControlInput, InputPort } from '@explorer-engine/core';

export interface DomInputOptions {
  /** Element that receives pointer/wheel/keyboard events (e.g. the canvas). */
  readonly element: HTMLElement;
  /** The control scheme the gestures are forwarded to. */
  readonly input: ControlInput;
  /** Called on any input activity, so the host can wake its render loop. */
  readonly onActivity?: () => void;
  /** Pixel-equivalent orbit step per keyboard arrow press. Default 24. */
  readonly keyOrbitStep?: number;
  /** Pan step (pixels) per Shift+arrow press. Default 24. */
  readonly keyPanStep?: number;
  /** Zoom units per keyboard +/- press. Default 1. */
  readonly keyZoomStep?: number;
  /** Zoom units per wheel pixel. Default 0.01. */
  readonly wheelZoomScale?: number;
}

interface PointerState {
  x: number;
  y: number;
}

const ZOOM_KEYS_IN = new Set(['+', '=']);
const ZOOM_KEYS_OUT = new Set(['-', '_']);

export function createDomInput(options: DomInputOptions): InputPort {
  const { element, input } = options;
  const onActivity = options.onActivity ?? (() => {});
  const keyOrbitStep = options.keyOrbitStep ?? 24;
  const keyPanStep = options.keyPanStep ?? 24;
  const keyZoomStep = options.keyZoomStep ?? 1;
  const wheelZoomScale = options.wheelZoomScale ?? 0.01;

  const pointers = new Map<number, PointerState>();
  let pinchDistance = 0;
  let pinchMidX = 0;
  let pinchMidY = 0;
  let disposed = false;

  const twoPointerGeometry = () => {
    const points = [...pointers.values()];
    const a = points[0];
    const b = points[1];
    if (a === undefined || b === undefined) return { distance: 0, midX: 0, midY: 0 };
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
    };
  };

  const onPointerDown = (event: PointerEvent) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    element.setPointerCapture?.(event.pointerId);
    if (pointers.size === 2) {
      const g = twoPointerGeometry();
      pinchDistance = g.distance;
      pinchMidX = g.midX;
      pinchMidY = g.midY;
    }
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    const prev = pointers.get(event.pointerId);
    if (prev === undefined) return;
    const dx = event.clientX - prev.x;
    const dy = event.clientY - prev.y;
    prev.x = event.clientX;
    prev.y = event.clientY;

    if (pointers.size >= 2) {
      const g = twoPointerGeometry();
      if (pinchDistance > 0) input.zoom((g.distance - pinchDistance) * 0.01);
      input.pan(g.midX - pinchMidX, g.midY - pinchMidY);
      pinchDistance = g.distance;
      pinchMidX = g.midX;
      pinchMidY = g.midY;
    } else if (event.shiftKey || (event.buttons & 2) !== 0) {
      input.pan(dx, dy);
    } else {
      input.orbit(dx, dy);
    }
    onActivity();
  };

  const endPointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    element.releasePointerCapture?.(event.pointerId);
    if (pointers.size < 2) pinchDistance = 0;
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    input.zoom(-event.deltaY * wheelZoomScale);
    onActivity();
  };

  const onContextMenu = (event: Event) => event.preventDefault();

  const onKeyDown = (event: KeyboardEvent) => {
    let handled = true;
    const pan = event.shiftKey;
    switch (event.key) {
      case 'ArrowLeft':
        if (pan) input.pan(keyPanStep, 0);
        else input.orbit(-keyOrbitStep, 0);
        break;
      case 'ArrowRight':
        if (pan) input.pan(-keyPanStep, 0);
        else input.orbit(keyOrbitStep, 0);
        break;
      case 'ArrowUp':
        if (pan) input.pan(0, keyPanStep);
        else input.orbit(0, -keyOrbitStep);
        break;
      case 'ArrowDown':
        if (pan) input.pan(0, -keyPanStep);
        else input.orbit(0, keyOrbitStep);
        break;
      default:
        if (ZOOM_KEYS_IN.has(event.key)) input.zoom(keyZoomStep);
        else if (ZOOM_KEYS_OUT.has(event.key)) input.zoom(-keyZoomStep);
        else handled = false;
    }
    if (handled) {
      event.preventDefault();
      onActivity();
    }
  };

  // Make the element focusable so it can receive keyboard events, and stop the
  // browser's own touch gestures from interfering with pointer handling.
  if (element.tabIndex < 0) element.tabIndex = 0;
  element.style.touchAction = 'none';

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', endPointer);
  element.addEventListener('pointercancel', endPointer);
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('contextmenu', onContextMenu);
  element.addEventListener('keydown', onKeyDown);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', endPointer);
      element.removeEventListener('pointercancel', endPointer);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('contextmenu', onContextMenu);
      element.removeEventListener('keydown', onKeyDown);
      pointers.clear();
    },
  };
}
