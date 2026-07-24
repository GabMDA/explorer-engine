// Shell stylesheet (ch.12 §12.2, §12.7 responsive, §12.11 rule 2). EVERY visual
// property is a `var(--ee-<token>, <fallback>)` reference — the fallback matches
// the engine's default light tokens so the shell isn't unstyled before the first
// `theme:changed` (or `initialTokens`) arrives. Encapsulated in the Shadow DOM, so
// none of this leaks into (or is affected by) the host page (ch.12 §12.1.1).
export const SHELL_STYLES = `
  :host {
    position: absolute;
    inset: 0;
    pointer-events: none;
    font-family: var(--ee-fontFamily, 'Inter', system-ui, sans-serif);
    font-size: var(--ee-fontSizeMd, 15px);
    color: var(--ee-colorText, #14161a);
    --ee-transition-fast: var(--ee-durationFast, 120ms);
  }
  * { box-sizing: border-box; }
  button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    cursor: pointer;
  }
  .ee-shell { position: absolute; inset: 0; }

  .ee-topbar {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--ee-space-4, 16px);
    padding: var(--ee-space-2, 8px) var(--ee-space-4, 16px);
    background: var(--ee-colorSurface, #f5f6f8);
    border-bottom: var(--ee-borderWidth, 1px) solid var(--ee-colorBorder, #d8dbe2);
  }
  .ee-title { font-weight: var(--ee-fontWeightBold, 700); }
  .ee-breadcrumb { display: flex; align-items: center; gap: var(--ee-space-1, 4px); flex: 1; }
  .ee-breadcrumb button {
    padding: var(--ee-space-1, 4px) var(--ee-space-2, 8px);
    border-radius: var(--ee-radiusSm, 4px);
  }
  .ee-breadcrumb button[aria-current="true"] { font-weight: var(--ee-fontWeightMedium, 500); }
  .ee-breadcrumb button:hover,
  .ee-breadcrumb button:focus-visible { background: var(--ee-colorBorder, #d8dbe2); }
  .ee-breadcrumb[hidden] { display: none; }

  .ee-toolbar {
    pointer-events: auto;
    display: flex;
    gap: var(--ee-space-2, 8px);
  }
  .ee-toolbar-item {
    padding: var(--ee-space-1, 4px) var(--ee-space-3, 12px);
    border-radius: var(--ee-radiusMd, 8px);
    border: var(--ee-borderWidth, 1px) solid var(--ee-colorBorder, #d8dbe2);
    transition: background var(--ee-transition-fast) var(--ee-easingDefault, ease-in-out);
  }
  .ee-toolbar-item[aria-pressed="true"] {
    background: var(--ee-colorAccent, #0b63ce);
    color: var(--ee-colorBackground, #fff);
  }
  .ee-toolbar-item:disabled { opacity: 0.5; cursor: not-allowed; }

  .ee-markers { position: absolute; inset: 0; pointer-events: none; }
  .ee-marker {
    position: absolute;
    transform: translate(-50%, -50%);
    width: var(--ee-hotspotSize, 14px);
    height: var(--ee-hotspotSize, 14px);
    border-radius: var(--ee-radiusFull, 9999px);
    background: var(--ee-hotspotColor, #0b63ce);
    pointer-events: auto;
  }
  .ee-marker[aria-pressed="true"] { background: var(--ee-hotspotColorActive, #0b63ce); }
  .ee-marker--occluded { opacity: 0.35; }

  .ee-panels {
    pointer-events: auto;
    position: absolute;
    top: var(--ee-space-4, 16px);
    right: var(--ee-space-4, 16px);
    bottom: var(--ee-space-4, 16px);
    width: 320px;
    display: flex;
    flex-direction: column;
    gap: var(--ee-space-3, 12px);
    overflow: auto;
  }
  .ee-panel {
    background: var(--ee-colorSurface, #f5f6f8);
    border-radius: var(--ee-radiusLg, 16px);
    box-shadow: var(--ee-shadowMd, 0 4px 12px rgba(0,0,0,0.12));
    padding: var(--ee-space-4, 16px);
  }
  .ee-panel-header { display: flex; justify-content: space-between; align-items: center; }
  .ee-panel-title { font-weight: var(--ee-fontWeightBold, 700); }
  .ee-block-text { line-height: var(--ee-lineHeightBase, 1.5); }
  .ee-block-image, .ee-block-video { max-width: 100%; border-radius: var(--ee-radiusSm, 4px); }
  .ee-block-specs td, .ee-block-specs th { text-align: left; padding: var(--ee-space-1, 4px) 0; }

  @media (max-width: 640px) {
    .ee-panels { left: 0; right: 0; top: auto; bottom: 0; width: auto; max-height: 50%; }
  }

  .ee-loader {
    pointer-events: auto;
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--ee-space-3, 12px);
    background: var(--ee-colorBackground, #fff);
    transition: opacity var(--ee-durationSlow, 400ms) var(--ee-easingDefault, ease-in-out);
  }
  .ee-loader[hidden] { display: none; }
  .ee-loader-bar {
    width: 200px;
    height: 4px;
    border-radius: var(--ee-radiusFull, 9999px);
    background: var(--ee-colorBorder, #d8dbe2);
    overflow: hidden;
  }
  .ee-loader-fill { height: 100%; background: var(--ee-colorAccent, #0b63ce); }
  .ee-loader--indeterminate .ee-loader-fill { width: 40% !important; }

  .ee-navlist-toggle-wrap { position: absolute; bottom: var(--ee-space-4, 16px); left: var(--ee-space-4, 16px); }
  .ee-navlist-toggle {
    pointer-events: auto;
    padding: var(--ee-space-1, 4px) var(--ee-space-3, 12px);
    border-radius: var(--ee-radiusMd, 8px);
    border: var(--ee-borderWidth, 1px) solid var(--ee-colorBorder, #d8dbe2);
    background: var(--ee-colorSurface, #f5f6f8);
  }
  .ee-navlist {
    pointer-events: auto;
    position: absolute;
    bottom: calc(var(--ee-space-4, 16px) * 3);
    left: var(--ee-space-4, 16px);
    background: var(--ee-colorSurface, #f5f6f8);
    border-radius: var(--ee-radiusMd, 8px);
    box-shadow: var(--ee-shadowMd, 0 4px 12px rgba(0,0,0,0.12));
    padding: var(--ee-space-2, 8px);
    max-height: 40vh;
    overflow: auto;
  }
  .ee-navlist[hidden] { display: none; }
  .ee-navlist ul { list-style: none; margin: 0; padding: 0; }
  .ee-navlist button { display: block; width: 100%; text-align: left; padding: var(--ee-space-1, 4px) var(--ee-space-2, 8px); }

  .ee-live-polite, .ee-live-assertive {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (forced-colors: active) {
    .ee-toolbar-item, .ee-panel, .ee-loader-bar, .ee-navlist { forced-color-adjust: none; border: 1px solid CanvasText; }
  }
`;
