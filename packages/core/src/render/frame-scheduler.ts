// Frame scheduler contract (chapter 02 §"requestRender()" / chapter 14 §14.10.1).
// Backend-agnostic and DOM-free: the headless render loop schedules its frames
// through this port instead of calling requestAnimationFrame directly, so the
// core never touches the DOM (ENGINE_CONSTITUTION L8/L9). A host adapter (the
// playground) supplies a requestAnimationFrame-based scheduler; tests supply a
// deterministic one.

/** Opaque handle identifying a scheduled frame (e.g. a requestAnimationFrame id). */
export type FrameRequestToken = number;

/** Schedules and cancels single frame callbacks. */
export interface FrameScheduler {
  /**
   * Schedule `callback` to run once before the next repaint. Returns a token that
   * can be passed to {@link cancel}. Any argument the backend passes to the
   * callback (e.g. a timestamp) is ignored by the render loop.
   */
  request(callback: () => void): FrameRequestToken;
  /** Cancel a frame previously scheduled via {@link request}. */
  cancel(token: FrameRequestToken): void;
}
