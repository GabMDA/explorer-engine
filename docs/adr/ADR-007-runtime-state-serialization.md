# ADR-007 — Sérialisation de l'état runtime

- **Statut** : Accepted
- **Date** : 2026-07-18
- **Décideurs** : Lead Architect, équipe moteur, produit
- **Corrections liées** : C10 (et F20 déterminisme) · **Principes** : P6, P9 · **Chapitres** : 20, 09, 08, 18

---

## Contexte

Explorer Engine est un produit **web**, destiné à durer. Les utilisateurs attendent des comportements web de base : partager un lien vers une vue précise, utiliser le bouton Précédent, mettre en signet un état. À plus long terme, l'exploration collaborative (multijoueur) est envisagée.

## Problème

La conception v1 ne définissait **aucun moyen de capturer, partager ou restaurer** l'état d'une exploration : impossible de partager « le focus GPU du PC en vue éclatée » par URL, ni de gérer l'historique du navigateur. Ajouter cela **après** avoir codé les états aurait imposé de rétrofiter la sérialisation dans des modules déjà écrits — coûteux et risqué. Par ailleurs, la v1 évoquait un « déterminisme » du moteur comme base du multijoueur, ce qui est **illusoire** en rendu WebGL/asynchrone (F20).

## Options envisagées

- **Option A — Ignorer (dette).** *Inconvénient* : deep-linking impossible ; rétrofit douloureux ; attente utilisateur non satisfaite.
- **Option B — État runtime sérialisable de bout en bout** (base + modifiers + focus stack + vue + sélection), avec `serialize`/`apply`/`diff`/`patch`, et un module `Navigation` **opt-in** pour le binding URL/History. *Avantage* : deep-linking, historique, partage, reprise, tests e2e reproductibles ; fondation propre du multijoueur. *Inconvénient* : impose que l'état runtime soit conçu **sérialisable dès le départ**.
- **Option C — Déléguer entièrement à l'hôte.** *Avantage* : moteur plus léger. *Inconvénient* : chaque intégrateur réinvente la sérialisation ; pas de format standard partageable.

## Décision

**Option B**, avec délégation possible du binding URL ([chapitre 20](../20-runtime-state-serialization.md)) :

- L'**état runtime** est **sérialisable/désérialisable**, versionné (`RuntimeState`), et référence des **entités logiques** (ids), pas des objets 3D.
- API core : `serialize` / `apply` / `toQuery` / `fromQuery` / `diff` / `patch`. `apply` restaure **via le Render State Resolver** → déterministe et réversible ; **dégrade** si une référence manque.
- Le binding URL/History est un module **`Navigation` opt-in** ; sinon l'hôte gère l'URL via l'API (arbitrage O3).
- Le **multijoueur** est reformulé en **synchronisation d'état** (snapshots/patches diffusés par un plugin de transport), **pas** en simulation déterministe. P9 est reprécisé : « transitions **logiques** déterministes à entrées égales », pas déterminisme de rendu.

## Conséquences

- **Positives** : deep-linking, historique, partage, reprise, e2e reproductibles ; base commune au multijoueur ; état observable et auditable.
- **Négatives / coûts** : l'état runtime doit rester **exhaustif et sérialisable** (toute nouvelle dimension d'état doit y entrer, sinon partage/synchro incomplets) ; format `RuntimeState` à versionner.
- **Impacts** : ch.20 (nouveau), ch.09 (serialize/apply macro), ch.08 (focus stack dans l'état), ch.18 (multijoueur = synchro d'état), ch.16 (exigence dès P3/P6 ; `Navigation` en P7).
- **Invariants créés** : L22 (état runtime sérialisable).

## Notes

L'encodage d'URL est compact, lisible, versionné et **validé** (aucune exécution). Voir [change-log v2 §C10](../reviews/spec-v2-change-log.md).
