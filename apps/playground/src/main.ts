// Explorer Engine — development playground (Sprint 4: states).
//
// The playground is a GENERIC composition root: it fetches a config.json through
// the Config Loader (core), then builds the scene ENTIRELY from that resolved
// config — lighting, environment, camera, controls, model, AND the interaction +
// focus/animation + state stack (Render State Resolver, Animation Engine, Selection,
// Hotspots, Focus Manager, camera intent controller, State Manager). There is no
// object-specific code: the same code drives any config (proof of L1/L2).
//
//   ?config=minimal      minimal single-cube config (default)
//   ?config=indexed      multi-node model, exercises the node index (P2-T4)
//   ?config=interactive  components + hotspots + focus, exercises Sprint 2/3
//   ?config=states       bases + modifiers (exploded / X-ray / cutaway), Sprint 4
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
  createAnimationEngine,
  createFocusManager,
  createStateManager,
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
  createBoundsProvider,
  createCameraIntentController,
  type CameraIntentController,
} from '@explorer-engine/renderer-three';
import { createFetchTransport } from '@explorer-engine/resource-fetch';
import { createDomInput } from '@explorer-engine/input-dom';
import { createHotspotOverlay } from './hotspot-overlay';
import { createStateToolbar } from './state-toolbar';

const DEG2RAD = Math.PI / 180;

const CONFIG_PATH = ((): string => {
  const which = new URLSearchParams(window.location.search).get('config');
  if (which === 'indexed') return 'indexed.json';
  if (which === 'states') return 'states.json';
  if (which === 'interactive') return 'interactive.json';
  return 'minimal.json';
})();

const app = document.querySelector<HTMLDivElement>('#app');

