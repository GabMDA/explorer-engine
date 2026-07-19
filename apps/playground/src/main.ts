// Explorer Engine — development playground (Sprint 1: config-driven).
//
// The playground is a GENERIC composition root: it fetches a config.json through
// the Config Loader (core), then builds the scene ENTIRELY from that resolved
// config — lighting, environment, camera, controls and model all come from data.
// There is no object-specific code: the same code drives any config (proof of
// L1/L2). It imports no Three.js and parses no GLB itself. `?config=indexed` loads
// a multi-node model to exercise the node index (P2-T4); the default is minimal.
import {
  createOrbitControls,
  getLightingPreset,
  createRenderLoop,
  createResourceManager,
  createConfigLoader,
  environmentSpecFromConfig,
  lightingPresetIdFromConfig,
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

const CONFIG_PATH =
  new URLSearchParams(window.location.search).get('config') === 'indexed'
    ? 'indexed.json'
    : 'minimal.json';

const app = document.querySelector<HTMLDivElement>('#app');

async function boot(app: HTMLDivElement): Promise<void> {
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);
  const caption = document.createElement('p');
  caption.className = 'caption';
  caption.textContent = 'Explorer Engine — Sprint 1 · loading config…';
  document.body.appendChild(caption);

  const renderer = createThreeRenderer({ canvas, toneMapping: 'aces-filmic' });
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

  // 1. Load + validate + resolve the config (headless Config Loader).
  const configLoader = createConfigLoader({
    resourceManager,
    decodeText: (bytes) => new TextDecoder().decode(bytes),
  });
  const loaded = await configLoader.load(CONFIG_PATH);
  const config = loaded.config;
  for (const w of loaded.warnings) console.warn(`[config] ${w.path}: ${w.message}`);
  if (loaded.migratedFrom) console.info(`[config] migrated from ${loaded.migratedFrom}`);

  // 2. Build the scene entirely FROM the config.
  const scene = createSceneManager();
  const camera = createCameraManager({
    fov: config.camera.fov,
    position: [3, 2, 4],
    target: [0, 0, 0],
  });

  const lighting = createLightingManager(scene);
  lighting.apply(getLightingPreset(lightingPresetIdFromConfig(config.lighting)));

  const environment = createEnvironmentManager({ scene, renderer });
  environment.apply(environmentSpecFromConfig(config.environment));

  const controls = createOrbitControls(camera, {
    position: [3, 2, 4],
    target: [0, 0, 0],
    minDistance: config.camera.controls.minDistance,
    maxDistance: config.camera.controls.maxDistance,
    enablePan: config.camera.controls.enablePan,
    enableZoom: config.camera.controls.enableZoom,
  });

  // On-demand render loop (P1-T5).
  let renderCount = 0;
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
  resize();
  canvas.focus();

  // 3. Model loader configured from the config (decoders gated by config toggles).
  const events = new EventBus<EngineEventMap>();
  events.on('model:error', (e) => {
    caption.textContent = `Explorer Engine — Sprint 1 · model error: ${e.message}`;
  });
  const modelLoader = createModelLoader({
    resourceManager,
    scene,
    camera,
    controls,
    events,
    requestRender: wake,
    ...(config.model.draco ? { dracoDecoderPath: 'decoders/draco/' } : {}),
    ...(config.model.ktx2 ? { ktx2TranscoderPath: 'decoders/basis/', renderer } : {}),
  });

  let modelError: string | null = null;
  const modelReady = modelLoader
    .load({ path: config.model.src })
    .then(() => {
      const n = scene.getNodeIndex()?.size ?? 0;
      caption.textContent = `Explorer Engine — ${config.meta.title ?? 'model'} · ${n} indexed node(s) · drag = orbit`;
    })
    .catch((error: unknown) => {
      modelError = error instanceof Error ? error.message : String(error);
    });

  const teardown = () => {
    loop.dispose();
    window.removeEventListener('resize', resize);
    input.dispose();
    controls.dispose();
    modelLoader.dispose();
    resourceManager.dispose();
    events.clear();
    environment.dispose();
    lighting.dispose();
    scene.dispose();
    renderer.dispose();
    caption.remove();
    canvas.remove();
  };
  window.addEventListener('beforeunload', teardown);
  if (import.meta.hot) import.meta.hot.dispose(teardown);

  if (import.meta.env.DEV) {
    (window as unknown as { __ee?: unknown }).__ee = {
      cameraPosition: () => camera.getThreeCamera().position.toArray(),
      renderCount: () => renderCount,
      hasPendingFrame: () => loop.hasPendingFrame,
      modelReady: () => modelReady,
      modelError: () => modelError,
      sceneChildCount: () => scene.getThreeScene().children.length,
      config: () => config,
      nodeCount: () => scene.getNodeIndex()?.size ?? 0,
      resolveNode: (id: string) => scene.getNodeIndex()?.resolve(id).length ?? 0,
      byName: (name: string) => scene.getNodeIndex()?.byName(name).length ?? 0,
      teardown,
    };
  }
}

if (app) {
  void boot(app).catch((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    const p = document.createElement('p');
    p.className = 'caption';
    p.textContent = `Explorer Engine — boot error: ${msg}`;
    document.body.appendChild(p);
    console.error('[boot]', error);
  });
}
