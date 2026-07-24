// UiPort — the contract behind which the 2D DOM overlay lives (chapter 12 §12.1.1,
// decision C3, ENGINE_CONSTITUTION L8). The core pushes DECLARATIVE DESCRIPTORS and
// receives typed `UiAction` intents; it never touches the DOM. The default adapter
// is Web Components (@explorer-engine/ui-webcomponents); a host MAY supply its own
// UiPort implementation (React/Vue) without touching the core.
//
// "Descriptors, not JSX" (ch.12 §12.1.1): a plugin describes its UI with
// `UiDescriptor` trees interpreted by the adapter, so `plugin-sdk` never imports a
// UI framework.
import type { Address, ThemePreset } from '@explorer-engine/schema';

/** A generic, framework-free UI descriptor for plugin-provided content/slots. */
export interface UiDescriptor {
  readonly type: string;
  readonly props?: Readonly<Record<string, unknown>>;
  readonly children?: readonly UiDescriptor[];
}

/** Toolbar item kinds (ch.12 §12.5.1). `custom` carries a plugin `UiDescriptor`. */
export type ToolbarItemKind =
  'stateToggle' | 'resetView' | 'fullscreen' | 'themeToggle' | 'languageSelect' | 'custom';

export interface ToolbarItemDescriptor {
  readonly kind: ToolbarItemKind;
  readonly id: string;
  readonly label: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly descriptor?: UiDescriptor;
}

/** A breadcrumb segment (ch.12 §12.4.1); `target: null` = root/home. */
export interface BreadcrumbSegmentDescriptor {
  readonly label: string;
  readonly target: Address | null;
  readonly current: boolean;
}

/** Panel content block (ch.12 §12.3.2, ch.05 §5.3.11). Textual content is data —
 * sanitization before rendering is the adapter's responsibility (L26). */
export type PanelBlock =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image'; readonly src: string; readonly alt: string }
  | { readonly type: 'video'; readonly src: string; readonly poster?: string }
  | { readonly type: 'audio'; readonly src: string }
  | { readonly type: 'list'; readonly items: readonly string[] }
  | {
      readonly type: 'specs';
      readonly rows: readonly { readonly key: string; readonly value: string }[];
    }
  | { readonly type: 'divider' }
  | { readonly type: 'action'; readonly label: string; readonly actionId: string };

export interface PanelDescriptor {
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly PanelBlock[];
}

/** Loading screen state (ch.12 §12.6.1); `progress` absent = indeterminate. */
export interface LoaderStateDescriptor {
  readonly visible: boolean;
  readonly progress?: number;
  readonly message?: string;
}

/** A hotspot marker, already projected by the renderer (ch.12 §12.1.1, C9 — hot
 * per-frame positions flow through the port, never the event bus). */
export interface HotspotMarkerDescriptor {
  readonly id: string;
  readonly label: string;
  /** Normalized viewport position in `[0, 1]`. */
  readonly x: number;
  readonly y: number;
  readonly occluded: boolean;
  /** Mirrors `HotspotView.state === 'active'` (ch.07 §7.9 — `aria-pressed`). */
  readonly active: boolean;
}

export interface ShellDescriptor {
  readonly title?: string;
  readonly showBreadcrumb: boolean;
}

/**
 * A typed intent the UI raises back to the core (ch.12 §12.10). The UI never
 * drives the scene directly — it only ever reflects state and emits intents.
 */
export type UiAction =
  | { readonly type: 'goToState'; readonly state: string }
  | { readonly type: 'toggleModifier'; readonly id: string }
  | { readonly type: 'focus'; readonly target: Address }
  | { readonly type: 'back' }
  | { readonly type: 'reset' }
  | { readonly type: 'setLocale'; readonly locale: string }
  | { readonly type: 'setThemePreset'; readonly preset: ThemePreset }
  | { readonly type: 'custom'; readonly id: string; readonly payload?: unknown };

/**
 * The contract an adapter implements to materialize the UI overlay. The core only
 * ever calls these methods with plain data; DOM/Shadow DOM/CSS specifics are
 * entirely the adapter's business (L8/L9).
 */
export interface UiPort {
  mountShell(descriptor: ShellDescriptor): void;
  showPanel(descriptor: PanelDescriptor): void;
  hidePanel(id: string): void;
  setToolbar(items: readonly ToolbarItemDescriptor[]): void;
  setBreadcrumb(path: readonly BreadcrumbSegmentDescriptor[]): void;
  setLoader(state: LoaderStateDescriptor): void;
  positionMarkers(markers: readonly HotspotMarkerDescriptor[]): void;
  registerSlot(slotId: string): void;
  renderSlot(slotId: string, descriptor: UiDescriptor | null): void;
  /** Subscribe to user intents raised by the UI. Returns an unsubscribe function. */
  onAction(handler: (action: UiAction) => void): () => void;
  /** Release all DOM nodes/listeners. Idempotent (L20). */
  dispose(): void;
}
