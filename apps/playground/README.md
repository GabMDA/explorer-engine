# @explorer-engine/playground

Development playground for Explorer Engine (**P0-T3**). A minimal web app with a
**Vite** dev server + **HMR** that mounts an empty host page. It exists solely to
verify that the development environment starts and hot-reloads.

- **Statut** : shell minimal (P0-T3). **Aucun code moteur, aucun rendu 3D.**
- **Référence** : chapitres 03 §3.2, 16 (P0-T3).

## Lancer

Depuis la racine du dépôt :

```bash
npm install
npm run dev            # équivaut à: npm run dev -w @explorer-engine/playground
```

Vite affiche une URL locale (par défaut http://localhost:5173). La page affiche
un shell « Explorer Engine — Playground ». Modifier `src/main.ts` ou `index.html`
met la page à jour **à chaud** (HMR), sans rechargement complet.

## Scripts

| Script | Effet |
|--------|-------|
| `dev` | Serveur de développement + HMR (`vite`). |
| `build` | Build de production (`vite build`) → `dist/` (ignoré par git). |
| `preview` | Sert le build de production (`vite preview`). |
| `typecheck` | Vérification TypeScript (`tsc --noEmit`). |

## À venir (hors P0-T3)

L'hébergement réel du moteur (core headless + adaptateurs + UI) sera branché ici
lors des phases ultérieures (P0-T4 et suivantes).
