// Timeline (chapter 11 §11.3) — composes atomic animations on a shared local time
// axis, supporting SEQUENCES, PARALLELISM and OFFSETS. Pure and deterministic like
// any Animation: `seek(localMs)` maps to each child's local time. A child is only
// applied once it has started (so a later sequenced child never overwrites an
// earlier one before its turn); a finished child holds at its final value. The
// core composes ATOMIC animations only — scenario DSLs live in plugins (C12).
import type { Animation } from './tween';

/** One placed child on the timeline: `animation` starts at offset `at` (ms). */
export interface TimelineEntry {
  readonly at: number;
  readonly animation: Animation;
}

/**
 * Build a timeline from placed children. Its duration is the furthest child end.
 * When children overlap on the same target, later ARRAY entries win (deterministic).
 */
export function createTimeline(entries: readonly TimelineEntry[]): Animation {
  const placed = entries.map((e) => ({ at: Math.max(0, e.at), animation: e.animation }));
  const duration = placed.reduce((max, e) => Math.max(max, e.at + e.animation.duration), 0);
  return {
    duration,
    seek(localMs: number): void {
      for (const entry of placed) {
        const local = localMs - entry.at;
        if (local < 0) continue; // not started yet — do not apply
        entry.animation.seek(Math.min(local, entry.animation.duration));
      }
    },
  };
}

/** Convenience: place animations back-to-back (each starts when the previous ends). */
export function sequence(animations: readonly Animation[]): Animation {
  let cursor = 0;
  const entries: TimelineEntry[] = animations.map((animation) => {
    const at = cursor;
    cursor += animation.duration;
    return { at, animation };
  });
  return createTimeline(entries);
}

/** Convenience: play all animations together from t=0. */
export function parallel(animations: readonly Animation[]): Animation {
  return createTimeline(animations.map((animation) => ({ at: 0, animation })));
}
