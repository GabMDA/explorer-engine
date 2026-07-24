// Explorer Engine — development playground (Sprint 6: Plugins).
//
// The playground is a GENERIC composition root: it fetches a config.json through
// the Config Loader (core), then builds the scene ENTIRELY from that resolved
// config — lighting, environment, camera, controls, model, AND the interaction +
// focus/animation + state stack (Render State Resolver, Animation Engine, Selection,
// Hotspots, Focus Manager, camera intent controller, State Manager) — PLUS the UI
// overlay (Theme/Accessibility/i18n services + the default UiPort adapter) AND the
// Plugin Manager, which registers the two official reference plugins (Guided Tour,
// Measure) and activates them declaratively via `config.plugins`. There is no
// object-specific code: the same code drives any config (proof of L1/L2).
//
//   ?config=minimal      minimal single-cube config (default)
//   ?config=indexed      multi-node model, exercises the node index (P2-T4)
//   ?config=interactive  components + hotspots + focus, exercises Sprint 2/3
//   ?config=states       bases + modifiers + UI + plugins, Sprint 4/5/6
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
  createThemeManager,
  createAccessibilityService,
  createI18nService,
  createLogger,
  createPluginManager,
  createPluginRenderStateFacade,
  createPerfMetrics,
  createQualityManager,
  EventBus,
  type Address,
  type EngineEventMap,
  type ResolvedConfig,
  type ToolbarItemDescriptor,
  type BreadcrumbSegmentDescriptor,
  type PluginContext,
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
import { createDomUiPort, wireSystemPreferences } from '@explorer-engine/ui-webcomponents';
import { createGuidedTourPlugin } from '@explorer-engine/plugin-guided-tour';
import { createMeasurePlugin } from '@explorer-engine/plugin-measure';

const DEG2RAD = Math.PI / 180;

const CONFIG_PATH = ((): string => {
  const which = new URLSearchParams(window.location.search).get('config');
  if (which === 'indexed') return 'indexed.json';
  if (which === 'states') return 'states.json';
  if (which === 'interactive') return 'interactive.json';
  return 'minimal.json';
})();

/** Approximate progress fraction for the loader bar — the emitted `model:loading`
 * event only carries a discrete phase (chapter 05), not a byte-level fraction. */
const PHASE_PROGRESS: Record<string, number> = {
  fetching: 0.2,
  parsing: 0.45,
  inserting: 0.7,
  framing: 0.9,
  ready: 1,
};

const app = document.querySelector<HTMLDivElement>('#app');