async function boot(app: HTMLDivElement): Promise<void> {
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);
  const caption = document.createElement('p');
  caption.className = 'caption';
  caption.textContent = 'Explorer Engine — Sprint 3 · loading config…';
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
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 3. Interaction + focus/animation stack. All visual state flows through the
  // resolver (L5); every animation goes through the headless Animation Engine.
  const components = createComponentModel(config);
  // The applicator is given the renderer so cutaway clipping can be enabled.
  const applicator = createRenderStateApplicator({ scene, renderer });
  let renderCount = 0;
  const wake = () => loop.requestRender();
  const engine = createAnimationEngine({ requestRender: wake, reducedMotion });
  // Holder for the forward-referenced camera adapter (created after the resolver,
  // which it depends on; the resolver only needs a callback into it).
  const cam: { controller?: CameraIntentController } = {};
  const resolver = createRenderStateResolver({
    components,
    port: applicator,
    requestRender: wake,
    animation: engine, // enables layer `transition`s (dim fade)
    onIntentChange: () => cam.controller?.sync(), // camera adapter executes cameraIntent
  });
  const raycaster = createRaycasterAdapter({ scene, camera });
  const selection = createSelectionManager({ components, resolver, raycaster, events });

  // Focus Manager (headless) → publishes cameraIntent + dim/outline layers.
  const boundsProvider = createBoundsProvider({ scene, components });
  const focus = createFocusManager({
    resolver,
    components,
    config: config.focus,
    boundsProvider,
    frameHint: () => ({
      fovYRadians: config.camera.fov * DEG2RAD,
      aspect: window.innerWidth / Math.max(1, window.innerHeight),
    }),
    events,
  });
  // Camera adapter: consumes cameraIntent, animates the camera via the engine.
  cam.controller = createCameraIntentController({
    resolver,
    camera,
    controls,
    animation: engine,
    transition: config.focus.transition,
    requestRender: wake,
  });

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

  // State Manager (headless statechart) → publishes state/modifier layers + intents.
  const stateManager = createStateManager({
    resolver,
    states: config.states,
    initialState: config.initialState,
    events,
  });
  const bases = config.states
    .filter((s) => s.region === 'base')
    .map((s) => ({ id: s.id, label: s.label }));
  const mods = config.states
    .filter((s) => s.region !== 'base')
    .map((s) => ({ id: s.id, label: s.label }));
  const toolbar =
    config.states.length > 0
      ? createStateToolbar({
          container: document.body,
          bases,
          modifiers: mods,
          onBase: (id) => {
            stateManager.goToBase(id);
            wake();
          },
          onModifier: (id) => {
            stateManager.toggleModifier(id);
            wake();
          },
          onReset: () => {
            focus.clear();
            selection.clearSelection();
            stateManager.reset();
            wake();
          },
        })
      : null;
  toolbar?.update(stateManager.getBase(), stateManager.getModifiers());

  // React to interaction events (typed bus). A hotspot `focus` action now drives
  // the Focus Manager (camera transition + dim/outline); `emit` is just reported.
  events.on('selection:changed', (e) => (caption.textContent = `Selected: ${e.component}`));
  events.on('focus:started', (e) => (caption.textContent = `Focus → ${e.target.id} · Esc = back`));
  events.on('focus:ended', (e) => {
    caption.textContent = e.current ? `Focus → ${e.current.id} · Esc = back` : `Overview`;
  });
  events.on('hotspot:activated', (e) => {
    if (e.action.type === 'focus') focus.focus(e.action.target);
    else if (e.action.type === 'goToState') stateManager.goToState(e.action.state);
    else caption.textContent = `Hotspot ${e.id} → ${e.action.type}`;
    wake();
  });
  // Keep the toolbar in sync with the macroscopic state.
  events.on('state:changed', (e) => {
    toolbar?.update(e.base, e.modifiers);
    caption.textContent = `State: ${e.base ?? 'rest'}${e.modifiers.length ? ' + ' + e.modifiers.join(', ') : ''}`;
    wake();
  });

  // On-demand render loop (P1-T5): advance animations, compose visual state, project
  // hotspots, draw. The loop stays alive while an animation is active, then goes
  // dormant (frame ownership, chapter 11 §11.8.1 / L18) — no permanent 60 FPS loop.
  const loop = createRenderLoop({
    scheduler: {
      request: (cb) => requestAnimationFrame(cb),
      cancel: (id) => cancelAnimationFrame(id),
    },
    render: () => {
      renderCount += 1;
      engine.update(performance.now()); // advance tweens/timelines (camera + RSR fades)
      const moving = controls.update();
      resolver.flush(); // push composed visual state to the applicator (dirty only)
      if (overlay) {
        hotspots.applyProjection(projector.project(hotspots.anchors()));
        overlay.update(hotspots.view());
      }
      renderer.render(scene, camera);
      if (moving || engine.hasActive) loop.requestRender();
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

  // Escape exits the current focus level (chapter 08 §8.10 — keyboard exit).
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && focus.depth > 0) {
      focus.back();
      wake();
    }
  };
  window.addEventListener('keydown', onKeyDown);

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
      // Seed the camera "home" pose from the auto-framing, so exiting a focus
      // returns to the overview (recomposition, not imperative restore).
      const view = controls.getView();
      cam.controller?.setHome(view.position, view.target);
      caption.textContent = `Explorer Engine — ${config.meta.title ?? 'model'} · ${n} node(s) · ${hs} hotspot(s) · hotspot = focus, Esc = back`;
      wake();
    })
    .catch((error: unknown) => {
      modelError = error instanceof Error ? error.message : String(error);
    });

  const teardown = () => {
    loop.dispose();
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    input.dispose();
    controls.dispose();
    modelLoader.dispose();
    overlay?.dispose();
    toolbar?.dispose();
    stateManager.dispose();
    focus.dispose();
    cam.controller?.dispose();
    engine.dispose();
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
      // Sprint 3 focus / animation hooks.
      focusComponent: (id: string) => focus.focus({ kind: 'component', id }),
      back: () => focus.back(),
      clearFocus: () => focus.clear(),
      focusDepth: () => focus.depth,
      focusTarget: () => focus.getCurrent(),
      cameraIntent: () => resolver.getCameraIntent(),
      cameraPose: () => cam.controller?.getView(),
      cameraTransitioning: () => cam.controller?.isTransitioning() ?? false,
      engineActive: () => engine.hasActive,
      // Sprint 4 state hooks.
      goToState: (id: string) => stateManager.goToState(id),
      goToBase: (id: string) => stateManager.goToBase(id),
      toggleModifier: (id: string, on?: boolean) => stateManager.toggleModifier(id, on),
      resetState: () => stateManager.reset(),
      getBase: () => stateManager.getBase(),
      getModifiers: () => stateManager.getModifiers(),
      serializeState: () => stateManager.serialize(),
      applyState: (snap: { base: string | null; modifiers: readonly string[] }) =>
        stateManager.apply(snap),
      toolbarButtons: () => document.querySelectorAll('.ee-toolbar-item').length,
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
