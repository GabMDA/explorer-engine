# Chapitre 21 — Guide créateur : produire un Explorer Package

> Ce chapitre est un **guide pratique**, pas une redite normative. Le format exact d'un package et du `config.json` est défini aux [chapitres 04](./04-explorer-packages.md) et [05](./05-config-format.md) — c'est la référence qui fait foi en cas de doute. Ce guide se contente de montrer, **pas à pas et avec de vrais extraits**, comment on va du modèle 3D brut à un package validé, en s'appuyant sur les deux packages de référence réellement livrés par le moteur :
>
> - `examples/explorer-packages/watch/` — package **simple** (P10-T1) : 4 composants, 2 hotspots, 1 état, un thème.
> - `examples/explorer-packages/gaming-pc/` — package **complexe** (P10-T2) : 7 composants, 4 états (dont *exploded* et *x-ray*), un Guided Tour déclaratif, le plugin Measure, i18n anglais/allemand.
>
> Si tu suis ce guide sur ton propre objet, tu dois pouvoir produire un package qui passe `validate-package` sans avertissement, à la fin.

---

## 21.1 Ce dont tu as besoin avant de commencer

- Un modèle 3D exportable en **GLB** (glTF binaire), avec un nœud par partie que tu veux pouvoir adresser (composant, hotspot, état).
- Node.js et le dépôt installé (`npm install` à la racine).
- Aucune connaissance du code moteur n'est nécessaire — un package ne contient jamais de code moteur ([§4.1.2](./04-explorer-packages.md#412-ce-quun-package-ne-contient-pas)).

---

## 21.2 Étape 1 — Préparer le GLB : des identifiants stables, pas des noms

Le moteur adresse les parties d'un objet par `extras.explorerId` sur chaque nœud glTF — **jamais** par le nom du nœud, qui est fragile (renommage dans l'outil d'export, ré-export, etc.). C'est la règle d'or de l'[ADR-003](./adr/ADR-003-stable-asset-identity.md).

Dans Blender/l'outil de ton choix, chaque objet exporté doit porter une extra glTF `explorerId`. Si tu génères ou post-traites tes GLB par script (comme les deux fixtures de référence le font, via [`@gltf-transform`](https://gltf-transform.dev/)), c'est un simple appel :

```js
// extrait réel de scripts/gen-gaming-pc-model.mjs
const node = doc
  .createNode(name)
  .setMesh(mesh)
  .setTranslation(position)
  .setExtras({ explorerId }); // ex. 'cpu-cooler', 'ram-stick-1'…
```

Le [`gaming-pc`](../examples/explorer-packages/gaming-pc/) de référence pose 8 `explorerId` sur 8 nœuds pour former 7 composants (deux nœuds `ram-stick-1`/`ram-stick-2` agrégés en un seul composant `ram` — voir §21.4.1). Le [`watch`](../examples/explorer-packages/watch/) en pose 5 pour 4 composants, avec le même principe d'agrégation pour le `strap`.

**Repli par nom** : si un nœud n'a pas d'`explorerId`, le moteur retombe sur son nom — mais `validate-package` émettra un **avertissement** (repli fragile, [§4.6](./04-explorer-packages.md)). Corrige-le avant publication.

**Compression** : Draco (géométrie) + KTX2 (textures) sont recommandés pour tout modèle réel ([§4.2.2 point 3](./04-explorer-packages.md), [chapitre 06](./06-modeles-3d.md)). Les deux packages de référence utilisent une géométrie volontairement simple (des boîtes) et n'ont donc pas besoin de compression — ne les prends pas comme référence de poids/complexité, seulement de **structure**.

---

## 21.3 Étape 2 — L'arborescence du package

