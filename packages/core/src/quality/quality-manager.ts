// Quality Manager (roadmap P9-T2 ; chapter 14 §14.2.2). Headless policy engine:
// it consumes a stream of measured frame times and decides a discrete quality
// tier, driving ONLY the renderer lever this phase's ports already expose
// (`RendererPort.setPixelRatio`, ch.14 §14.3). It contains no Three.js and no
// device detection (ENGINE_CONSTITUTION L1/L8/L9) — picking which
// `frameBudgetMs` applies (desktop vs mobile) is a host concern (chapter 05,
// chapter 14 §14.1.1); this manager only reacts to the numbers it is given.
import type { RendererPort } from '../ports/renderer-port';
import type { EventBus } from '../events/event-bus';
import type { EngineEventMap, QualityChangeReason } from '../types/events';
import { QUALITY_LEVELS } from '@explorer-engine/schema';
import type { QualityLeverConfig, QualityLevel } from '@explorer-engine/schema';

export type { QualityLevel, QualityLeverConfig };
/** Ordered low → high (chapter 14 §14.2.2 degrade/upgrade direction). */
export { QUALITY_LEVELS };

export interface QualityManagerOptions {
  /** Lever values applied at each tier (ch.14 §14.3). */
  readonly levels: Readonly<Record<QualityLevel, QualityLeverConfig>>;
  /** The renderer lever this phase drives — nothing else (ch.14 §14.3). */
  readonly renderer: Pick<RendererPort, 'setPixelRatio'>;
  /** Per-frame budget (ms) beyond which frames count as "over budget". */
  readonly frameBudgetMs: number;
  /** Starting tier. Defaults to `'high'`. */
  readonly initialLevel?: QualityLevel;
  /** Whether automatic degrade/upgrade is active. Defaults to `true`. */
  readonly adaptive?: boolean;
  /** Consecutive over-budget samples before dropping one tier. Defaults to 30. */
  readonly degradeAfterFrames?: number;
  /** Consecutive under-budget samples before raising one tier. Defaults to 120
   * (more conservative than degrading, to avoid oscillation — ch.14 §14.2.2). */
  readonly upgradeAfterFrames?: number;
  readonly events?: EventBus<EngineEventMap>;
}

export interface QualityManager {
  readonly level: QualityLevel;
  readonly adaptive: boolean;
  /**
   * Feed one frame's measured time (ms) into the adaptive policy. Zero
   * allocation (ENGINE_CONSTITUTION L19) — only plain counters are touched.
   * A no-op while `adaptive` is `false`.
   */
  sample(frameTimeMs: number): void;
  /** Force a specific tier. Disables `adaptive` until re-enabled — an explicit
   * choice is never silently overridden by the next sample. */
  setLevel(level: QualityLevel): void;
  setAdaptive(adaptive: boolean): void;
  /** Idempotent; releases nothing (this manager holds no subscriptions/timers)
   * but is provided for API consistency with every other manager's teardown. */
  dispose(): void;
}

export function createQualityManager(options: QualityManagerOptions): QualityManager {
  const { levels, renderer, frameBudgetMs, events } = options;
  const degradeAfterFrames = Math.max(1, options.degradeAfterFrames ?? 30);
  const upgradeAfterFrames = Math.max(1, options.upgradeAfterFrames ?? 120);

  let level: QualityLevel = options.initialLevel ?? 'high';
  let adaptive = options.adaptive ?? true;
  let overBudgetStreak = 0;
  let underBudgetStreak = 0;
  let disposed = false;

  const applyLevel = (next: QualityLevel, reason: QualityChangeReason): void => {
    level = next;
    renderer.setPixelRatio(levels[next].maxPixelRatio);
    events?.emit('quality:changed', { level: next, reason });
  };

  // Declarative sync at creation (ch.14 §14.9 — "mobile démarre avec des
  // réglages plus prudents"): the initial tier's lever is applied immediately,
  // without treating it as a "change".
  renderer.setPixelRatio(levels[level].maxPixelRatio);

  return {
    get level() {
      return level;
    },
    get adaptive() {
      return adaptive;
    },
    sample(frameTimeMs) {
      if (disposed || !adaptive) return;
      if (frameTimeMs > frameBudgetMs) {
        overBudgetStreak += 1;
        underBudgetStreak = 0;
        if (overBudgetStreak >= degradeAfterFrames) {
          overBudgetStreak = 0;
          const idx = QUALITY_LEVELS.indexOf(level);
          if (idx > 0) applyLevel(QUALITY_LEVELS[idx - 1] as QualityLevel, 'auto');
        }
      } else {
        underBudgetStreak += 1;
        overBudgetStreak = 0;
        if (underBudgetStreak >= upgradeAfterFrames) {
          underBudgetStreak = 0;
          const idx = QUALITY_LEVELS.indexOf(level);
          if (idx < QUALITY_LEVELS.length - 1)
            applyLevel(QUALITY_LEVELS[idx + 1] as QualityLevel, 'auto');
        }
      }
    },
    setLevel(next) {
      if (disposed) return;
      adaptive = false;
      overBudgetStreak = 0;
      underBudgetStreak = 0;
      applyLevel(next, 'manual');
    },
    setAdaptive(next) {
      if (disposed) return;
      adaptive = next;
      overBudgetStreak = 0;
      underBudgetStreak = 0;
    },
    dispose() {
      disposed = true;
    },
  };
}
