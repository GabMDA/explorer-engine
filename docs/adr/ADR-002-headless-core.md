# ADR-002 — Core headless + adaptateurs (architecture hexagonale)

- **Statut** : Accepted
- **Date** : 2026-07-18
- **Décideurs** : Lead Architect, équipe moteur
- **Corrections liées** : C2 (et C25/F25) · **Principes** : P3, P4, P9 · **Chapitres** : 02, 03, 12

---

## Contexte

Un moteur destiné à durer dix ans doit : être testable sans navigateur, s'intégrer dans des applications hôtes hétérogènes (leur propre UI), et pouvoir changer de backend graphique (WebGL → WebGPU, voire XR) sans réécriture.

## Problème

La conception v1 plaçait le rendu (Three.js/WebGL) **et** l'UI (DOM) au même niveau que la logique, dans un noyau monolithique (`ui/` à l'intérieur de `core`). Conséquences :

- La logique (états, focus, sélection, config) n'était **pas testable** sans DOM/WebGL — contredit la testabilité (P9).
- Le moteur n'était **pas embarquable** avec une UI tierce (React/Vue maison) sans traîner l'UI intégrée.
- Le contrat d'injection d'UI par plugin dépendait d'une techno UI non figée → risque pour la stabilité du `plugin-sdk`.
- Un futur backend WebGPU/XR aurait imposé de toucher au cœur.

## Options envisagées

- **Option A — Tout dans `core` (statu quo v1).** *Avantage* : simple à démarrer. *Inconvénient* : verrouille testabilité, embarquabilité et évolution du backend.
- **Option B — Deux couches (logique+rendu ensemble / UI séparée).** *Avantage* : isole l'UI. *Inconvénient* : garde WebGL couplé à la logique ; core toujours non testable sans GPU.
- **Option C — Architecture hexagonale : core headless + adaptateurs derrière des ports.** `core` = logique pure (aucun DOM/WebGL) exposant `RendererPort`, `UiPort`, `InputPort` ; adaptateurs `renderer-three`, `ui-webcomponents`, `input-dom`. *Avantage* : testabilité totale, embarquabilité, évolution backend = nouvel adaptateur. *Inconvénient* : plus de packages ; discipline de frontière à tenir.

## Décision

**Option C.** Le core devient **headless** ([chapitres 02](../02-architecture-generale.md) et [03](../03-structure-projet.md)) :

- `@explorer-engine/core` n'importe **ni Three.js ni le DOM** ; il pilote via ports.
- Adaptateurs séparés : `renderer-three` (le **seul** endroit où `three` est importé), `ui-webcomponents`, `input-dom`.
- Le Core **branche** les adaptateurs fournis par l'hôte ; il ne les instancie pas en dur.
- Invariant vérifié en CI (interdiction d'import de `three`/DOM dans `core`).

## Conséquences

- **Positives** : tests unitaires sans navigateur ; réutilisation avec UI tierce ; WebGPU/XR = adaptateur additionnel ; frontières nettes.
- **Négatives / coûts** : davantage de packages et de contrats à maintenir ; une couche d'indirection (ports) ; le `RendererPort` doit exposer juste ce qu'il faut (ni fuite d'abstraction Three.js, ni port anémique).
- **Impacts** : ch.03 (packages `renderer-three`/`ui-webcomponents`/`input-dom`), ch.02 (couches, matrice), ch.12 (UI = adaptateur `UiPort`), ch.15 (règle CI). La roadmap (ch.16 §16.0) place la définition des ports en P0.
- **Invariants créés** : L8 (core headless), L9 (jamais de Three.js dans le core).

## Notes

Le contrat d'UI agnostique (`UiPort`) et son implémentation par défaut en Web Components sont décrits au [chapitre 12](../12-interface-utilisateur.md). Le choix exact de la techno Web Components (Lit vs Custom Elements vanilla) reste un arbitrage ouvert (O2), sans impact sur le contrat `UiPort`.
