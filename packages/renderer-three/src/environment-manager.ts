// Environment Manager (chapter 02 §2.9) — Three.js implementation of the core's
// EnvironmentPort. Applies the scene background (flat color, vertical gradient or
// transparent) and an image-based-lighting (IBL) environment for PBR reflections.
//
// This first version ships only in-code sources (no external HDR/asset): the
// `neutral-room` IBL is baked at runtime from Three's RoomEnvironment via a
// PMREMGenerator. The manager owns every resource it creates (gradient texture,
// baked env map, PMREM generator) and releases them on replacement / dispose so
// nothing leaks. Per correction C6 it does NOT reference the Lighting Manager.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {
  EnvironmentPort,
  EnvironmentSpec,
  BackgroundSpec,
  EnvironmentSource,
  ColorValue,
} from '@explorer-engine/core';
import type { ThreeSceneHandle, ThreeRendererHandle } from './internal/handles';

const GRADIENT_HEIGHT = 64;

/** Build a vertical `bottom`→`top` gradient as a DOM-free DataTexture. */
function makeGradientTexture(top: ColorValue, bottom: ColorValue): THREE.DataTexture {
  const data = new Uint8Array(GRADIENT_HEIGHT * 4);
  const cTop = new THREE.Color(top);
  const cBottom = new THREE.Color(bottom);
  const row = new THREE.Color();
  for (let i = 0; i < GRADIENT_HEIGHT; i += 1) {
    const t = i / (GRADIENT_HEIGHT - 1); // row 0 = bottom, last row = top
    row.copy(cBottom).lerp(cTop, t);
    const o = i * 4;
    data[o] = Math.round(row.r * 255);
    data[o + 1] = Math.round(row.g * 255);
    data[o + 2] = Math.round(row.b * 255);
    data[o + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, 1, GRADIENT_HEIGHT, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export interface EnvironmentManagerOptions {
  readonly scene: ThreeSceneHandle;
  /** Needed to bake the IBL environment map (PMREM). */
  readonly renderer: ThreeRendererHandle;
}

export function createEnvironmentManager(options: EnvironmentManagerOptions): EnvironmentPort {
  const scene = options.scene.getThreeScene();
  const renderer = options.renderer.getThreeRenderer();

  let gradient: THREE.DataTexture | null = null; // owned background texture
  let envMap: THREE.Texture | null = null; // owned baked IBL map
  let pmrem: THREE.PMREMGenerator | null = null;

  const clearBackground = () => {
    if (scene.background === gradient) scene.background = null;
    gradient?.dispose();
    gradient = null;
  };

  const clearEnvironment = () => {
    if (scene.environment === envMap) scene.environment = null;
    envMap?.dispose();
    envMap = null;
  };

  const applyBackground = (spec: BackgroundSpec) => {
    clearBackground();
    switch (spec.kind) {
      case 'color':
        scene.background = new THREE.Color(spec.color);
        break;
      case 'gradient':
        gradient = makeGradientTexture(spec.top, spec.bottom);
        scene.background = gradient;
        break;
      case 'transparent':
        scene.background = null;
        break;
    }
  };

  const applyEnvironment = (source: EnvironmentSource, intensity: number) => {
    clearEnvironment();
    if (source === 'neutral-room') {
      pmrem ??= new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      envMap = pmrem.fromScene(room, 0.04).texture;
      room.dispose();
      scene.environment = envMap;
    }
    scene.environmentIntensity = intensity;
  };

  return {
    apply(config: EnvironmentSpec) {
      applyBackground(config.background);
      applyEnvironment(config.environment ?? 'none', config.environmentIntensity ?? 1);
    },
    dispose() {
      clearBackground();
      clearEnvironment();
      pmrem?.dispose();
      pmrem = null;
    },
  };
}
