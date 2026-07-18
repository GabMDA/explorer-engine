# @explorer-engine/renderer-three

The **RendererPort adapter** for Explorer Engine, backed by **Three.js**. This is
the **only** package allowed to import `three` (ENGINE_CONSTITUTION L9 ; ADR-002);
the headless `@explorer-engine/core` depends solely on the `RendererPort` *type*.

- **Statut** : **P1-T1**. Fournit `createThreeRenderer()` — un renderer WebGL
  minimal : canvas (fourni par l'hôte), color space, tone mapping, exposition,
  clear color, pixel ratio (plafonné), `setSize`/resize, `render` (clear) et
  `dispose` propre.
- **Hors P1-T1** : pas de scène, pas de caméra avancée, pas d'orbit, pas d'éclairage
  (P1-T2 et suivantes).
- **Référence** : chapitres 02 (§2.0 ports, §2.3 Renderer), 14 ; ADR-002.

## Utilisation

```ts
import { createThreeRenderer } from '@explorer-engine/renderer-three';
import type { RendererPort } from '@explorer-engine/core';

const canvas = document.querySelector('canvas')!;
const renderer: RendererPort = createThreeRenderer({
  canvas,
  colorSpace: 'srgb',
  toneMapping: 'aces-filmic',
  clearColor: '#101014',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.render();   // efface le buffer (aucune scène en P1-T1)
renderer.dispose();  // libère le contexte WebGL
```
