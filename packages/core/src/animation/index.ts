export { EASINGS, resolveEasing } from './easing';
export { lerp, lerpVec3, clamp01 } from './interpolate';
export { createTween, numberTween, vec3Tween } from './tween';
export type { Animation, TweenSpec } from './tween';
export { createTimeline, sequence, parallel } from './timeline';
export type { TimelineEntry } from './timeline';
export { createAnimationEngine } from './engine';
export type {
  AnimationEngine,
  AnimationEngineOptions,
  PlaybackHandle,
  PlaybackState,
  PlayOptions,
} from './engine';
