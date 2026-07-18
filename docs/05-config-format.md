# Chapitre 05 — Format du fichier `config.json`

> Le `config.json` est le **contrat déclaratif** entre le créateur de contenu et le moteur. Ce chapitre en définit le schéma, propriété par propriété, avec des exemples. Ce schéma est la **référence normative** ; le package `schema` (chapitre 03) en est l'implémentation vérifiable.

---

## 5.1 Principes du format

- **Déclaratif** : on décrit *ce qui doit être*, pas *comment le faire* (P2).
- **Sûr par défaut** : presque toutes les propriétés ont une **valeur par défaut** ; un `config.json` minimal doit produire une expérience correcte.
- **Explicite et lisible** : noms clairs, structuration par sections cohérentes avec l'architecture (chapitre 02).
- **Versionné** : `schemaVersion` en tête ; toute évolution respecte la compatibilité ascendante (P10).
- **Référentiel par identifiants** : les entités (composants, hotspots, états, vues) portent des `id` uniques et se référencent entre elles par ces `id`.

> Le format cible est **JSON** (portabilité maximale). Une variante **JSON5/commentée** POURRA être tolérée en entrée par l'outillage, mais le format canonique est le JSON strict.

---

## 5.2 Structure de premier niveau

```jsonc
{
  "schemaVersion": "1.0",        // OBLIGATOIRE — version du schéma
  "meta": { ... },               // métadonnées (nom, description, langue par défaut)
  "model": { ... },              // OBLIGATOIRE — le modèle 3D et ses options de chargement
  "environment": { ... },        // arrière-plan, environment map
  "lighting": { ... },           // éclairage
  "camera": { ... },             // caméra, contrôles, vues nommées
  "components": [ ... ],         // mapping logique des nœuds du GLB (granularité, groupes)
  "hotspots": [ ... ],           // points d'intérêt
  "states": [ ... ],             // états macroscopiques et transitions
  "focus": { ... },              // réglages globaux du Focus System
  "ui": { ... },                 // panneaux, toolbar, breadcrumb, loaders
  "theme": { ... },              // design tokens (ou référence à un thème)
  "animations": { ... },         // clips nommés, timelines déclaratives
  "plugins": [ ... ],            // plugins activés + leur configuration
  "i18n": { ... }                // langues disponibles, fichiers de traduction
}
```

### 5.2.1 Table de synthèse des sections

| Section | Oblig. | Module cible | Chapitre lié |
|---------|:------:|--------------|--------------|
| `schemaVersion` | ✔ | Config Loader | 04 |
| `meta` | — | Core / UI | 04 |
| `model` | ✔ | Model Loader | 06 |
| `environment` | — | Environment Manager | 02 |
| `lighting` | — | Lighting Manager | 02 |
| `camera` | — | Camera / Controls | 02, 08 |
| `components` | — | Scene / Selection | 06, 08 |
| `hotspots` | — | Hotspot Manager | 07 |
| `states` | — | State Manager | 09 |
| `focus` | — | Focus Manager | 08 |
| `ui` | — | UI Manager | 12 |
| `theme` | — | Theme Manager | 13 |
| `animations` | — | Animation Manager | 11 |
| `plugins` | — | Plugin Manager | 10 |
| `i18n` | — | UI / Config | 12 |

---

## 5.3 Détail des sections

### 5.3.1 `schemaVersion`

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `schemaVersion` | `string` (semver `"MAJEUR.MINEUR"`) | — (obligatoire) | Version du schéma que ce package cible. Détermine compatibilité et migration (chapitre 04). |

### 5.3.2 `meta`

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `title` | `string` | `""` | Titre affiché de l'expérience. |
| `description` | `string` | `""` | Description courte. |
| `defaultLocale` | `string` (BCP-47) | `"en"` | Langue par défaut. |
| `authors` | `string[]` | `[]` | Crédits. |
| `tags` | `string[]` | `[]` | Classification (galerie). |

