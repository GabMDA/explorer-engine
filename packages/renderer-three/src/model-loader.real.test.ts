import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { EventBus } from '@explorer-engine/core';
import type { ResourceManager, EngineEventMap, OrbitControls } from '@explorer-engine/core';
import type { SceneManager } from './scene-manager';
import type { CameraManager } from './camera-manager';
import { createModelLoader } from './model-loader';

// Byte-identical content of apps/playground/public/models/cube.glb — a
// self-contained, uncompressed unit-cube GLB (see that folder's README for
// provenance). Inlined so the real GLTFLoader.parse path runs without a
// filesystem dependency.
const CUBE_GLB_BASE64 =
  'Z2xURgIAAAAYBgAAdAMAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAiLCJnZW5lcmF0b3IiOiJleHBsb3Jlci1lbmdpbmUgUDItVDIgZml4dHVyZSBnZW5lcmF0b3IifSwic2NlbmUiOjAsInNjZW5lcyI6W3sibm9kZXMiOlswXX1dLCJub2RlcyI6W3sibWVzaCI6MCwibmFtZSI6IkN1YmUifV0sIm1lc2hlcyI6W3sibmFtZSI6IkN1YmUiLCJwcmltaXRpdmVzIjpbeyJhdHRyaWJ1dGVzIjp7IlBPU0lUSU9OIjowLCJOT1JNQUwiOjF9LCJpbmRpY2VzIjoyLCJtYXRlcmlhbCI6MCwibW9kZSI6NH1dfV0sIm1hdGVyaWFscyI6W3sibmFtZSI6IkN1YmVNYXQiLCJwYnJNZXRhbGxpY1JvdWdobmVzcyI6eyJiYXNlQ29sb3JGYWN0b3IiOlswLjIzLDAuNjUsMSwxXSwibWV0YWxsaWNGYWN0b3IiOjAuMSwicm91Z2huZXNzRmFjdG9yIjowLjV9fV0sImFjY2Vzc29ycyI6W3siYnVmZmVyVmlldyI6MCwiY29tcG9uZW50VHlwZSI6NTEyNiwiY291bnQiOjI0LCJ0eXBlIjoiVkVDMyIsIm1pbiI6Wy0wLjUsLTAuNSwtMC41XSwibWF4IjpbMC41LDAuNSwwLjVdfSx7ImJ1ZmZlclZpZXciOjEsImNvbXBvbmVudFR5cGUiOjUxMjYsImNvdW50IjoyNCwidHlwZSI6IlZFQzMifSx7ImJ1ZmZlclZpZXciOjIsImNvbXBvbmVudFR5cGUiOjUxMjMsImNvdW50IjozNiwidHlwZSI6IlNDQUxBUiJ9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6Mjg4LCJ0YXJnZXQiOjM0OTYyfSx7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6Mjg4LCJieXRlTGVuZ3RoIjoyODgsInRhcmdldCI6MzQ5NjJ9LHsiYnVmZmVyIjowLCJieXRlT2Zmc2V0Ijo1NzYsImJ5dGVMZW5ndGgiOjcyLCJ0YXJnZXQiOjM0OTYzfV0sImJ1ZmZlcnMiOlt7ImJ5dGVMZW5ndGgiOjY0OH1dfSAgIIgCAABCSU4AAAAAPwAAAL8AAAA/AAAAPwAAAL8AAAC/AAAAPwAAAD8AAAC/AAAAPwAAAD8AAAA/AAAAvwAAAL8AAAC/AAAAvwAAAL8AAAA/AAAAvwAAAD8AAAA/AAAAvwAAAD8AAAC/AAAAvwAAAD8AAAC/AAAAvwAAAD8AAAA/AAAAPwAAAD8AAAA/AAAAPwAAAD8AAAC/AAAAvwAAAL8AAAA/AAAAvwAAAL8AAAC/AAAAPwAAAL8AAAC/AAAAPwAAAL8AAAA/AAAAvwAAAL8AAAA/AAAAPwAAAL8AAAA/AAAAPwAAAD8AAAA/AAAAvwAAAD8AAAA/AAAAPwAAAL8AAAC/AAAAvwAAAL8AAAC/AAAAvwAAAD8AAAC/AAAAPwAAAD8AAAC/AACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAABAAIAAAACAAMABAAFAAYABAAGAAcACAAJAAoACAAKAAsADAANAA4ADAAOAA8AEAARABIAEAASABMAFAAVABYAFAAWABcA';

const cubeBytes = () => Uint8Array.from(atob(CUBE_GLB_BASE64), (c) => c.charCodeAt(0));

describe('createModelLoader — real GLB parse (cube fixture)', () => {
  it('fetches once, parses the GLB, inserts it, frames it, and reports it', async () => {
    let loadCount = 0;
    const rm = {
      load: (path: string) => {
        loadCount += 1;
        return Promise.resolve({
          url: 'https://host/models/' + path,
          bytes: cubeBytes(),
          mimeType: 'model/gltf-binary',
        });
      },
      dispose: vi.fn(),
    } as unknown as ResourceManager;

    const added: THREE.Object3D[] = [];
    const removed: THREE.Object3D[] = [];
    const scene = {
      add: (o: THREE.Object3D) => added.push(o),
      remove: (o: THREE.Object3D) => removed.push(o),
    } as unknown as SceneManager;

    const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 100);
    const camera = {
      getThreeCamera: () => cam,
      setAspect: vi.fn(),
      setView: vi.fn(),
      dispose: vi.fn(),
    } as unknown as CameraManager;

    const controls = { setView: vi.fn() } as unknown as OrbitControls;

    const events = new EventBus<EngineEventMap>();
    const loaded: {
      url: string;
      boundingBox: { min: readonly number[]; max: readonly number[] };
    }[] = [];
    events.on('model:loaded', (e) => loaded.push(e));

    const loader = createModelLoader({ resourceManager: rm, scene, camera, controls, events });
    const result = await loader.load({ path: 'cube.glb' });

    // Real parse produced a real subtree that was inserted.
    expect(added).toHaveLength(1);
    expect(added[0]).toBeInstanceOf(THREE.Object3D);
    // Bounding box of the unit cube.
    expect(result.boundingBox.min.map((n) => Math.round(n * 100) / 100)).toEqual([
      -0.5, -0.5, -0.5,
    ]);
    expect(result.boundingBox.max.map((n) => Math.round(n * 100) / 100)).toEqual([0.5, 0.5, 0.5]);
    // Framing is finite and pulls back beyond the model radius.
    expect(result.framing.distance).toBeGreaterThan(result.framing.radius);
    expect(result.framing.position.every(Number.isFinite)).toBe(true);
    // Controls were re-targeted; exactly one network request for the GLB.
    expect(controls.setView).toHaveBeenCalledTimes(1);
    expect(loadCount).toBe(1);
    expect(loaded).toHaveLength(1);

    // Dispose removes the inserted model.
    loader.dispose();
    expect(removed).toContain(added[0]);
  });
});
