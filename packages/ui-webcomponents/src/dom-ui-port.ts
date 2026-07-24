// createDomUiPort — the default UiPort implementation (ch.12 §12.1.1), a native
// Custom Element with an encapsulated Shadow DOM. It only ever receives plain
// descriptors and reports typed UiAction intents (ch.12 §12.10): it NEVER reaches
// into the engine directly. Reacts to the three Phase-1 headless services over the
// shared, typed event bus (ADR-004) — theme:changed, a11y:announce,
// a11y:navigable-changed — so a host only has to wire outgoing actions.
import type {
  BreadcrumbSegmentDescriptor,
  EngineEventMap,
  EventBus,
  HotspotMarkerDescriptor,
  LoaderStateDescriptor,
  PanelDescriptor,
  ShellDescriptor,
  ThemeTokens,
  ThemeVariant,
  ToolbarItemDescriptor,
  UiAction,
  UiDescriptor,
  UiPort,
  Unsubscribe,
} from '@explorer-engine/core';
import { SHELL_STYLES } from './shell-styles';
import { applyThemeTokens } from './theme-css-vars';
import { buildBlockElement } from './panel-blocks';
import { renderDescriptor } from './descriptor-renderer';

const TAG = 'ee-ui-shell';

// The shell's own chrome markup — a FIXED, engine-authored constant (never
// interpolates config/package data), so `innerHTML` here is not an L26 concern;
// all untrusted content elsewhere in this module goes through textContent/attrs.
const SHELL_TEMPLATE = `
  <style>${SHELL_STYLES}</style>
  <div class="ee-shell">
    <header class="ee-topbar">
      <span class="ee-title"></span>
      <nav class="ee-breadcrumb" aria-label="Breadcrumb"></nav>
      <div class="ee-toolbar" role="toolbar" aria-label="View controls"></div>
    </header>
    <div class="ee-markers"></div>
    <div class="ee-panels"></div>
    <div class="ee-loader" hidden>
      <div class="ee-loader-bar"><div class="ee-loader-fill"></div></div>
      <p class="ee-loader-message"></p>
    </div>
    <div class="ee-slots"></div>
    <div class="ee-navlist-toggle-wrap">
      <button type="button" class="ee-navlist-toggle" aria-expanded="false">Component list</button>
    </div>
    <nav class="ee-navlist" aria-label="Component list" hidden><ul></ul></nav>
    <div class="ee-live-polite" aria-live="polite"></div>
    <div class="ee-live-assertive" aria-live="assertive"></div>
  </div>
`;

interface ShellRefs {
  readonly title: HTMLElement;
  readonly breadcrumb: HTMLElement;
  readonly toolbar: HTMLElement;
  readonly markers: HTMLElement;
  readonly panels: HTMLElement;
  readonly loader: HTMLElement;
  readonly loaderFill: HTMLElement;
  readonly loaderMessage: HTMLElement;
  readonly slots: HTMLElement;
  readonly navlistToggle: HTMLButtonElement;
  readonly navlist: HTMLElement;
  readonly navlistList: HTMLElement;
  readonly livePolite: HTMLElement;
  readonly liveAssertive: HTMLElement;
}

class EeUiShellElement extends HTMLElement {
  readonly refs: ShellRefs;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = SHELL_TEMPLATE;
    const q = <T extends HTMLElement>(selector: string): T => {
      const found = shadow.querySelector<T>(selector);
      if (found === null) throw new Error(`ee-ui-shell: missing "${selector}" in template`);
      return found;
    };
    this.refs = {
      title: q('.ee-title'),
      breadcrumb: q('.ee-breadcrumb'),
      toolbar: q('.ee-toolbar'),
      markers: q('.ee-markers'),
      panels: q('.ee-panels'),
      loader: q('.ee-loader'),
      loaderFill: q('.ee-loader-fill'),
      loaderMessage: q('.ee-loader-message'),
      slots: q('.ee-slots'),
      navlistToggle: q('.ee-navlist-toggle'),
      navlist: q('.ee-navlist'),
      navlistList: q('.ee-navlist ul'),
      livePolite: q('.ee-live-polite'),
      liveAssertive: q('.ee-live-assertive'),
    };
  }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG)) {
  customElements.define(TAG, EeUiShellElement);
}

