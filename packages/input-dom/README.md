# @explorer-engine/input-dom

The **InputPort adapter** for Explorer Engine. This is the **only** package that
handles **DOM input events** for camera controls (ENGINE_CONSTITUTION: DOM
confined to this adapter). It translates pointer / wheel / keyboard events on a
target element into normalized `ControlInput` gestures (`orbit` / `zoom` / `pan`)
consumed by a headless control scheme such as the core's orbit controls.

- **Statut** : **P1-T3**. `createDomInput({ element, input, onActivity })` →
  `InputPort`. Pointer (souris + tactile, pinch/pan à deux doigts), molette, et
  clavier (flèches = orbit, Shift+flèches = pan, +/- = zoom). Élément rendu
  focusable (`tabindex`) et `touch-action: none`.
- **Ne contient aucun Three.js** ; dépend du core uniquement pour les types.
- **Référence** : chapitre 02 §2.6 (Controls) ; ADR-002.

## Utilisation

```ts
import { createOrbitControls } from '@explorer-engine/core';
import { createDomInput } from '@explorer-engine/input-dom';

const controls = createOrbitControls(camera, { position: [3, 2, 4] });
const input = createDomInput({ element: canvas, input: controls, onActivity: wake });
// ... boucle : controls.update(); renderer.render(scene, camera);
// teardown : input.dispose(); controls.dispose();
```
