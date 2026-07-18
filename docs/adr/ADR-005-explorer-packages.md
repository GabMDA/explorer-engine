# ADR-005 — Explorer Packages (séparation moteur ≠ contenu)

- **Statut** : Accepted
- **Date** : 2026-07-18
- **Décideurs** : Lead Architect, direction produit
- **Corrections liées** : — (décision fondatrice) · **Principes** : P1, P2, P10 · **Chapitres** : 04, 05, 03

---

## Contexte

Explorer Engine doit permettre d'explorer n'importe quel objet 3D — PC, voiture, montre, moteur, cerveau, fusée — **sans modifier le moteur**. C'est l'exigence produit centrale.

## Problème

Comment supporter une infinité d'objets, chacun avec ses composants, hotspots, états et présentation, tout en gardant **un seul moteur générique, stable et réutilisable** ? Si la connaissance d'un objet fuit dans le code moteur, on obtient un moteur couplé, non réutilisable, qu'il faut patcher pour chaque nouvel objet — l'échec assuré d'un framework.

## Options envisagées

- **Option A — Un moteur par objet / configuration codée en dur.** *Inconvénient* : non générique ; explosion de forks ; impossible à maintenir.
- **Option B — Moteur générique piloté par des packages de données** (« le moteur est un lecteur, le package est le disque »). Un **Explorer Package** = GLB + `config.json` déclaratif + ressources, **data-only**, portable. *Avantage* : un moteur unique ; nouvel objet = nouveau package ; séparation nette. *Inconvénient* : nécessite un **schéma de configuration** riche et versionné, et un pipeline de préparation d'assets.
- **Option C — Moteur + scripts par objet (code fourni par le package).** *Inconvénient* : sécurité (exécution de code arbitraire), couplage, non déclaratif.

## Décision

**Option B.** Le contenu est un **Explorer Package** ([chapitre 04](../04-explorer-packages.md)), le comportement est **déclaratif** via `config.json` ([chapitre 05](../05-config-format.md)) :

- Le moteur ne contient **aucune** connaissance d'un objet (P1).
- Un package est **autonome, data-only, portable** (précisé en v2 : « portable sur tout runtime conforme au profil de capacités déclaré » — voir [ADR-006](./ADR-006-plugin-system.md)/C8).
- Le schéma est **versionné** (`schemaVersion`) avec migration montante et forward-compat tolérante (C14).
- Les packages d'exemple restent **data-only** : preuve continue de la séparation.

## Conséquences

- **Positives** : moteur unique, générique, durable ; création de contenu ouverte aux non-développeurs (via `config.json`, futur Explorer Studio) ; testabilité par packages de référence.
- **Négatives / coûts** : le **schéma** devient un contrat critique à concevoir et faire évoluer avec soin ; un pipeline de préparation d'assets est nécessaire ; toute fonctionnalité courante doit être exprimable en config (sinon on étend le schéma, pas le code — P2).
- **Impacts** : ch.04, ch.05 (schéma), ch.03 (`examples/` = data pure, `packages/schema` dédié), ch.16 (validation par packages de référence).
- **Invariants créés** : L1 (moteur ne connaît aucun objet), L2 (toute expérience = un package), L3 (comportement déclaratif), L4 (rien codé en dur), L29 (exemples data-only).

## Notes

Ce choix est la raison d'être du projet ; il précède et conditionne toutes les autres décisions. Voir [chapitre 01](../01-vision.md).
