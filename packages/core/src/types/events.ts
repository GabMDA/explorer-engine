// Typed engine event catalog (ADR-004): maps event name → payload type.
//
// Extended as real modules land. Payloads are data-only and carry no per-frame
// data — hot data flows through ports, never the bus (ENGINE_CONSTITUTION L11).
// The bus is compile-time checked against this map.
import type { BoundingBox } from '../ports/scene-port';
import type { ModelLoadPhase } from '../model/model-loader-port';
import type { UiAction } from '../ports/ui-port';
import type { Vec3 } from '../ports/camera-port';
import type { Address, HotspotAction, ThemeTokens } from '@explorer-engine/schema';

export interface EngineDisposedEvent {
  /** Epoch milliseconds at which disposal occurred. */
  readonly at: number;
}

/** A model load entered a new phase (P2-T2). */
export interface ModelLoadingEvent {
  readonly url: string;
  readonly phase: ModelLoadPhase;
}

/** A model finished loading and was inserted + framed (P2-T2). */
export interface ModelLoadedEvent {
  readonly url: string;
  readonly boundingBox: BoundingBox;
}

/** A model load failed (P2-T2). No backend objects, just a message. */
export interface ModelErrorEvent {
  readonly url: string;
  readonly message: string;
}

/** Selection changed to a component (P4-T1). Discrete — never per-frame (L11). */
export interface SelectionChangedEvent {
  readonly component: string;
}

/** Hover moved to a component, or cleared (`null`). Discrete (L11). */
export interface SelectionHoverEvent {
  readonly component: string | null;
}

/** A hotspot was activated; carries its typed config action (P4-T4). */
export interface HotspotActivatedEvent {
  readonly id: string;
  readonly action: HotspotAction;
}

/** Hover moved to a hotspot, or cleared (`null`). Discrete (L11). */
export interface HotspotHoverEvent {
  readonly id: string | null;
}

/** A focus level was entered (P5-T4). */
export interface FocusStartedEvent {
  readonly target: Address;
}

/** A focus level was exited; `current` is the new top of the stack (or null). */
export interface FocusEndedEvent {
  readonly target: Address;
  readonly current: Address | null;
}

/** A base-state transition is starting (P6-T1). */
export interface StateChangingEvent {
  readonly from: string | null;
  readonly to: string;
}

/** The macroscopic state changed: active base + active modifier ids. */
export interface StateChangedEvent {
  readonly base: string | null;
  readonly modifiers: readonly string[];
}

/** A modifier region was toggled on/off. */
export interface ModifierChangedEvent {
  readonly id: string;
  readonly on: boolean;
}

/** `'light' | 'dark'` — the resolved theme variant (ch.13 §13.4). Defined here
 * (rather than in the Theme Manager) to keep the event catalog a leaf module. */
export type ThemeVariant = 'light' | 'dark';

/** The resolved theme changed (preset switch or system preference change). */
export interface ThemeChangedEvent {
  readonly variant: ThemeVariant;
  readonly tokens: ThemeTokens;
}

/** Live-region politeness (ch.12 §12.8.1, C17 central A11y service). */
export type A11yPoliteness = 'polite' | 'assertive';

/** A single announcement raised through the central announcer. */
export interface A11yAnnounceEvent {
  readonly message: string;
  readonly politeness: A11yPoliteness;
  readonly at: number;
}

/** An entry in the unified alternative-navigation registry (ch.12 §12.8.1). */
export interface A11yNavigableEntry {
  readonly target: Address;
  readonly label: string;
}

/** The alt-nav registry (components/hotspots list) was (re)published. */
export interface A11yNavigableChangedEvent {
  readonly entries: readonly A11yNavigableEntry[];
}

/** The active locale changed (ch.05 §5.3.15, `languageSelect` toolbar item). */
export interface I18nLocaleChangedEvent {
  readonly locale: string;
}

/** A plugin lifecycle hook completed successfully (ch.10 §10.4). */
export interface PluginRegisteredEvent {
  readonly id: string;
}

/** A plugin finished `start` and is now active (ch.10 §10.4). */
export interface PluginStartedEvent {
  readonly id: string;
}

/** A plugin finished `stop`. */
export interface PluginStoppedEvent {
  readonly id: string;
}

/** A plugin finished `dispose` and was released. */
export interface PluginDisposedEvent {
  readonly id: string;
}

/** Where a plugin failed: a lifecycle hook, or the pre-hook resolution pass
 * (missing capability, incompatibility, `orderAfter` cycle — ch.10 §10.5.2). */
export type PluginErrorPhase = 'resolve' | 'register' | 'init' | 'start' | 'stop' | 'dispose';

/** A plugin failed and was isolated (L17) — it never breaks the engine or its
 * siblings. Always logged (L24); never a silent failure. */
export interface PluginErrorEvent {
  readonly id: string;
  readonly phase: PluginErrorPhase;
  readonly message: string;
}

// --- Official plugin events (ch.10 §10.7.1/§10.7.2) — the catalog is the ------
// meeting point between core and official plugins (ADR-004); each plugin's own
// events are registered here, namespaced by its `id` field in the payload so
// multiple instances of the same plugin stay distinguishable.

/** Guided Tour entered a step (ch.10 §10.7.1). */
export interface TourStepEvent {
  readonly id: string;
  readonly index: number;
  readonly total: number;
  readonly target: string;
}

/** Guided Tour finished — naturally, or via an explicit interruption. */
export interface TourCompletedEvent {
  readonly id: string;
  readonly interrupted: boolean;
}

/** Measure recorded one of its two points (ch.10 §10.7.2). */
export interface MeasurePointAddedEvent {
  readonly id: string;
  readonly index: 0 | 1;
  readonly point: Vec3;
}

/** Measure has both points; the distance is final for this measurement. */
export interface MeasureCompletedEvent {
  readonly id: string;
  readonly distance: number;
}

export interface EngineEventMap {
  'engine:disposed': EngineDisposedEvent;
  'model:loading': ModelLoadingEvent;
  'model:loaded': ModelLoadedEvent;
  'model:error': ModelErrorEvent;
  'selection:changed': SelectionChangedEvent;
  'selection:cleared': Record<string, never>;
  'selection:hover': SelectionHoverEvent;
  'hotspot:activated': HotspotActivatedEvent;
  'hotspot:hover': HotspotHoverEvent;
  'focus:started': FocusStartedEvent;
  'focus:ended': FocusEndedEvent;
  'state:changing': StateChangingEvent;
  'state:changed': StateChangedEvent;
  'modifier:changed': ModifierChangedEvent;
  'theme:changed': ThemeChangedEvent;
  'a11y:announce': A11yAnnounceEvent;
  'a11y:navigable-changed': A11yNavigableChangedEvent;
  'i18n:locale-changed': I18nLocaleChangedEvent;
  'ui:action': UiAction;
  'plugin:registered': PluginRegisteredEvent;
  'plugin:started': PluginStartedEvent;
  'plugin:stopped': PluginStoppedEvent;
  'plugin:disposed': PluginDisposedEvent;
  'plugin:error': PluginErrorEvent;
  'tour:step': TourStepEvent;
  'tour:completed': TourCompletedEvent;
  'measure:point-added': MeasurePointAddedEvent;
  'measure:completed': MeasureCompletedEvent;
}
