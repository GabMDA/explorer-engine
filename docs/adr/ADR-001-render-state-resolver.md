# ADR-001 — Render State Resolver déclaratif

- **Statut** : Accepted
- **Date** : 2026-07-18
- **Décideurs** : Lead Architect, équipe moteur
- **Corrections liées** : C1 (et C4, transforms absolus) · **Principes** : P3, P5, P6, P9 · **Chapitres** : 19, 08, 09, 05, 06

---

## Contexte

Explorer Engine superpose de nombreuses transformations visuelles simultanées : états (Open, Exploded, Transparent, Cutaway), modifiers combinables (X-ray), mise en avant par le Focus (dim/outline/isolation), survol de la sélection, et contributions de plugins. Toutes ces sources agissent sur les **mêmes** propriétés des **mêmes** objets (transform, opacité, visibilité, couleur, caméra, éclairage).

## Problème

Dans la conception initiale (v1), chaque sous-système **mutait directement** la scène et « mémorisait l'original pour le restaurer ». Ce modèle **ne compose pas** :

- **Conflit d'ordre (last-writer-wins)** : X-ray met une coque à `opacity 0.2`, un focus par-dessus mémorise `0.2` comme original, l'assombrit, puis restaure `0.2` ; désactiver X-ray restaure alors une valeur déjà écrasée → résultat **non déterministe selon l'ordre**.
- **Interruptions en cascade** : transition d'état interrompue par un focus, lui-même interrompu par un hover → plusieurs « originaux » restaurés dans le désordre.
- **Réversibilité fragile**, aggravée par les transforms « relatifs » (la pose de repos n'est plus récupérable).

C'est le défaut structurel n°1 de la revue v1 : **état mutable partagé sans autorité de réconciliation**.

## Options envisagées

- **Option A — Protocole de sauvegarde/restauration renforcé** (pile globale d'originaux). *Avantage* : proche de l'existant. *Inconvénient* : ne compose toujours pas ; complexité de bookkeeping qui grandit avec le nombre de sources ; bugs d'ordre persistants.
- **Option B — Résolveur d'état déclaratif à couches (Render State Resolver)**. Chaque source publie des **couches** typées `{ source, target, channel, value, priority }` ; un module central compose par cible+canal (règles par canal) et applique/interpole l'effectif. *Avantage* : composition déterministe, réversibilité par retrait de couche, sources simplifiées. *Inconvénient* : un module noyau supplémentaire à concevoir et tester rigoureusement.
- **Option C — ECS complet** (Entity-Component-System). *Avantage* : modèle data-oriented général. *Inconvénient* : surdimensionné pour ce moteur ; courbe d'apprentissage ; couplage à un paradigme lourd.

## Décision

**Option B.** Introduction du **Render State Resolver (RSR)** comme module noyau ([chapitre 19](../19-render-state-resolver.md)) :

- Personne ne mute la scène directement ; on publie/retire des **couches**.
- Composition **par canal** : `transform` additif (offsets **absolus depuis une rest pose canonique**), `opacity` par `min`, `visibility` « hidden gagne », intentions caméra/éclairage exclusives par priorité, etc.
- Priorité normative : `focus > selection > modifier > state > default`.
- **On ne restaure jamais** : sortir d'un focus/état = retirer ses couches + recomposer.
- Les transforms « relatifs » sont supprimés (déterminisme).

## Conséquences

- **Positives** : composition prévisible et indépendante de l'ordre ; réversibilité par construction ; Focus/États/Sélection deviennent de simples producteurs de couches (moins de couplage) ; testable en isolation (headless).
- **Négatives / coûts** : un module central critique dont la logique de composition doit être **exhaustivement testée** ; discipline imposée (aucune mutation directe autorisée — [Constitution L5–L7](../../ENGINE_CONSTITUTION.md)).
- **Impacts** : ch.08 (Focus = producteur de couches), ch.09 (états = couches, statechart), ch.05 (schéma : `layers`, transforms absolus, fin de `material`/`relative`), ch.06 (rest pose), ch.19 (nouveau).
- **Invariants créés** : L5 (toute mutation via le RSR), L6 (jamais de restauration), L7 (transforms absolus).

## Notes

Liste des canaux **fermée** en v1 (arbitrage O4, extensible en v2). Voir [change-log v2 §C1](../reviews/spec-v2-change-log.md).
