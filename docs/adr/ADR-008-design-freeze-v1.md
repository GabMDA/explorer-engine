# ADR-008 — Design Freeze v1.0 (périmètre, versions, compatibilité)

- **Statut** : Accepted
- **Date** : 2026-07-24
- **Décideurs** : Lead Architect, équipe moteur
- **Corrections liées** : — (clôture de Roadmap) · **Principes** : P1–P10 · **Chapitres** : 03, 04, 05, 10, 16, 21, 22

---

## Contexte

La Roadmap ([chapitre 16](../16-roadmap.md)) s'achève avec la phase P10 : deux Explorer Packages de référence livrés (`watch` — simple, P10-T1 ; `gaming-pc` — complexe, P10-T2), les guides créateur et plugin rédigés ([chapitre 21](../21-guide-createur-package.md), [chapitre 22](../22-guide-plugins.md)), et P10-T4 exige de « figer l'API et le schéma » avec une « version 1.0 (moteur + schéma + SDK versionnés) » et une « compatibilité ascendante engagée ».

Tous les paquets du monorepo étaient jusqu'ici en `0.0.0` — un numéro de version qui ne communiquait aucune stabilité et n'engageait personne.

## Problème

Sans décision explicite, deux questions restent ouvertes et bloquent la clôture de P10-T4 :

1. **Quels paquets constituent l'« API publique » à figer ?** Le monorepo mélange des paquets consommés par un tiers (créateur de package, développeur de plugin, intégrateur hôte) et des outils de développement internes.
2. **Que signifie « figer » concrètement ?** Sans définition explicite de ce qu'est un changement cassant, un futur amendement pourrait rompre la compatibilité sans que personne ne le remarque avant qu'un intégrateur ne le découvre en production.

## Options envisagées

- **Option A — Ne rien figer, laisser tout à `0.0.0`.** *Inconvénient* : aucune garantie de stabilité communicable ; contredit directement la validation de P10-T4.
- **Option B — Figer TOUT le monorepo (y compris `playground` et `validate-package`) en `1.0.0`.** *Avantage* : simplicité apparente. *Inconvénient* : `playground` est un bac à sable de développement interne (jamais consommé comme dépendance par un tiers) et `validate-package` un outil CLI de développement — les figer en `1.0.0` engagerait une compatibilité sur des surfaces qui n'en ont jamais eu besoin, et qui doivent au contraire pouvoir continuer d'évoluer librement pour accompagner le développement des sprints suivants (chapitre 18).
- **Option C — Figer uniquement les paquets réellement consommés par un tiers** (créateur de contenu, développeur de plugin, intégrateur hôte), laisser les outils de développement internes hors périmètre. *Avantage* : le gel porte exactement sur ce que la Roadmap nomme (« moteur + schéma + SDK ») ; les outils internes restent libres d'évoluer. *Inconvénient* : nécessite d'énumérer explicitement le périmètre (fait ci-dessous).

## Décision

**Option C.**

### Périmètre figé en `1.0.0`

| Paquet | Rôle |
|--------|------|
| `@explorer-engine/schema` | Schéma `config.json` normatif, validateur, migration ([chapitre 05](../05-config-format.md)) — l'API du créateur de contenu. |
| `@explorer-engine/core` | Moteur headless (ports, Render State Resolver, hotspots, focus, états, plugins, i18n, thème, a11y, perf) — l'API de l'intégrateur hôte. |
| `@explorer-engine/renderer-three` | Adaptateur `RendererPort` de référence. |
| `@explorer-engine/ui-webcomponents` | Adaptateur `UiPort` de référence. |
| `@explorer-engine/input-dom` | Adaptateur `InputPort` de référence. |
| `@explorer-engine/resource-fetch` | Adaptateur `ResourceTransport` de référence. |
| `@explorer-engine/plugin-sdk` | Façade stable pour développer un plugin ([chapitre 22](../22-guide-plugins.md)). |
| `@explorer-engine/plugin-guided-tour` | Plugin de référence officiel. |
| `@explorer-engine/plugin-measure` | Plugin de référence officiel. |

### Hors périmètre (restent en `0.0.0`, non figés)

- `@explorer-engine/playground` (`apps/playground`) — bac à sable de développement, jamais consommé comme dépendance.
- `@explorer-engine/validate-package` (`tools/validate-package`) — outil CLI de développement, pas une bibliothèque consommée par du code tiers.

### Ce que « figer » engage concrètement

À partir de `1.0.0`, pour chaque paquet du périmètre ci-dessus :

- Toute **suppression ou renommage** d'un export public, tout **changement de signature incompatible**, tout **changement de comportement observable** d'une fonction publique, ou tout **amendement du schéma `config.json` qui invaliderait un package existant** est un changement **cassant** — il exige un incrément de version **majeure** (`2.0.0`) et un ADR documentant la migration.
- L'**ajout** d'un champ optionnel, d'un export, d'une valeur par défaut rétrocompatible (comme l'élargissement `string → I18nText` de la Phase 2 de ce sprint) est un changement **mineur** (`1.x.0`).
- Une **correction** sans changement d'API observable est un changement **correctif** (`1.0.x`).
- Le `schemaVersion` **majeur** (`"1"`, [`SUPPORTED_SCHEMA_MAJORS`](../../packages/schema/src/defaults.ts)) suit la même règle : un package valide aujourd'hui contre le schéma `1.x` DOIT rester valide contre tout `1.y` futur (y ≥ x).

## Conséquences

- **Positives** : un créateur de package ou un développeur de plugin peut désormais dépendre de la ligne `1.x` en sachant que son intégration ne sera pas rompue silencieusement ; le CHANGELOG (racine du dépôt) devient la source de vérité des évolutions futures.
- **Négatives / coûts** : toute évolution du périmètre figé doit désormais justifier son impact de compatibilité avant d'être mergée — un changement qui aurait pu être fait « en passant » avant P10-T4 nécessite maintenant un ADR s'il est cassant.
- **Impacts** : chapitre 16 (P10-T4 clos) ; CHANGELOG (créé, racine du dépôt) ; `package.json` des 9 paquets du périmètre passés à `1.0.0` (et les références croisées entre eux mises à jour en conséquence).
- **Invariants créés** : aucun nouveau L-numéro — cette décision n'introduit pas de contrainte d'implémentation nouvelle, elle formalise un engagement de compatibilité déjà implicite dans L27 (la spec fait foi) et L28 (traçabilité par ADR).

## Notes

`apps/playground` et `tools/validate-package` pourront rejoindre le périmètre figé dans un ADR ultérieur si l'un d'eux devient un jour consommé comme dépendance par un tiers (par exemple si `validate-package` était un jour publié comme paquet npm indépendant). Ce n'est pas le cas aujourd'hui.
