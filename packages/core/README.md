# @explorer-engine/core

Headless core of Explorer Engine — **no DOM, no WebGL, no Three.js, no UI framework**
(ENGINE_CONSTITUTION L8/L9).

- **Statut** : squelette **P0-T4**. Contenu actuel :
  - `createEngine()` — cycle de vie minimal `create`/`dispose` (no-op), expose les services transverses ;
  - `EventBus` — bus publish/subscribe **typé** (`on`/`off`/`once`/`emit`), catalogue d'événements compile-time (ADR-004) ;
  - `createLogger()` — logger de diagnostics structuré (niveaux, namespaces, sink injectable).
- **Référence** : chapitres 02 (§2.2, §2.19), 03 ; ADR-004.
- **À venir** (phases ultérieures) : ports/adaptateurs, Render State Resolver, états, focus, sélection, animation, config.

## API publique (extrait)

```ts
import { createEngine, createLogger, EventBus } from '@explorer-engine/core';

const engine = createEngine({ diagnostics: { level: 'info' } });
engine.events.on('engine:disposed', ({ at }) => {
  /* ... */
});
engine.dispose(); // émet engine:disposed, libère les listeners, idempotent
```

## Scripts

| Script | Effet |
|--------|-------|
| `typecheck` | `tsc --noEmit` (inclut les tests). |

Les tests unitaires (Vitest) sont exécutés depuis la racine du dépôt (`npm run test`).
