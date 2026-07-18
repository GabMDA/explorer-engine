# Architecture Review v1 — Explorer Engine

> **Rôle du relecteur** : Lead Software Architect, revue « 10 ans de durée de vie ».
> **Posture** : adversariale et sans complaisance. On cherche les défauts, pas les qualités.
> **Objet** : la spécification `docs/` v0.1.
> **Verdict court** : fondations saines et bien intentionnées, mais **plusieurs défauts structurels bloquants** doivent être corrigés **avant** d'écrire du code. En l'état, l'architecture couplerait durablement le moteur à des choix qui la rendraient difficile à faire évoluer et à tester. Ni catastrophique, ni prête.

---

## 1. Échelle de gravité

| Niveau | Signification | Action |
|--------|---------------|--------|
| **S1 — Bloquant** | Défaut structurel qui contaminera tout le code s'il n'est pas corrigé avant. Coût de correction *après* code = très élevé. | Corriger **avant** la moindre ligne. |
| **S2 — Majeur** | Risque sérieux de dette ou de blocage d'évolution ; corrigible tôt à coût modéré. | Corriger avant la phase concernée (P1–P3). |
| **S3 — Mineur** | Imperfection, ambiguïté ou risque localisé. | Trancher et documenter ; non bloquant. |

---

## 2. Défaut transversal n°1 (la racine de la moitié des problèmes)

> **L'état visuel de la scène est muté de façon impérative par une demi-douzaine de modules, chacun promettant de « restaurer l'original », sans aucune autorité de réconciliation centrale.**

State Manager applique des transforms et des surcharges de matériaux. Focus Manager applique dim/outline/isolate/transparence des occultants (autres surcharges de matériaux + transforms de caméra). Selection Manager applique un hover-highlight. Les états `modifier` (X-ray) surchargent l'opacité. Les plugins peuvent aussi toucher aux matériaux. Chacun « mémorise l'original et le restaure au retour » (chapitres 08, 09).

Ce modèle **ne compose pas**. Deux exemples concrets qui casseront :

- État `xray` (opacité coque = 0.2) actif, PUIS focus sur un composant de la coque (le focus « mémorise » 0.2 comme original, puis dim). On sort du focus → il restaure **0.2**. On désactive `xray` → il restaure quoi ? Le `xray` a mémorisé 1.0, mais le focus a écrasé la valeur entre-temps. **Résultat non déterministe selon l'ordre.**
- Une transition d'état interrompue par un focus, lui-même interrompu par un hover : trois « originaux » mémorisés en cascade, restaurés dans le désordre.

C'est le **problème du « last-writer-wins » sur un état partagé** sans couche de composition. Il est la cause directe des findings F1, F2, F3, F8 ci-dessous.

**La bonne architecture est déclarative, pas impérative** : chaque sous-système déclare des *contributions* (couches) à l'état visuel ; un **résolveur** calcule l'état final par composition ordonnée, à chaque changement. On ne « restaure » jamais : on retire une couche et on recompose. C'est le cœur de la correction à apporter.

---

## 3. Défauts S1 — Bloquants (à corriger avant tout code)

### F1 — Pas de résolveur d'état visuel ; mutations impératives distribuées
- **Pourquoi c'est un problème** : voir §2. Réversibilité par « mémoriser/restaurer » réparties entre State, Focus, Selection, modifiers et plugins → bugs d'ordre, états incohérents, cauchemar de débogage sur 10 ans. C'est le défaut le plus grave.
- **Gravité** : **S1**.
- **Solutions** :
  1. *Statu quo amélioré* : définir un protocole strict de sauvegarde/restauration avec pile globale. → Fragile, ne compose toujours pas.
  2. **Résolveur d'état de rendu déclaratif (Render State Resolver)** : chaque contributeur (state base, modifiers, focus, selection, plugin) pousse une *couche* typée `{ target, property, value, priority, source }` dans un store ; un résolveur central calcule, par cible, la valeur effective (par priorité/ordre) et l'applique/interpole. Retirer un focus = retirer sa couche + recomposer. Aucune restauration manuelle.
  3. *ECS complet* (Entity-Component-System) : surdimensionné pour ce moteur, mais l'idée de « données → système qui calcule » est la bonne.
