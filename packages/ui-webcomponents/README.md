# @explorer-engine/ui-webcomponents

UiPort adapter (chapter 12 §12.1.1, decision C3) — the default UI overlay,
implemented with native Custom Elements + Shadow DOM. Zero framework
dependency; a host may supply its own `UiPort` implementation instead.

- **Statut** : P7-T2/T3 (Sprint 5, Phase 2) — `createDomUiPort` implements the
  full `UiPort` contract.
- **Référence** : chapitres 03, 12, 13 ; ADR-002 ; décisions C3/C17.
- **Dépendances** : `@explorer-engine/core` uniquement (ports + types
  d'événements). Aucune dépendance à un framework UI.
