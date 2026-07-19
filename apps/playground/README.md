# @explorer-engine/playground

Development playground for Explorer Engine. **P1-T2** : assemble le renderer, une
scène de démonstration (cube unité éclairé) et une caméra pour la **première
validation visuelle réelle** du moteur. N'importe **aucun** Three.js directement
(tout le 3D vit dans `@explorer-engine/renderer-three`).

- **Statut** : P1-T2. Rendu à la demande (mount + resize) ; pas de boucle continue (P1-T5).
- **Référence** : chapitres 03 §3.2, 16 (P1-T2).

## Lancer

```bash
npm install
npm run dev            # ou : npm run dev -w @explorer-engine/playground
```

Vite affiche une URL locale (par défaut http://localhost:5173). Un canvas WebGL
plein écran affiche un cube bleu éclairé sur fond sombre. Redimensionner la
fenêtre reprojette et re-rend la scène. Le teardown (HMR / fermeture) retire le
listener de resize et libère les ressources GPU — aucune boucle active.

## Scripts

| Script | Effet |
|--------|-------|
| `dev` | Serveur de développement + HMR (`vite`). |
| `build` | Build de production (`vite build`) → `dist/` (ignoré par git). |
| `preview` | Sert le build de production (`vite preview`). |
| `typecheck` | Vérification TypeScript (`tsc --noEmit`). |
