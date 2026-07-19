# @explorer-engine/playground

Development playground for Explorer Engine. **P1-T3** : assemble le renderer, une
scène de démonstration (cube unité éclairé), une caméra, les **contrôles orbit**
(core, headless) et l'**adaptateur d'entrée DOM** (`input-dom`) pour une scène
**interactive**. N'importe **aucun** Three.js et **aucune** logique DOM de
contrôle directement — il ne fait qu'assembler des adaptateurs.

- **Statut** : P1-T3. Boucle de rendu déclenchée par l'interaction (damping),
  qui s'arrête d'elle-même à l'arrêt ; pas de boucle continue (P1-T5).
- **Référence** : chapitres 03 §3.2, 16 (P1-T3).

## Lancer

```bash
npm install
npm run dev            # ou : npm run dev -w @explorer-engine/playground
```

Vite affiche une URL locale (par défaut http://localhost:5173). Un canvas WebGL
plein écran affiche un cube bleu éclairé. Contrôles :

| Entrée | Effet |
|--------|-------|
| Glisser (souris / un doigt) | Orbit |
| Molette / pincer à deux doigts | Zoom (dans les limites) |
| Clic droit ou Shift + glisser / deux doigts | Pan |
| Flèches | Orbit · **Shift+Flèches** : Pan · **+ / -** : Zoom |

Redimensionner reprojette et re-rend. Le teardown (HMR / fermeture) retire tous
les listeners DOM, arrête la boucle et libère les ressources GPU.

## Scripts

| Script | Effet |
|--------|-------|
| `dev` | Serveur de développement + HMR (`vite`). |
| `build` | Build de production (`vite build`) → `dist/` (ignoré par git). |
| `preview` | Sert le build de production (`vite preview`). |
| `typecheck` | Vérification TypeScript (`tsc --noEmit`). |
