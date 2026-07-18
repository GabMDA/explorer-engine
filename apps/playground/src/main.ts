// Explorer Engine — development playground (P0-T3).
//
// Minimal host shell ONLY. Intentionally contains NO engine code, NO Three.js,
// NO 3D scene, NO hotspots, NO plugins. Its sole purpose is to verify that the
// development server, HMR and the TypeScript toolchain start correctly.
// The engine, its adapters and the UI are wired here in later phases.

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <main class="shell">
      <h1>Explorer Engine</h1>
      <p>Development playground — P0-T3 shell.</p>
      <p class="hint">Empty host page. Engine, adapters and UI arrive in later phases.</p>
    </main>
  `;
}

// Vite Hot Module Replacement: accepting self-updates confirms HMR is wired.
if (import.meta.hot) {
  import.meta.hot.accept();
}
