# Spec v2 — Change Log des corrections d'architecture

> Suivi de l'application des corrections issues de [`architecture-review-v1.md`](./architecture-review-v1.md).
> Branche : `docs/spec-v2-architecture-fixes`. **Aucun code source** n'est produit — documentation uniquement.
> Légende statut : ✅ Appliqué · 🟡 Partiel / arbitrage ouvert · ⬜ Non commencé.

---

## 1. Tableau de suivi C1 → C17

| # | Correction | Findings | Sévérité | Statut | Chapitres impactés |
|---|-----------|----------|----------|--------|--------------------|
| **C1** | Render State Resolver déclaratif (couches typées, priorités, recomposition ; fin du mémoriser/restaurer) | F1, F8, F26, F3 | S1 | ✅ | **19 (nouveau)**, 02, 08, 09 |
| **C2** | Core headless + adaptateurs (rendu, UI, entrées) derrière des ports | F4, F25 | S1 | ✅ | 02, 03 |
| **C3** | Contrat d'extension UI agnostique ; UI par défaut en Web Components | F5 | S1 | ✅ | 03, 10, 12 |
| **C4** | Focus = mécanisme, pas un état ; suppression de l'état `Focus` | F2 | S1 | ✅ | 08, 09 |
| **C5** | Identité stable des composants via `extras.explorerId` (repli nom + warning) ; adressage typé | F7, F17 | S1 | ✅ | 05, 06 |
| **C6** | Correction du graphe de dépendances ; suppression de tous les cycles ; anti-cycle exécutable | F6, F25 | S1 | ✅ | 02 |
| **C7** | Contrat de render-loop ownership (`requestRender` + frame handles) | F11 | S1/S2 | ✅ | 02, 11, 14 |
| **C8** | Portabilité vs plugins : runtime de référence + `requiredCapabilities` + dégradation | F9 | S2 | ✅ | 04, 10 |
| **C9** | Catalogue d'événements typé + règle « pas de données par frame sur le bus » | F10 | S2 | ✅ | 02, 15 |
| **C10** | État runtime sérialisable (deep-linking, historique, partage d'URL) | F12, F20 | S2 | ✅ | **20 (nouveau)**, 02, 09 |
| **C11** | Statecharts pour base/modifiers (régions parallèles) + exclusions | F8 | S2 | ✅ | 09 |
| **C12** | Réduire le DSL de timelines à de l'interpolation ; scénarios en plugins | F14 | S2 | ✅ | 05, 11 |
| **C13** | Occlusion des hotspots sans readback GPU→CPU synchrone | F13 | S2 | ✅ | 07 |
| **C14** | Politique de compatibilité de schéma (forward-compat) + matrice core/schema/sdk | F15 | S2 | ✅ | 05 |
| **C15** | Normalisation vers volume unité + depth log optionnel | F16 | S2 | ✅ | 06, 14 |
| **C16** | Modèle d'annulation/concurrence du chargement (tokens) | F18 | S2 | ✅ | 04, 02 |
| **C17** | Mineurs : i18n typé (F19), en-têtes WASM/CSP (F21), `$ref` config (F22), service A11y (F23), color space tokens (F24) | F19-F24 | S3 | ✅ | 05, 12, 13, 14 |

---

## 2. Décisions finales par correction

### C1 — Render State Resolver (nouveau chapitre 19)
- **Problème** : état visuel muté impérativement par 6 modules (State, Focus, Selection, modifiers, plugins) avec « mémoriser/restaurer » non composables → last-writer-wins non déterministe.
- **Décision** : introduction d'un module noyau **Render State Resolver**. Les sous-systèmes ne mutent plus la scène ; ils publient des **couches (contributions) typées** `{ target, channel, value, priority, source }`. Le resolver compose par cible+canal et applique/interpole l'effectif. Retirer un focus/état = retirer sa couche, jamais restaurer.
- **Conséquence** : Focus, State, Selection, modifiers deviennent de simples **producteurs de couches**. Réversibilité et composition garanties par construction.

### C2 — Core headless + adaptateurs
- **Problème** : `ui/` dans `core` → moteur non embarquable, logique non testable sans DOM/WebGL (contredit P9).
- **Décision** : architecture **hexagonale**. `@explorer-engine/core` = **headless** (config, résolveur d'état, states, focus, selection *logique*, hotspots *logique*, animation, event bus, sérialisation) — **zéro DOM, zéro WebGL**. Adaptateurs derrière des **ports** : `renderer-three` (rendu), `ui-webcomponents` (UI), `input-dom` (entrées). Le core pilote via interfaces (`RendererPort`, `UiPort`, `InputPort`).
- **Conséquence** : tests unitaires sans navigateur ; WebGPU/XR = nouveaux adaptateurs ; refonte de la structure du dépôt (ch03).

### C3 — Contrat d'UI agnostique + Web Components
- **Problème** : techno UI reportée alors que le `plugin-sdk` (livrable v1) en dépend.
- **Décision** : figer **le contrat `UiPort`** (descripteurs déclaratifs : panneaux, toolbar, slots, marqueurs) indépendant du framework. Implémentation par défaut en **Web Components/Custom Elements** (zéro dépendance imposée, natif, thématisable par CSS custom properties, accessible). Les plugins déclarent des **descripteurs UI**, jamais du JSX.
- **Conséquence** : SDK dépend du contrat, pas d'un framework ; UI remplaçable.

### C4 — Focus mécanisme, pas état
- **Problème** : `Focus` à la fois mécanisme (ch08) et valeur d'état (ch09) → double mutation caméra/matériaux.
- **Décision** : **suppression de l'état `Focus`** de la liste de référence. Le Focus est un **mécanisme** transverse qui **produit des couches** (caméra + matériaux) via le resolver (C1). Un état ne « fait » jamais de focus.
- **Conséquence** : ch09 ne liste plus `Focus` ; ch08 reformulé en producteur de couches.

### C5 — Identité stable `explorerId` + adressage typé
- **Problème** : identité par nom de nœud glTF → casse au ré-export (gltfpack renomme).
- **Décision** : identité primaire via **`extras.explorerId`** (propriété custom glTF posée à la préparation). Repli sur le **nom de nœud** avec **avertissement** de validation. Adressage **typé et discriminé** : `{ kind: "component" | "group" | "node", id }`. Au-delà de `components[].nodes`, la surface d'API ne référence **que** des composants/groupes.
- **Conséquence** : ch05 (schéma cibles), ch06 (indexation).

### C6 — Graphe de dépendances sans cycle
- **Problème** : matrice déclarait `Lighting ↔ Environment` (cycle) sous un titre « acyclique » ; Focus sur-couplé.
- **Décision** : introduire une ressource partagée **`EnvironmentResource`** (env map/IBL) possédée par un module neutre, consommée par Lighting et Environment **sans se référencer**. Focus/State/Selection ne dépendent plus de Camera/Lighting/UI (ils émettent des couches). Inverser `Model Loader → Animation` (le loader **produit** des descripteurs de clips). Matrice régénérée + **test de non-régression du DAG** (règle lint).
- **Conséquence** : ch02 (matrice), ch06/11 (clips), ch15 (règle exécutable).

### C7 — `requestRender()` + frame ownership
- **Problème** : rendu à la demande vs animations continues (ventilateur, idle, audio) non arbitré.
- **Décision** : contrat **`requestRender()`** (rendu ponctuel après changement) + **frame handles** (`acquireFrameLoop()` / release) : la boucle reste active tant qu'au moins un handle vit (animation, clip en boucle, plugin). Sinon la boucle dort. Le resolver marque `dirty` sur changement de couche → `requestRender()`.
- **Conséquence** : ch02 (Core), ch11 (Animation), ch14 (perf).

### C8 — `requiredCapabilities` + runtime de référence
- **Problème** : package « autonome/portable » (ch04) contredit « plugins enregistrés côté hôte » (ch10).
- **Décision** : définir un **Runtime de référence** (profil) embarquant un **jeu de plugins standard garanti**. Un package déclare **`requiredCapabilities`** ; si une capacité manque, **dégradation gracieuse** + diagnostic. Reformulation : « portable sur tout runtime conforme au **profil de capacités** déclaré ».
- **Conséquence** : ch04 (portabilité), ch10 (capabilities).

### C9 — Catalogue d'événements typé
- **Problème** : événements en chaînes libres → typos, pas de refactor sûr.
- **Décision** : **catalogue d'événements typé** (map nom→payload, vérifiée à la compilation) exposé par core et SDK. Règle normative : **aucune donnée par frame ne transite par le bus** (données chaudes via ports/appels directs).
- **Conséquence** : ch02 (Event Bus), ch15 (règle).

### C10 — État runtime sérialisable (nouveau chapitre 20)
- **Problème** : pas de deep-linking / historique / partage d'URL ; « déterminisme » sur-vendu pour le multijoueur.
- **Décision** : l'**état runtime** (base + modifiers + focus stack + vue + sélection) est **sérialisable/désérialisable** (schéma `RuntimeState` versionné). Module **`Navigation`** optionnel : binding URL/History (opt-in) ; sinon exposé via l'API pour l'hôte. Multijoueur reformulé en **synchronisation d'état** (snapshots/patches), pas simulation déterministe.
- **Conséquence** : nouveau ch20 ; ch02 (état observable), ch09, ch18 (multijoueur).

### C11 — Statecharts
- **Décision** : formaliser les états en **statechart** : **région principale** (bases, exclusives) + **régions parallèles** (modifiers, indépendants) + **règles d'exclusion** entre modifiers conflictuels. `allowedFrom` reste pour la région principale.
- **Conséquence** : ch09.

### C12 — Timelines réduites à l'interpolation
- **Décision** : le noyau d'animation ne fait que **tweens + enchaînement d'animations atomiques + mixer de clips** ; **suppression du DSL de scénarios** (`timelines` avec `action`) du schéma v1. La **scénarisation** (visites, séquences riches) est un **plugin** (Guided Tour) au-dessus de l'Animation Engine. `animations` en config se limite à nommer/mapper des clips et régler l'`autoplay` d'un clip simple.
- **Conséquence** : ch05 (schéma), ch11 (moteur), ch10 (tour).

### C13 — Occlusion sans readback synchrone
- **Décision** : occlusion des hotspots par **BVH sur volumes englobants** (raycast CPU throttlé contre bounding boxes des occultants majeurs), jamais de `readPixels`/depth readback synchrone. Option **depth asynchrone** (PBO, latence 1 frame) documentée comme avancée. Retrait de la mention « depth buffer test » naïve.
- **Conséquence** : ch07.

### C14 — Compatibilité de schéma
- **Décision** : **tolérance des champs inconnus** au sein d'une même **majeure** (ignore + warn) ; rejet inter-majeure avec doc de migration. Publication d'une **matrice de compatibilité** `core ↔ schema ↔ sdk` et d'une politique semver explicite.
- **Conséquence** : ch05.

### C15 — Précision de profondeur
- **Décision** : **normalisation systématique** du modèle vers un **volume unité** au chargement ; near/far dérivés de la bounding box ; **logarithmic depth buffer** activable par package pour les objets à grande dynamique interne.
- **Conséquence** : ch06 (Model Loader), ch14 (perf).

### C16 — Annulation / concurrence du chargement
- **Décision** : **jeton d'annulation** (AbortSignal) de bout en bout (fetch → décodage WASM → build) ; politique **« un chargement actif à la fois : un nouveau `load()` annule le précédent »** ; `dispose` coordonné.
- **Conséquence** : ch04, ch02 (Resource Manager / Core).

### C17 — Corrections mineures
- **i18n typé** : champ i18n explicite `{ "$t": "clé" }` (fin de l'heuristique `@`).
- **En-têtes WASM/CSP** : self-host des décodeurs versionnés ; documentation COOP/COEP/CSP + repli non-threadé.
- **`$ref` config** : références externes autorisées (`hotspots.json`, `panels.json`) résolues par le Config Loader ; `config.json` = manifeste.
- **Service A11y** : annonceur central unique + registre de navigation alternative.
- **Color space tokens** : règle de conversion sRGB→linéaire au passage token→scène.

---

## 3. Arbitrages restant ouverts (à trancher avant P0 ou tôt en P0)

| Réf | Question ouverte | Options | Recommandation provisoire |
|-----|------------------|---------|---------------------------|
| O1 | Numérotation des chapitres : nouveaux ch19/20 vs renumérotation complète | (a) ajouter en 19/20 et ordonner via TOC ; (b) renuméroter 03-18 | (a) — évite un churn massif et des liens cassés ; TOC donne l'ordre de lecture |
| O2 | Techno exacte de l'implémentation Web Components (Lit vs vanilla Custom Elements) | Lit (ergonomie, ~5 Ko) vs vanilla (zéro dépendance) | À trancher en P7 ; le **contrat** `UiPort` est neutre quoi qu'il arrive |
| O3 | Binding URL : intégré au core (module Navigation) vs délégué à l'hôte | intégré opt-in / hôte | Module `Navigation` **opt-in** dans core ; sérialisation toujours dans le core |
| O4 | Granularité du `channel` du resolver (liste fermée vs extensible par plugin) | fermée (sûre) vs extensible | Liste **fermée** en v1 (transform, opacity, colorOverride, visibility, outline, cameraIntent, lightingIntent) ; extensible en v2 |
| O5 | `explorerId` : convention de génération (auteur manuel vs outil) | manuel vs `optimize-model` auto | L'outil `optimize-model` **génère/préserve** les ids ; auteur peut surcharger |

---

## 4. Vérification de cohérence

- ❏ Aucune référence résiduelle à « l'état Focus » comme valeur d'état (hors mention historique). — vérifié C4
- ❏ Aucun cycle dans la matrice de dépendances v2. — vérifié C6
- ❏ Aucune mention de mutation directe « mémoriser/restaurer » présentée comme la voie normative. — vérifié C1
- ❏ Aucune mention de `readPixels`/depth readback **synchrone** comme stratégie recommandée. — vérifié C13
- ❏ Le schéma ne contient plus de DSL de scénario (`timelines[].action`). — vérifié C12
- ❏ Aucun code source créé. — vérifié (docs uniquement)

*(Les cases ❏ sont cochées dans le résumé final de la réponse ; ce fichier trace les décisions.)*
