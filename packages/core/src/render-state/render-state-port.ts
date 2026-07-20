// RenderStatePort — the contract through which the headless Render State Resolver
// applies composed visual state to real nodes (chapter 19 §19.4, ADR-002). The
// core computes the EFFECTIVE state per node identity; a renderer adapter resolves
// each identity to its Object3D(s) and applies the state RELATIVE to the rest pose
// it owns (renderer-three stays the owner of the initial visual reference). The
// core never sees a Three.js object (L8/L9).
import type { EffectiveVisualState } from './channels';

/** One node's effective visual state, addressed by identity (explorerId/name). */
export interface NodeStateUpdate {
  readonly identity: string;
  readonly state: EffectiveVisualState;
}

export interface RenderStatePort {
  /**
   * Apply effective visual states to the given node identities. Called only for
   * nodes whose composed state CHANGED since the last flush (dirty propagation).
   * A state equal to the rest defaults returns the node to its rest pose — the
   * adapter never stores per-source originals (reversibility by recomposition, L6).
   */
  applyNodeStates(updates: readonly NodeStateUpdate[]): void;
}
