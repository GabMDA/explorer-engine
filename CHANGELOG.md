# Changelog

Toutes les évolutions notables d'Explorer Engine sont documentées dans ce fichier. Le format suit approximativement [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) ; les versions suivent [SemVer](https://semver.org/lang/fr/). Le périmètre exact des paquets concernés par le versionnage et l'engagement de compatibilité sont définis dans l'[ADR-008 — Design Freeze v1.0](./docs/adr/ADR-008-design-freeze-v1.md).

## [1.0.0] — 2026-07-24

Première version figée du moteur, du schéma et du SDK, à l'issue de la Roadmap complète (phases P0 à P10 — voir [chapitre 16](./docs/16-roadmap.md)). Aucune version publique n'existait avant celle-ci : cette entrée couvre donc l'ensemble du développement depuis l'initialisation du dépôt.

### Paquets figés en 1.0.0

`@explorer-engine/core`, `@explorer-engine/schema`, `@explorer-engine/renderer-three`, `@explorer-engine/ui-webcomponents`, `@explorer-engine/input-dom`, `@explorer-engine/resource-fetch`, `@explorer-engine/plugin-sdk`, `@explorer-engine/plugin-guided-tour`, `@explorer-engine/plugin-measure`.

`@explorer-engine/playground` (application de démonstration) et `@explorer-engine/validate-package` (outil CLI) restent hors périmètre du gel — ce sont des outils de développement internes, pas une API consommée par un tiers (voir ADR-008).

### Ajouté, par phase de Roadmap

- **P0 — Fondations** : monorepo (workspaces `packages/`, `apps/`, `examples/`, `tools/`), CI (typecheck, lint, format, tests), garde-fou architectural headless.
- **P1 — Rendu de base** : `RendererPort` + adaptateur Three.js, scène/caméra, orbit controls, boucle de rendu **à la demande** (L18).
- **P2 — Chargement de modèle** : chargement GLB (Draco/KTX2/Meshopt paresseux), cadrage automatique, Resource Manager headless (cache, annulation, priorités, cascade de chargement paresseux).
- **P3 — Config & validation** : schéma `config.json` normatif et versionné (`@explorer-engine/schema`), Config Loader, migration, `validate-package`.
- **P4 — Interaction** : Render State Resolver déclaratif à couches (ADR-001), sélection, hotspots (projection, occlusion, priorité).
- **P5 — Focus & Animation** : Animation Engine (tweens/timelines), Focus Manager (zoom caméra, dim/outline, pile de focus).
- **P6 — États** : State Manager déclaratif (bases exclusives / régions modificatrices parallèles, transforms absolus, jamais de restauration impérative — L6).
- **P7 — UI & Thèmes** : `UiPort`, adaptateur Web Components (`ui-webcomponents`), Theme Manager, i18n Service, Accessibility Service.
- **P8 — Plugins** : Plugin Manager headless (capacités, ordre, incompatibilités — L15), `plugin-sdk`, plugins de référence **Guided Tour** et **Measure**.
- **P9 — Perf & a11y** : Perf Metrics + Quality Manager adaptatif, budgets de performance, instancing déclaratif, cascade de chargement paresseux priorisée.
- **P10 — Packages de référence & v1** :
  - Package de référence **simple** `watch` (P10-T1) : 4 composants, 2 hotspots, 1 état, un thème.
  - Package de référence **complexe** `gaming-pc` (P10-T2) : 7 composants, 4 états (dont *exploded* et *x-ray*), Guided Tour déclaratif, Measure, i18n anglais/allemand.
  - Élargissement de `ComponentConfig.label`/`HotspotConfig.label`/`StateConfig.label` de `string` à `I18nText` (mise en conformité avec le chapitre 05, rétrocompatible) — nécessaire pour qu'un package puisse réellement déclarer un libellé traduisible.
  - Chargement paresseux des dictionnaires i18n d'un package (`config.i18n.sources`) via le Resource Manager, et câblage de `HotspotManager.setActiveState` (visibilité des hotspots par état) dans le Playground.
  - Guide créateur ([chapitre 21](./docs/21-guide-createur-package.md)) et guide plugin ([chapitre 22](./docs/22-guide-plugins.md)).
  - Design Freeze v1.0 ([ADR-008](./docs/adr/ADR-008-design-freeze-v1.md)) : API publique figée, compatibilité ascendante engagée pour la ligne 1.x.

### Compatibilité

Voir [ADR-008](./docs/adr/ADR-008-design-freeze-v1.md) pour l'engagement de compatibilité ascendante de la ligne 1.x et la définition de ce qui constitue un changement cassant.
