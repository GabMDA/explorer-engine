// Easing functions (chapter 11 §11.4) — a CLOSED, validated set mapped by name.
// Pure `(t: number) => number` over the normalized progress t ∈ [0,1]; f(0)=0,
// f(1)=1 for the monotone ones. Headless and deterministic (no time, no DOM).
import type { EaseName } from '@explorer-engine/schema';

const c1 = 1.70158; // back overshoot
const c3 = c1 + 1;

const pow = Math.pow;

/** name → easing function. Every {@link EaseName} has an entry. */
export const EASINGS: Record<EaseName, (t: number) => number> = {
  linear: (t) => t,
  // Quadratic aliases used as the generic ease names in config/docs.
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2),
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - pow(-2 * t + 2, 2) / 2),
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2),
  easeInBack: (t) => c3 * t * t * t - c1 * t * t,
  easeOutBack: (t) => 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2),
  easeOutElastic: (t) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/** Resolve an easing function by name; unknown names fall back to `linear`. */
export function resolveEasing(name: EaseName): (t: number) => number {
  return EASINGS[name] ?? EASINGS.linear;
}
