# Checklist de revue de code — Explorer Engine

> À utiliser **avant chaque Pull Request** : l'**auteur** l'applique en auto-revue, le **relecteur** la re-vérifie. Elle complète la [Definition of Done](./DEFINITION_OF_DONE.md) et vérifie le respect de la [Constitution](../ENGINE_CONSTITUTION.md).
>
> **Règle** : un point ❌ sur un invariant de la Constitution **bloque** le merge, même si la CI est verte.

---

## 0. Portée & contexte
- [ ] La PR correspond à **une tâche** de la roadmap/issue ; elle est **petite et focalisée**.
- [ ] Le titre suit Conventional Commits ; la description dit **quoi** et **pourquoi**.
- [ ] Les critères de validation de la tâche sont explicitement satisfaits.

---

## 1. Architecture 🏛️
- [ ] **Généricité** : aucune connaissance d'un objet métier ; pas de `if (type === ...)` (L1).
- [ ] **Déclaratif** : rien codé en dur qui devrait être en config (hotspots, états, vues, panneaux) (L3/L4).
- [ ] **Core headless** : aucun `three`/DOM dans `core` ; `three` confiné à `renderer-three` (L8/L9).
- [ ] **Render State Resolver** : **aucune mutation directe** de la scène ; contributions par **couches** ; transforms **absolus** ; jamais de « sauvegarde/restauration » (L5–L7).
- [ ] **Ports** : interactions rendu/UI/entrées via `RendererPort`/`UiPort`/`InputPort` ; pas de fuite d'abstraction backend.
- [ ] **DAG** : aucun cycle de dépendances (lint anti-cycle vert) (L10).
- [ ] **Encapsulation** : imports via API publique de module uniquement (pas d'accès interne).
- [ ] **Identité/adressage** : `explorerId` (nom = repli warned) ; `Address` typé (L12/L13).
- [ ] **Responsabilité unique** : le module fait une seule chose ; pas de « fourre-tout ».
- [ ] Si décision d'archi : **ADR** présent/à jour (L28).

---

## 2. Performance ⚡
- [ ] **Rendu piloté** : `requestRender()`/frame handles ; pas de rendu sur scène stable (L18).
- [ ] **Zéro allocation** en boucle chaude (render/animation/projection/résolution de couches) (L19).
- [ ] **Aucune lecture GPU→CPU synchrone** (`readPixels`/depth readback bloquant) (L21).
- [ ] Recalculs conditionnés par des **dirty flags** (projection, cadrage, composition).
- [ ] Assets : compression/instancing/LOD respectés côté package ; textures budgétées.
- [ ] **Budgets de perf** tenus (FPS/mémoire/draw calls) ; pas de régression mesurée.
- [ ] **Mémoire** : `dispose` complet ; pas de fuite ; pools là où pertinent (L20).
- [ ] Chargements **annulables** ; un seul chargement actif (C16).

---

## 3. Accessibilité ♿
- [ ] **Clavier** : toute action réalisable ; ordre de tabulation logique ; `Échap` ferme/retourne.
- [ ] **ARIA** : rôles/labels/états corrects ; **focus visible** contrasté.
- [ ] **Annonces** via le **service A11y central** (une seule live region).
- [ ] **Contraste WCAG 2.1 AA** ; pas d'info portée uniquement par la couleur.
- [ ] Préférences système : `reduced-motion`, `color-scheme`, `contrast`, `forced-colors`.
- [ ] **Équivalent non-3D** des hotspots (liste navigable) préservé.
- [ ] Cibles tactiles suffisantes ; i18n/RTL non cassés.

---

## 4. Sécurité 🔒
- [ ] Contenu de package **assaini** avant tout rendu HTML.
- [ ] Politique de chargement respectée (relatif / liste blanche) ; `$ref` résolus **dans** le package.
- [ ] **Aucun code arbitraire** de package exécuté (plugins enregistrés côté hôte).
- [ ] Décodeurs WASM **auto-hébergés** ; en-têtes CSP/COOP/COEP documentés si nécessaires.
- [ ] Aucun **secret**, credential, hostname interne, ni identifiant de modèle d'assistant dans le diff.
- [ ] Dépendances : ajout justifié, maintenu, minimal.

---

## 5. Modularité & maintenabilité 🧩
- [ ] Frontières nettes ; **faible couplage**, forte cohésion.
- [ ] **Injection de dépendances** (pas d'instanciation en dur des dépendances lourdes) → testable.
- [ ] Substituabilité : les stratégies (occlusion, easing, backend) respectent leur contrat.
- [ ] **Plugins** : dépendent du `plugin-sdk` uniquement ; **découplés** entre eux (L15) ; contribuent via couches ; UI via descripteurs ; `dispose` complet ; erreurs isolées (L16/L17).
- [ ] Nommage clair et conforme ; pas de duplication évitable ; complexité maîtrisée.
- [ ] **Événements typés** ; aucune donnée par frame sur le bus (L11).

---

## 6. Tests ✅
- [ ] Tests **unitaires** pour la logique ; **intégration**/**e2e** si pertinent.
- [ ] **Non-régression** ajoutée pour chaque bug corrigé.
- [ ] Tests **déterministes** (temps simulé) ; pas de tests fragiles/aléatoires.
- [ ] Couverture significative de la **logique du noyau** (headless).
- [ ] La suite passe en local **et** en CI.

---

## 7. Documentation 📚
- [ ] Chapitre(s) de spec impacté(s) **mis à jour** dans la même PR.
- [ ] **API publique** documentée (TSDoc → spec).
- [ ] **CHANGELOG** (moteur/schéma) mis à jour si comportement/format change ; **matrice de compat** si schéma/SDK.
- [ ] Commentaires expliquant le *pourquoi* des points non évidents/invariants.

---

## 8. Cohérence finale 🧭
- [ ] La PR **n'introduit aucune contradiction** avec la spec v2 ni la Constitution.
- [ ] La **[Definition of Done](./DEFINITION_OF_DONE.md)** est satisfaite (ou N/A justifiés).
- [ ] **CI entièrement verte** ; au moins **une approbation** ; remarques **résolues**.
- [ ] Pour une surface visible : **démonstration** fournie (capture/vidéo/étapes).

---

### Verdict du relecteur

- ✅ **Approuvé** — tous les points critiques satisfaits.
- 🟡 **Changements demandés** — points non bloquants à corriger.
- ❌ **Bloqué** — au moins un invariant de la Constitution enfreint (préciser le(s) L concerné(s)).
