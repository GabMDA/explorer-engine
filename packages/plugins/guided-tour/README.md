# @explorer-engine/plugin-guided-tour

Official reference plugin (chapter 10 §10.7.1): sequences a guided tour across
`steps` (component ids), using ONLY the focus mechanism and a UI slot — both
reached exclusively through `@explorer-engine/plugin-sdk`. Never imports
`@explorer-engine/core` directly.

- **Statut** : P8-T2 (Sprint 6, Phase 2).
- **Capacité fournie** : `scenario`.
- **Événements** : `tour:step`, `tour:completed`.
- **Hors périmètre de cette phase** : intégration Playground, avance
  automatique temporisée, narration audio (texte uniquement via le slot UI —
  aucune primitive audio n'existe dans le core headless).
