# Chapitre 17 — Bonnes pratiques

> Ce chapitre regroupe les bonnes pratiques à respecter tout au long du développement. Elles complètent et opérationnalisent les principes (chapitre 01) et les standards (chapitre 15).

---

## 17.1 Pratiques d'architecture

1. **Appliquer le *Generic Test*** avant toute fonctionnalité noyau : « vaut-elle pour *tout* objet ? » Sinon → plugin/config (chapitre 01).
2. **Ne jamais coupler le noyau à un objet** : aucun `if (type === "voiture")`, aucune constante métier dans le core (P1).
3. **Préférer la configuration au code** : si un besoin courant exige du code, étendre le schéma (P2).
4. **Respecter le DAG** : pas de dépendance montante ni de cycle ; communication montante par événements.
5. **Encapsuler** : importer uniquement l'API publique d'un module ; jamais ses internes.
6. **Injecter les dépendances** ; ne pas instancier ses dépendances lourdes en dur (testabilité).
7. **Un module, une responsabilité** ; scinder dès qu'un module « fait deux choses ».
8. **Isoler le backend 3D** (Three.js) derrière le Renderer pour préparer l'avenir (WebGPU).

---

## 17.2 Pratiques de robustesse (fail gracefully)

1. **Ne jamais planter sur un contenu imparfait** : valider et dégrader (P6).
2. **Messages d'erreur exploitables** : quoi, où, comment corriger.
3. **Défauts partout** : un `config.json` minimal doit fonctionner.
4. **Placeholders** pour assets manquants (texture, image, audio).
5. **Frontières d'erreur** autour du chargement de package et des plugins.
6. **Pas d'échec silencieux** : toujours journaliser (Diagnostics).
7. **Interruptions propres** : une nouvelle action annule proprement l'animation/transition en cours, sans état incohérent.

---

## 17.3 Pratiques de performance

1. **Rendu à la demande** : ne pas rendre une scène statique (chapitre 14).
2. **Zéro allocation par frame** dans les boucles chaudes (render, animation, projection).
3. **Dirty flags** : ne recalculer (projection, cadrage) que si nécessaire.
4. **Batch DOM** et transforms GPU pour les hotspots.
5. **Compression par défaut** : Draco + KTX2 + Meshopt.
6. **Instancing** des répétitions.
7. **Lazy loading** en cascade ; décodeurs paresseux.
8. **Qualité adaptative** ; réglages mobiles prudents.
9. **Mesurer avant d'optimiser** : prof­iler avec Diagnostics ; ne pas optimiser à l'aveugle.
10. **Budgets de perf en CI** sur packages de référence (non-régression).

---

## 17.4 Pratiques mémoire

