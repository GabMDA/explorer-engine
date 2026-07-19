// Explorer Engine — development playground (P1-T3).
//
// Assembles EXISTING adapters only: the Three.js renderer/scene/camera, the
// headless orbit controls (core), and the DOM input adapter. It imports no
// Three.js and no DOM-control logic directly. A minimal interaction-driven
// render loop runs while the controls are moving (damping) and auto-stops when
// idle — the engine's structured on-demand loop is P1-T5. Teardown removes every
// DOM listener and stops the loop.
import { createOrbitControls } from '@explorer-engine/core';
import {
  createThreeRenderer,
  createDemoScene,
  createCameraManager,
} from '@explorer-engine/renderer-three';
import { createDomInput } from '@explorer-engine/input-dom';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);

  const caption = document.createElement('p');
  caption.className = 'caption';
  caption.textContent =
    'Explorer Engine — P1-T3 · drag = orbit · wheel = zoom · arrows/Shift+arrows/+- = keyboard';
  document.body.appendChild(caption);

  const position: [number, number, number] = [3, 2, 4];
  const target: [number, number, number] = [0, 0, 0];

  const renderer = createThreeRenderer({
    canvas,
    clearColor: '#101014',
    toneMapping: 'aces-filmic',
  });
  const scene = createDemoScene();
  const camera = createCameraManager({ position, target });
  const controls = createOrbitControls(camera, {
    position,
    target,
    minDistance: 2,
    maxDistance: 12,
  });

  // Interaction-driven render loop: runs while the controls are still moving,
  // then stops. Woken by input activity and by resize.
  let rafId = 0;
  let running = false;
  const frame = () => {
    const active = controls.update();
    renderer.render(scene, camera);
    if (active) {
      rafId = requestAnimationFrame(frame);
    } else {
      running = false;
      rafId = 0;
    }
  };
  const wake = () => {
    if (!running) {
      running = true;
      rafId = requestAnimationFrame(frame);
    }
  };

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspect(window.innerWidth / window.innerHeight);
    wake();
  };

  const input = createDomInput({ element: canvas, input: controls, onActivity: wake });

  window.addEventListener('resize', resize);
  resize(); // initial size + first render
  canvas.focus(); // enable keyboard controls right away

  const teardown = () => {
    if (rafId) cancelAnimationFrame(rafId);
    running = false;
    window.removeEventListener('resize', resize);
    input.dispose();
    controls.dispose();
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
      teardown,
    };
  }
}
