// Three.js adapter implementing the core's RendererPort (ADR-002).
//
// This is the ONLY package allowed to import three. The core never sees this
// module: it depends only on the RendererPort *type* (import type, erased at
// runtime), keeping the Core fully independent of Three.js (L9).
import * as THREE from 'three';
import type {
  RendererPort,
  RendererConfig,
  RendererSize,
  ColorSpace,
  ToneMapping,
} from '@explorer-engine/core';

/** Options for the Three.js renderer adapter. The host owns and passes the canvas. */
export interface ThreeRendererOptions extends RendererConfig {
  readonly canvas: HTMLCanvasElement;
}

const COLOR_SPACE: Record<ColorSpace, THREE.ColorSpace> = {
  srgb: THREE.SRGBColorSpace,
  'srgb-linear': THREE.LinearSRGBColorSpace,
};

const TONE_MAPPING: Record<ToneMapping, THREE.ToneMapping> = {
  none: THREE.NoToneMapping,
  linear: THREE.LinearToneMapping,
  'aces-filmic': THREE.ACESFilmicToneMapping,
  agx: THREE.AgXToneMapping,
  neutral: THREE.NeutralToneMapping,
};

function resolvePixelRatio(config: RendererConfig): number {
  if (config.pixelRatio !== undefined) return config.pixelRatio;
  const dpr = (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1;
  return Math.min(dpr, config.maxPixelRatio ?? 2);
}

/**
 * Create a Three.js-backed renderer that satisfies {@link RendererPort}.
 * At P1-T1 `render()` clears the drawing buffer (no scene yet).
 */
export function createThreeRenderer(options: ThreeRendererOptions): RendererPort {
  const renderer = new THREE.WebGLRenderer({
    canvas: options.canvas,
    antialias: options.antialias ?? true,
    alpha: options.alpha ?? false,
  });

  renderer.outputColorSpace = COLOR_SPACE[options.colorSpace ?? 'srgb'];
  renderer.toneMapping = TONE_MAPPING[options.toneMapping ?? 'none'];
  renderer.toneMappingExposure = options.toneMappingExposure ?? 1;
  if (options.clearColor !== undefined) {
    renderer.setClearColor(options.clearColor, options.clearAlpha ?? 1);
  }
  renderer.setPixelRatio(resolvePixelRatio(options));

  let size: RendererSize = { width: 0, height: 0 };
  let disposed = false;

  return {
    setSize(width, height) {
      size = { width, height };
      // updateStyle=false: the host controls the canvas CSS layout, not the renderer.
      renderer.setSize(width, height, false);
    },
    setPixelRatio(pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
    },
    getSize() {
      return size;
    },
    getPixelRatio() {
      return renderer.getPixelRatio();
    },
    render() {
      if (disposed) return;
      renderer.clear();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
