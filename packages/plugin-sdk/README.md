# @explorer-engine/plugin-sdk

Stable, framework-agnostic API for authoring plugins — a pure re-export façade
over `@explorer-engine/core`'s plugin contract. No business logic of its own.

- **Statut** : P8-T1 (Sprint 6, Phase 2) — façade réelle.
- **Référence** : chapitre 10 ; ADR-006.
- **Règle** : un plugin dépend **uniquement** de ce package, jamais de
  `@explorer-engine/core` directement (ch.03 §3.4).
