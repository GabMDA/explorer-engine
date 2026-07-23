// Render State applicator (chapter 19 §19.4, roadmap Sprint 2) — the Three.js side
// of the RenderStatePort. The headless resolver composes the EFFECTIVE visual state
// per node identity; this adapter resolves each identity to its Object3D(s) via the
// node index and applies the state RELATIVE to the CANONICAL REST POSE it captures
// the first time it touches a node (renderer-three owns the initial visual reference).
//
// It NEVER stores per-source originals: the resolver always pushes the full effective
// state, so returning to the rest defaults restores the rest pose exactly (L6, L7).
// This is the ONLY place materials/transforms are mutated (L5). Three.js is confined
// here (L9).
import * as THREE from 'three';
import type {
  NodeStateUpdate,
  RenderStatePort,
  EffectiveVisualState,
  ClipPlane,
} from '@explorer-engine/core';
import type { SceneManager } from './scene-manager';
import type { ThreeRendererHandle } from './internal/handles';

interface MaterialRest {
  readonly material: THREE.Material;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly hasEmissive: boolean;
  readonly emissive: number;
  readonly emissiveIntensity: number;
  /** Rest clipping planes (usually null) — restored when cutaway is removed. */
  readonly clippingPlanes: THREE.Plane[] | null;
}

interface RestPose {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly scale: THREE.Vector3;
  readonly visible: boolean;
  readonly materials: readonly MaterialRest[];
}

export interface RenderStateApplicatorOptions {
  /** Scene manager whose current node index resolves identity → Object3D. */
  readonly scene: SceneManager;
  /**
   * Renderer whose local clipping is enabled the first time a cutaway clip is
   * applied. Omit ⇒ clip planes are still set on materials but stay inert
   * (explicit fallback for renderers without clipping — chapter 09 §9.2.1).
   */
  readonly renderer?: ThreeRendererHandle;
}

// Reused scratch objects — applyNodeStates runs on change (not per frame), but we
// still avoid per-call allocation (L19).
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

function materialsOf(object: THREE.Object3D): THREE.Material[] {
  const out: THREE.Material[] = [];
  object.traverse((node) => {
    const mesh = node as Partial<THREE.Mesh>;
    const material = mesh.material;
    if (Array.isArray(material)) out.push(...material);
    else if (material) out.push(material);
  });
  return out;
}

function captureRest(object: THREE.Object3D): RestPose {
  const materials = materialsOf(object).map((material): MaterialRest => {
    const emissive = (material as Partial<THREE.MeshStandardMaterial>).emissive;
    const hasEmissive = emissive instanceof THREE.Color;
    return {
      material,
      opacity: material.opacity,
      transparent: material.transparent,
      hasEmissive,
      emissive: hasEmissive ? emissive.getHex() : 0,
      emissiveIntensity: (material as Partial<THREE.MeshStandardMaterial>).emissiveIntensity ?? 1,
      clippingPlanes: material.clippingPlanes ?? null,
    };
  });
  return {
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    scale: object.scale.clone(),
    visible: object.visible,
    materials,
  };
}

/**
 * Convert data-only clip planes to Three.js planes. A plane keeps the half-space
 * where `normal·x ≥ offset`; Three clips where `normal·x + constant < 0`, so the
 * constant is `-offset` (normals are normalised).
 */
function toThreePlanes(planes: readonly ClipPlane[]): THREE.Plane[] {
  return planes.map((p) => {
    const n = new THREE.Vector3(p.normal[0], p.normal[1], p.normal[2]).normalize();
    return new THREE.Plane(n, -p.offset);
  });
}

/** Resolve the emissive tint (colorOverride wins; outline is a fallback highlight). */
function emissiveOf(state: EffectiveVisualState): { color: string; intensity: number } | null {
  if (state.colorOverride) return state.colorOverride;
  if (state.outline) {
    // The reference adapter renders an outline as an emissive rim highlight; a true
    // post-process outline is a later enhancement (kept additive).
    return { color: state.outline.color, intensity: Math.min(1, 0.5 * state.outline.thickness) };
  }
  return null;
}

function applyToObject(object: THREE.Object3D, rest: RestPose, state: EffectiveVisualState): void {
  // Transform: rest ⊕ absolute offset (L7). null ⇒ exact rest pose.
  if (state.transform === null) {
    object.position.copy(rest.position);
    object.quaternion.copy(rest.quaternion);
    object.scale.copy(rest.scale);
  } else {
    const t = state.transform;
    object.position.set(
      rest.position.x + (t.translate?.[0] ?? 0),
      rest.position.y + (t.translate?.[1] ?? 0),
      rest.position.z + (t.translate?.[2] ?? 0),
    );
    if (t.rotate) {
      _euler.set(t.rotate[0], t.rotate[1], t.rotate[2]);
      _quat.setFromEuler(_euler);
      object.quaternion.copy(rest.quaternion).multiply(_quat);
    } else {
      object.quaternion.copy(rest.quaternion);
    }
    const s = t.scale;
    const sx = typeof s === 'number' ? s : (s?.[0] ?? 1);
    const sy = typeof s === 'number' ? s : (s?.[1] ?? 1);
    const sz = typeof s === 'number' ? s : (s?.[2] ?? 1);
    object.scale.set(rest.scale.x * sx, rest.scale.y * sy, rest.scale.z * sz);
  }

  // Visibility.
  object.visible = state.visibility === 'hidden' ? false : rest.visible;

  // Opacity + emissive tint, per material, always relative to rest.
  const tint = emissiveOf(state);
  for (const rec of rest.materials) {
    const material = rec.material;
    if (state.opacity < 1) {
      material.transparent = true;
      material.opacity = state.opacity;
    } else {
      material.transparent = rec.transparent;
      material.opacity = rec.opacity;
    }
    if (rec.hasEmissive) {
      const std = material as THREE.MeshStandardMaterial;
      if (tint) {
        std.emissive.set(tint.color);
        std.emissiveIntensity = tint.intensity;
      } else {
        std.emissive.setHex(rec.emissive);
        std.emissiveIntensity = rec.emissiveIntensity;
      }
    }
    // Cutaway: set clipping planes from the effective clip, or restore the rest.
    material.clippingPlanes =
      state.clip.length > 0 ? toThreePlanes(state.clip) : rec.clippingPlanes;
  }
}

export interface RenderStateApplicator extends RenderStatePort {
  dispose(): void;
}

export function createRenderStateApplicator(
  options: RenderStateApplicatorOptions,
): RenderStateApplicator {
  const { scene, renderer } = options;
  const restPoses = new WeakMap<THREE.Object3D, RestPose>();
  let localClippingEnabled = false;

  return {
    applyNodeStates(updates: readonly NodeStateUpdate[]): void {
      const index = scene.getNodeIndex();
      if (!index) return;
      for (const { identity, state } of updates) {
        // Enable local clipping once, lazily, the first time a cutaway appears.
        if (state.clip.length > 0 && !localClippingEnabled && renderer) {
          renderer.getThreeRenderer().localClippingEnabled = true;
          localClippingEnabled = true;
        }
        for (const object of index.resolve(identity)) {
          let rest = restPoses.get(object);
          if (!rest) {
            rest = captureRest(object); // object is still at rest on first touch (L5)
            restPoses.set(object, rest);
          }
          applyToObject(object, rest, state);
        }
      }
    },
    dispose() {
      // Rest poses live in a WeakMap keyed by Object3D — released with the scene.
    },
  };
}
