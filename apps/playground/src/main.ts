// Explorer Engine — development playground (Sprint 2: interaction + RSR).
//
// The playground is a GENERIC composition root: it fetches a config.json through
// the Config Loader (core), then builds the scene ENTIRELY from that resolved
// config — lighting, environment, camera, controls, model, AND the interaction
// stack (Render State Resolver, Selection, Hotspots). There is no object-specific
// code: the same code drives any config (proof of L1/L2). It imports no Three.js
// and parses no GLB itself.
//
//   ?config=minimal      minimal single-cube config (default)
//   ?config=indexed      multi-node model, exercises the node index (P2-T4)
//   ?config=interactive  components + hotspots, exercises Sprint 2 (selection/RSR/hotspots)
import {
  createOrbitControls,
  getLightingPreset,
  createRenderLoop,
  createResourceManager,
  createConfigLoader,
  environmentSpecFromConfig,
  lightingPresetIdFromConfig,
  createComponentModel,
  createRenderStateResolver,
  createSelectionManager,
  createHotspotManager,
  EventBus,
  type EngineEventMap,
  type ResolvedConfig,
} from '@explorer-engine/core';
import {
  createThreeRenderer,
  createSceneManager,
  createCameraManager,
  createLightingManager,
  createEnvironmentManager,
  createModelLoader,
  createRenderStateApplicator,
  createRaycasterAdapter,
  createHotspotProjector,
} from '@explorer-engine/renderer-three';
import { createFetchTransport } from '@explorer-engine/resource-fetch';
import { createDomInput } from '@explorer-engine/input-dom';
import { createHotspotOverlay } from './hotspot-overlay';

const CONFIG_PATH = ((): string => {
  const which = new URLSearchParams(window.location.search).get('config');
  if (which === 'indexed') return 'indexed.json';
  if (which === 'interactive') return 'interactive.json';
  return 'minimal.json';
})();

const app = document.querySelector<HTMLDivElement>('#app');

async function boot(app: HTMLDivElement): Promise<void> {
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);
  const caption = document.createElement('p');
  caption.className = 'caption';
  caption.textContent = 'Explorer Engine — Sprint 2 · loading config…';
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
  const config: ResolvedConfig = loaded.config;
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

  const events = new EventBus<EngineEventMap>();

  // 3. Interaction stack (Sprint 2). All visual state flows through the resolver (L5).
  const components = createComponentModel(config);
  const applicator = createRenderStateApplicator({ scene });
  let renderCount = 0;
  const wake = () => loop.requestRender();
  const resolver = createRenderStateResolver({ components, port: applicator, requestRender: wake });
  const raycaster = createRaycasterAdapter({ scene, camera });
  const selection = createSelectionManager({ components, resolver, raycaster, events });

  const hotspots = createHotspotManager({ config, components, events });
  const projector = createHotspotProjector({ scene, camera, renderer });
  const overlay =
    hotspots.count > 0
      ? createHotspotOverlay({
          container: document.body,
          hotspots: hotspots.view().map((v) => ({ id: v.id, label: v.label })),
          onActivate: (id) => hotspots.activate(id),
          onHover: (id) => hotspots.hover(id),
        })
      : null;

  // React to interaction events (typed bus). In Sprint 2 a hotspot `focus` action
  // is demonstrated by selecting its target component (Focus Manager lands in P5).
  events.on('selection:changed', (e) => (caption.textContent = `Selected: ${e.component}`));
  events.on('selection:cleared', () => (caption.textContent = `Selection cleared`));
  events.on('hotspot:activated', (e) => {
    if (e.action.type === 'focus' && e.action.target.kind === 'component') {
      selection.selectComponent(e.action.target.id);
    }
    caption.textContent = `Hotspot ${e.id} → ${e.action.type}`;
    wake();
  });

  // On-demand render loop (P1-T5): compose visual state, project hotspots, draw.
  const loop = createRenderLoop({
    scheduler: {
      request: (cb) => requestAnimationFrame(cb),
      cancel: (id) => cancelAnimationFrame(id),
    },
    render: () => {
      renderCount += 1;
      const moving = controls.update();
      resolver.flush(); // push composed visual state to the applicator (dirty only)
      if (overlay) {
        hotspots.applyProjection(projector.project(hotspots.anchors()));
        overlay.update(hotspots.view());
      }
      renderer.render(scene, camera);
      if (moving) loop.requestRender();
    },
  });

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspect(window.innerWidth / window.innerHeight);
    wake();
  };
  const input = createDomInput({ element: canvas, input: controls, onActivity: wake });

  // Picking: a press that does not turn into a drag is a click → select; a bare
  // pointer move → hover. Orbit (drag) is handled by createDomInput in parallel.
  const toNdc = (clientX: number, clientY: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    return [
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    ];
  };
  let downX = 0;
  let downY = 0;
  let dragging = false;
  const onPointerDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
    dragging = false;
  };
  const onPointerMove = (e: PointerEvent) => {
    if (e.buttons !== 0) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 4) dragging = true;
      return; // dragging = orbit, not hover
    }
    const [nx, ny] = toNdc(e.clientX, e.clientY);
    selection.hoverAt(nx, ny);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (dragging) return; // was an orbit gesture
    const [nx, ny] = toNdc(e.clientX, e.clientY);
    selection.selectAt(nx, ny);
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);

  window.addEventListener('resize', resize);
  resize();
  canvas.focus();

  // 4. Model loader configured from the config (decoders gated by config toggles).
  events.on('model:error', (e) => {
    caption.textContent = `Explorer Engine — Sprint 2 · model error: ${e.message}`;
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
      const hs = hotspots.count;
      caption.textContent = `Explorer Engine — ${config.meta.title ?? 'model'} · ${n} node(s) · ${hs} hotspot(s) · click = select, drag = orbit`;
      wake();
    })
    .catch((error: unknown) => {
      modelError = error instanceof Error ? error.message : String(error);
    });

  const teardown = () => {
    loop.dispose();
    window.removeEventListener('resize', resize);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    input.dispose();
    controls.dispose();
    modelLoader.dispose();
    overlay?.dispose();
    selection.dispose();
    resolver.dispose();
    applicator.dispose();
    hotspots.dispose();
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
      // Sprint 2 interaction hooks.
      hotspotCount: () => hotspots.count,
      hotspotView: () => hotspots.view(),
      listItemCount: () => document.querySelectorAll('.ee-hotspot-listitem').length,
      markerCount: () => document.querySelectorAll('.ee-hotspot').length,
      selectComponent: (id: string | null) => selection.selectComponent(id),
      hoverComponent: (id: string | null) => selection.hoverComponent(id),
      pickAt: (nx: number, ny: number) => {
        selection.selectAt(nx, ny);
        return selection.getSelected();
      },
      activateHotspot: (id: string) => hotspots.activate(id),
      getSelected: () => selection.getSelected(),
      getHovered: () => selection.getHovered(),
      effectiveState: (identity: string) => resolver.resolveNode(identity),
      layerCount: () => resolver.layerCount,
      flush: () => resolver.flush(),
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
