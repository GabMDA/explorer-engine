# Architecture Decision Records (ADR)

> Les ADR consignent les **décisions d'architecture significatives** d'Explorer Engine : le contexte, le problème, les options envisagées, la décision retenue et ses conséquences. Ils existent pour que les futurs développeurs comprennent **pourquoi** ces choix ont été faits, et ne les défassent pas par ignorance.

---

## Qu'est-ce qu'un ADR ?

Un ADR est un document **court, immuable et daté** qui capture une décision à un instant T. On ne réécrit pas un ADR : si une décision change, on crée un **nouvel** ADR qui **remplace** (`Superseded by`) le précédent. L'historique des décisions est ainsi préservé.

Format : voir [ADR-000 (template)](./ADR-000-template.md).

## Statuts possibles

| Statut | Signification |
|--------|---------------|
| `Proposed` | En discussion. |
| `Accepted` | Décision en vigueur. |
| `Superseded by ADR-XXX` | Remplacée par un ADR plus récent. |
| `Deprecated` | Abandonnée sans remplacement. |

## Index

| ADR | Titre | Statut | Corr. | Chapitres |
|-----|-------|--------|-------|-----------|
| [ADR-001](./ADR-001-render-state-resolver.md) | Render State Resolver déclaratif | Accepted | C1 | 19, 08, 09 |
| [ADR-002](./ADR-002-headless-core.md) | Core headless + adaptateurs (ports) | Accepted | C2 | 02, 03 |
| [ADR-003](./ADR-003-stable-asset-identity.md) | Identité d'assets stable (`explorerId`) | Accepted | C5 | 05, 06 |
| [ADR-004](./ADR-004-typed-events.md) | Catalogue d'événements typé | Accepted | C9 | 02, 15 |
| [ADR-005](./ADR-005-explorer-packages.md) | Explorer Packages (moteur ≠ contenu) | Accepted | P1 | 04, 05 |
| [ADR-006](./ADR-006-plugin-system.md) | Système de plugins | Accepted | P4, C8 | 10 |
| [ADR-007](./ADR-007-runtime-state-serialization.md) | Sérialisation de l'état runtime | Accepted | C10 | 20 |
| [ADR-008](./ADR-008-design-freeze-v1.md) | Design Freeze v1.0 (périmètre, versions, compatibilité) | Accepted | — | 03, 04, 05, 10, 16, 21, 22 |

## Décisions futures à tracer (non encore des ADR)

Quand elles seront prises (souvent en début de phase de roadmap), ces décisions recevront un ADR :

- Implémentation Web Components (Lit vs vanilla) — arbitrage O2.
- Backend WebGPU (nouvel adaptateur `RendererPort`) — chapitre 18.
- Bundler / outillage de build.
- Extensibilité des canaux du Render State Resolver — arbitrage O4.

## Règle

Toute PR introduisant ou modifiant une décision d'architecture significative **DOIT** être accompagnée d'un ADR (nouveau ou mise à jour de statut). Voir [Constitution L28](../../ENGINE_CONSTITUTION.md).