export interface DomUiPortOptions {
  /** Where the shell mounts (typically overlaying the renderer's canvas). */
  readonly container: HTMLElement;
  /** The shared typed event bus (ADR-004) — reacts to theme/a11y events. */
  readonly events: EventBus<EngineEventMap>;
  /** Applied immediately at mount, before the first `theme:changed` (avoids an
   * unstyled flash — pass `themeManager.getTokens()`). */
  readonly initialTokens?: ThemeTokens;
}

function button(className: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  return el;
}

/** Native Custom Element / Shadow DOM implementation of {@link UiPort}. */
export function createDomUiPort(options: DomUiPortOptions): UiPort {
  const { container, events } = options;
  const shell = document.createElement(TAG) as EeUiShellElement;
  container.appendChild(shell);
  const { refs } = shell;

  if (options.initialTokens) applyThemeTokens(shell, options.initialTokens);

  let disposed = false;
  let lastVariant: ThemeVariant = 'light';
  const actionHandlers = new Set<(action: UiAction) => void>();
  const panelElements = new Map<string, HTMLElement>();
  const markerElements = new Map<string, HTMLButtonElement>();
  const slotElements = new Map<string, HTMLElement>();
  const domListeners: (() => void)[] = [];

  const emitAction = (action: UiAction): void => {
    for (const handler of actionHandlers) handler(action);
  };

  const listen = <K extends keyof HTMLElementEventMap>(
    target: EventTarget,
    type: K,
    handler: (event: Event) => void,
  ): void => {
    target.addEventListener(type, handler);
    domListeners.push(() => target.removeEventListener(type, handler));
  };

  // --- theme:changed → CSS custom properties on the host (ch.13) -----------------
  const busUnsubscribers: Unsubscribe[] = [
    events.on('theme:changed', ({ variant, tokens }) => {
      lastVariant = variant;
      applyThemeTokens(shell, tokens);
    }),
    // --- a11y:announce → the single live region for the given politeness (C17) ---
    events.on('a11y:announce', ({ message, politeness }) => {
      const region = politeness === 'assertive' ? refs.liveAssertive : refs.livePolite;
      region.textContent = message;
    }),
    // --- a11y:navigable-changed → the alternative navigation list (C17) ----------
    events.on('a11y:navigable-changed', ({ entries }) => {
      refs.navlistList.replaceChildren();
      for (const entry of entries) {
        const li = document.createElement('li');
        const btn = button('');
        btn.textContent = entry.label;
        btn.addEventListener('click', () => emitAction({ type: 'focus', target: entry.target }));
        li.appendChild(btn);
        refs.navlistList.appendChild(li);
      }
    }),
  ];

  listen(refs.navlistToggle, 'click', () => {
    const nowHidden = !refs.navlist.hidden;
    refs.navlist.hidden = nowHidden;
    refs.navlistToggle.setAttribute('aria-expanded', String(!nowHidden));
  });

  const port: UiPort = {
    mountShell(descriptor: ShellDescriptor) {
      if (disposed) return;
      refs.title.textContent = descriptor.title ?? '';
      refs.breadcrumb.hidden = !descriptor.showBreadcrumb;
    },

    showPanel(descriptor: PanelDescriptor) {
      if (disposed) return;
      const existing = panelElements.get(descriptor.id);
      const panel = existing ?? document.createElement('section');
      panel.className = 'ee-panel';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', descriptor.title);
      panel.replaceChildren();

      const header = document.createElement('div');
      header.className = 'ee-panel-header';
      const title = document.createElement('h2');
      title.className = 'ee-panel-title';
      title.textContent = descriptor.title;
      const close = button('ee-panel-close');
      close.setAttribute('aria-label', 'Close panel');
      close.textContent = '×';
      close.addEventListener('click', () => emitAction({ type: 'back' }));
      header.append(title, close);
      panel.appendChild(header);

      for (const block of descriptor.blocks) {
        panel.appendChild(
          buildBlockElement(block, (actionId) =>
            emitAction({
              type: 'custom',
              id: 'panel-action',
              payload: { panelId: descriptor.id, actionId },
            }),
          ),
        );
      }

      if (!existing) {
        panelElements.set(descriptor.id, panel);
        refs.panels.appendChild(panel);
      }
    },

    hidePanel(id: string) {
      if (disposed) return;
      const panel = panelElements.get(id);
      if (!panel) return;
      panel.remove();
      panelElements.delete(id);
    },

    setToolbar(items: readonly ToolbarItemDescriptor[]) {
      if (disposed) return;
      refs.toolbar.replaceChildren();
      for (const item of items) {
        const btn = button('ee-toolbar-item');
        btn.textContent = item.label;
        btn.disabled = item.disabled ?? false;
        if (item.active !== undefined) btn.setAttribute('aria-pressed', String(item.active));
        btn.addEventListener('click', () => {
          switch (item.kind) {
            case 'stateToggle':
              emitAction({ type: 'goToState', state: item.id });
              return;
            case 'resetView':
              emitAction({ type: 'reset' });
              return;
            case 'fullscreen':
              if (document.fullscreenElement) void document.exitFullscreen();
              else void container.requestFullscreen?.();
              return;
            case 'themeToggle':
              emitAction({
                type: 'setThemePreset',
                preset: lastVariant === 'dark' ? 'light' : 'dark',
              });
              return;
            case 'languageSelect':
              emitAction({ type: 'setLocale', locale: item.id });
              return;
            case 'custom':
              emitAction({ type: 'custom', id: item.id });
              return;
          }
        });
        if (item.kind === 'custom' && item.descriptor)
          btn.appendChild(renderDescriptor(item.descriptor));
        refs.toolbar.appendChild(btn);
      }
    },

    setBreadcrumb(path: readonly BreadcrumbSegmentDescriptor[]) {
      if (disposed) return;
      refs.breadcrumb.replaceChildren();
      path.forEach((segment) => {
        const btn = button('');
        btn.textContent = segment.label;
        if (segment.current) btn.setAttribute('aria-current', 'true');
        btn.addEventListener('click', () => {
          if (segment.current) return;
          if (segment.target === null) emitAction({ type: 'reset' });
          else emitAction({ type: 'focus', target: segment.target });
        });
        refs.breadcrumb.appendChild(btn);
      });
    },

    setLoader(state: LoaderStateDescriptor) {
      if (disposed) return;
      refs.loader.hidden = !state.visible;
      refs.loader.classList.toggle('ee-loader--indeterminate', state.progress === undefined);
      refs.loaderFill.style.width = `${Math.round((state.progress ?? 0) * 100)}%`;
      refs.loaderMessage.textContent = state.message ?? '';
    },

    positionMarkers(markers: readonly HotspotMarkerDescriptor[]) {
      if (disposed) return;
      const seen = new Set<string>();
      for (const marker of markers) {
        seen.add(marker.id);
        let el = markerElements.get(marker.id);
        if (!el) {
          el = button('ee-marker');
          el.addEventListener('click', () => {
            const current = markerElements.get(marker.id);
            emitAction({
              type: 'custom',
              id: 'hotspot',
              payload: { hotspotId: marker.id, active: current?.getAttribute('aria-pressed') },
            });
          });
          markerElements.set(marker.id, el);
          refs.markers.appendChild(el);
        }
        el.style.left = `${marker.x * 100}%`;
        el.style.top = `${marker.y * 100}%`;
        el.setAttribute('aria-label', marker.label);
        el.classList.toggle('ee-marker--occluded', marker.occluded);
        el.tabIndex = marker.occluded ? -1 : 0;
      }
      for (const [id, el] of markerElements) {
        if (!seen.has(id)) {
          el.remove();
          markerElements.delete(id);
        }
      }
    },

    registerSlot(slotId: string) {
      if (disposed || slotElements.has(slotId)) return;
      const el = document.createElement('div');
      el.dataset['slot'] = slotId;
      slotElements.set(slotId, el);
      refs.slots.appendChild(el);
    },

    renderSlot(slotId: string, descriptor: UiDescriptor | null) {
      if (disposed) return;
      let el = slotElements.get(slotId);
      if (!el) {
        el = document.createElement('div');
        el.dataset['slot'] = slotId;
        slotElements.set(slotId, el);
        refs.slots.appendChild(el);
      }
      el.replaceChildren();
      if (descriptor) el.appendChild(renderDescriptor(descriptor));
    },

    onAction(handler: (action: UiAction) => void) {
      actionHandlers.add(handler);
      return () => actionHandlers.delete(handler);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const unsubscribe of busUnsubscribers) unsubscribe();
      for (const removeListener of domListeners) removeListener();
      actionHandlers.clear();
      panelElements.clear();
      markerElements.clear();
      slotElements.clear();
      shell.remove();
    },
  };

  return port;
}