1. **`dispose` systématique** : toute ressource GPU/DOM/écouteur allouée est libérée.
2. **Teardown orchestré** par le Core au changement de package.
3. **Déduplication** via le Resource Manager.
4. **Pools** pour objets fréquemment créés/détruits (marqueurs, temporaires d'animation).
5. **Surcharges de matériaux maîtrisées** (éviter la duplication).
6. **Test de stabilité mémoire** : charger/décharger en boucle → mémoire plate.

---

## 17.5 Pratiques d'accessibilité (P8)

1. **Clavier d'abord** : toute action réalisable sans souris.
2. **Focus visible** et ordre logique.
3. **ARIA correct** (rôles, labels, états, live regions).
4. **Annoncer** les changements d'état/focus/chargement.
5. **Contraste WCAG 2.1 AA** dans tous les thèmes.
6. **Équivalent non-3D** : liste navigable des composants/hotspots.
7. **Respecter les préférences système** (`reduced-motion`, `color-scheme`, `contrast`, `forced-colors`).
8. **Cibles tactiles** suffisantes ; **i18n/RTL**.
9. **Auditer** (automatisé + tests clavier manuels) régulièrement.

---

## 17.6 Pratiques de sécurité

1. **Assainir** tout contenu de package rendu en HTML.
2. **Politique de chargement** stricte (relatif / liste blanche de domaines).
3. **Pas de code arbitraire** exécuté depuis un package (plugins enregistrés côté hôte).
4. **Dépendances minimales et auditées** ; mises à jour de sécurité suivies.
5. **Aucune donnée sensible** dans le code/commits (chapitre 17.9).

---

## 17.7 Pratiques de qualité de code

1. **TypeScript strict** ; pas de `any` non justifié.
2. **Formatage et lint automatiques**, bloquants en CI.
3. **Noms clairs** et cohérents (chapitre 15).
4. **Fonctions courtes**, responsabilité unique, pas de nombres magiques.
5. **Commenter le *pourquoi***, documenter l'API publique (TSDoc) et les invariants.
6. **Écrire un test** pour chaque comportement et pour chaque bug corrigé (non-régression).
7. **Petites PR**, revues, une tâche = un incrément validable (chapitre 16).
8. **ADR** pour les décisions d'architecture significatives.

---

## 17.8 Pratiques de test

1. **Pyramide de tests** : beaucoup d'unitaires, quelques intégrations, e2e ciblés (chapitre 15).
2. **Tester la logique pure** en priorité (validation, machine à états, cadrage, easings).
3. **Packages de référence** comme base des tests d'intégration/e2e/perf/a11y.
4. **Tests déterministes** (temps simulé pour les animations).
5. **CI verte obligatoire** pour fusionner.

---

## 17.9 Pratiques de contenu (créateurs de packages)

1. **Nommer proprement les nœuds** du GLB (pont vers la config).
2. **Compresser** (Draco/KTX2/Meshopt) et fournir des **LOD** si lourd.
3. **Textures** : résolution adaptée, atlas, mipmaps, color space correct.
4. **Instancier** les répétitions ; **nettoyer** les objets inutiles.
5. **Chemins relatifs** uniquement ; package **autonome**.
6. **Déclarer `schemaVersion`**.
7. **Valider** avec `validate-package` avant publication.
8. **Vérifier l'accessibilité du contenu** (labels, contrastes du thème, textes alternatifs).

---

## 17.10 Pratiques de collaboration et de dépôt

1. **La documentation fait foi** : tout code respecte cette spécification ; tout écart = amendement tracé.
2. **Documentation versionnée avec le code** (cohérence spec ↔ implémentation).
3. **Commits clairs** et atomiques ; messages descriptifs.
4. **Branches par tâche** (chapitre 16) ; PR petites et revues.
5. **CHANGELOG** (moteur + schéma) tenu à jour.
6. **Compatibilité ascendante** : évolutions de schéma/SDK rétrocompatibles ou migrées (P10).
7. **Ne jamais fusionner en rouge** (tests/lint/types/perf/a11y).

---

## 17.11 Anti-patterns à proscrire

| Anti-pattern | Pourquoi c'est interdit | À la place |
|--------------|-------------------------|-----------|
| Brancher le noyau sur un type d'objet | Viole P1 (généricité). | Config / plugin. |
| Coder en dur une couleur/typo | Viole le système de thèmes. | Design tokens. |
| Manipuler la scène depuis l'UI | Couplage 3D/UI. | Événements/API. |
| Import profond dans un autre module | Casse l'encapsulation. | API publique du module. |
| Rendre 60 fps une scène statique | Gaspillage GPU/batterie. | Rendu à la demande. |
| Allouer dans la boucle chaude | Pression GC, jank. | Réutilisation/pools. |
| Oublier `dispose` | Fuites mémoire. | Teardown systématique. |
| Avaler une erreur en silence | Débogage impossible. | Journaliser + dégrader. |
| Exécuter du code fourni par un package | Faille de sécurité. | Plugins enregistrés côté hôte. |
| Ajouter une capacité en modifiant le noyau | Viole Open/Closed. | Plugin / point d'extension. |
| Animation basée sur le nombre de frames | Non déterministe selon FPS. | Time-based + delta clampé. |

---

## 17.12 Checklist « prêt à fusionner » (Definition of Done)

- [ ] Conforme à la spécification (ce document) ; écarts documentés.
- [ ] Type-check, lint, format : verts.
- [ ] Tests (unit/intégration, e2e si pertinent) : verts, non-régression ajoutée.
- [ ] Performance : pas de régression (budgets tenus) ; rendu à la demande respecté.
- [ ] Mémoire : `dispose` complet ; pas de fuite.
- [ ] Accessibilité : clavier + ARIA + contraste ; préférences système respectées.
- [ ] Sécurité : contenu assaini ; politique de chargement respectée.
- [ ] Documentation/API à jour ; ADR si décision d'architecture.
- [ ] Démonstration visible du livrable (chapitre 16).
