// Render State Resolver — channels & composition (chapter 19, ADR-001, L5–L7).
//
// A *channel* is an independent, composable visual dimension. The list is CLOSED
// in v1 (chapter 19 §19.3.2). The composition rule DEPENDS ON THE CHANNEL — this
// is what makes "X-ray + focus + hover" deterministic and order-independent:
//   transform      → additive (offsets from the canonical rest pose, L7)
//   opacity        → min (the most transparent contribution wins)
//   colorOverride  → priority (last-by-priority)
//   outline        → priority
//   visibility     → "hidden" wins (isolation)
//   cameraIntent   → exclusive, resolved by priority (global, not per-node)
//   lightingIntent → exclusive, resolved by priority (global, not per-node)
//
// Headless & data-only: no DOM/Three.js. Every value is a plain, serialisable
// object; the renderer adapter turns the effective state into concrete pixels.
import type { Vec3 } from '../ports/camera-port';

/** Per-node visual channels composed into an effective visual state. */
export type VisualChannel = 'transform' | 'opacity' | 'colorOverride' | 'outline' | 'visibility';

/** Global, exclusive intent channels (one winner, resolved by priority). */
export type IntentChannel = 'cameraIntent' | 'lightingIntent';

/** The closed set of channels a layer may contribute to (chapter 19 §19.3.2). */
export type Channel = VisualChannel | IntentChannel;

/** A transform OFFSET from the rest pose (L7 — never relative to current state). */
export interface TransformValue {
  /** Additive translation offset (model units). */
  readonly translate?: Vec3;
  /** Additive rotation offset as XYZ Euler radians. */
  readonly rotate?: Vec3;
  /** Multiplicative scale offset (1 = identity), scalar or per-axis. */
  readonly scale?: number | Vec3;
}

/** An emissive-style colour override (chapter 19 §19.3.2). */
export interface ColorOverrideValue {
  /** CSS colour string (e.g. "#3ba7ff"). */
  readonly color: string;
  /** Strength in [0,1] (0 = none). */
  readonly intensity: number;
}

/** An outline/highlight request. */
export interface OutlineValue {
  readonly color: string;
  /** Relative thickness/strength hint for the adapter (≥ 0). */
  readonly thickness: number;
}

export type VisibilityValue = 'visible' | 'hidden';

/** A camera pose intent (chapter 19 §19.5). Exclusive by priority. */
export interface CameraIntentValue {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly fov?: number;
}

/** A lighting ambience intent. Exclusive by priority. */
export interface LightingIntentValue {
  /** Preset id understood by the lighting adapter. */
  readonly preset: string;
}

/** Maps each channel to its value type (compile-time checked contributions). */
export interface ChannelValueMap {
  transform: TransformValue;
  opacity: number;
  colorOverride: ColorOverrideValue;
  outline: OutlineValue;
  visibility: VisibilityValue;
  cameraIntent: CameraIntentValue;
  lightingIntent: LightingIntentValue;
}

/**
 * The composed, effective visual state of a single node. `transform: null` means
 * "rest pose" (identity offset); `opacity: 1`, `visibility: 'visible'` and null
 * overrides are the canonical rest defaults — pushing this to the adapter returns
 * the node exactly to its rest pose (reversibility by construction, L6).
 */
export interface EffectiveVisualState {
  readonly transform: TransformValue | null;
  readonly opacity: number;
  readonly colorOverride: ColorOverrideValue | null;
  readonly outline: OutlineValue | null;
  readonly visibility: VisibilityValue;
}

/** The rest-pose default effective state (no contributions). Frozen & shared. */
export const REST_VISUAL_STATE: EffectiveVisualState = Object.freeze({
  transform: null,
  opacity: 1,
  colorOverride: null,
  outline: null,
  visibility: 'visible' as const,
});

const VISUAL_CHANNELS: readonly VisualChannel[] = [
  'transform',
  'opacity',
  'colorOverride',
  'outline',
  'visibility',
];

const INTENT_CHANNELS: readonly IntentChannel[] = ['cameraIntent', 'lightingIntent'];

export const isVisualChannel = (c: Channel): c is VisualChannel =>
  (VISUAL_CHANNELS as readonly string[]).includes(c);

export const isIntentChannel = (c: Channel): c is IntentChannel =>
  (INTENT_CHANNELS as readonly string[]).includes(c);

