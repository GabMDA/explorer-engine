// ScenePort — a backend-agnostic handle to a renderable scene. The headless core
// references this contract without knowing about Three.js, WebGL or the DOM
// (ENGINE_CONSTITUTION L8/L9). A renderer adapter (e.g. renderer-three) provides
// the concrete implementation and knows how to draw it.

/** Axis-aligned bounding box, as plain number tuples (no backend types). */
export interface BoundingBox {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface ScenePort {
  /** Axis-aligned bounding box of the scene content, or `null` when empty. */
  getBoundingBox(): BoundingBox | null;
  /** Release all GPU resources held by the scene. Idempotent. */
  dispose(): void;
}
