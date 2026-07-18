# Definition of Done (DoD) — Explorer Engine

> Une tâche/PR n'est **terminée** que lorsque **tous** les critères ci-dessous sont satisfaits. « Ça marche sur ma machine » n'est pas *Done*. La DoD protège la qualité et les invariants de la [Constitution](../ENGINE_CONSTITUTION.md) sur la durée.

---

## 1. Comment utiliser ce document

- L'**auteur** vérifie la DoD **avant** de demander la revue.
- Le **relecteur** confirme la DoD pendant la revue (voir [Checklist de revue](./CODE_REVIEW_CHECKLIST.md)).
- Une tâche de la [Roadmap](./16-roadmap.md) est cochée **uniquement** si sa DoD **et** ses **critères de validation propres** sont remplis.
- **Aucune exception silencieuse** : un critère non applicable doit être justifié explicitement dans la PR (voir §4).

---

## 2. Critères universels (toute PR)

### 2.1 Conformité à la spécification
- [ ] La tâche correspond à un élément de la **roadmap** ou à une issue acceptée.
- [ ] Le changement **respecte la [Spécification v2](./README.md)** ; tout écart est tracé (ADR + amendement de spec).
- [ ] Aucun invariant de la **[Constitution](../ENGINE_CONSTITUTION.md)** n'est enfreint.
- [ ] Si décision d'architecture : un **ADR** est ajouté/mis à jour.

### 2.2 Architecture
- [ ] **Core headless** : aucun `three`/DOM introduit dans `@explorer-engine/core` (L8/L9).
- [ ] **Aucune mutation directe de la scène** : l'état visuel passe par des **couches** du Render State Resolver (L5–L7).
- [ ] **Événements typés** ; **aucune donnée par frame** sur le bus (L11).
- [ ] **DAG** préservé : aucun nouveau cycle de dépendances (L10) — vérifié par le lint anti-cycle.
- [ ] Encapsulation respectée : imports via API publique des modules uniquement.
- [ ] **Adressage typé** et **`explorerId`** utilisés (nom de nœud = repli avec warning) (L12/L13).

### 2.3 Tests
- [ ] Tests **unitaires** ajoutés/mis à jour pour la logique introduite.
- [ ] Tests **d'intégration** si des modules interagissent.
- [ ] Tests **e2e** si un parcours utilisateur critique est touché.
- [ ] Tout **bug corrigé** a un **test de non-régression**.
- [ ] Les tests sont **déterministes** (temps simulé pour les animations).
- [ ] La suite **passe** localement et en CI.

### 2.4 Qualité de code
- [ ] **Type-check** strict : vert.
- [ ] **Lint** + **format** : verts (bloquants).
- [ ] Pas de `any` non justifié ; pas de nombre magique ; fonctions à responsabilité unique.
- [ ] **`dispose`** implémenté pour toute ressource allouée ; **aucune fuite** (GPU/DOM/écouteurs).
- [ ] Chargements **annulables** (AbortSignal) le cas échéant (L20/C16).

### 2.5 Performance
- [ ] **Rendu à la demande** respecté : `requestRender()`/frame handles ; pas de boucle 60 FPS inconditionnelle (L18).
- [ ] **Zéro allocation** dans les boucles chaudes (render/animation/projection/résolution) (L19).
- [ ] **Budgets de perf** tenus sur les packages de référence (FPS/mémoire/draw calls) ; pas de régression.
- [ ] Aucune **lecture GPU→CPU synchrone** introduite (L21).

### 2.6 Accessibilité (si UI/interaction)
- [ ] Navigable **au clavier** ; ordre logique ; `Échap` ferme/retourne.
- [ ] **ARIA** correct ; **focus visible** ; changements annoncés via le **service A11y central**.
- [ ] **Contraste WCAG 2.1 AA** ; information non portée uniquement par la couleur.
- [ ] Préférences système respectées (`reduced-motion`, `color-scheme`, `contrast`).
- [ ] Équivalent **non-3D** (liste) préservé pour les hotspots.

### 2.7 Sécurité
- [ ] Contenu de package **assaini** avant rendu.
- [ ] Politique de chargement respectée (relatif / liste blanche) ; `$ref` dans le package.
- [ ] **Aucun code arbitraire** de package exécuté.
- [ ] Aucun **secret** ni identifiant de modèle d'assistant committé.

### 2.8 Documentation
- [ ] Chapitre(s) de spec impacté(s) **mis à jour** dans la même PR.
- [ ] **API publique** documentée (TSDoc) renvoyant à la spec.
- [ ] **CHANGELOG** (moteur/schéma) mis à jour si comportement/format modifié.
- [ ] **ADR** si décision d'architecture.

### 2.9 Revue & intégration
- [ ] **Au moins une approbation** d'un mainteneur/pair.
- [ ] **CI entièrement verte** (types, lint, format, tests, build, validation des packages, budgets perf/a11y).
- [ ] Toutes les remarques de revue **résolues**.
- [ ] **Démonstration** possible du livrable (capture/vidéo/étapes) pour une tâche à surface visible.

---

## 3. Critères spécifiques par type de livrable

### 3.1 Module du core (headless)
- [ ] Testable **sans navigateur** (aucune dépendance DOM/WebGL).
- [ ] Interagit via **ports**/événements ; ne référence aucun objet 3D concret.

### 3.2 Adaptateur (`renderer-three` / `ui-webcomponents` / `input-dom`)
- [ ] Implémente **fidèlement** le port ; aucune fuite d'abstraction du backend vers le core.
- [ ] `three`/DOM confinés à ce package.

### 3.3 Plugin
- [ ] Dépend **uniquement** du `plugin-sdk` ; **découplé** des autres plugins (L15).
- [ ] Cycle de vie complet (`register→…→dispose`) **sans fuite**.
- [ ] Erreurs **isolées** (ne casse pas le moteur) ; capacité déclarée si fournie.
- [ ] Contribue au visuel via **couches** ; UI via descripteurs de slots.

### 3.4 Explorer Package (exemple/référence)
- [ ] **Data-only** (aucun code moteur).
- [ ] `explorerId` posés ; **`validate-package`** passe (warnings traités).
- [ ] Transforms **absolus** ; adressage **typé** ; chemins relatifs.
- [ ] Budgets d'assets raisonnables (compression, LOD, textures).

### 3.5 Schéma / config
- [ ] Rétrocompatibilité respectée (mineure) ou migration fournie (majeure) ; **matrice de compat** mise à jour.
- [ ] Défauts documentés ; validation à jour ; exemples cohérents.

---

## 4. Exceptions

Un critère **non applicable** doit être **explicitement** marqué `N/A — <raison>` dans la PR (ex. « pas de surface UI » pour §2.6). Un critère applicable **non satisfait** = tâche **non *Done***. Aucune exception implicite.

---

## 5. Definition of Done d'une **phase** de roadmap

En plus des DoD de chaque tâche :

- [ ] **Toutes** les tâches de la phase sont *Done*.
- [ ] La **démonstration de fin de phase** ([chapitre 16](./16-roadmap.md)) fonctionne.
- [ ] Aucune régression (tests, perf, a11y) par rapport à la phase précédente.
- [ ] Documentation de la phase à jour.
