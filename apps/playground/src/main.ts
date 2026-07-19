// Explorer Engine — development playground (P2-T3).
//
// Assembles EXISTING services only: the Three.js renderer/scene/camera, the
// Lighting and Environment Managers (P1-T4), the headless orbit controls (core),
// the DOM input adapter (P1-T3), the on-demand render loop (P1-T5), the Resource
// Manager (P2-T1) with the fetch transport, and the Model Loader (P2-T2/T3). It
// imports no Three.js and parses no GLB itself. The Model Loader is configured
// with the Draco/KTX2 decoder paths (P2-T3); their WASM (served from public/) is
// fetched lazily by Three.js only when a GLB actually uses the extension. The
// scene starts EMPTY (no demo cube): the GLB is the only object. Teardown disposes
// everything in a safe order.
import {
  createOrbitControls,
  getLightingPreset,
  createRenderLoop,
  createResourceManager,
  EventBus,
  type EngineEventMap,
} from '@explorer-engine/core';
import {
  createThreeRenderer,
  createSceneManager,
  createCameraManager,
  createLightingManager,
  createEnvironmentManager,
  createModelLoader,
} from '@explorer-engine/renderer-three';
import { createFetchTransport } from '@explorer-engine/resource-fetch';
import { createDomInput } from '@explorer-engine/input-dom';

// Dev switch: `?model=compressed` loads the Draco+KTX2 fixture (P2-T3); the
// default is the uncompressed cube.glb (P2-T2). No product UI — just a query param.
const MODEL_PATH =
  new URLSearchParams(window.location.search).get('model') === 'compressed'
    ? 'models/compressed-cube.glb'
    : 'models/cube.glb';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);

  const caption = document.createElement('p');
  caption.className = 'caption';
  caption.textContent = 'Explorer Engine — P2-T3 · loading model…';
  document.body.appendChild(caption);

  const renderer = createThreeRenderer({ canvas, toneMapping: 'aces-filmic' });
  const scene = createSceneManager(); // empty; the GLB is the only object
  const camera = createCameraManager({ position: [3, 2, 4], target: [0, 0, 0] });

  const lighting = createLightingManager(scene);
  lighting.apply(getLightingPreset('studio'));

  const environment = createEnvironmentManager({ scene, renderer });
  environment.apply({
    background: { kind: 'gradient', top: '#2a3350', bottom: '#0a0b12' },
    environment: 'neutral-room',
    environmentIntensity: 1,
  });

  // Generous limits so auto-framing can place the camera freely.
  const controls = createOrbitControls(camera, {
    position: [3, 2, 4],
    target: [0, 0, 0],
    minDistance: 0.1,
    maxDistance: 100,
  });

  // On-demand render loop (P1-T5): only renders when something invalidates a frame.
  let renderCount = 0; // dev-only counter for browser idle verification
  const loop = createRenderLoop({
    scheduler: {
      request: (cb) => requestAnimationFrame(cb),
      cancel: (id) => cancelAnimationFrame(id),
    },
    render: () => {
      renderCount += 1;
      const moving = controls.update();
      renderer.render(scene, camera);
      if (moving) loop.requestRender();
    },
  });
  const wake = () => loop.requestRender();

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspect(window.innerWidth / window.innerHeight);
    wake();
  };

  const input = createDomInput({ element: canvas, input: controls, onActivity: wake });

  window.addEventListener('resize', resize);
  resize(); // initial size (sets aspect used by framing) + first render request
  canvas.focus();

  // Resource Manager (P2-T1) + fetch transport, owned by the host (playground).
  const resourceManager = createResourceManager({
    transport: createFetchTransport(),
    baseUrl: window.location.origin + '/',
    timeoutMs: 15000,
    timeoutScheduler: {
      schedule: (cb, ms) => {
        const id = window.setTimeout(cb, ms);
        return () => window.clearTimeout(id);
      },
    },
  });

  // Typed events → console diagnostics (no full loader UI at P2-T2).
  const events = new EventBus<EngineEventMap>();
  events.on('model:loading', (e) => console.info(`[model] ${e.phase}: ${e.url}`));
  const modelName = MODEL_PATH.split('/').pop();
  events.on('model:loaded', (e) => {
    console.info('[model] loaded', e.url, e.boundingBox);
    caption.textContent = `Explorer Engine — P2-T3 · ${modelName} loaded · drag = orbit · wheel = zoom`;
  });
  events.on('model:error', (e) => {
    console.error('[model] error', e.url, e.message);
    caption.textContent = `Explorer Engine — P2-T3 · model error: ${e.message}`;
  });

  const modelLoader = createModelLoader({
    resourceManager,
    scene,
    camera,
    controls,
    events,
    requestRender: wake,
    // Compression decoders (P2-T3): WASM served from public/, fetched lazily by
    // Three.js only when a GLB actually uses the matching extension. The renderer
    // is needed for KTX2Loader.detectSupport.
    dracoDecoderPath: 'decoders/draco/',
    ktx2TranscoderPath: 'decoders/basis/',
    renderer,
  });

  let modelBox: { min: readonly number[]; max: readonly number[] } | null = null;
  let modelError: string | null = null;
  const modelReady = modelLoader
    .load({ path: MODEL_PATH })
    .then((result) => {
      modelBox = result.boundingBox;
    })
    .catch((error: unknown) => {
      modelError = error instanceof Error ? error.message : String(error);
    });

  const teardown = () => {
    loop.dispose(); // cancels any pending frame
    window.removeEventListener('resize', resize);
    input.dispose();
    controls.dispose();
    modelLoader.dispose(); // removes + releases the loaded model
    resourceManager.dispose(); // cancels any in-flight fetch (host owns it)
    events.clear();
    // Dispose managers before the scene so their GPU resources are released first.
    environment.dispose();
    lighting.dispose();
    scene.dispose();
    renderer.dispose();
    caption.remove();
    canvas.remove();
  };

  window.addEventListener('beforeunload', teardown);
  if (import.meta.hot) {
    import.meta.hot.dispose(teardown);
  }

  // Dev-only hook for local/browser verification (not part of any public API).
  if (import.meta.env.DEV) {
    (window as unknown as { __ee?: unknown }).__ee = {
      cameraPosition: () => camera.getThreeCamera().position.toArray(),
      renderCount: () => renderCount,
      hasPendingFrame: () => loop.hasPendingFrame,
      modelReady: () => modelReady,
      modelBoundingBox: () => modelBox,
      modelError: () => modelError,
      sceneChildCount: () => scene.getThreeScene().children.length,
      teardown,
    };
  }
}
