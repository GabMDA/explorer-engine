// Hotspot projector (chapter 07 §7.3–7.4, roadmap P4-T2/P4-T3) — the Three.js side
// of the core ProjectionPort. It turns resolved anchors into screen coordinates and
// an occlusion verdict. Occlusion is a THROTTLED CPU raycast against the scene — no
// synchronous GPU→CPU readback whatsoever (L21 / chapter 07 §7.4.1). Self-hits (the
// anchor's own geometry, since a component centre sits inside its mesh) are ignored
// so a hotspot never occludes itself. All Three.js stays confined here (L9).
import * as THREE from 'three';
import type {
  AnchorSpec,
  ProjectionPort,
  ProjectionResult,
  RendererPort,
} from '@explorer-engine/core';
import type { SceneManager } from './scene-manager';
import type { CameraManager } from './camera-manager';

export interface HotspotProjectorOptions {
  readonly scene: SceneManager;
  readonly camera: CameraManager;
  /** Provides the viewport size in CSS pixels. */
  readonly renderer: RendererPort;
  /** Minimum interval between occlusion recomputes (ms). Default 150 (~6–7 Hz). */
  readonly occlusionIntervalMs?: number;
  /** Monotonic clock for throttling. Defaults to performance.now / Date.now. */
  readonly now?: () => number;
}

const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const _anchor = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _dir = new THREE.Vector3();

/** Collect the objects (with descendants) an anchor's identities resolve to. */
function anchorObjects(scene: SceneManager, spec: AnchorSpec): Set<THREE.Object3D> {
  const set = new Set<THREE.Object3D>();
  const index = scene.getNodeIndex();
  if (!index) return set;
  for (const identity of spec.identities) {
    for (const object of index.resolve(identity)) {
      object.traverse((node) => set.add(node));
    }
  }
  return set;
}

/** Anchor world point: centre of resolved nodes (or fixed position) + offset. */
function anchorPoint(scene: SceneManager, spec: AnchorSpec, out: THREE.Vector3): boolean {
  if (spec.position !== null) {
    out.set(spec.position[0], spec.position[1], spec.position[2]);
  } else {
    const index = scene.getNodeIndex();
    if (!index) return false;
    _box.makeEmpty();
    let any = false;
    for (const identity of spec.identities) {
      for (const object of index.resolve(identity)) {
        _box.expandByObject(object);
        any = true;
      }
    }
    if (!any || _box.isEmpty()) return false;
    _box.getCenter(out);
  }
  if (spec.offset) out.add(_dir.set(spec.offset[0], spec.offset[1], spec.offset[2]));
  return true;
}

export function createHotspotProjector(options: HotspotProjectorOptions): ProjectionPort {
  const { scene, camera, renderer } = options;
  const intervalMs = options.occlusionIntervalMs ?? 150;
  const now = options.now ?? (() => globalThis.performance?.now?.() ?? Date.now());
  const raycaster = new THREE.Raycaster();
  const lastOccluded = new Map<string, boolean>();
  let lastOcclusionAt = -Infinity;

  return {
    project(anchors: readonly AnchorSpec[]): readonly ProjectionResult[] {
      const cam = camera.getThreeCamera();
      // Ensure world matrices are current independent of render ordering (cached
      // when nothing moved — no cost on a stable scene).
      cam.updateMatrixWorld();
      scene.getThreeScene().updateMatrixWorld();
      const size = renderer.getSize();
      const width = size.width || 1;
      const height = size.height || 1;
      cam.getWorldPosition(_camPos);

      // Occlusion is throttled: recompute at most every intervalMs; otherwise reuse.
      const t = now();
      const doOcclusion = t - lastOcclusionAt >= intervalMs;
      if (doOcclusion) lastOcclusionAt = t;

      const results: ProjectionResult[] = [];
      const sceneChildren = scene.getThreeScene().children;

      for (const spec of anchors) {
        if (!anchorPoint(scene, spec, _anchor)) {
          results.push({
            id: spec.id,
            x: 0,
            y: 0,
            depth: Infinity,
            onScreen: false,
            occluded: false,
          });
          continue;
        }
        const depth = _camPos.distanceTo(_anchor);
        _center.copy(_anchor).project(cam);
        const onScreen =
          _center.z > -1 &&
          _center.z < 1 &&
          _center.x >= -1 &&
          _center.x <= 1 &&
          _center.y >= -1 &&
          _center.y <= 1;
        const x = (_center.x * 0.5 + 0.5) * width;
        const y = (-_center.y * 0.5 + 0.5) * height;

        let occluded = lastOccluded.get(spec.id) ?? false;
        if (spec.occludable && onScreen && doOcclusion) {
          occluded = computeOcclusion(
            raycaster,
            sceneChildren,
            scene,
            spec,
            _camPos,
            _anchor,
            depth,
          );
          lastOccluded.set(spec.id, occluded);
        } else if (!spec.occludable) {
          occluded = false;
        }

        results.push({ id: spec.id, x, y, depth, onScreen, occluded });
      }
      return results;
    },
  };
}

/** True when non-self geometry lies between the camera and the anchor point. */
function computeOcclusion(
  raycaster: THREE.Raycaster,
  sceneChildren: readonly THREE.Object3D[],
  scene: SceneManager,
  spec: AnchorSpec,
  camPos: THREE.Vector3,
  anchor: THREE.Vector3,
  depth: number,
): boolean {
  _dir.copy(anchor).sub(camPos).normalize();
  raycaster.set(camPos, _dir);
  raycaster.far = depth; // never look past the anchor itself
  const own = anchorObjects(scene, spec);
  const hits = raycaster.intersectObjects(sceneChildren as THREE.Object3D[], true);
  const epsilon = Math.max(1e-3, depth * 1e-3);
  for (const hit of hits) {
    if (hit.distance >= depth - epsilon) break; // reached the anchor; nothing in front
    if (own.has(hit.object)) continue; // ignore the anchor's own surface (self-hit)
    if (!hit.object.visible) continue;
    return true; // a different object sits in front → occluded
  }
  return false;
}