Structure normative ([§4.2.1](./04-explorer-packages.md#421-arborescence-normative)), telle que réellement livrée par `gaming-pc` :

```
gaming-pc/
├── config.json                  # OBLIGATOIRE
├── models/
│   └── gaming-pc.glb            # OBLIGATOIRE — référencé par model.src
├── locales/                     # ici : 2 langues (le minimum pour démontrer l'i18n)
│   ├── en.json
│   └── de.json
└── package.meta.json            # métadonnées (nom, version, licence, tags)
```

`watch/` a la même forme, plus un dossier `assets/images/` (vignette). Aucun des deux champs `assets/` ou `preview.jpg` n'est obligatoire — n'ajoute que ce dont ton package a réellement besoin.

**Un package est autonome** : tous les chemins dans `config.json` sont relatifs à sa propre racine (jamais un chemin absolu, jamais une dépendance à l'endroit où il est hébergé — [§4.2.2 point 2 et 4](./04-explorer-packages.md)).

---

## 21.4 Étape 3 — Écrire `config.json`

Le schéma complet est au [chapitre 05](./05-config-format.md). Voici comment les sections s'enchaînent en pratique, avec de vrais extraits.

### 21.4.1 Composants — agréger plusieurs nœuds sous un seul id adressable

```json
{
  "id": "ram",
  "label": { "$t": "component.ram" },
  "nodes": [{ "explorerId": "ram-stick-1" }, { "explorerId": "ram-stick-2" }]
}
```

Un composant peut regrouper **plusieurs** nœuds GLB (ici deux barrettes de RAM) sous un seul id que hotspots, focus et états référencent ensuite. C'est le même principe que `strap` dans `watch/config.json` (deux nœuds `strap-top`/`strap-bottom`).

### 21.4.2 Hotspots — mélanger les actions, filtrer par état

```json
{
  "id": "hs-open",
  "label": { "$t": "hotspot.openPanel" },
  "anchor": { "kind": "component", "id": "side-panel" },
  "action": { "type": "goToState", "state": "open" },
  "visibleInStates": ["closed"]
}
```

Trois types d'action existent : `focus` (zoomer sur un composant), `goToState` (changer d'état ou activer un modificateur), `emit` (événement libre pour un plugin). `gaming-pc` utilise les deux premiers ; `visibleInStates` restreint un hotspot aux états où il a du sens (ici : proposer d'ouvrir le boîtier seulement quand il est fermé).

> **Piège rencontré en pratique** : si tes hotspots pointent vers des composants **internes** (carte mère, GPU…) placés dans un boîtier plein (sans découpe réelle dans la géométrie), le moteur les considérera **occlus** par le boîtier même après l'avoir "ouvert" visuellement — l'occlusion est un vrai test géométrique, pas une déduction depuis l'état actif. Si ton objet n'a pas de véritable ouverture modélisée, déclare ces hotspots `"occludable": false` (comme le fait `gaming-pc` pour ses 5 hotspots internes). Ce n'est pas un contournement : `occludable` existe précisément pour ce cas d'usage.

### 21.4.3 États — base exclusive + régions modificatrices parallèles

```json
{
  "id": "exploded",
  "label": { "$t": "state.exploded" },
  "region": "base",
  "layers": [
    { "target": { "kind": "component", "id": "psu" }, "channel": "transform", "value": { "translate": [0, -0.5, 0] } }
  ],
  "cameraIntent": { "position": [2.6, 0.8, 2.4], "target": [0, -0.1, -0.1] },
  "transition": { "duration": 700, "easing": "easeInOut" }
}
```

`region: "base"` = un seul état actif à la fois (`closed`/`open`/`exploded` sont mutuellement exclusifs dans `gaming-pc`). Toute autre valeur de `region` est une région **modificatrice**, activable/désactivable en parallèle d'un état de base — `gaming-pc` l'utilise pour son état `xray` (`region: "xray"`, un simple canal `opacity` réduit sur le boîtier). Les transforms sont **toujours absolus** depuis la pose de repos (jamais de `relative`) — voir [chapitre 09](./09-etats.md).

### 21.4.4 Thème

```json
"theme": {
  "preset": "dark",
  "tokens": { "colorAccent": "#7c3aed" },
  "hotspotStyle": { "hotspotColor": "#a78bfa", "hotspotColorActive": "#7c3aed" }
}
```

`validate-package` vérifie automatiquement le **contraste WCAG AA** de tes jetons de thème contre le texte/fond ([chapitre 13](./13-systeme-themes.md)) — un avertissement apparaît si un jeton personnalisé casse le contraste. Ne personnalise que ce qui a du sens pour ton objet (ici, seul l'accent et les couleurs de hotspot ont été modifiés ; le reste hérite des valeurs par défaut du moteur).

### 21.4.5 Plugins — déclarer ce qui doit s'activer, avec ses données

```json
"plugins": [
  {
    "id": "guided-tour",
    "enabled": true,
    "options": {
      "steps": ["case", "side-panel", "motherboard", "cpu-cooler", "gpu", "ram", "psu"],
      "narration": ["The tower case, closed.", "…"]
    }
  },
  { "id": "measure", "enabled": true }
]
```

Un plugin n'est **jamais** codé dans un package : le package se contente de l'**activer** (`enabled`) et de lui fournir ses **données** (`options`), lues par le plugin lui-même (voir [chapitre 22](./22-guide-plugins.md) pour le point de vue plugin). `guided-tour` construit sa visite entièrement depuis `options.steps` (des ids de composants, dans l'ordre de visite) — aucune ligne de code moteur n'a été ajoutée pour livrer ce parcours.

---

## 21.5 Étape 4 — Internationaliser (au moins 2 langues)

Toute chaîne affichable (`label` d'un composant, d'un hotspot, d'un état) accepte soit un littéral, soit une clé `I18nText` :

```json
{ "label": { "$t": "component.gpu" } }
```

```json
// locales/en.json
{ "component.gpu": "Graphics Card", "state.exploded": "Exploded" }
// locales/de.json
{ "component.gpu": "Grafikkarte", "state.exploded": "Explosionsansicht" }
```

Déclare tes langues et tes fichiers dans `config.json` :

```json
"i18n": { "locales": ["en", "de"], "sources": { "en": "locales/en.json", "de": "locales/de.json" } }
```

Chaque fichier est un dictionnaire plat `clé → chaîne`. Une clé absente d'une langue retombe sur la langue par défaut, puis sur la clé elle-même (dégradation gracieuse, jamais d'échec silencieux) — tu peux donc livrer une traduction partielle sans casser l'expérience.

---

## 21.6 Étape 5 — Valider

```bash
npm run validate:package -- examples/explorer-packages/<ton-package>
```

Le validateur vérifie, dans l'ordre : (1) que `config.json` respecte le schéma normatif, (2) que le GLB référencé existe, (3) que **chaque** `explorerId`/nom de nœud référencé par un composant, un hotspot ou une couche d'état existe réellement dans le GLB. Une sortie propre ressemble à :

```
validate-package: OK (examples/explorer-packages/gaming-pc)
```

Toute erreur bloque la publication ; tout avertissement (contraste, repli par nom…) doit être corrigé avant de considérer le package terminé.

---

## 21.7 Étape 6 — Tester dans le Playground

Place ton package sous `examples/explorer-packages/<nom>/`, puis :

```bash
npm run packages:sync   # ou : npm run dev (le fait automatiquement en predev)
npm run dev
```

Ouvre `http://localhost:<port>/?package=<nom>`. Le Playground résout **tous** les chemins de ton package relativement à `packages/<nom>/` — aucune configuration supplémentaire n'est nécessaire, et rien dans le moteur ni le Playground ne connaît le nom de ton package à l'avance (généricité continue, prouvée par le fait que `watch` et `gaming-pc` utilisent exactement le même mécanisme).

---

## 21.8 Checklist finale

- [ ] Chaque nœud adressé porte un `extras.explorerId` stable (aucun avertissement de repli par nom).
- [ ] `validate-package` : 0 erreur, 0 avertissement.
- [ ] Chaque `label` destiné à être traduit utilise `{ "$t": "…" }`, avec une clé présente dans **chaque** langue déclarée.
- [ ] Les hotspots visibles seulement dans certains états utilisent `visibleInStates` ; ceux qui pointent vers des parties non réellement découpées dans la géométrie utilisent `occludable: false` si nécessaire.
- [ ] Le thème personnalisé passe le contraste WCAG AA (aucun avertissement `validate-package`).
- [ ] Le package s'ouvre et se comporte correctement dans le Playground via `?package=<nom>`.

## Références

[Chapitre 04](./04-explorer-packages.md) · [Chapitre 05](./05-config-format.md) · [Chapitre 07 — Hotspots](./07-hotspots.md) · [Chapitre 09 — États](./09-etats.md) · [Chapitre 13 — Thèmes](./13-systeme-themes.md) · [ADR-003](./adr/ADR-003-stable-asset-identity.md) · [ADR-005](./adr/ADR-005-explorer-packages.md) · [CONTRIBUTING §5](../CONTRIBUTING.md#5-créer-un-explorer-package).
