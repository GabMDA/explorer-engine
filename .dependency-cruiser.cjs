// dependency-cruiser configuration (P0-T2).
// Authoritative enforcement of the module dependency graph
// (ENGINE_CONSTITUTION L10 DAG, L9 headless core ; ADR-002). Runs in CI.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'The dependency graph MUST be acyclic (ENGINE_CONSTITUTION L10). Break the cycle.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-stays-headless',
      comment:
        'The headless core (core/plugin-sdk/schema) MUST NOT depend on three or a UI framework (ENGINE_CONSTITUTION L9 ; ADR-002).',
      severity: 'error',
      from: { path: '^packages/(core|plugin-sdk|schema)/' },
      to: {
        path: 'node_modules/(three|react|react-dom|vue|svelte|lit|@angular)(/|$)',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Resolve TypeScript extensionless imports so the graph links correctly.
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.d.ts', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json'],
    },
    tsPreCompilationDeps: true,
  },
};