/** One contribution to a single visual channel of a single node (post-expansion). */
export interface VisualContribution {
  readonly channel: VisualChannel;
  readonly value: ChannelValueMap[VisualChannel];
  readonly priority: number;
  /** Monotonic insertion order — breaks ties deterministically (last wins). */
  readonly seq: number;
}

function addScale(acc: [number, number, number], s: number | Vec3): void {
  if (typeof s === 'number') {
    acc[0] *= s;
    acc[1] *= s;
    acc[2] *= s;
  } else {
    acc[0] *= s[0];
    acc[1] *= s[1];
    acc[2] *= s[2];
  }
}

function composeTransform(contribs: readonly VisualContribution[]): TransformValue | null {
  let any = false;
  const translate: [number, number, number] = [0, 0, 0];
  const rotate: [number, number, number] = [0, 0, 0];
  const scale: [number, number, number] = [1, 1, 1];
  for (const c of contribs) {
    if (c.channel !== 'transform') continue;
    const t = c.value as TransformValue;
    any = true;
    if (t.translate) {
      translate[0] += t.translate[0];
      translate[1] += t.translate[1];
      translate[2] += t.translate[2];
    }
    if (t.rotate) {
      rotate[0] += t.rotate[0];
      rotate[1] += t.rotate[1];
      rotate[2] += t.rotate[2];
    }
    if (t.scale !== undefined) addScale(scale, t.scale);
  }
  if (!any) return null;
  return { translate, rotate, scale };
}

/** Higher priority wins; equal priority → later insertion (seq) wins. */
function winner<T extends VisualContribution>(a: T, b: T): T {
  if (b.priority > a.priority) return b;
  if (b.priority === a.priority && b.seq > a.seq) return b;
  return a;
}

/**
 * Compose a node's contributions into an effective visual state, applying the
 * per-channel rule. Deterministic and INDEPENDENT of contribution order (ties
 * broken by explicit priority then insertion seq). Pure — allocates only the
 * result (safe to call for dirty nodes only; chapter 19 §19.4).
 */
export function composeVisualState(contribs: readonly VisualContribution[]): EffectiveVisualState {
  if (contribs.length === 0) return REST_VISUAL_STATE;

  let opacity = 1;
  let visibility: VisibilityValue = 'visible';
  let colorWinner: VisualContribution | null = null;
  let outlineWinner: VisualContribution | null = null;

  for (const c of contribs) {
    switch (c.channel) {
      case 'opacity':
        opacity = Math.min(opacity, c.value as number);
        break;
      case 'visibility':
        if ((c.value as VisibilityValue) === 'hidden') visibility = 'hidden';
        break;
      case 'colorOverride':
        colorWinner = colorWinner ? winner(colorWinner, c) : c;
        break;
      case 'outline':
        outlineWinner = outlineWinner ? winner(outlineWinner, c) : c;
        break;
      case 'transform':
        break; // handled by composeTransform
    }
  }

  return {
    transform: composeTransform(contribs),
    opacity,
    colorOverride: colorWinner ? (colorWinner.value as ColorOverrideValue) : null,
    outline: outlineWinner ? (outlineWinner.value as OutlineValue) : null,
    visibility,
  };
}

/** True when two effective visual states are visually identical (skip re-apply). */
export function visualStateEquals(a: EffectiveVisualState, b: EffectiveVisualState): boolean {
  return (
    a.opacity === b.opacity &&
    a.visibility === b.visibility &&
    transformEquals(a.transform, b.transform) &&
    colorEquals(a.colorOverride, b.colorOverride) &&
    outlineEquals(a.outline, b.outline)
  );
}

function vecEquals(a: Vec3 | undefined, b: Vec3 | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function transformEquals(a: TransformValue | null, b: TransformValue | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const scaleA = typeof a.scale === 'number' ? ([a.scale, a.scale, a.scale] as Vec3) : a.scale;
  const scaleB = typeof b.scale === 'number' ? ([b.scale, b.scale, b.scale] as Vec3) : b.scale;
  return (
    vecEquals(a.translate, b.translate) &&
    vecEquals(a.rotate, b.rotate) &&
    vecEquals(scaleA, scaleB)
  );
}

function colorEquals(a: ColorOverrideValue | null, b: ColorOverrideValue | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.color === b.color && a.intensity === b.intensity;
}

function outlineEquals(a: OutlineValue | null, b: OutlineValue | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.color === b.color && a.thickness === b.thickness;
}
