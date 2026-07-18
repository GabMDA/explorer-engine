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
  "schemaVersion": "1.0",        // OBLIGATOIRE — version du schéma (politique de compat: §5.3.1)
  "requiredCapabilities": [ ... ],// v2 (C8) — capacités attendues du runtime (dégradation si absentes)
  "meta": { ... },               // métadonnées (nom, description, langue par défaut)
  "model": { ... },              // OBLIGATOIRE — le modèle 3D et ses options de chargement
  "environment": { ... },        // arrière-plan, environment map
  "lighting": { ... },           // éclairage
  "camera": { ... },             // caméra, contrôles, vues nommées
  "components": [ ... ],         // mapping logique (explorerId → composant) + granularité + groupes
  "hotspots": [ ... ],           // points d'intérêt (adressage typé)
  "states": [ ... ],             // états macroscopiques (couches, transforms ABSOLUS)
  "focus": { ... },              // réglages globaux du mécanisme de Focus
  "ui": { ... },                 // panneaux, toolbar, breadcrumb, loaders
  "theme": { ... },              // design tokens (ou référence à un thème)
  "animations": { ... },         // clips nommés + autoplay (v2: PLUS de DSL de scénario — cf. C12)
  "plugins": [ ... ],            // plugins activés + leur configuration
  "i18n": { ... }                // langues disponibles, fichiers de traduction
}
```

> **Références externes (`$ref`, v2/C17)** : toute section volumineuse (`hotspots`, `ui.panels`, `i18n.sources`) PEUT être extraite dans un fichier séparé et référencée : `"hotspots": { "$ref": "hotspots.json" }`. Le Config Loader résout les `$ref` (relatifs au package) à la validation. `config.json` reste le **manifeste**.

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

### 5.3.1 `schemaVersion` et politique de compatibilité (v2, C14)

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `schemaVersion` | `string` (semver `"MAJEUR.MINEUR"`) | — (obligatoire) | Version du schéma que ce package cible. |

**Politique de compatibilité (normative)** :

| Cas | Comportement moteur |
|-----|---------------------|
| Package **même majeure, mineure ≤** celle du moteur | Chargé normalement (défauts appliqués aux champs récents absents). |
| Package **même majeure, mineure >** celle du moteur (package plus récent) | **Forward-compat tolérante** : chargé ; les **champs inconnus sont ignorés avec avertissement** (jamais de rejet). L'expérience fonctionne en mode dégradé sur les nouveautés non comprises. |
| Package **majeure antérieure** | **Migration montante** déterministe (chapitre 04) vers la majeure du moteur. |
| Package **majeure postérieure** | **Rejet propre** + message pointant la doc de migration/mise à jour du runtime. |

**Matrice de compatibilité** : le dépôt publie une matrice `core ↔ schema ↔ sdk` (dans `packages/schema`) indiquant, pour chaque version de `core`, les majeures de schéma supportées et la version de `plugin-sdk` compatible. Politique semver stricte : ajout de champ optionnel = mineure ; changement de sémantique/suppression = majeure.

### 5.3.1bis `requiredCapabilities` (v2, C8)

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `requiredCapabilities` | `Capability[]` | `[]` | Capacités attendues du runtime. Chaque entrée : `{ id: string, level?: "required" \| "optional" }`. Une capacité `required` absente → fonctionnalité désactivée + diagnostic (pas d'échec global) ; `optional` absente → ignorée. |

Exemples de capacités : `"scenario"` (visites), `"measure"`, `"annotations"`, `"spatial-audio"`, `"depth-log"` (buffer de profondeur logarithmique). Le mapping capacité → plugin/feature est assuré par le **runtime de référence** (chapitre 10).

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
| `normalizeToUnit` | `boolean` | `true` | **v2 (C15)** — Normaliser le modèle dans un **volume unité** au chargement (précision de profondeur ; near/far dérivés). |
| `depthLog` | `boolean` | `false` | **v2 (C15)** — Activer un **buffer de profondeur logarithmique** (objets à grande dynamique interne : montre ↔ fusée). Capacité `"depth-log"`. |
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

### 5.3.7 `components` (v2 : identité stable + adressage typé)

Décrit la **granularité logique** et les **groupes** utilisés par la sélection, le focus et les états. Un composant mappe des **nœuds du modèle** vers une entité logique.

**Identité stable (C5)** : un composant référence ses nœuds **prioritairement par `explorerId`** (propriété `extras.explorerId` posée dans le GLB à la préparation — chapitre 06). Le **nom de nœud** n'est qu'un **repli** : s'il est utilisé, l'outil de validation émet un **avertissement** (fragile au ré-export). C'est le **seul** endroit du schéma où des nœuds bruts sont référencés — partout ailleurs on adresse des **composants/groupes**.

`Component` :

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `id` | `string` | — | Identifiant logique unique du composant. |
| `label` | `string \| I18nText` | `id` | Nom lisible. |
| `nodes` | `NodeRef[]` | — | Nœuds rattachés. `NodeRef = { explorerId: string }` (**recommandé**) ou `{ name: string }` (**repli, warning**). |
| `selectable` | `boolean` | `true` | Peut être sélectionné (picking). |
| `pickTarget` | `string` (id de composant) | `self` | Regroupement de granularité au clic. |
| `group` | `string` | `null` | Groupe logique (ex. `"internals"`) pour les états. |
| `info` | `object` | `null` | Contenu par défaut du panneau (voir `ui`). |

**Adressage typé (`Address`, C5)** — utilisé par hotspots/états/focus/plugins : `{ kind: "component" | "group" | "node", id: string }`. Le préfixe de chaîne `"group:internals"` de la v1 est **supprimé** au profit de `{ kind: "group", id: "internals" }`.

### 5.3.8 `hotspots`

> Sémantique complète au [chapitre 07](./07-hotspots.md).

`Hotspot` :

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `id` | `string` | — | Identifiant unique. |
| `anchor` | `{ component: id } \| { group: id } \| { node: { explorerId } } \| { position: [x,y,z] }` | — | Ancrage typé (v2, C5) — `component`/`group` recommandés. |
| `label` | `string \| I18nText` | `""` | Libellé/tooltip. |
| `icon` | `string` (chemin/preset) | défaut | Icône du marqueur. |
| `content` | `PanelContentRef` | `null` | Contenu affiché à l'activation. |
| `action` | `HotspotAction` | `focus` | Comportement à l'activation (voir 07). |
| `visibleInStates` | `string[]` | tous | États dans lesquels le hotspot est visible. |
| `occludable` | `boolean` | `true` | Masquer si occulté (occlusion BVH, sans readback — chapitre 07/C13). |
| `priority` | `number` | `0` | Résolution des chevauchements (clustering). |

`HotspotAction` (union) : `{ type: "focus", target: Address }` | `{ type: "openPanel", panel }` | `{ type: "goToState", state }` | `{ type: "setModifier", modifier, on }` | `{ type: "playClip", clip }` | `{ type: "emit", event }` (événement **typé** consommable par un plugin). *(`playAnimation` de v1 devient `playClip` — plus de scénario ici, cf. C12.)*

### 5.3.9 `states`

> Sémantique complète au [chapitre 09](./09-etats.md).

`State` :

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `id` | `string` | — | Identifiant (ex. `"closed"`, `"exploded"`). |
| `label` | `string \| I18nText` | `id` | Nom affiché. |
| `region` | `"base" \| <modifierRegionId>` | `"base"` | **v2 (C11)** — `base` = région principale (exclusif) ; sinon région parallèle (modifier). |
| `layers` | `Layer[]` | `[]` | **v2 (C1)** — couches publiées au resolver (voir ci-dessous). |
| `cameraIntent` | `string` (id de vue) \| inline | `null` | Couche `cameraIntent` (priorité `state`). |
| `lightingIntent` | `string` (preset) | `null` | Couche `lightingIntent`. |
| `excludes` | `string[]` | `[]` | **v2 (C11)** — modifiers/régions mutuellement exclusifs. |
| `transition` | `TransitionSpec` | défaut global | Durée/easing de la transition entrante. |
| `allowedFrom` | `string[]` | tous | Restriction de la région principale (bases). |

`Layer` (v2, remplace `transforms` + `material`) : `{ target: Address, channel: "transform"|"opacity"|"colorOverride"|"visibility", value }`.
- `transform.value` = **offset ABSOLU depuis la rest pose** : `{ translate?, rotate?, scale? }`. **Le flag `relative` est supprimé** (chapitre 19 §19.3.3).
- `opacity.value` ∈ `[0,1]` ; `visibility.value` ∈ `"visible"|"hidden"` ; `colorOverride.value` = `{ color, intensity }`.

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

> **v2 (C1/C4)** : `restoreOnExit` est **supprimé**. Le retour de focus est intrinsèque au **retrait des couches** publiées (chapitre 08/19) — il n'y a plus rien à « restaurer ».

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
| `autoplay` | `{ clip: id, loop?: bool }` | `null` | **Clip simple** joué au démarrage (ex. ventilateur, rotation d'inactivité). |

> **v2 (C12)** : le champ **`timelines` (DSL de scénario) est supprimé** du schéma. Le noyau d'animation ne fait qu'**interpoler** et **enchaîner des animations atomiques** ; toute **séquence/scénario** (visite, présentation) relève du **plugin `guided-tour`** (capacité `"scenario"`), au-dessus de l'Animation Engine. Voir [chapitre 11](./11-animation-engine.md) et [chapitre 10](./10-plugins.md).

### 5.3.14 `plugins`

> Détaillé au [chapitre 10](./10-plugins.md).

`PluginEntry` : `{ id: string, enabled?: boolean, options?: object }`. Le `id` référence un plugin connu du runtime (officiel ou enregistré par l'application hôte). Un package **ne fournit pas** le code du plugin ; il l'**active** et le **configure**.

### 5.3.15 `i18n`

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `locales` | `string[]` | `[meta.defaultLocale]` | Langues disponibles. |
| `sources` | `Record<locale, path>` | `{}` | Fichiers de traduction (`locales/*.json`). |

Toute chaîne affichable (`label`, `title`, `content`…) est de type **`I18nText`** : soit un **littéral** (`"Couronne"`), soit un objet **clé typé** `{ "$t": "watch.crown" }` résolu via les `sources`. **v2 (C17)** : l'heuristique de préfixe `"@clé"` de la v1 est **supprimée** (ambiguë) au profit de la forme explicite `{ "$t": ... }`.

---

## 5.4 Types réutilisables (glossaire de schéma)

| Type | Forme | Notes |
|------|-------|-------|
| `Color` | `"#RRGGBB"` \| `"#RRGGBBAA"` \| token | Chaînes hex ou référence à un token de thème. |
| `Vec3` | `[number, number, number]` | Coordonnées/vecteurs. |
| **`Address`** | `{ kind: "component" \| "group" \| "node", id }` | **v2 (C5)** — adressage typé unifié (remplace les préfixes de chaîne). |
| **`NodeRef`** | `{ explorerId: string }` \| `{ name: string }` | **v2 (C5)** — `explorerId` recommandé ; `name` = repli avec warning. |
| **`I18nText`** | `string` littéral \| `{ "$t": "clé" }` | **v2 (C17)** — clé i18n explicite (fin du préfixe `@`). |
| **`Layer`** | `{ target: Address, channel, value }` | **v2 (C1)** — contribution au Render State Resolver (chapitre 19). |
| `TransitionSpec` | `{ duration: ms, easing: EaseName, delay?: ms }` | Voir easings au chapitre 11. |
| `EaseName` | `"linear" \| "easeIn" \| "easeOut" \| "easeInOut" \| ...` | Ensemble borné, validé. |
| `PanelContentRef` | `string` (id de panel) \| inline `Panel` | Contenu d'un panneau. |
| `$ref` | `{ "$ref": "fichier.json" }` | **v2 (C17)** — référence externe résolue par le Config Loader. |

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
    { "id": "crown", "label": "Couronne", "nodes": [{ "explorerId": "crown" }] },
    { "id": "movement", "label": "Mouvement",
      "nodes": [{ "explorerId": "movement" }, { "explorerId": "balance" }, { "explorerId": "gears" }] },
    { "id": "case", "label": "Boîtier", "nodes": [{ "explorerId": "case" }, { "explorerId": "glass" }] }
  ],
  "hotspots": [
    { "id": "hs-crown", "anchor": { "component": "crown" }, "label": "Couronne",
      "action": { "type": "focus", "target": { "kind": "component", "id": "crown" } } },
    { "id": "hs-movement", "anchor": { "component": "movement" }, "label": "Mouvement",
      "action": { "type": "goToState", "state": "cutaway" }, "visibleInStates": ["closed"] }
  ],
  "states": [
    { "id": "closed", "label": "Fermée", "region": "base" },
    { "id": "cutaway", "label": "Vue en coupe", "region": "base",
      "layers": [
        { "target": { "kind": "component", "id": "case" }, "channel": "opacity", "value": 0.15 }
      ],
      "cameraIntent": "movement",
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
  "requiredCapabilities": [
    { "id": "scenario", "level": "optional" },
    { "id": "measure", "level": "optional" }
  ],
  "components": [
    { "id": "case-panel", "label": "Panneau latéral", "nodes": [{ "explorerId": "side_panel" }], "group": "shell" },
    { "id": "gpu", "label": "Carte graphique",
      "nodes": [{ "explorerId": "gpu" }, { "explorerId": "gpu_fans" }], "group": "internals",
      "info": { "panel": "p-gpu" } },
    { "id": "cpu", "label": "Processeur", "nodes": [{ "explorerId": "cpu" }, { "explorerId": "cooler" }], "group": "internals" },
    { "id": "ram", "label": "Mémoire", "nodes": [{ "explorerId": "ram_1" }, { "explorerId": "ram_2" }], "group": "internals" }
  ],
  "states": [
    { "id": "closed", "label": "Fermé", "region": "base" },
    { "id": "open", "label": "Ouvert", "region": "base",
      "layers": [
        { "target": { "kind": "component", "id": "case-panel" },
          "channel": "transform", "value": { "translate": [0.3, 0, 0] } }
      ] },
    { "id": "exploded", "label": "Éclaté", "region": "base", "allowedFrom": ["open"],
      "layers": [
        { "target": { "kind": "component", "id": "gpu" }, "channel": "transform", "value": { "translate": [0, -0.25, 0.3] } },
        { "target": { "kind": "component", "id": "cpu" }, "channel": "transform", "value": { "translate": [0, 0.25, 0.3] } },
        { "target": { "kind": "component", "id": "ram" }, "channel": "transform", "value": { "translate": [0, 0.1, 0.35] } }
      ],
      "transition": { "duration": 900, "easing": "easeInOut" } },
    { "id": "xray", "label": "Rayons X", "region": "modifier-visibility",
      "layers": [
        { "target": { "kind": "group", "id": "shell" }, "channel": "opacity", "value": 0.2 }
      ] }
  ],
  "hotspots": [
    { "id": "hs-gpu", "anchor": { "component": "gpu" }, "label": "GPU",
      "action": { "type": "focus", "target": { "kind": "component", "id": "gpu" } },
      "visibleInStates": ["open", "exploded"] }
  ],
  "ui": {
    "toolbar": { "items": [
      { "type": "stateToggle", "region": "base", "states": ["closed", "open", "exploded"] },
      { "type": "modifierToggle", "modifier": "xray" },
      { "type": "resetView" }
    ] },
    "panels": { "$ref": "panels.json" }
  },
  "plugins": [
    { "id": "guided-tour", "options": { "steps": ["hs-gpu", "cpu", "ram"], "autoStart": false } },
    { "id": "measure", "enabled": true }
  ],
  "theme": { "preset": "auto", "tokens": { "colorAccent": "#3ba7ff" } }
}
```

> Notes v2 : transforms **absolus** depuis la rest pose (plus de `relative`) ; adressage `Address` typé ; `xray` est un **modifier** dans sa propre région parallèle (`region: "modifier-visibility"`) ; `panels` extrait via `$ref` ; `requiredCapabilities` déclare `scenario`/`measure` en `optional` (dégradation gracieuse si le runtime ne les fournit pas).

---

## 5.6 Règles de validation (normatives)

1. `schemaVersion` et `model.src` sont **obligatoires**.
2. Tous les `id` (composants, hotspots, états, vues, panels) sont **uniques** dans leur espace.
3. Toute **référence** (`action.target` typé, `anchor`, `cameraIntent`, `visibleInStates`, `plugins[].id`…) DOIT pointer vers une entité existante ou une capacité disponible ; sinon → erreur ciblée (le reste continue).
4. Les `nodes` référencés DOIVENT exister dans le GLB : par **`explorerId`** (recommandé) ou par **`name`** (repli, **warning** de validation — C5).
5. Les valeurs énumérées (`easing`, `channel`, `region`, `preset`…) DOIVENT appartenir aux ensembles bornés du schéma.
6. Les nombres contraints (opacités ∈ [0,1], durées ≥ 0…) sont **bornés** ; hors bornes → clamp + warning.
7. Les couches `transform` sont **absolues** (aucun `relative`) — une couche `relative` est **rejetée** (C1).
8. Les modifiers en conflit sur un même `(target, channel)` DOIVENT déclarer `excludes` ou une priorité ; sinon warning (C11).
9. Les `$ref` sont résolus **relativement au package** ; une cible hors package est rejetée (sécurité).
10. Le moteur applique les **défauts** documentés ici pour toute propriété absente ; les **champs inconnus d'une mineure supérieure** sont ignorés avec warning (C14).

---

## 5.7 Évolution du schéma

- Ajout de propriété **optionnelle** avec défaut → **mineure** (rétrocompatible).
- Changement de sémantique / suppression / renommage → **majeure** (nécessite migration).
- Le `Config Loader` embarque des **migrations montantes** déterministes entre mineures/majeures supportées (chapitre 04).
- Toute évolution DOIT être documentée dans un **CHANGELOG de schéma** (dans `packages/schema`).
