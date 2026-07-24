// Public API of @explorer-engine/ui-webcomponents — the default UiPort adapter
// (ch.12 §12.1.1). Depends only on @explorer-engine/core; no UI framework.
export { createDomUiPort } from './dom-ui-port';
export type { DomUiPortOptions } from './dom-ui-port';

export { applyThemeTokens, themeTokensToCssText, cssVarName } from './theme-css-vars';

export { wireSystemPreferences } from './system-preferences';
export type { MatchMediaLike, MediaQueryLike } from './system-preferences';

export { isSafeUrl } from './safe-url';
export { buildBlockElement } from './panel-blocks';
export { renderDescriptor, isSafeTag, isSafeAttr } from './descriptor-renderer';
