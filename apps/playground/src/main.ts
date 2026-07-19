// Explorer Engine — development playground (P1-T5).
//
// Assembles EXISTING adapters only: the Three.js renderer/scene/camera, the
// Lighting and Environment Managers (P1-T4), the headless orbit controls (core),
// and the DOM input adapter (P1-T3). It imports no Three.js and no DOM-control
// logic directly. The demo scene ships WITHOUT its own lights
// (`includeLights: false`) so lighting comes exclusively from the Lighting
// Manager (studio preset) and PBR reflections from the Environment Manager's
// in-code neutral-room IBL. Rendering is driven by the engine's headless
// on-demand render loop (P1-T5): frames are requested on mount, input activity,
// resize and while the controls are still easing — never a continuous loop on a
// stable scene. Teardown disposes the loop (cancelling any pending frame), every
// DOM listener and every manager.
import { createOrbitControls, getLightingPreset, createRenderLoop } from '@explorer-engine/core';
import {
  createThreeRenderer,
  createDemoScene,
  createCameraManager,
  createLightingManager,
  createEnvironmentManager,
} from '@explorer-engine/renderer-three';
import { createDomInput } from '@explorer-engine/input-dom';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);

  const caption = document.createElement('p');
  caption.className = 'caption';
  caption.textContent =
    'Explorer Engine — P1-T5 · on-demand rendering · studio lighting · drag = orbit · wheel = zoom';
  document.body.appendChild(caption);

  const position: [number, number, number] = [3, 2, 4];
  const target: [number, number, number] = [0, 0, 0];

  const renderer = createThreeRenderer({
    canvas,
    toneMapping: 'aces-filmic',
  });
  // The scene ships its object only; lighting/environment own the rest (P1-T4).
  const scene = createDemoScene({ includeLights: false });
  const camera = createCameraManager({ position, target });

  // Lighting: studio preset. Environment: gradient background + neutral-room IBL.
  const lighting = createLightingManager(scene);
  lighting.apply(getLightingPreset('studio'));

  const environment = createEnvironmentManager({ scene, renderer });
  environment.apply({
    background: { kind: 'gradient', top: '#2a3350', bottom: '#0a0b12' },
    environment: 'neutral-room',
    environmentIntensity: 1,
  });
  const controls = createOrbitControls(camera, {
    position,
    target,
    minDistance: 2,
    maxDistance: 12,
  });

  // On-demand render loop (P1-T5): renders only when something invalidates the
  // frame — never a continuous loop on a stable scene. The DOM-based frame
  // scheduler (requestAnimationFrame) is supplied here, keeping the core headless.
  let renderCount = 0; // dev-only counter, used by browser idle verification
  const loop = createRenderLoop({
    scheduler: {
      request: (cb) => requestAnimationFrame(cb),
      cancel: (id) => cancelAnimationFrame(id),
    },
    render: () => {
      renderCount += 1;
      const moving = controls.update();
      renderer.render(scene, camera);
      // Damping: while the controls are still easing toward their goal, keep the
      // loop alive one frame at a time; it settles to idle once movement stops.
      if (moving) loop.requestRender();
    },
  });
  const wake = () => loop.requestRender();

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspect(window.innerWidth / window.innerHeight);
    wake();
  };

  const input = createDomInput({ element: canvas, input: controls, onActivity: wake });

  window.addEventListener('resize', resize);
  resize(); // initial size + first render request
  canvas.focus(); // enable keyboard controls right away

  const teardown = () => {
    loop.dispose(); // cancels any pending frame
    window.removeEventListener('resize', resize);
    input.dispose();
    controls.dispose();
    // Dispose managers before the scene so their lights/textures/env maps are
    // removed and released, then the scene frees the object geometry/material.
    environment.dispose();
    lighting.dispose();
    scene.dispose();
    renderer.dispose();
    caption.remove();
    canvas.remove();
  };

  window.addEventListener('beforeunload', teardown);
  if (import.meta.hot) {
    import.meta.hot.dispose(teardown);
  }

  // Dev-only hook for local/browser verification (not part of any public API).
  if (import.meta.env.DEV) {
    (window as unknown as { __ee?: unknown }).__ee = {
      cameraPosition: () => camera.getThreeCamera().position.toArray(),
      renderCount: () => renderCount,
      hasPendingFrame: () => loop.hasPendingFrame,
      teardown,
    };
  }
}