- **Recommandation** : **Solution 2**. C'est la décision d'architecture la plus importante du projet. Elle simplifie *aussi* Focus, States et Selection (qui deviennent de simples producteurs de couches). À spécifier comme un nouveau module noyau (« Render State / Scene State Resolver ») **avant** P4.

### F2 — Frontière `Focus` vs `État Focus` non tranchée → responsabilités qui se chevauchent
- **Pourquoi** : le chapitre 08 (mécanisme) et le chapitre 09 (état `Focus`) se recouvrent ; j'ai « reconnu » l'ambiguïté au lieu de la **résoudre**. Deux sous-systèmes mutent caméra + matériaux avec des règles de réversibilité concurrentes. Qui possède la caméra pendant un focus dans un état ? Indéfini.
- **Gravité** : **S1** (couplage + F1).
- **Solutions** :
  1. `Focus` n'existe **pas** comme état ; c'est purement un mécanisme transverse produisant des couches (via F1). Les états ne « font » jamais de focus.
  2. `Focus` est **uniquement** un état ; le « Focus System » disparaît, absorbé par le State Manager.
  3. Garder les deux avec un contrat de préséance explicite.
- **Recommandation** : **Solution 1**. Le Focus est un *mécanisme* (producteur de couches caméra + matériaux), jamais une valeur d'état. Supprimer `Focus` de la liste d'états de référence du chapitre 09. Cela élimine un chevauchement entier.

### F3 — Modèle de transforms `relative: true` incompatible avec la réversibilité déterministe
- **Pourquoi** : un transform « relatif » appliqué depuis la valeur *courante* rend la cible dépendante de l'historique. Combiné aux interruptions (chapitre 09 « interpoler depuis l'état courant »), la pose de repos n'est plus récupérable de façon fiable.
- **Gravité** : **S1**.
- **Solutions** :
  1. Interdire `relative` ; tout transform d'état est **absolu**, exprimé comme offset par rapport à une **pose de repos canonique unique** (le modèle au chargement), jamais par rapport à l'état courant.
  2. Garder `relative` mais recalculer toujours à partir de la pose de repos mémorisée une fois (au chargement).
- **Recommandation** : **Solution 1**, intégrée à F1 : les états produisent des *couches de transform absolues* depuis la pose de repos ; le résolveur interpole `repos+Σcouches`. Déterministe, réversible, composable.

