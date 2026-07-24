# Explorer Engine — Documentation d'Architecture

> **Statut** : Spécification **v1.0 — Design Freeze** (voir [ADR-008](./adr/ADR-008-design-freeze-v1.md) et le [CHANGELOG](../CHANGELOG.md)). Amendements désormais tracés (§5 ci-dessous), plus de révision libre.
> **Nature du document** : Source de vérité (Single Source of Truth) du projet Explorer Engine.
> **Règle d'or** : Toute décision de développement future DOIT être conforme à cette spécification. En cas de contradiction entre le code et ce document, c'est le document qui fait foi jusqu'à amendement explicite.

---

## 1. Qu'est-ce que Explorer Engine ?

**Explorer Engine** est un moteur générique permettant de créer des **expériences interactives d'exploration d'objets 3D**. Il permet à un utilisateur final de découvrir, manipuler, décomposer et comprendre un objet tridimensionnel — qu'il s'agisse d'un PC gaming, d'une voiture, d'une montre, d'un moteur thermique, d'un cerveau humain, d'un téléphone, d'une console, d'une fusée, ou de tout autre objet.

Le principe fondateur est la **séparation totale entre le moteur et le contenu** :

- Le **moteur** (Explorer Engine) est un logiciel générique, stable, réutilisable, qui ne connaît aucun objet en particulier.
- Le **contenu** est décrit par un **Explorer Package** : un modèle `GLB`, un fichier de configuration `config.json`, et des ressources associées (textures, audio, animations…).

Le moteur **construit automatiquement toute l'expérience** à partir du package, sans qu'aucune ligne de code ne soit modifiée dans le moteur.

```
┌──────────────────────────┐        ┌──────────────────────────┐
│      EXPLORER ENGINE      │        │     EXPLORER PACKAGE      │
│      (générique, stable)  │  ◄───  │  (spécifique à l'objet)   │
│                           │  charge│                          │
│  Renderer, Scene, Camera, │        │  model.glb               │
│  Hotspots, Focus, States, │        │  config.json             │
│  Plugins, UI, Themes...   │        │  assets/ (textures...)   │
└──────────────────────────┘        └──────────────────────────┘
```

---

## 2. Comment lire cette documentation

Cette documentation est organisée en **chapitres numérotés**. Chaque chapitre est autonome mais s'inscrit dans une progression logique : de la vision stratégique vers les détails d'implémentation, puis vers la planification.

| # | Chapitre | Objet | Public prioritaire |
|---|----------|-------|--------------------|
| 01 | [Vision du projet](./01-vision.md) | Objectifs, philosophie, cibles, cas d'usage, limites, principes | Tous |
| 02 | [Architecture générale](./02-architecture-generale.md) | Tous les modules du moteur, rôles, dépendances, interactions | Architectes, développeurs |
| 03 | [Structure du projet](./03-structure-projet.md) | Organisation du dépôt et justification | Développeurs |
| 04 | [Explorer Packages](./04-explorer-packages.md) | Définition, structure, chargement d'un package | Développeurs, créateurs de contenu |
| 05 | [Format du `config.json`](./05-config-format.md) | Schéma détaillé, propriétés, exemples | Développeurs, créateurs de contenu |
| 06 | [Gestion des modèles 3D](./06-modeles-3d.md) | Chargement, optimisation, matériaux, LOD, compression | Développeurs 3D |
| 07 | [Hotspots](./07-hotspots.md) | Fonctionnement complet, projection, interaction, cycle de vie | Développeurs |
| 08 | [Focus System](./08-focus-system.md) | Sélection, zoom, caméra, mise en avant, retour | Développeurs |
| 09 | [États (States)](./09-etats.md) | Système d'états et transitions | Développeurs |
| 10 | [Plugins](./10-plugins.md) | Système d'extension, création, chargement, communication | Développeurs, intégrateurs |
| 11 | [Animation Engine](./11-animation-engine.md) | Timelines, transitions, événements, synchronisation | Développeurs |
| 12 | [Interface utilisateur](./12-interface-utilisateur.md) | Panneaux, navigation, toolbar, responsive, accessibilité | Développeurs UI |
| 13 | [Système de thèmes](./13-systeme-themes.md) | Personnalisation complète de l'interface | Développeurs UI, designers |
| 14 | [Performances](./14-performances.md) | Objectifs 60 FPS, GPU, mémoire, Draco, KTX2, instancing | Tous les développeurs |
| 15 | [Standards de code](./15-standards-code.md) | Conventions, SOLID, modularité, extensibilité | Tous les développeurs |
| 16 | [Roadmap](./16-roadmap.md) | Découpage en tâches indépendantes, validables | Chefs de projet, développeurs |
| 17 | [Bonnes pratiques](./17-bonnes-pratiques.md) | Règles à respecter pendant le développement | Tous les développeurs |
| 18 | [Évolutions futures](./18-evolutions-futures.md) | Explorer Studio, IA, VR, multijoueur… | Direction, architectes |
| 19 | [Render State Resolver](./19-render-state-resolver.md) | État de rendu déclaratif à couches (noyau, **spec v2**) | Architectes, développeurs |
| 20 | [État runtime sérialisable](./20-runtime-state-serialization.md) | Deep-linking, historique, partage d'URL (noyau, **spec v2**) | Architectes, développeurs |
| 21 | [Guide créateur : produire un Explorer Package](./21-guide-createur-package.md) | Guide pratique, pas à pas, sur les deux packages de référence réels (P10-T3) | Créateurs de contenu |
| 22 | [Guide plugin : développer une extension](./22-guide-plugins.md) | Guide pratique, sur le code réel des deux plugins officiels (P10-T3) | Développeurs, intégrateurs |
| — | [Glossaire](./99-glossaire.md) | Terminologie de référence | Tous |
| — | [Revue v1](./reviews/architecture-review-v1.md) · [Change-log v2](./reviews/spec-v2-change-log.md) | Revue d'architecture & suivi des corrections | Architectes |

