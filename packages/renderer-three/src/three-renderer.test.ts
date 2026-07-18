import { describe, it, expect, vi, beforeEach } from 'vitest';

// A minimal stand-in for THREE.WebGLRenderer so tests run without a GPU/WebGL.
interface MockRenderer {
  outputColorSpace: string;
  toneMapping: number;
  toneMappingExposure: number;
  pixelRatio: number;
  width: number;
  height: number;
  clearColor?: unknown;
  clearAlpha?: number;
  clears: number;
  disposed: number;
  contextLost: number;
}

const { instances } = vi.hoisted(() => ({ instances: [] as MockRenderer[] }));

vi.mock('three', () => {
  class WebGLRenderer {
    outputColorSpace = '';
    toneMapping = -1;
    toneMappingExposure = 1;
    pixelRatio = 1;
    width = 0;
    height = 0;
    clearColor?: unknown;
    clearAlpha?: number;
    clears = 0;
    disposed = 0;
    contextLost = 0;
    constructor() {
      instances.push(this as unknown as MockRenderer);
    }
    setPixelRatio(ratio: number) {
      this.pixelRatio = ratio;
    }
    getPixelRatio() {
      return this.pixelRatio;
    }
    setSize(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    setClearColor(color: unknown, alpha?: number) {
      this.clearColor = color;
      this.clearAlpha = alpha;
    }
    clear() {
      this.clears += 1;
    }
    dispose() {
      this.disposed += 1;
    }
    forceContextLoss() {
      this.contextLost += 1;
    }
  }
  return {
    WebGLRenderer,
    NoToneMapping: 0,
    LinearToneMapping: 1,
    ACESFilmicToneMapping: 2,
    AgXToneMapping: 6,
    NeutralToneMapping: 7,
    SRGBColorSpace: 'srgb',
    LinearSRGBColorSpace: 'srgb-linear',
  };
});

import { createThreeRenderer } from './three-renderer';

const canvas = {} as HTMLCanvasElement;

beforeEach(() => {
  instances.length = 0;
});

describe('createThreeRenderer', () => {
  it('applies color space, tone mapping, exposure, clear color and pixel ratio', () => {
    createThreeRenderer({
      canvas,
      colorSpace: 'srgb-linear',
      toneMapping: 'aces-filmic',
      toneMappingExposure: 1.2,
      clearColor: '#101014',
      clearAlpha: 1,
      pixelRatio: 1.5,
    });
    const r = instances[0];
    expect(r?.outputColorSpace).toBe('srgb-linear');
    expect(r?.toneMapping).toBe(2);
    expect(r?.toneMappingExposure).toBe(1.2);
    expect(r?.clearColor).toBe('#101014');
    expect(r?.pixelRatio).toBe(1.5);
  });

  it('defaults: srgb color space, no tone mapping, exposure 1', () => {
    createThreeRenderer({ canvas });
    const r = instances[0];
    expect(r?.outputColorSpace).toBe('srgb');
    expect(r?.toneMapping).toBe(0);
    expect(r?.toneMappingExposure).toBe(1);
  });

  it('setSize resizes correctly and getSize reflects it', () => {
    const renderer = createThreeRenderer({ canvas, pixelRatio: 1 });
    renderer.setSize(800, 600);
    expect(renderer.getSize()).toEqual({ width: 800, height: 600 });
    expect(instances[0]?.width).toBe(800);
    expect(instances[0]?.height).toBe(600);
  });

  it('setPixelRatio / getPixelRatio round-trip', () => {
    const renderer = createThreeRenderer({ canvas, pixelRatio: 1 });
    renderer.setPixelRatio(2);
    expect(renderer.getPixelRatio()).toBe(2);
  });

  it('render clears the buffer; dispose releases context and is idempotent', () => {
    const renderer = createThreeRenderer({ canvas, pixelRatio: 1 });
    renderer.render();
    renderer.render();
    expect(instances[0]?.clears).toBe(2);

    renderer.dispose();
    expect(instances[0]?.disposed).toBe(1);
    expect(instances[0]?.contextLost).toBe(1);

    renderer.dispose(); // idempotent
    renderer.render(); // no-op after dispose
    expect(instances[0]?.disposed).toBe(1);
    expect(instances[0]?.clears).toBe(2);
  });
});
