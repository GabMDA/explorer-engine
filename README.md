# Explorer Engine

Un moteur 3D modulaire, générique et data-driven pour créer des **expériences interactives d'exploration d'objets 3D** — un PC gaming, une voiture, une montre, un moteur, un cerveau, une fusée, ou n'importe quel objet — sans jamais modifier le moteur.

> Chaque objet est décrit par un **Explorer Package** (un modèle GLB + un `config.json` + des ressources). Le moteur construit automatiquement toute l'expérience.

## 📐 Statut du projet

**v1.0 — Design Freeze.** La Roadmap complète (phases P0 à P10, voir [chapitre 16](./docs/16-roadmap.md)) est livrée : moteur headless, adaptateurs de référence, deux plugins officiels, deux Explorer Packages de référence (`watch` et `gaming-pc`, voir [`examples/explorer-packages/`](./examples/explorer-packages/)), et l'API publique est figée pour la ligne 1.x. Voir le [CHANGELOG](./CHANGELOG.md) et l'[ADR-008 — Design Freeze v1.0](./docs/adr/ADR-008-design-freeze-v1.md) pour le détail et l'engagement de compatibilité ascendante.

Pour créer un package ou un plugin, voir les guides pratiques : [chapitre 21](./docs/21-guide-createur-package.md) (créateur de package) et [chapitre 22](./docs/22-guide-plugins.md) (développeur de plugin).

## 📚 Documentation d'architecture

La spécification complète se trouve dans [`docs/`](./docs/README.md). Commencez par l'[**index**](./docs/README.md).

| # | Chapitre |
|---|----------|
| 01 | [Vision du projet](./docs/01-vision.md) |
| 02 | [Architecture générale](./docs/02-architecture-generale.md) |
| 03 | [Structure du projet](./docs/03-structure-projet.md) |
| 04 | [Explorer Packages](./docs/04-explorer-packages.md) |
| 05 | [Format du `config.json`](./docs/05-config-format.md) |
| 06 | [Gestion des modèles 3D](./docs/06-modeles-3d.md) |
| 07 | [Hotspots](./docs/07-hotspots.md) |
| 08 | [Focus System](./docs/08-focus-system.md) |
| 09 | [États (States)](./docs/09-etats.md) |
| 10 | [Plugins](./docs/10-plugins.md) |
| 11 | [Animation Engine](./docs/11-animation-engine.md) |
| 12 | [Interface utilisateur](./docs/12-interface-utilisateur.md) |
| 13 | [Système de thèmes](./docs/13-systeme-themes.md) |
| 14 | [Performances](./docs/14-performances.md) |
| 15 | [Standards de code](./docs/15-standards-code.md) |
| 16 | [Roadmap](./docs/16-roadmap.md) |
| 17 | [Bonnes pratiques](./docs/17-bonnes-pratiques.md) |
| 18 | [Évolutions futures](./docs/18-evolutions-futures.md) |
| 19 | [Render State Resolver](./docs/19-render-state-resolver.md) *(noyau v2)* |
| 20 | [État runtime sérialisable & deep-linking](./docs/20-runtime-state-serialization.md) *(noyau v2)* |
| 21 | [Guide créateur : produire un Explorer Package](./docs/21-guide-createur-package.md) |
| 22 | [Guide plugin : développer une extension](./docs/22-guide-plugins.md) |
| — | [Glossaire](./docs/99-glossaire.md) |
| — | [Revue d'architecture v1](./docs/reviews/architecture-review-v1.md) · [Change-log spec v2](./docs/reviews/spec-v2-change-log.md) |
| — | [CHANGELOG](./CHANGELOG.md) · [ADR-008 — Design Freeze v1.0](./docs/adr/ADR-008-design-freeze-v1.md) |

> **Spec v2** — La spécification a été révisée après une revue d'architecture. Les chapitres **19** (Render State Resolver) et **20** (état sérialisable) sont des ajouts noyau ; les chapitres 02, 03, 05–13 ont été amendés (core headless + adaptateurs, Focus = mécanisme, identité `explorerId`, événements typés, `requestRender`, occlusion sans readback, statecharts). Voir le [change-log](./docs/reviews/spec-v2-change-log.md).

## 🧭 Principes non négociables

1. **Généricité absolue** — le moteur ne connaît aucun objet ; un nouvel objet = un package, jamais un patch moteur.
2. **Configuration plutôt que code** — le comportement est déclaratif (`config.json`).
3. **Modularité stricte** — responsabilité unique, contrats explicites, couplage faible.
4. **Extensibilité par plugins** — noyau minimal et stable ; capacités via plugins.
5. **Performance par conception** — 60 FPS et maîtrise mémoire comme contraintes de départ.
