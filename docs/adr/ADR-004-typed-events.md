# ADR-004 — Catalogue d'événements typé

- **Statut** : Accepted
- **Date** : 2026-07-18
- **Décideurs** : Lead Architect, équipe moteur
- **Corrections liées** : C9 · **Principes** : P5, P9 · **Chapitres** : 02, 15, 10

---

## Contexte

Les modules d'Explorer Engine communiquent par un **Event Bus** (pub/sub) pour rester découplés : un hotspot activé notifie sans connaître ses consommateurs (Focus, UI, analytics…). Ce bus est aussi le canal principal de communication des plugins.

## Problème

En v1, les événements étaient des **chaînes libres** (`"hotspot:activated"`). Sur un projet de dix ans :

- **typos silencieuses** (un écouteur sur `"hotspot:activate"` ne se déclenche jamais, sans erreur) ;
- **pas de vérification du payload** (forme des données non garantie) ;
- **pas de « find all references »** ni de refactoring sûr (renommer un événement est risqué) ;
- **couplage caché** difficile à auditer.

De plus, la frontière « certains événements par frame contournent le bus » n'était pas définie, laissant planer un risque de faire transiter des **données chaudes** (positions projetées, deltas) par le bus — coûteux.

## Options envisagées

- **Option A — Chaînes + convention + tests.** *Avantage* : zéro cérémonie. *Inconvénient* : ne supprime pas les typos ni l'absence de vérification ; discipline non contraignante.
- **Option B — Catalogue d'événements typé** (association `nom → payload` vérifiée à la compilation), exposé par le core et le `plugin-sdk`. *Avantage* : erreurs à la compilation, refactoring sûr, payloads garantis, auto-documentation. *Inconvénient* : nécessite de maintenir le catalogue comme partie du contrat public.
- **Option C — Émetteurs fortement typés par domaine** (un émetteur par famille). *Avantage* : typage local. *Inconvénient* : fragmente le bus ; moins d'introspection globale.

## Décision

**Option B.**

- Un **catalogue typé** (map `nom → forme du payload`) est exposé par le core et le SDK ([chapitres 02](../02-architecture-generale.md) et [15](../15-standards-code.md)). Un nom inconnu ou un payload mal formé est une **erreur de compilation**.
- Les plugins déclarent leurs propres événements typés dans un **espace de nom** (`measure:*`).
- **Règle normative** : **aucune donnée par frame ne transite par le bus**. Les données chaudes passent par les **ports** (`RendererPort`, etc.) et le Render State Resolver ; le bus est réservé aux **événements sémantiques discrets**.
- L'anti-cycle et l'absence de données par frame sur le bus sont **vérifiés** (lint/revue).

## Conséquences

- **Positives** : sécurité de refactoring, découplage sûr, payloads fiables, meilleure maintenabilité sur la durée.
- **Négatives / coûts** : le catalogue devient une **surface de contrat** à versionner (impacte la compatibilité du SDK) ; ajouter un événement demande de l'inscrire au catalogue.
- **Impacts** : ch.02 (Event Bus typé + règle per-frame), ch.10 (événements de plugins typés), ch.15 (règle de lint). Compatibilité SDK à suivre dans la matrice core/schema/sdk (C14).
- **Invariants créés** : L11 (événements typés ; aucune donnée par frame sur le bus).

## Notes

Le catalogue est le point de rendez-vous entre core et plugins : son évolution suit la politique semver du `plugin-sdk` ([chapitre 05 §5.3.1](../05-config-format.md)).