### Gouvernance & process

| Document | Objet |
|----------|-------|
| [ENGINE_CONSTITUTION.md](../ENGINE_CONSTITUTION.md) | Les invariants absolus (lois L1–L29) — priment sur toute PR. |
| [Architecture Decision Records](./adr/README.md) | Le *pourquoi* des décisions majeures (ADR-001 → 008). |
| [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md) | Branche → dev → tests → revue → merge → doc. |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Guide contributeur (style, plugin, package, commits, PR). |
| [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md) | Quand une tâche est *terminée*. |
| [CODE_REVIEW_CHECKLIST.md](./CODE_REVIEW_CHECKLIST.md) | Checklist avant chaque Pull Request. |
| [CHANGELOG.md](../CHANGELOG.md) | Historique des versions publiées (SemVer). |

> **Spec v2** : chapitres 19–20 ajoutés et chapitres 02, 03, 04, 05–16, 18 amendés après revue d'architecture. Détail dans le [change-log v2](./reviews/spec-v2-change-log.md).

---

## 3. Conventions de la documentation

- **RFC 2119** : les mots-clés **DOIT**, **NE DOIT PAS**, **DEVRAIT**, **PEUT** sont employés au sens normatif. « DOIT » désigne une exigence obligatoire ; « DEVRAIT » une recommandation forte ; « PEUT » une option.
- **Diagrammes** : les schémas utilisent la syntaxe [Mermaid](https://mermaid.js.org/) (rendue nativement par GitHub) ou de l'ASCII art lorsque c'est plus clair.
- **Exemples de configuration** : tous les extraits `config.json` sont des exemples pédagogiques et non normatifs, sauf mention explicite. Le schéma normatif est défini au [chapitre 05](./05-config-format.md).
- **Pseudocode** : lorsque des interfaces sont décrites, elles le sont sous forme de contrat conceptuel (signatures, responsabilités), **pas** sous forme de code d'implémentation. Aucun code source n'est produit par ce document.

---

## 4. Principes non négociables (résumé exécutif)

Ces cinq principes structurent l'ensemble de l'architecture. Ils sont détaillés au [chapitre 01](./01-vision.md) et au [chapitre 15](./15-standards-code.md).

1. **Généricité absolue** — Le moteur ne contient AUCUNE connaissance d'un objet particulier. Ajouter un nouvel objet = ajouter un package, jamais modifier le moteur.
2. **Configuration plutôt que code** — Le comportement d'une expérience est piloté par des données déclaratives (`config.json`), pas par de la programmation.
3. **Modularité stricte** — Chaque module a une responsabilité unique, une frontière nette, et communique par contrats explicites (interfaces et événements).
4. **Extensibilité par plugins** — Toute fonctionnalité non essentielle est un plugin. Le noyau reste minimal et stable.
5. **Performance par conception** — L'objectif de 60 FPS et la maîtrise mémoire sont des contraintes de conception, pas des optimisations tardives.

---

## 5. Cycle de vie du document

| Version | Statut | Signification |
|---------|--------|---------------|
| v0.x | Draft / Design | La spécification évolue. Amendements libres via revue. |
| v1.0 | Design Freeze | Gel de la conception. Début du développement du noyau. |
| v1.x | Living Spec | La spécification suit le développement ; tout écart est un amendement tracé. |
| v2.0 | Evolution | Intègre les évolutions majeures (voir chapitre 18). |

Toute modification de ce document DOIT passer par une revue et être justifiée. Le document est versionné avec le code, dans le même dépôt, pour garantir la cohérence entre spécification et implémentation.
