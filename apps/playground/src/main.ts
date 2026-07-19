// Explorer Engine — development playground (P1-T2).
//
// Assembles EXISTING components only: the Three.js renderer adapter, a demo
// scene (a single lit cube built in code) and a camera. It imports NO Three.js
// directly — all 3D lives in @explorer-engine/renderer-three. This is the first
// real visual check of the engine: a lit cube on a WebGL canvas, resize-aware,
// with a clean teardown (no active loop or leaked resources).
import {
  createThreeRenderer,
  createDemoScene,
  createCameraManager,
} from '@explorer-engine/renderer-three';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const canvas = document.createElement('canvas');
  app.appendChild(canvas);

  const caption = document.createElement('p');
  caption.className = 'caption';
  caption.textContent = 'Explorer Engine — P1-T2 (Scene + Camera + demo cube)';
  document.body.appendChild(caption);

  const renderer = createThreeRenderer({
    canvas,
    clearColor: '#101014',
    toneMapping: 'aces-filmic',
  });
  const scene = createDemoScene();
  const camera = createCameraManager({ position: [3, 2, 4], target: [0, 0, 0] });

  // On-demand rendering: draw on mount and on resize (no continuous loop — that
  // is P1-T5). Keeps teardown trivially free of any running loop.
  const renderFrame = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.setAspect(width / height);
    renderer.render(scene, camera);
  };

  window.addEventListener('resize', renderFrame);
  renderFrame();

  const teardown = () => {
    window.removeEventListener('resize', renderFrame);
    scene.dispose();
    renderer.dispose();
    caption.remove();
    canvas.remove();
  };

  window.addEventListener('beforeunload', teardown);
  // HMR: tear down the previous instance before the module is replaced.
  if (import.meta.hot) {
    import.meta.hot.dispose(teardown);
  }
}