async function boot(app: HTMLDivElement): Promise<void> {
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);
  const caption = document.createElement('p');
  caption.className = 'caption';
  caption.textContent = 'Explorer Engine — loading config…';
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

  const events = new EventBus<EngineEventMap>();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Diagnostics & Quality (Sprint 7, P9-T2): a headless Perf Metrics
  // collector (FPS/frame time/scripting time, zero allocation per frame) feeds
  // a headless Quality Manager that degrades/upgrades a discrete tier by
  // driving ONLY the renderer lever already exposed by RendererPort
  // (setPixelRatio, ch.14 §14.3). Picking desktop vs mobile budget is a HOST
  // decision (the headless core does no device sniffing, L1/L8) — a simple
  // viewport check is enough for this dev playground.
  const perf = createPerfMetrics({ now: () => performance.now() });
  const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
  const perfBudget = isMobileViewport ? config.performance.mobile : config.performance.desktop;
  const quality = createQualityManager({
    levels: config.quality.levels,
    renderer,
    frameBudgetMs: perfBudget.frameBudgetMs,
    initialLevel: config.quality.initialLevel,
    adaptive: config.quality.adaptive,
    events,
  });

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

  // State Manager (headless statechart) → publishes state/modifier layers + intents.
  const stateManager = createStateManager({
    resolver,
    states: config.states,
    initialState: config.initialState,
    events,
  });

  // --- UI (Sprint 5, P7): headless Theme/Accessibility/i18n services + the
  // default UiPort adapter (Web Components, DOM confined to that package). The
  // adapter only ever sees plain descriptors and reports typed UiAction intents
  // over the SAME shared bus every other manager already uses — no manager gains
  // a new dependency, and the core stays entirely headless (L8/L9).
  const themeManager = createThemeManager({ config: config.theme, events });
  const unwireSystemPreferences = wireSystemPreferences(themeManager, (q) => window.matchMedia(q));

  const componentLabel = (id: string): string =>
    config.components.find((c) => c.id === id)?.label ?? id;
  const labelForAddress = (address: Address): string =>
    address.kind === 'component' ? componentLabel(address.id) : address.id;

  // The UiPort's bus subscriptions (theme/a11y) must exist BEFORE any other
  // service publishes, since it only reacts to events — it has no "current state"
  // getters to pull from (mirrors why `initialTokens` exists for theme below).
  const uiPort = createDomUiPort({
    container: document.body,
    events,
    initialTokens: themeManager.getTokens(),
  });
  uiPort.mountShell({ title: config.meta.title ?? 'Explorer Engine', showBreadcrumb: true });

  const a11y = createAccessibilityService({ events, describeTarget: labelForAddress });
  a11y.setNavigable(
    config.components
      .filter((c) => c.selectable)
      .map((c) => ({ target: { kind: 'component', id: c.id } as Address, label: c.label ?? c.id })),
  );

  const i18n = createI18nService({
    locales: config.i18n.locales,
    defaultLocale: config.meta.defaultLocale ?? 'en',
    events,
  });
  // The engine's own chrome strings (not package content) — a package's i18n
  // sources (ch.05 §5.3.15) would flow through the same registerDictionary path.
  i18n.registerDictionary('en', { 'ui.reset': 'Reset' });
  i18n.registerDictionary('fr', { 'ui.reset': 'Réinitialiser' });

  // --- Plugins (Sprint 6, P8): headless Plugin Manager + the two official
  // reference plugins, registered PROGRAMMATICALLY (ch.10 §10.5.1 — the HOST
  // supplies plugin code; a package never does) and ACTIVATED declaratively via
  // `config.plugins` (a package only turns a registered plugin on/off). Each
  // plugin only ever sees the restricted PluginContext facade built here — never
  // a manager directly — and depends only on @explorer-engine/plugin-sdk.
  const logger = createLogger();
  const pluginManager = createPluginManager({ events, logger });
  const guidedTour = createGuidedTourPlugin({ steps: [] });
  const measure = createMeasurePlugin();

  const buildPluginContext = (pluginId: string): PluginContext => {
    const entry = config.plugins.find((p) => p.id === pluginId);
    return {
      pluginId,
      events,
      logger: logger.child(pluginId),
      config: { options: entry?.options ?? {}, resolved: config },
      resolver: createPluginRenderStateFacade(resolver, pluginId),
      components,
      resources: { load: (path: string) => resourceManager.load(path) },
      animation: { play: (animation, opts) => engine.play(animation, opts) },
      focus: {
        focus: (target) => focus.focus(target),
        back: () => focus.back(),
        getCurrent: () => focus.getCurrent(),
      },
      state: {
        goToState: (stateId) => stateManager.goToState(stateId),
        getBase: () => stateManager.getBase(),
        getModifiers: () => stateManager.getModifiers(),
      },
      ui: uiPort,
      raycaster: { pick: (nx: number, ny: number) => raycaster.pick(nx, ny) },
    };
  };

  const isActivated = (id: string): boolean => config.plugins.some((p) => p.id === id && p.enabled);
  if (isActivated('guided-tour')) {
    pluginManager.registerPlugin(guidedTour, () => buildPluginContext('guided-tour'));
  }
  if (isActivated('measure')) {
    pluginManager.registerPlugin(measure, () => buildPluginContext('measure'));
  }

  const renderBreadcrumb = (): void => {
    const stack = focus.getStack();
    const segments: BreadcrumbSegmentDescriptor[] = [
      { label: 'Home', target: null, current: stack.length === 0 },
      ...stack.map((address, i) => ({
        label: labelForAddress(address),
        target: address,
        current: i === stack.length - 1,
      })),
    ];
    uiPort.setBreadcrumb(segments);
  };

  const renderToolbar = (): void => {
    const base = stateManager.getBase();
    const modifiers = stateManager.getModifiers();
    const locales = i18n.getLocales();
    const items: ToolbarItemDescriptor[] = [
      ...config.states
        .filter((s) => s.region === 'base')
        .map((s) => ({
          kind: 'stateToggle' as const,
          id: s.id,
          label: s.label,
          active: s.id === base,
        })),
      ...config.states
        .filter((s) => s.region !== 'base')
        .map((s) => ({
          kind: 'stateToggle' as const,
          id: s.id,
          label: s.label,
          active: modifiers.includes(s.id),
        })),
      { kind: 'resetView', id: 'reset', label: i18n.translate({ $t: 'ui.reset' }) },
      {
        kind: 'themeToggle',
        id: 'theme',
        label: themeManager.getVariant() === 'dark' ? 'Light' : 'Dark',
      },
      ...(locales.length > 1
        ? locales.map((locale) => ({
            kind: 'languageSelect' as const,
            id: locale,
            label: locale.toUpperCase(),
            active: locale === i18n.getLocale(),
          }))
        : []),
    ];
    const active = pluginManager.getActivePluginIds();
    if (active.includes('guided-tour')) {
      items.push(
        {
          kind: 'custom',
          id: 'guided-tour-next',
          label: guidedTour.getCurrentStepIndex() === null ? 'Start Tour' : 'Next Step',
        },
        {
          kind: 'custom',
          id: 'guided-tour-stop',
          label: 'Stop Tour',
          disabled: guidedTour.getCurrentStepIndex() === null,
        },
      );
    }
    if (active.includes('measure')) {
      items.push({
        kind: 'custom',
        id: 'measure-toggle',
        label: measure.isActive() ? 'Measure: ON' : 'Measure: OFF',
        active: measure.isActive(),
      });
    }
    items.push({ kind: 'fullscreen', id: 'fullscreen', label: 'Fullscreen' });
    uiPort.setToolbar(items);
  };

  const showPanelFor = (address: Address): void => {
    uiPort.showPanel({
      id: address.id,
      title: labelForAddress(address),
      blocks: [{ type: 'text', text: `${address.kind} · ${address.id}` }],
    });
  };

  renderBreadcrumb();
  renderToolbar();

  // React to interaction events (typed bus). A hotspot `focus` action now drives
  // the Focus Manager (camera transition + dim/outline); `emit` is just reported.
  events.on('selection:changed', (e) => (caption.textContent = `Selected: ${e.component}`));
  events.on('focus:started', (e) => {
    caption.textContent = `Focus → ${e.target.id} · Esc = back`;
    renderBreadcrumb();
    showPanelFor(e.target);
    wake();
  });
  events.on('focus:ended', (e) => {
    caption.textContent = e.current ? `Focus → ${e.current.id} · Esc = back` : `Overview`;
    renderBreadcrumb();
    uiPort.hidePanel(e.target.id);
    if (e.current) showPanelFor(e.current);
    wake();
  });
  events.on('hotspot:activated', (e) => {
    if (e.action.type === 'focus') focus.focus(e.action.target);
    else if (e.action.type === 'goToState') stateManager.goToState(e.action.state);
    else caption.textContent = `Hotspot ${e.id} → ${e.action.type}`;
    wake();
  });
  // Keep the toolbar/breadcrumb in sync with the macroscopic state / theme / locale.
  events.on('state:changed', (e) => {
    renderToolbar();
    caption.textContent = `State: ${e.base ?? 'rest'}${e.modifiers.length ? ' + ' + e.modifiers.join(', ') : ''}`;
    wake();
  });
  events.on('theme:changed', () => renderToolbar());
  events.on('i18n:locale-changed', () => renderToolbar());
  // Keep the toolbar's plugin buttons (label/enabled state) in sync.
  events.on('tour:step', () => renderToolbar());
  events.on('tour:completed', () => renderToolbar());
  events.on('measure:point-added', () => renderToolbar());
  events.on('measure:completed', () => renderToolbar());
  // NOTE: no separate `plugin:error` listener here — the Plugin Manager already
  // logs every isolated failure through this SAME `logger` instance (L24);
  // adding another would just duplicate the diagnostic.
  events.on('model:loading', (e) => {
    uiPort.setLoader({
      visible: true,
      progress: PHASE_PROGRESS[e.phase],
      message: `Loading… (${e.phase})`,
    });
  });
  events.on('model:loaded', () => uiPort.setLoader({ visible: false }));
  events.on('model:error', (e) => {
    caption.textContent = `Explorer Engine — model error: ${e.message}`;
    uiPort.setLoader({ visible: false });
  });

  // Turns UI-raised intents into calls on the headless managers (ch.12 §12.10) —
  // the adapter itself never reaches into the engine directly.
  uiPort.onAction((action) => {
    switch (action.type) {
      case 'goToState': {
        const definition = config.states.find((s) => s.id === action.state);
        // A modifier toolbar item must TOGGLE (goToState always turns a modifier
        // ON) — the descriptor doesn't carry region info, so resolve it here.
        if (definition && definition.region !== 'base') stateManager.toggleModifier(action.state);
        else stateManager.goToState(action.state);
        wake();
        break;
      }
      case 'toggleModifier':
        stateManager.toggleModifier(action.id);
        wake();
        break;
      case 'reset':
        focus.clear();
        selection.clearSelection();
        stateManager.reset();
        wake();
        break;
      case 'back':
        if (focus.depth > 0) {
          focus.back();
          wake();
        }
        break;
      case 'focus':
        focus.focus(action.target);
        wake();
        break;
      case 'setThemePreset':
        themeManager.setPreset(action.preset);
        break;
      case 'setLocale':
        i18n.setLocale(action.locale);
        break;
      case 'custom':
        if (action.id === 'hotspot' && action.payload && typeof action.payload === 'object') {
          const hotspotId = (action.payload as { hotspotId?: unknown }).hotspotId;
          if (typeof hotspotId === 'string') hotspots.activate(hotspotId);
          wake();
        } else if (action.id === 'guided-tour-next') {
          if (guidedTour.getCurrentStepIndex() === null) guidedTour.startTour();
          else guidedTour.next();
          wake();
        } else if (action.id === 'guided-tour-stop') {
          guidedTour.stopTour();
          wake();
        } else if (action.id === 'measure-toggle') {
          measure.setActive(!measure.isActive());
          renderToolbar();
        }
        break;
    }
  });

  // Generic status slot (node count once the model loads) — unrelated to any
  // specific plugin, just a demonstration of the descriptor-based slot mechanism.
  uiPort.registerSlot('status');

  // On-demand render loop (P1-T5): advance animations, compose visual state, project
  // hotspots, draw. The loop stays alive while an animation is active, then goes
  // dormant (frame ownership, chapter 11 §11.8.1 / L18) — no permanent 60 FPS loop.
  const loop = createRenderLoop({
    scheduler: {
      request: (cb) => requestAnimationFrame(cb),
      cancel: (id) => cancelAnimationFrame(id),
    },
    render: () => {
      perf.beginFrame();
      renderCount += 1;
      engine.update(performance.now()); // advance tweens/timelines (camera + RSR fades)
      const moving = controls.update();
      resolver.flush(); // push composed visual state to the applicator (dirty only)
      if (hotspots.count > 0) {
        hotspots.applyProjection(projector.project(hotspots.anchors()));
        const { width, height } = renderer.getSize();
        uiPort.positionMarkers(
          hotspots
            .view()
            .filter((v) => v.visible)
            .map((v) => ({
              id: v.id,
              label: v.label,
              x: v.x / width,
              y: v.y / height,
              occluded: v.occluded,
            })),
        );
      }
      renderer.render(scene, camera);
      perf.endFrame();
      quality.sample(perf.frameTimeMs);
      if (moving || engine.hasActive) loop.requestRender();
    },
  });

  // Developer performance/quality overlay (ch.14 §14.8): a plain DOM-confined
  // HUD, refreshed on its OWN low-frequency ticker — never every frame, since
  // polling `renderer.getStats()` and writing to the DOM that often would
  // itself be exactly the kind of per-frame overhead chapter 14 warns against.
  // Enabled via `config.performance.overlay` or `?perf=1` for quick local use.
  const perfOverlayEnabled =
    config.performance.overlay || new URLSearchParams(window.location.search).get('perf') === '1';
  const perfOverlay = document.createElement('pre');
  perfOverlay.className = 'ee-perf-overlay';
  let perfOverlayInterval: number | undefined;
  if (perfOverlayEnabled) {
    document.body.appendChild(perfOverlay);
    perfOverlayInterval = window.setInterval(() => {
      perf.setRendererStats(renderer.getStats?.() ?? null);
      const snap = perf.snapshot();
      const lines = [
        `FPS: ${snap.fps.toFixed(1)}`,
        `Frame: ${snap.frameTimeMs.toFixed(2)} ms`,
        `Script: ${snap.scriptingTimeMs.toFixed(2)} ms`,
        `Quality: ${quality.level}${quality.adaptive ? '' : ' (manual)'}`,
      ];
      if (snap.rendererStats) {
        lines.push(
          `Draw calls: ${snap.rendererStats.drawCalls}`,
          `Triangles: ${snap.rendererStats.triangles}`,
          `Geometries: ${snap.rendererStats.geometries}`,
          `Textures: ${snap.rendererStats.textures}`,
        );
      }
      perfOverlay.textContent = lines.join('\n');
    }, 500);
  }

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
    // Reuses the SAME pick gesture the existing Selection system already
    // computes (sans modifier son architecture) — Measure just consumes it
    // instead of Selection while its own mode is active.
    if (measure.isActive()) {
      measure.pickAt(nx, ny);
      wake();
      return;
    }
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
    .then(async () => {
      const n = scene.getNodeIndex()?.size ?? 0;
      const hs = hotspots.count;
      // Seed the camera "home" pose from the auto-framing, so exiting a focus
      // returns to the overview (recomposition, not imperative restore).
      const view = controls.getView();
      cam.controller?.setHome(view.position, view.target);
      caption.textContent = `Explorer Engine — ${config.meta.title ?? 'model'} · ${n} node(s) · ${hs} hotspot(s) · hotspot = focus, Esc = back`;
      uiPort.renderSlot('status', {
        type: 'div',
        props: { class: 'ee-status-slot', text: `${n} node(s) loaded` },
      });
      // Plugins start once "the experience is ready" (ch.10 §10.4) — resolves
      // capabilities/orderAfter/incompatibilities, then register->init->start
      // each activated plugin, isolating any failure (L17) without affecting
      // the others or the engine.
      await pluginManager.start();
      renderToolbar(); // reveal any plugin toolbar buttons now that they're active
      wake();
    })
    .catch((error: unknown) => {
      modelError = error instanceof Error ? error.message : String(error);
    });

  const teardown = async () => {
    loop.dispose();
    if (perfOverlayInterval !== undefined) window.clearInterval(perfOverlayInterval);
    perfOverlay.remove();
    quality.dispose();
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    input.dispose();
    controls.dispose();
    modelLoader.dispose();
    // Plugins first — their own dispose hooks may still touch the resolver/UI/
    // events, which must stay alive until every plugin has released everything.
    await pluginManager.dispose();
    unwireSystemPreferences();
    uiPort.dispose();
    themeManager.dispose();
    a11y.dispose();
    i18n.dispose();
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
    const shellShadow = () => document.querySelector('ee-ui-shell')?.shadowRoot ?? null;
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
      markerCount: () => shellShadow()?.querySelectorAll('.ee-marker').length ?? 0,
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
      toolbarButtonLabels: () =>
        Array.from(shellShadow()?.querySelectorAll('.ee-toolbar-item') ?? []).map(
          (b) => b.textContent,
        ),
      // Sprint 5 UI hooks.
      uiPort: () => uiPort,
      themeVariant: () => themeManager.getVariant(),
      setThemePreset: (preset: 'light' | 'dark' | 'auto') => themeManager.setPreset(preset),
      locale: () => i18n.getLocale(),
      setLocale: (locale: string) => i18n.setLocale(locale),
      announce: (message: string) => a11y.announce(message),
      livePoliteText: () => shellShadow()?.querySelector('.ee-live-polite')?.textContent ?? null,
      breadcrumbLabels: () =>
        Array.from(shellShadow()?.querySelectorAll('.ee-breadcrumb button') ?? []).map(
          (b) => b.textContent,
        ),
      panelIds: () =>
        Array.from(shellShadow()?.querySelectorAll('.ee-panel') ?? []).map((p) =>
          p.getAttribute('aria-label'),
        ),
      loaderVisible: () =>
        shellShadow()?.querySelector('.ee-loader')?.hasAttribute('hidden') === false,
      navlistEntries: () =>
        Array.from(shellShadow()?.querySelectorAll('.ee-navlist li button') ?? []).map(
          (b) => b.textContent,
        ),
      statusSlotText: () =>
        shellShadow()?.querySelector('[data-slot="status"]')?.textContent ?? null,
      // Sprint 6 plugin hooks.
      pluginManager: () => pluginManager,
      activePluginIds: () => pluginManager.getActivePluginIds(),
      guidedTour: () => guidedTour,
      measure: () => measure,
      tourStatusText: () =>
        shellShadow()?.querySelector('[data-slot="guided-tour-status"]')?.textContent ?? null,
      measureOverlayText: () =>
        shellShadow()?.querySelector('[data-slot="measure-overlay"]')?.textContent ?? null,
      // Sprint 7 diagnostics / quality hooks.
      perfMetrics: () => perf,
      qualityManager: () => quality,
      perfSnapshot: () => perf.snapshot(),
      perfOverlayEnabled: () => perfOverlayEnabled,
      perfOverlayText: () => (perfOverlayEnabled ? perfOverlay.textContent : null),
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
