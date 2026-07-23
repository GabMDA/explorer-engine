export {
  composeVisualState,
  interpolateVisualState,
  visualStateEquals,
  isVisualChannel,
  isIntentChannel,
  REST_VISUAL_STATE,
} from './channels';
export type {
  Channel,
  VisualChannel,
  IntentChannel,
  ChannelValueMap,
  TransformValue,
  ColorOverrideValue,
  OutlineValue,
  VisibilityValue,
  ClipPlane,
  CameraIntentValue,
  LightingIntentValue,
  EffectiveVisualState,
  VisualContribution,
} from './channels';

export { createComponentModel, nodeRefIdentity } from './component-model';
export type { ComponentModel } from './component-model';

export type { RenderStatePort, NodeStateUpdate } from './render-state-port';

export { createRenderStateResolver } from './resolver';
export type {
  RenderStateResolver,
  RenderStateResolverOptions,
  RenderLayer,
  LayerHandle,
  LayerSource,
  ResolvedIntent,
} from './resolver';
