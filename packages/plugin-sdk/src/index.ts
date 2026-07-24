// @explorer-engine/plugin-sdk — the ONLY dependency an Explorer Engine plugin may
// take (ch.03 §3.4, ch.10, ADR-006: "un plugin dépend uniquement du plugin-sdk,
// jamais des internes du core"). This is a PURE re-export façade over
// @explorer-engine/core's plugin contract and the supporting types a plugin body
// needs — it adds no logic of its own. Headless (same guard as core/schema):
// no DOM, no Three.js, no UI framework.
export type {
  // The plugin contract + the façade the Plugin Manager hands to every hook.
  Plugin,
  PluginContext,
  PluginRenderStateFacade,
  PluginFocusFacade,
  PluginStateFacade,
  // Typed addressing (targets for focus/layers) and geometry.
  Address,
  Vec3,
  // Render State Resolver vocabulary — for building layer contributions.
  Channel,
  VisualChannel,
  IntentChannel,
  ChannelValueMap,
  RenderLayer,
  LayerHandle,
  // UI extension points (slots) — descriptor content, never JSX/a framework.
  UiDescriptor,
  // Read-only picking (world-space hit point).
  PickHit,
  // The shared typed event catalog (ADR-004) and subscription helpers, so a
  // plugin can type its own `ctx.events.on(...)` subscriptions and clean them
  // up in `dispose` (ch.10 §10.8 rule 2).
  EngineEventMap,
  EventHandler,
  Unsubscribe,
} from '@explorer-engine/core';
