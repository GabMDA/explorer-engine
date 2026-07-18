# ADR-003 — Identité d'assets stable (`extras.explorerId`)

- **Statut** : Accepted
- **Date** : 2026-07-18
- **Décideurs** : Lead Architect, équipe moteur, pipeline assets
- **Corrections liées** : C5 (et C17 adressage typé) · **Principes** : P1, P6, P10 · **Chapitres** : 05, 06

---

## Contexte

Tout le système d'interaction — hotspots, focus, sélection, états — référence des **parties du modèle** 3D. Ce référencement est la **colonne vertébrale** du moteur : c'est le pont entre la config (data) et la géométrie (GLB).

## Problème

En v1, ce pont reposait sur les **noms de nœuds glTF**. Or les noms de nœuds **ne sont pas un identifiant stable** :

- un renommage dans l'outil 3D (Blender), un ré-export, ou une passe de compression (gltfpack/Draco renomment ou fusionnent des nœuds) **cassent silencieusement** toute la config ;
- les collisions de noms (homonymes) sont fréquentes ;
- rien ne garantit la persistance d'un nom entre deux versions d'un asset.

Résultat : le moteur pouvait cesser de fonctionner sur un simple ré-export, sans erreur explicite. C'est le défaut F7 de la revue v1 (fragilité systémique du backbone).

## Options envisagées

- **Option A — Noms de nœuds + validation stricte au build.** *Avantage* : rien à préparer. *Inconvénient* : ne protège pas contre le ré-export ; fragile par nature.
- **Option B — Identité stable via `extras.explorerId`** (propriété custom glTF posée à la préparation). Le moteur mappe par cet id, pas par le nom. *Avantage* : survit au ré-export et à la compression ; identité explicite et unique. *Inconvénient* : nécessite une étape de préparation (outil) et une discipline d'auteur.
- **Option C — Chemin hiérarchique** (plus stable que le nom seul). *Inconvénient* : casse au reparentage.
- **Option D — Empreinte géométrique (hash de mesh).** *Inconvénient* : coûteux, faux positifs, instable à la moindre édition.

## Décision

**Option B en primaire, Option A en repli explicite.**

- Identité **primaire** : `node.extras.explorerId` ([chapitres 05](../05-config-format.md) et [06](../06-modeles-3d.md)). La config référence les nœuds via `NodeRef { explorerId }`.
- **Repli** : `NodeRef { name }` accepté **mais** l'outil de validation émet un **avertissement** (fragile).
- L'outil `optimize-model` **génère/préserve** les `explorerId` durant la conversion/compression (arbitrage O5).
- Corollaire (C17) : l'adressage au-delà de `components[].nodes` est **typé** (`Address { kind, id }`) et ne référence que des composants/groupes ; les nœuds bruts disparaissent de la surface d'API.

## Conséquences

- **Positives** : le backbone devient robuste ; l'identité est un **contrat du pipeline d'assets** ; compatibilité ascendante des packages améliorée (P10).
- **Négatives / coûts** : étape de préparation obligatoire pour la production ; l'outillage doit garantir la préservation des ids (test de round-trip).
- **Impacts** : ch.05 (`NodeRef`, `Address`), ch.06 (indexation par `explorerId`), outil `validate-package` (warning sur repli par nom), outil `optimize-model` (génération/préservation).
- **Invariants créés** : L12 (identité stable `explorerId`, nom = repli), L13 (adressage typé).

## Notes

Voir [change-log v2 §C5](../reviews/spec-v2-change-log.md). La convention exacte de génération d'`explorerId` (dérivée du nom d'origine, préservée si déjà présent) sera précisée dans le guide auteur (roadmap P10-T3).
