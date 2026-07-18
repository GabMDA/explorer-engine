# Contributing to Explorer Engine

Merci de contribuer à Explorer Engine. Ce guide explique **comment** contribuer de façon conforme au projet. Il s'appuie sur trois documents que tu dois connaître :

- La [Constitution](./ENGINE_CONSTITUTION.md) — les lois non négociables.
- La [Spécification d'architecture v2](./docs/README.md) — la source de vérité.
- Le [Development Workflow](./docs/DEVELOPMENT_WORKFLOW.md) — le process.

> **Règle d'or** : lis la [Constitution](./ENGINE_CONSTITUTION.md) avant ta première contribution. Une PR qui enfreint un invariant ne sera pas fusionnée, quelle que soit sa qualité par ailleurs.

---

## 1. Avant de commencer

- Toute contribution correspond à une **tâche de la [Roadmap](./docs/16-roadmap.md)** ou à une issue acceptée.
- Discute des changements significatifs dans une **issue** avant de coder.
- Un changement d'architecture nécessite un **ADR** ([docs/adr/](./docs/adr/README.md)).

---

## 2. Style de code & conventions

- **Langage** : TypeScript **strict** (`strict: true`, pas de `any` implicite ; `any` explicite proscrit sauf justification locale documentée). Modules ESM.
- **Nommage** ([chapitre 15 §15.4](./docs/15-standards-code.md)) :
  | Élément | Convention | Exemple |
  |---------|-----------|---------|
  | Fichiers/dossiers | `kebab-case` | `hotspot-manager` |
  | Types/interfaces | `PascalCase` | `RenderStateResolver` |
  | Fonctions/variables | `camelCase` | `composeLayers` |
  | Constantes | `UPPER_SNAKE_CASE` | `DEFAULT_FOV` |
  | Événements | `domaine:action` (typé) | `hotspot:activated` |
  | Booléens | préfixe `is/has/should/can` | `isVisible` |
- **Formatage & lint automatiques** et **bloquants en CI** (pas de débat de style en revue).
- **Commentaires** : expliquer le *pourquoi*, pas le *quoi* ; TSDoc sur l'API publique, renvoyant au chapitre de spec.
- **Imports** : uniquement l'API publique d'un module (`index`), jamais un fichier interne (encapsulation).

---

## 3. Architecture à respecter

Rappels des invariants les plus fréquemment concernés (voir [Constitution](./ENGINE_CONSTITUTION.md)) :

- **Core headless** : aucun `three` ni DOM dans `@explorer-engine/core` (L8/L9).
- **Aucune mutation directe de la scène** : publier des **couches** au Render State Resolver (L5–L7).
- **Événements typés** ; aucune donnée par frame sur le bus (L11).
- **DAG** : pas de cycle de dépendances (L10).
- **Identité** : `explorerId` (nom = repli) et **adressage typé** (L12/L13).
- **`dispose`** systématique ; **annulation** des chargements (L20).
- **Accessibilité** (L25) et **sécurité** (L26) non négociables.

---

## 4. Créer un plugin

Un plugin ajoute une capacité **sans modifier le noyau** ([chapitre 10](./docs/10-plugins.md)).

1. **Squelette** : un dossier sous `packages/plugins/<mon-plugin>/`, dépendant **uniquement** du `@explorer-engine/plugin-sdk` (jamais des internes du core).
2. **Contrat** : exporter un objet conforme au contrat de plugin (`id`, `version`, hooks `register/init/start/stop/dispose`, `dependencies?`, `capabilities?`).
3. **Cycle de vie** : tout ce qui est alloué dans `init`/`start` est libéré dans `dispose` (aucun listener/DOM/ressource orphelin).
4. **Communication** : via l'**Event Bus typé** (espace de nom propre, ex. `measure:*`) et le **Plugin Context**. Pour toute contribution visuelle, utiliser **`addLayer`** (plage de priorité plugin), **jamais** de mutation directe.
5. **Découplage** : ne **jamais** importer le code d'un autre plugin (L15). Une dépendance d'ordre se **déclare** ; l'interaction passe par événements.
6. **UI** : fournir des **descripteurs** via les slots du `UiPort` (pas de JSX, pas de framework imposé).
7. **Capacité** : si le plugin fournit une capacité (`scenario`, `measure`…), la déclarer pour que les packages puissent l'exiger via `requiredCapabilities`.
8. **Robustesse** : capter ses propres erreurs ; ne jamais faire planter le moteur.
9. **Tests** : unitaires (logique) + intégration (cycle de vie register→…→dispose sans fuite).

---

## 5. Créer un Explorer Package

Un package est **data-only** ([chapitres 04](./docs/04-explorer-packages.md) et [05](./docs/05-config-format.md)). Aucun code moteur.

1. **Structure** : `config.json` (manifeste) + `models/*.glb` + `assets/` + éventuels `locales/` et `$ref` (`hotspots.json`, `panels.json`).
2. **Préparer le GLB** :
   - Poser des **`extras.explorerId`** stables sur les nœuds adressés (ne pas dépendre des noms).
   - Compresser : **Draco** (géométrie) + **KTX2** (textures) + **Meshopt**.
   - Fournir des **LOD** pour les objets lourds ; **instancier** les répétitions ; nettoyer les objets inutiles.
   - Color space correct ; textures à résolution raisonnable ; mipmaps.
3. **Config** :
   - Déclarer `schemaVersion` (+ `requiredCapabilities` si besoin).
   - Adresser en **typé** (`Address { kind, id }`), pas de préfixe de chaîne.
   - États : couches à **transforms absolus** (pas de `relative`), régions base/modifier.
   - Chaînes traduisibles via `I18nText` (`{ "$t": "clé" }`).
   - Chemins **relatifs** au package uniquement.
4. **Valider** : passer l'outil `validate-package` (schéma + assets + correspondance `explorerId`) **avant** publication. Corriger les avertissements (notamment le repli par nom de nœud).
5. **Accessibilité du contenu** : labels clairs, contrastes du thème conformes, textes alternatifs.

---

## 6. Rédiger les commits

- **Conventional Commits** : `type(scope): résumé impératif court` (`feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `chore`).
- **Atomiques** ; le projet compile à chaque commit.
- Sujet à l'**impératif présent**, ≤ ~72 car. ; corps expliquant le *pourquoi* si utile ; référencer la tâche (`P4-T2`, `#123`).
- Jamais de secret ni d'identifiant de modèle d'assistant dans les commits.

---

## 7. Rédiger les Pull Requests

- **Une PR = une tâche** ; petite et focalisée.
- **Titre** : style Conventional Commit.
- **Description** : *quoi* et *pourquoi* ; tâche/issue liée ; captures/vidéos si UI/3D ; notes de test ; ADR si décision d'archi.
- **Auto-checklist** avant d'ouvrir : voir la [Checklist de revue](./docs/CODE_REVIEW_CHECKLIST.md) et la [Definition of Done](./docs/DEFINITION_OF_DONE.md).
- **CI verte** obligatoire ; au moins **une approbation** ; répondre à toutes les remarques.
- Ne pas créer de PR vers `main` sans que la [Definition of Done](./docs/DEFINITION_OF_DONE.md) soit satisfaite.

---

## 8. Signaler un problème (issue)

- **Bug** : étapes de reproduction, comportement attendu vs observé, package/état concerné, environnement.
- **Problème d'architecture** : décrire l'impact ; proposer un ADR. Ne pas contourner un invariant en silence — voir [Workflow §4.1](./docs/DEVELOPMENT_WORKFLOW.md).
- **Sécurité** : signaler en privé au mainteneur, pas en issue publique.

---

## 9. Code de conduite

Contributions bienveillantes et factuelles. On critique le code, jamais la personne. On explique le *pourquoi*. On respecte le temps des relecteurs (PR petites, descriptions claires).

Merci — chaque contribution conforme rend Explorer Engine plus solide et plus durable.