### 5.3.3 `model`

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `src` | `string` (chemin) | — (obligatoire) | Chemin relatif du GLB principal. |
| `draco` | `boolean` | `true` | Autoriser le décodage Draco si présent. |
| `ktx2` | `boolean` | `true` | Autoriser les textures KTX2/Basis. |
| `meshopt` | `boolean` | `true` | Autoriser la décompression Meshopt. |
| `scale` | `number` | `1` | Facteur d'échelle global appliqué au chargement. |
| `up` | `"y" \| "z"` | `"y"` | Axe « haut » du modèle (normalisation d'orientation). |
| `center` | `boolean` | `true` | Recentrer le modèle sur l'origine. |
| `frameOnLoad` | `boolean` | `true` | Cadrer automatiquement la caméra sur le modèle au chargement. |
| `lod` | `object` | voir 06 | Options LOD (voir chapitre 06). |

### 5.3.4 `environment`

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `background` | `Color \| "transparent" \| { gradient } \| { image }` | thème | Arrière-plan. |
| `envMap` | `string` (chemin) \| preset | `null` | Environment map pour IBL/réflexions. |
| `envIntensity` | `number` | `1` | Intensité de l'IBL. |
| `ground` | `object` \| `false` | `false` | Sol optionnel (`{ shadow, grid, color }`). |
| `fog` | `object` \| `false` | `false` | Brouillard (`{ color, near, far }`). |

### 5.3.5 `lighting`

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `preset` | `"studio" \| "outdoor" \| "night" \| "neutral"` | `"studio"` | Preset d'éclairage prêt à l'emploi. |
| `lights` | `Light[]` | `[]` | Lumières explicites, surchargent/complètent le preset. |
| `shadows` | `boolean \| { quality }` | `false` | Ombres et qualité (coût GPU, chapitre 14). |
| `toneMappingExposure` | `number` | `1` | Exposition globale. |

Chaque `Light` : `{ type: "directional"|"ambient"|"point"|"spot"|"hemisphere", color, intensity, position?, target?, castShadow? }`.

### 5.3.6 `camera`

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `type` | `"perspective" \| "orthographic"` | `"perspective"` | Type de caméra. |
| `fov` | `number` | `45` | Champ de vision (perspective). |
| `near` / `far` | `number` | auto | Plans de clipping (auto-calculés depuis la bounding box si absents). |
| `controls` | `object` | voir ci-dessous | Réglages du Controls Manager. |
| `views` | `View[]` | `[]` | Vues nommées (presets de caméra). |
| `initialView` | `string` (id de vue) | `null` | Vue de départ (sinon cadrage auto). |

`controls` : `{ mode: "orbit"|"turntable", enablePan, enableZoom, damping, minDistance, maxDistance, minPolarAngle, maxPolarAngle, autoRotate, autoRotateSpeed }`.

`View` : `{ id, label?, position: [x,y,z], target: [x,y,z], fov? }`.

### 5.3.7 `components`

Décrit la **granularité logique** et les **groupes** utilisés par la sélection, le focus et les états. Sert à mapper les noms de nœuds du GLB vers des entités compréhensibles.

`Component` :

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `id` | `string` | — | Identifiant logique unique. |
| `label` | `string \| i18nKey` | `id` | Nom lisible. |
| `nodes` | `string[]` | — | Noms de nœuds GLB rattachés à ce composant. |
| `selectable` | `boolean` | `true` | Peut être sélectionné (picking). |
| `pickTarget` | `string` (id) | `self` | Si cliqué, sélectionner ce composant (regroupement de granularité). |
| `group` | `string` | `null` | Groupe logique (ex. `"internals"`) pour les états. |
| `info` | `object` | `null` | Contenu par défaut du panneau (voir `ui`). |

### 5.3.8 `hotspots`

> Sémantique complète au [chapitre 07](./07-hotspots.md).

`Hotspot` :

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `id` | `string` | — | Identifiant unique. |
| `anchor` | `{ node: string } \| { position: [x,y,z] } \| { component: string }` | — | Point d'ancrage 3D. |
| `label` | `string \| i18nKey` | `""` | Libellé/tooltip. |
| `icon` | `string` (chemin/preset) | défaut | Icône du marqueur. |
| `content` | `PanelContentRef` | `null` | Contenu affiché à l'activation. |
| `action` | `HotspotAction` | `focus` | Comportement à l'activation (voir 07). |
| `visibleInStates` | `string[]` | tous | États dans lesquels le hotspot est visible. |
| `occludable` | `boolean` | `true` | Masquer si occulté par la géométrie. |
| `priority` | `number` | `0` | Résolution des chevauchements (clustering). |

`HotspotAction` (union) : `{ type: "focus", target }` | `{ type: "openPanel", panel }` | `{ type: "goToState", state }` | `{ type: "playAnimation", clip }` | `{ type: "emit", event }` (déclenche un événement consommable par un plugin).

### 5.3.9 `states`

> Sémantique complète au [chapitre 09](./09-etats.md).

`State` :

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `id` | `string` | — | Identifiant (ex. `"closed"`, `"exploded"`). |
| `label` | `string \| i18nKey` | `id` | Nom affiché. |
| `type` | `"base" \| "modifier"` | `"base"` | `base` = exclusif ; `modifier` = combinable (ex. transparence). |
| `transforms` | `Transform[]` | `[]` | Transformations appliquées aux composants/groupes. |
| `material` | `MaterialOverride[]` | `[]` | Surcharges de matériau (opacité, wireframe, couleur). |
| `camera` | `string` (id de vue) \| inline | `null` | Vue caméra associée. |
| `lighting` | `string` (preset) | `null` | Éclairage associé. |
| `transition` | `TransitionSpec` | défaut global | Durée/easing de la transition entrante. |
| `allowedFrom` | `string[]` | tous | Restriction de la machine à états. |

`Transform` : `{ target: componentId|group, translate?: [x,y,z], rotate?, scale?, relative?: bool }`.

### 5.3.10 `focus`

Réglages globaux du Focus System (surchargeables par hotspot/composant). Voir [chapitre 08](./08-focus-system.md).

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `padding` | `number` | `1.2` | Marge de cadrage autour de la cible. |
| `dimOthers` | `boolean` | `true` | Assombrir le reste de la scène. |
| `dimOpacity` | `number` | `0.15` | Opacité des non-ciblés. |
| `outline` | `boolean \| { color, thickness }` | `true` | Contour de mise en valeur. |
| `isolate` | `boolean` | `false` | Masquer complètement le reste. |
| `transition` | `TransitionSpec` | `{ duration: 600, easing: "easeInOut" }` | Animation du focus. |
| `restoreOnExit` | `boolean` | `true` | Revenir à la vue précédente à la sortie. |

### 5.3.11 `ui`

> Détaillé au [chapitre 12](./12-interface-utilisateur.md).

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `toolbar` | `{ items: ToolbarItem[] }` | défauts | Boutons de la barre d'outils. |
| `panels` | `Panel[]` | `[]` | Définition des panneaux d'information. |
| `breadcrumb` | `boolean` | `true` | Afficher le fil d'Ariane de navigation. |
| `loader` | `{ style, logo?, tips? }` | défaut | Personnalisation de l'écran de chargement. |
| `hints` | `Hint[]` | `[]` | Aides contextuelles / onboarding. |
| `layout` | `object` | responsive | Placement (positions des zones). |

`Panel` : `{ id, title, blocks: Block[] }` où `Block` ∈ `{ text, image, video, audio, list, specs (clé/valeur), divider, action }`.

### 5.3.12 `theme`

> Détaillé au [chapitre 13](./13-systeme-themes.md). Soit une référence à un preset, soit des tokens explicites.

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `preset` | `"light" \| "dark" \| "auto"` | `"auto"` | Base du thème (respecte `prefers-color-scheme`). |
| `tokens` | `object` | `{}` | Surcharges de design tokens (couleurs, typo, rayons, ombres…). |
| `hotspotStyle` | `object` | thème | Style des marqueurs de hotspots. |

### 5.3.13 `animations`

> Détaillé au [chapitre 11](./11-animation-engine.md).

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `clips` | `ClipRef[]` | auto (depuis GLB) | Déclaration/nommage des clips du GLB ou externes. |
| `timelines` | `Timeline[]` | `[]` | Séquences déclaratives orchestrant animations/caméra/états. |
| `autoplay` | `string` (id) | `null` | Timeline/clip joué au démarrage (ex. rotation d'inactivité). |

### 5.3.14 `plugins`

> Détaillé au [chapitre 10](./10-plugins.md).

`PluginEntry` : `{ id: string, enabled?: boolean, options?: object }`. Le `id` référence un plugin connu du runtime (officiel ou enregistré par l'application hôte). Un package **ne fournit pas** le code du plugin ; il l'**active** et le **configure**.

### 5.3.15 `i18n`

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `locales` | `string[]` | `[meta.defaultLocale]` | Langues disponibles. |
| `sources` | `Record<locale, path>` | `{}` | Fichiers de traduction (`locales/*.json`). |

Toute chaîne affichable (`label`, `title`, `content`…) PEUT être soit un texte littéral, soit une **clé i18n** (résolue via les `sources`).

---

## 5.4 Types réutilisables (glossaire de schéma)

| Type | Forme | Notes |
|------|-------|-------|
| `Color` | `"#RRGGBB"` \| `"#RRGGBBAA"` \| token | Chaînes hex ou référence à un token de thème. |
| `Vec3` | `[number, number, number]` | Coordonnées/vecteurs. |
| `i18nKey` | `string` préfixé (`"@key"`) | Résolu via i18n si le préfixe est présent. |
| `TransitionSpec` | `{ duration: ms, easing: EaseName, delay?: ms }` | Voir easings au chapitre 11. |
| `EaseName` | `"linear" \| "easeIn" \| "easeOut" \| "easeInOut" \| ...` | Ensemble borné, validé. |
| `PanelContentRef` | `string` (id de panel) \| inline `Panel` | Contenu d'un panneau. |

---

## 5.5 Exemples

### 5.5.1 Exemple minimal (le plus petit config valide)

```json
{
  "schemaVersion": "1.0",
  "model": { "src": "models/model.glb" }
}
```

> Résultat : le moteur charge le GLB, applique l'éclairage `studio` par défaut, cadre la caméra automatiquement, active l'orbit control, le thème `auto`. Aucune interaction avancée, mais une expérience visuelle correcte.

### 5.5.2 Exemple intermédiaire — Montre avec hotspots et état Cutaway

```json
{
  "schemaVersion": "1.0",
  "meta": { "title": "Montre Automatique", "defaultLocale": "fr" },
  "model": { "src": "models/watch.glb", "scale": 1, "frameOnLoad": true },
  "environment": { "envMap": "assets/env/studio.hdr", "background": { "gradient": ["#1a1a1f", "#000"] } },
  "lighting": { "preset": "studio", "shadows": { "quality": "medium" } },
  "camera": {
    "views": [
      { "id": "front", "position": [0, 0, 0.4], "target": [0, 0, 0] },
      { "id": "movement", "position": [0, 0.1, 0.2], "target": [0, 0, 0], "fov": 30 }
    ],
    "initialView": "front"
  },
  "components": [
    { "id": "crown", "label": "Couronne", "nodes": ["Crown"] },
    { "id": "movement", "label": "Mouvement", "nodes": ["Movement", "Balance", "Gears"] },
    { "id": "case", "label": "Boîtier", "nodes": ["Case", "Glass"] }
  ],
  "hotspots": [
    { "id": "hs-crown", "anchor": { "component": "crown" }, "label": "Couronne",
      "action": { "type": "focus", "target": "crown" } },
    { "id": "hs-movement", "anchor": { "component": "movement" }, "label": "Mouvement",
      "action": { "type": "goToState", "state": "cutaway" }, "visibleInStates": ["closed"] }
  ],
  "states": [
    { "id": "closed", "label": "Fermée", "type": "base" },
    { "id": "cutaway", "label": "Vue en coupe", "type": "base",
      "material": [{ "target": "case", "opacity": 0.15 }],
      "camera": "movement",
      "transition": { "duration": 800, "easing": "easeInOut" } }
  ],
  "ui": {
    "panels": [
      { "id": "p-movement", "title": "Mouvement automatique",
        "blocks": [
          { "type": "text", "value": "Un rotor remonte le ressort automatiquement." },
          { "type": "specs", "value": { "Fréquence": "28 800 A/h", "Réserve": "42 h" } }
        ] }
    ]
  },
  "theme": { "preset": "dark", "tokens": { "colorAccent": "#c9a227" } }
}
```

### 5.5.3 Exemple avancé — PC Gaming (extrait) avec états et plugin

```json
{
  "schemaVersion": "1.0",
  "meta": { "title": "Gaming PC", "defaultLocale": "fr" },
  "model": { "src": "models/gaming-pc.glb", "draco": true, "ktx2": true },
  "components": [
    { "id": "case-panel", "label": "Panneau latéral", "nodes": ["SidePanel"], "group": "shell" },
    { "id": "gpu", "label": "Carte graphique", "nodes": ["GPU", "GPU_Fans"], "group": "internals",
      "info": { "panel": "p-gpu" } },
    { "id": "cpu", "label": "Processeur", "nodes": ["CPU", "Cooler"], "group": "internals" },
    { "id": "ram", "label": "Mémoire", "nodes": ["RAM_1", "RAM_2"], "group": "internals" }
  ],
  "states": [
    { "id": "closed", "label": "Fermé", "type": "base" },
    { "id": "open", "label": "Ouvert", "type": "base",
      "transforms": [{ "target": "case-panel", "translate": [0.3, 0, 0], "relative": true }] },
    { "id": "exploded", "label": "Éclaté", "type": "base", "allowedFrom": ["open"],
      "transforms": [
        { "target": "gpu", "translate": [0, -0.25, 0.3], "relative": true },
        { "target": "cpu", "translate": [0, 0.25, 0.3], "relative": true },
        { "target": "ram", "translate": [0, 0.1, 0.35], "relative": true }
      ],
      "transition": { "duration": 900, "easing": "easeInOut" } },
    { "id": "xray", "label": "Rayons X", "type": "modifier",
      "material": [{ "target": "group:shell", "opacity": 0.2 }] }
  ],
  "hotspots": [
    { "id": "hs-gpu", "anchor": { "component": "gpu" }, "label": "GPU",
      "action": { "type": "focus", "target": "gpu" }, "visibleInStates": ["open", "exploded"] }
  ],
  "ui": {
    "toolbar": { "items": [
      { "type": "stateToggle", "states": ["closed", "open", "exploded"] },
      { "type": "stateToggle", "states": ["xray"] },
      { "type": "resetView" }
    ] },
    "panels": [
      { "id": "p-gpu", "title": "Carte graphique",
        "blocks": [
          { "type": "image", "src": "assets/images/gpu.jpg" },
          { "type": "specs", "value": { "VRAM": "16 Go", "TDP": "285 W" } }
        ] }
    ]
  },
  "plugins": [
    { "id": "guided-tour", "options": { "steps": ["hs-gpu", "cpu", "ram"], "autoStart": false } },
    { "id": "measure", "enabled": true }
  ],
  "theme": { "preset": "auto", "tokens": { "colorAccent": "#3ba7ff" } }
}
```

---

## 5.6 Règles de validation (normatives)

1. `schemaVersion` et `model.src` sont **obligatoires**.
2. Tous les `id` (composants, hotspots, états, vues, panels) sont **uniques** dans leur espace.
3. Toute **référence** (`action.target`, `anchor.component`, `state.camera`, `visibleInStates`, `plugins[].id`…) DOIT pointer vers une entité existante ou un plugin enregistré ; sinon → erreur ciblée (le reste continue).
4. Les `nodes` référencés DOIVENT exister dans le GLB (vérifié par l'outil `validate-package` et, à l'exécution, par le Model Loader).
5. Les valeurs énumérées (`easing`, `type`, `preset`…) DOIVENT appartenir aux ensembles bornés du schéma.
6. Les nombres contraints (opacités ∈ [0,1], durées ≥ 0…) sont **bornés** ; hors bornes → clamp + warning.
7. Le moteur applique les **défauts** documentés ici pour toute propriété absente.

---

## 5.7 Évolution du schéma

- Ajout de propriété **optionnelle** avec défaut → **mineure** (rétrocompatible).
- Changement de sémantique / suppression / renommage → **majeure** (nécessite migration).
- Le `Config Loader` embarque des **migrations montantes** déterministes entre mineures/majeures supportées (chapitre 04).
- Toute évolution DOIT être documentée dans un **CHANGELOG de schéma** (dans `packages/schema`).
