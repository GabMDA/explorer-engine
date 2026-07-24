# @explorer-engine/plugin-measure

Official reference plugin (chapter 10 §10.7.2): measures the real-world
distance between two picked points. Depends only on
`@explorer-engine/plugin-sdk`, never `@explorer-engine/core` directly.

- **Statut** : P8-T3 (Sprint 6, Phase 2).
- **Capacité fournie** : `measure`.
- **Événements** : `measure:point-added`, `measure:completed`.
- **Hors périmètre de cette phase** : intégration Playground (le picking est
  piloté par l'hôte via `pickAt(ndcX, ndcY)`, un point d'entrée public au-delà
  du contrat `Plugin` générique), bouton toolbar interactif réel (les
  descripteurs `UiPort` sont d'affichage uniquement à ce stade).