### F4 — Le `core` embarque l'UI DOM → moteur non « headless », non embarquable, difficile à tester
- **Pourquoi** : le chapitre 03 place `ui/` **dans** `packages/core`. Conséquences : (a) quiconque veut le moteur 3D avec sa propre UI (React/Vue/Svelte maison) doit quand même embarquer notre UI DOM ; (b) la logique (états, focus, sélection, config) n'est pas testable sans DOM/WebGL, ce qui contredit P9 (testabilité) ; (c) le contrat d'injection d'UI par plugin dépend d'une techno UI… non choisie (F5). C'est un couplage majeur qui se paie pendant 10 ans (embarquabilité = condition de survie d'un moteur).
- **Gravité** : **S1**.
- **Solutions** :
  1. Tout laisser dans `core` (statu quo). → Verrouille l'embarquabilité et la testabilité.
  2. **Séparer trois couches** : `@explorer-engine/core` **headless** (config, états, focus, sélection, hotspot *logique*, animation, event bus, résolveur d'état — **zéro DOM, zéro WebGL**) ; `@explorer-engine/renderer-three` (adaptateur rendu) ; `@explorer-engine/ui` (overlay DOM par défaut, **remplaçable**). Le noyau pilote via des ports (interfaces).
  3. Deux couches (headless+rendu ensemble / ui séparée). → Compromis, mais garde WebGL couplé à la logique.
- **Recommandation** : **Solution 2**. Architecture *hexagonale* : noyau headless + adaptateurs (rendu, UI, entrées) derrière des ports. Débloque : tests unitaires sans navigateur, réutilisation avec une UI tierce, et l'évolution WebGPU/XR (chapitre 18) devient un simple adaptateur. À acter dans les chapitres 02 et 03 **avant** P0.

### F5 — Choix technologique de l'UI reporté alors qu'il est structurant (points d'extension plugins)
- **Pourquoi** : le chapitre 12 reporte le framework UI « à la roadmap », mais l'API d'injection d'UI par les plugins (chapitre 10, « slots »), le theming par tokens, le responsive et la testabilité en **dépendent**. On ne peut pas figer le `plugin-sdk` (un livrable v1) sans connaître le modèle d'UI. Reporter un choix load-bearing = risque de réécriture du SDK.
- **Gravité** : **S1** (bloque la stabilité du SDK).
- **Solutions** :
  1. Choisir un framework lourd (React) dans le core. → Impose une dépendance lourde aux intégrateurs ; couple.
  2. **UI par défaut en vanilla/Web Components + Custom Elements**, exposée via un **contrat de « surface UI » agnostique** (le plugin déclare des *slots* et des *descripteurs* de composants, pas du JSX). L'`@explorer-engine/ui` est une *implémentation* de ce contrat, remplaçable.
  3. Définir seulement le **contrat** d'extension UI maintenant, implémenter plus tard.
- **Recommandation** : **Solution 2 + 3** : figer **le contrat** d'extension UI (indépendant du framework) dès maintenant ; implémenter l'UI par défaut en Web Components (zéro dépendance imposée, natif, thématisable par CSS custom properties, accessible). Le SDK dépend du *contrat*, jamais d'un framework.

### F6 — La matrice de dépendances contredit ses propres règles (cycle réel + sur-couplage)
- **Pourquoi** : au chapitre 02 §2.20, sous le titre « DOIT rester acyclique », la matrice déclare `Lighting → Environment` **et** `Environment → Lighting` : **un cycle**. `Model Loader → Lighting → Environment → Lighting` propage le cycle. Par ailleurs `Focus Manager` dépend directement de 6 modules — le sur-couplage nié par le principe P5 est visible dans le tableau. Une spécification qui se contredit dans le même chapitre est un signal d'alerte.
- **Gravité** : **S1** (incohérence fondatrice, cause de couplage).
- **Solutions** :
  1. Corriger à la main les deux cases fautives. → Traite le symptôme.
  2. **Refonder le modèle de dépendances** : (a) IBL/env map est **une** ressource partagée possédée par un seul module (fusionner la responsabilité env map entre Lighting et Environment, ou introduire un `EnvironmentResource` que les deux consomment sans se référencer) ; (b) réduire Focus/State à des *producteurs de couches* (via F1) → ils ne « dépendent » plus de Lighting/Camera/UI, ils émettent des couches et des intentions. Recalculer la matrice et **la faire vérifier par le lint** (règle anti-cycle, chapitre 15).
- **Recommandation** : **Solution 2**. F1 + F4 font tomber la majorité des dépendances « remontantes » ; il reste à casser le cycle Lighting/Environment via une ressource partagée. Régénérer la matrice et la rendre *exécutable* (test de non-régression sur le graphe de dépendances).

### F7 — Identité des composants fondée sur les noms de nœuds glTF : backbone fragile
- **Pourquoi** : tout le système (hotspots, focus, états, sélection) référence des `nodes` par **nom** (chapitres 05/06). Or les noms de nœuds glTF ne sont **pas** un identifiant stable : un renommage dans Blender, un ré-export, une déduplication d'outil de compression (gltfpack renomme/fusionne !), et toute la config casse silencieusement. C'est la colonne vertébrale du moteur posée sur du sable.
- **Gravité** : **S1** (fragilité systémique + F7 casse en production sur un simple ré-export).
- **Solutions** :
  1. Rester sur les noms + validation stricte au build. → Ne protège pas contre le ré-export.
  2. **Identité stable via `extras`/propriété custom glTF** (`KHR`/`extras.explorerId`) posée à la préparation : le moteur mappe par cet ID, pas par le nom. L'outil `optimize-model` garantit sa préservation.
  3. Mapping par **chemin hiérarchique** (plus stable que le nom seul, mais casse au reparentage).
  4. Empreinte géométrique (hash de mesh) comme repli. → Coûteux, faux positifs.
- **Recommandation** : **Solution 2** en primaire, **1** en repli (nom si pas d'ID), avec **avertissement** de l'outil de validation quand un package repose sur les noms. Documenter la « stabilité d'identité » comme contrat du pipeline d'assets. À trancher **avant** P2-T4 (indexation des nœuds).

---

## 4. Défauts S2 — Majeurs (corriger tôt, avant la phase concernée)

### F8 — Espace d'états combinatoire (base × modifiers × focus) sans validation ni réconciliation
- **Pourquoi** : `allowedFrom` ne valide que les transitions entre bases. Les modifiers (combinables) × focus × transitions créent un espace implicite non validé → combinaisons visuellement absurdes ou conflictuelles (deux modifiers touchant la même opacité). Lié à F1.
- **Gravité** : **S2**.
- **Solutions** : (1) documenter les conflits ; (2) **résolveur (F1) avec priorités déclarées** par couche + règles d'exclusion mutuelle entre modifiers ; (3) machine à états produit (statecharts/parallel regions).
- **Recommandation** : **Solution 2** ; adopter le vocabulaire des **statecharts** (régions parallèles pour les modifiers, région principale pour les bases) — modèle éprouvé pour exactement ce problème.

### F9 — Portabilité du package contredite par les plugins « enregistrés côté hôte »
- **Pourquoi** : le chapitre 04 promet un package « autonome et portable » ; le chapitre 10 exige que les plugins soient enregistrés par l'hôte. Un package déclarant `plugins:[guided-tour]` **ne fonctionne pas** sur un hôte qui ne l'a pas enregistré. Les deux affirmations sont incompatibles.
- **Gravité** : **S2**.
- **Solutions** : (1) livrer un **jeu de plugins standard** toujours présent dans le runtime officiel (le package est portable *au sein du runtime officiel*) ; (2) déclarer des **capabilities requises** + dégradation gracieuse si absentes ; (3) plugins sandboxés chargeables depuis le package (repoussé au ch.18, risque sécurité).
- **Recommandation** : **1 + 2**. Définir un **runtime de référence** avec plugins standard garantis, et un mécanisme de `requiredCapabilities` avec dégradation. Reformuler la promesse « portable » en « portable sur tout runtime conforme au profil X ». Corriger l'incohérence de wording dans les deux chapitres.

### F10 — Événements « stringly-typed » : maintenance et refactoring à risque sur 10 ans
- **Pourquoi** : `"hotspot:activated"` en chaînes libres → typos silencieuses, pas de « find all references », pas de vérification de payload, couplage caché. À grande échelle et dans la durée, c'est un puits de bugs. Le chapitre dit aussi que « certains événements par frame contournent le bus » sans définir la frontière.
- **Gravité** : **S2**.
- **Solutions** : (1) convention + tests ; (2) **catalogue d'événements typé** (map nom→payload vérifiée à la compilation) exposé par le core et le SDK ; (3) émetteurs typés par domaine.
- **Recommandation** : **Solution 2** + règle normative : **aucune donnée par frame ne transite par le bus** (la render loop pousse les données chaudes via appels directs/ports). Figer le catalogue d'événements comme partie du contrat SDK.

### F11 — Propriété de la render loop mal définie : « rendu à la demande » vs animations continues
- **Pourquoi** : le chapitre 14 vante le rendu à la demande, mais un clip GLB en boucle (ventilateur), l'autoplay idle, ou un plugin audio spatial rendent la scène « jamais statique ». Sans **contrat d'ownership de frame** (qui maintient la boucle active, qui demande un rendu ponctuel), soit on rend en continu (bénéfice nul), soit une animation se fige (bug).
- **Gravité** : **S2**.
- **Solutions** : (1) toujours rendre à 60 (abandon du bénéfice) ; (2) **API `requestRender()` + « animation frame handles »** : tout producteur d'animation détient un handle qui garde la boucle active tant qu'il vit ; sinon la boucle dort. Le résolveur (F1) marque « dirty » sur changement de couche.
- **Recommandation** : **Solution 2**. Spécifier ce contrat dans le chapitre 02 (Core) et 11 (Animation) **avant** P1-T5.

### F12 — Absence totale de deep-linking / sérialisation d'état (URL, partage, back button)
- **Pourquoi** : produit web destiné à durer, sans moyen de partager « le focus GPU du PC en vue éclatée » via URL, ni de gérer le bouton Précédent du navigateur. C'est une attente de base qui touche State, Focus et un futur Router. L'ajouter *après* coup impose de rétrofiter la sérialisation dans des états déjà codés.
- **Gravité** : **S2**.
- **Solutions** : (1) ignorer (dette) ; (2) **état sérialisable de bout en bout** : (base + modifiers + focus stack + vue) ↔ chaîne d'URL ; un module `Navigation/Router` optionnel synchronise history. (3) Laisser à l'hôte via l'API publique.
- **Recommandation** : **Solution 2 pour la capacité de sérialisation** (l'état runtime DOIT être sérialisable/désérialisable dès la conception), **3 pour le binding URL** (module optionnel/hôte). Exigence à inscrire au chapitre 09/02 maintenant, car elle contraint la forme de l'état.

### F13 — Occlusion des hotspots par depth-readback : stall GPU→CPU
- **Pourquoi** : le chapitre 07 propose « depth buffer test » comme stratégie d'occlusion. Une lecture synchrone du depth buffer (`readPixels`) **bloque le pipeline** GPU→CPU et tue le frame budget — l'inverse de l'objectif du chapitre 14. Le raycast CPU, lui, ne passe pas à l'échelle sur maillages lourds.
- **Gravité** : **S2**.
- **Solutions** : (1) raycast CPU throttlé sur bounding volumes (pas la géométrie fine) ; (2) depth **asynchrone** (PBO/`getBufferSubDataAsync` WebGL2) avec latence d'1 frame ; (3) occlusion approximée par test contre bounding boxes des gros occultants.
- **Recommandation** : **1 (BVH sur bounding volumes) + 3**, jamais de readback synchrone. Retirer la mention « depth buffer test » naïve du chapitre 07 ou la qualifier « async uniquement ».

### F14 — DSL de timelines déclaratives en JSON : scope creep vers un langage de script
- **Pourquoi** : `animations.timelines` (chapitre 05/11) invente un mini-langage de séquençage en JSON. Historiquement, ces DSL dérivent vers conditions/boucles/variables (une pseudo-Turing-complétude) et deviennent impossibles à maintenir et à valider. De plus, il **double** le plugin Guided Tour (deux systèmes de séquençage).
- **Gravité** : **S2**.
- **Solutions** : (1) enrichir le DSL (piège) ; (2) **noyau minimal** : le core ne connaît que des *transitions atomiques* (état, vue, focus) ; toute *séquence/scénario* est un plugin (Tour) au-dessus de l'Animation Engine ; supprimer `timelines` déclaratives du schéma v1 (ou les réduire à une liste plate de steps sans logique). (3) Externaliser dans Explorer Studio (génère des steps simples).
- **Recommandation** : **Solution 2**. Une seule voie de scénarisation (plugin), un noyau d'animation qui interpole et enchaîne mais **ne scripte pas**. Réduire le schéma en conséquence.

### F15 — Politique de compatibilité de schéma incomplète (forward-compat, matrice core/schema/sdk)
- **Pourquoi** : la spec gère la migration *montante* (package ancien sur moteur récent) mais pas le cas inverse (package `schemaVersion` plus récente / champs inconnus sur moteur plus ancien). Validation stricte = rejet ; tolérante = ignorer+warn : non tranché. De plus, 3 artefacts versionnés (core/schema/sdk) sans **matrice de compatibilité**.
- **Gravité** : **S2**.
- **Solutions** : (1) rejet strict (simple, rigide) ; (2) **tolérance des champs inconnus au sein d'une même majeure** (ignore+warn) + rejet inter-majeure ; (3) capability negotiation.
- **Recommandation** : **Solution 2** + publier une **matrice de compatibilité** core↔schema↔sdk et une politique semver explicite. À ajouter au chapitre 05.

### F16 — Précision de profondeur sur plage d'échelles extrême (montre ↔ fusée)
- **Pourquoi** : le moteur vise des objets du millimètre à la dizaine de mètres. Le z-buffer WebGL (float) provoque du z-fighting et des artefacts sur grande plage near/far. `model.scale`/`center` aident mais ne suffisent pas si un objet a lui-même une grande dynamique interne.
- **Gravité** : **S2**.
- **Solutions** : (1) auto near/far agressif (déjà prévu, insuffisant seul) ; (2) **normalisation systématique vers un volume unité** au chargement + near/far dérivés de la bounding box ; (3) **logarithmic depth buffer** optionnel activable par package.
- **Recommandation** : **2 par défaut + 3 en option**. Documenter la normalisation comme invariant du Model Loader.

### F17 — Modèle d'adressage à trois niveaux (node / component / group) stringly-typed
- **Pourquoi** : les cibles mélangent noms de nœuds, ids de composants, et `"group:internals"` (préfixe magique dans une chaîne). Trois schémas d'adressage non typés cohabitent → erreurs, validation faible, refactor risqué.
- **Gravité** : **S2**.
- **Solutions** : (1) documenter la convention ; (2) **type de cible discriminé** (`{ kind: "component"|"group"|"node", id }`) au lieu de préfixes de chaîne ; unifier tout le référencement autour des **composants** (les nœuds ne sont référencés qu'à la définition d'un composant, jamais ailleurs).
- **Recommandation** : **Solution 2**. Le reste du schéma (hotspots, états, focus) ne référence **que** des composants/groupes typés ; les nœuds bruts disparaissent de la surface d'API au-delà de `components[].nodes`.

### F18 — Modèle de concurrence/annulation du chargement absent
- **Pourquoi** : `load(url)` puis un second `load()` pendant le premier : fetches et décodeurs WASM en vol, races, fuites. Le chapitre parle de `dispose` mais pas d'**annulation** (AbortController, tokens) ni de sérialisation des chargements.
- **Gravité** : **S2**.
- **Solutions** : (1) ignorer (bug garanti) ; (2) **jeton d'annulation** de bout en bout (fetch/décodage/build) + politique « un chargement actif à la fois, le nouveau annule l'ancien » ; (3) file d'attente.
- **Recommandation** : **Solution 2**. À spécifier dans Core + Resource Manager avant P2/P3.

---

## 5. Défauts S3 — Mineurs (trancher et documenter)

### F19 — i18n : distinction littéral/clé par préfixe `"@"` fragile
- **Pourquoi** : ambiguïté (un texte commençant par `@`), échappement non défini, mélange de deux types dans un champ.
- **Gravité** : **S3**. **Reco** : champs i18n **explicitement typés** (`{ "$t": "key" }` ou champ dédié), pas d'heuristique sur le contenu.

### F20 — Sur-vente du « déterminisme » comme fondation du multijoueur
- **Pourquoi** : rendu WebGL, chargement async et flottants rendent le déterminisme *de rendu* illusoire ; le chapitre 18 s'appuie dessus pour le multijoueur.
- **Gravité** : **S3**. **Reco** : reformuler — multijoueur = **synchronisation d'état** (événements/snapshots sérialisés, cf. F12), pas simulation déterministe. Restreindre P9 à « transitions logiques déterministes à entrées égales ».

### F21 — Hébergement des décodeurs WASM + exigences COOP/COEP/CSP non traitées
- **Pourquoi** : Draco/KTX2/Basis (WASM, parfois threads/SharedArrayBuffer) exigent des en-têtes cross-origin isolation et une CSP compatible ; l'inline artifact/CSP et l'intégration hôte en dépendent.
- **Gravité** : **S3**. **Reco** : documenter l'hébergement des décodeurs (self-host, versionnés) et les exigences d'en-têtes ; fournir un repli non-threadé.

### F22 — `config.json` monolithique, sans `$ref` ni découpage
- **Pourquoi** : gros objets (hotspots/panels/i18n) → fichier ingérable, conflits de merge, pas d'authoring collaboratif.
- **Gravité** : **S3**. **Reco** : autoriser des **références externes** (`panels.json`, `hotspots.json`) résolues par le Config Loader ; garder `config.json` comme manifeste.

### F23 — Pas de service d'accessibilité coordinateur
- **Pourquoi** : live regions, navigation alternative, annonces sont dispersées (UI/Hotspot/Focus/State) → risque d'incohérence et de trous.
- **Gravité** : **S3**. **Reco** : un petit **service A11y** central (annonceur unique, registre de navigation alternative) consommé par les autres.

### F24 — Pont de tokens 2D↔3D sans règle de color space
- **Pourquoi** : les tokens (chaînes CSS sRGB) partagés avec la 3D (fond, hotspots, outline) nécessitent conversion sRGB→linéaire ; non spécifié.
- **Gravité** : **S3**. **Reco** : définir la conversion au passage token→matériau/scène.

### F25 — `Model Loader` dépend d'`Animation Manager` (direction douteuse)
- **Pourquoi** : dans la matrice, le loader « dépend de » l'Animation Manager alors qu'il lui *fournit* des clips. Dépendance à inverser (le loader produit des données de clip ; l'Animation Manager les consomme).
- **Gravité** : **S3**. **Reco** : inverser — le loader émet un **descripteur de clips** (données pures) ; l'Animation Manager les enregistre. Aligné avec F4 (headless).

### F26 — Overlap Selection hover-highlight vs Focus outline (deux systèmes de surbrillance)
- **Pourquoi** : deux voies de mise en évidence (hover de Selection, outline de Focus) → styles/priorités concurrents (cf. F1).
- **Gravité** : **S3**. **Reco** : unifier via des couches du résolveur (F1) avec priorité hover < focus.

---

## 6. Ce qui est solide (à conserver)

Bref, pour équilibrage, non par flatterie :

- **Séparation moteur/contenu (P1)** et l'idée data-driven : juste et différenciante.
- **Système de plugins** comme frontière d'extension : bon principe (à réconcilier avec F9/F5).
- **Design tokens** et respect des préférences système : solide.
- **Accessibilité traitée dès le départ** (rare et précieux), même si à recoordonner (F23).
- **Roadmap incrémentale et démontrable** : excellente discipline.
- **Compression Draco/KTX2/Meshopt et rendu à la demande** : bons instincts perf (à préciser via F11/F13).

---

## 7. Liste priorisée des modifications AVANT d'écrire du code

> Ordre = dépendances entre corrections. Les S1 sont bloquants ; ne pas coder P0 avant d'avoir tranché C1–C7.

| # | Correction | Findings | Sévérité | Chapitres à amender |
|---|-----------|----------|----------|---------------------|
| **C1** | Introduire le **Render State Resolver** déclaratif (couches typées, priorités, recomposition ; suppression du modèle mémoriser/restaurer). | F1, F8, F26, F3 | S1 | 02, 08, 09 (+ nouveau chapitre) |
| **C2** | Passer à une **architecture headless + adaptateurs** (core sans DOM/WebGL ; `renderer-three` et `ui` séparés derrière des ports). | F4, F25 | S1 | 02, 03 |
| **C3** | **Figer le contrat d'extension UI** (agnostique du framework) ; UI par défaut en Web Components ; le SDK dépend du contrat, pas d'un framework. | F5 | S1 | 03, 10, 12 |
| **C4** | Trancher **Focus = mécanisme, pas état** ; retirer l'état `Focus`. | F2 | S1 | 08, 09 |
| **C5** | **Identité stable des composants** via `extras.explorerId` (repli nom + warning). | F7, F17 | S1 | 05, 06 |
| **C6** | **Corriger le modèle de dépendances** : casser le cycle Lighting/Environment (ressource env partagée), régénérer la matrice, rendre l'anti-cycle **exécutable** (lint/test). | F6, F25 | S1 | 02 |
| **C7** | Définir le **contrat de render-loop ownership** (`requestRender` + frame handles) cohérent avec le résolveur (dirty). | F11 | S1/S2 | 02, 11, 14 |
| **C8** | Réconcilier **portabilité vs plugins** : runtime de référence + `requiredCapabilities` + dégradation ; corriger le wording. | F9 | S2 | 04, 10 |
| **C9** | **Catalogue d'événements typé** + règle « pas de données par frame sur le bus ». | F10 | S2 | 02, 15 |
| **C10** | Rendre l'**état runtime sérialisable** (base+modifiers+focus+vue) ; router URL optionnel. | F12, F20 | S2 | 02, 09, 18 |
| **C11** | **Statecharts** pour base/modifiers (régions parallèles) + règles d'exclusion. | F8 | S2 | 09 |
| **C12** | Réduire le **DSL de timelines** : transitions atomiques au noyau, scénarios en plugin. | F14 | S2 | 05, 11 |
| **C13** | **Occlusion sans readback synchrone** (BVH bounding-volumes + async). | F13 | S2 | 07 |
| **C14** | **Politique de compatibilité** schéma (forward-compat, champs inconnus) + matrice core/schema/sdk. | F15 | S2 | 05 |
| **C15** | **Normalisation vers volume unité** + option depth log. | F16 | S2 | 06, 14 |
| **C16** | **Modèle d'annulation/concurrence** du chargement (tokens, un chargement actif). | F18 | S2 | 02, 04 |
| **C17** | Corrections mineures : i18n typé (F19), en-têtes WASM/CSP (F21), `$ref` config (F22), service A11y (F23), color space tokens (F24). | F19-F24 | S3 | 05, 12, 13, 14 |

### Séquencement recommandé
1. **Semaine de correction (avant P0)** : trancher et amender pour **C1–C7** (tous S1). Ce sont les décisions qui, prises tard, imposeraient une réécriture. Elles sont **interdépendantes** (C1 simplifie C4/C6 ; C2 conditionne C3).
2. **Avant les phases concernées** : intégrer **C8–C16** aux chapitres, en amont de la phase qui les touche (ex. C13 avant P4, C11 avant P6, C14 avant P3).
3. **C17** : au fil de l'eau, non bloquant.

> **Conclusion** : l'ossature conceptuelle est bonne, mais quatre décisions structurelles manquent — **(1) un résolveur d'état déclaratif, (2) un noyau headless à adaptateurs, (3) un contrat d'UI/événements typé, (4) une identité d'assets stable**. Les acter maintenant coûte quelques jours ; les découvrir après P4 coûterait une réécriture. Le report d'une semaine que vous évoquez est le bon arbitrage.
