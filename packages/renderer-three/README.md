# @explorer-engine/renderer-three

The **RendererPort adapter** for Explorer Engine, backed by **Three.js**. This is
the **only** package allowed to import `three` (ENGINE_CONSTITUTION L9 ; ADR-002);
the headless `@explorer-engine/core` depends solely on the port *types*.

- **Statut** : **P1-T2**. Fournit :
  - `createThreeRenderer()` — renderer WebGL (`RendererPort`) : color space, tone
    mapping, clear color, pixel ratio plafonné, `setSize`/resize, `render(scene, camera)`,
    `dispose` propre.
  - `createSceneManager()` / `createDemoScene()` — **Scene Manager** (`ScenePort`) :
    graphe de scène, bounding box, dispose ; `createDemoScene` construit un cube unité
    éclairé, en code, sans asset externe.
  - `createCameraManager()` — **Camera Manager** (`CameraPort`) : caméra perspective,
    `setAspect` (resize), `setView`.
- **Hors P1-T2** : pas de contrôles souris, pas de chargement GLB, pas de boucle
  d'animation continue (P1-T3+).
- **Référence** : chapitres 02 (§2.3 Renderer, §2.4 Scene, §2.5 Camera), 14 ; ADR-002.

## Utilisation

```ts
import {
  createThreeRenderer,
  createDemoScene,
  createCameraManager,
} from '@explorer-engine/renderer-three';

const renderer = createThreeRenderer({ canvas, clearColor: '#101014' });
const scene = createDemoScene();
const camera = createCameraManager({ position: [3, 2, 4], target: [0, 0, 0] });

renderer.setSize(width, height);
camera.setAspect(width / height);
renderer.render(scene, camera);
// teardown: scene.dispose(); renderer.dispose();
```
