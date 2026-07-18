# Glossaire

> Terminologie de référence d'Explorer Engine. Les termes sont classés par thème puis alphabétiquement.

---

## Termes de la spec v2 (corrections d'architecture)

| Terme | Définition |
|-------|------------|
| **Render State Resolver (RSR)** | Module noyau qui compose l'état visuel à partir de **couches** déclaratives et l'applique via le `RendererPort`. Remplace la mutation impérative « mémoriser/restaurer » (chapitre 19). |
| **Couche (Layer / Contribution)** | Contribution déclarative typée `{ source, target, channel, value, priority }` publiée au RSR. Entrer dans un état/focus = ajouter des couches ; en sortir = les retirer. |
| **Canal (Channel)** | Dimension visuelle indépendante composée par le RSR : `transform`, `opacity`, `colorOverride`, `visibility`, `outline`, `cameraIntent`, `lightingIntent`. |
| **Rest pose canonique** | État géométrique/matériau du modèle au chargement (après normalisation). Seule référence des `transform` (offsets **absolus**). |
| **Core headless** | `@explorer-engine/core` : logique sans DOM ni WebGL, ne connaissant que des **ports**. |
| **Port / Adaptateur** | Contrat (`RendererPort`, `UiPort`, `InputPort`) implémenté par un adaptateur (`renderer-three`, `ui-webcomponents`, `input-dom`). Architecture hexagonale. |
| **`explorerId`** | Identité stable d'un nœud (`node.extras.explorerId`), résistante au ré-export. Le nom de nœud n'est qu'un repli avec avertissement. |
| **`Address`** | Adressage typé d'une cible : `{ kind: "component" \| "group" \| "node", id }`. Remplace les préfixes de chaîne (`"group:..."`). |
| **Catalogue d'événements typé** | Association `nom → payload` vérifiée à la compilation ; remplace les événements en chaînes libres. |
| **`requestRender()` / Frame handle** | Contrat de rendu : `requestRender()` demande une frame ; un `acquireFrameLoop()` (frame handle) maintient la boucle active tant qu'une animation vit. |
| **Statechart** | Modèle des états : région principale (bases exclusives) + régions parallèles (modifiers) + exclusions. |
| **RuntimeState** | État runtime sérialisable (base + modifiers + focus stack + vue + sélection) pour deep-linking/historique/partage/multijoueur (chapitre 20). |
| **`requiredCapabilities`** | Capacités qu'un package attend du runtime ; absence → dégradation gracieuse (réconcilie portabilité et plugins). |
| **Runtime de référence** | Profil officiel garantissant un jeu de plugins/capacités standard. |

---

## Concepts fondamentaux

| Terme | Définition |
|-------|------------|
| **Explorer Engine** | Le moteur générique qui construit une expérience d'exploration 3D à partir d'un package. Il ne connaît aucun objet en particulier. |
| **Explorer Package** | Unité de contenu autonome et data-only (GLB + `config.json` + assets) décrivant entièrement une expérience pour un objet donné. |
| **Content Author / Créateur de contenu** | Personne qui produit un Explorer Package (pas de code moteur requis). |
| **Extension Developer** | Personne qui étend le moteur via des plugins ou l'intègre dans une application. |
| **End User / Utilisateur final** | Personne qui explore l'objet dans le navigateur. |
| **Data-driven** | Piloté par des données déclaratives plutôt que par du code (principe P2). |
| **Generic Test** | Question d'arbitrage : « cette fonctionnalité vaut-elle pour *tout* objet ? » Sinon → plugin/config, jamais le noyau. |

## Modules (architecture)

| Terme | Définition |
|-------|------------|
| **Core / Kernel** | Orchestrateur central : cycle de vie, contexte partagé, render loop, API publique. |
| **Renderer** | Encapsule le rendu WebGL (Three.js), post-processing, resize. Backend isolé. |
| **Scene Manager** | Détient le graphe de scène et l'index des nœuds/composants. |
| **Camera Manager** | Caméra, presets de vues, transitions, cadrage. |
| **Controls Manager** | Traduit les entrées utilisateur en manipulation caméra (orbit…). |
| **Lighting Manager** | Éclairage, IBL, ombres, presets. |
| **Model Loader** | Charge et prépare les GLB (Draco/KTX2/Meshopt), indexe les nœuds, extrait les clips. |
| **Environment Manager** | Arrière-plan, env map, sol, brouillard. |
| **Resource Manager** | Fetch, cache, résolution de chemins, dispose. |
| **Hotspot Manager** | Points d'intérêt : ancrage, projection, occlusion, états, interaction. |
| **Selection Manager** | Picking (raycasting) et résolution de granularité. |
| **Focus Manager** | Mise en avant d'un composant : cadrage, isolation, pile de focus, retour. |
| **State Manager** | États macroscopiques (base/modifier) et transitions (machine à états). |
| **Animation Manager / Animation Engine** | Tweens, timelines, mixer de clips, synchronisation. |
| **UI Manager** | Interface overlay 2D : panneaux, toolbar, breadcrumb, loaders, marqueurs. |
| **Theme Manager** | Design tokens, variantes, préférences système. |
| **Config Loader** | Charge/valide/normalise/migre le `config.json`. |
| **Plugin Manager** | Cycle de vie et orchestration des plugins ; Plugin Context. |
| **Event Bus** | Bus d'événements pub/sub typé (découplage inter-modules). |
| **Diagnostics** | Journalisation, overlay de performance, rapport d'erreurs. |

## Interaction & narration

| Terme | Définition |
|-------|------------|
| **Hotspot** | Entité hybride : ancre 3D + marqueur 2D + comportement à l'activation. |
| **Ancre (anchor)** | Point 3D d'attache d'un hotspot (nœud, composant ou position). |
| **Occlusion** | Masquage d'un hotspot situé derrière la géométrie. |
| **Projection** | Conversion d'une position 3D en coordonnées écran 2D. |
| **Clustering** | Regroupement de hotspots qui se chevauchent à l'écran. |
| **Focus** | **Mécanisme** (v2, pas un état) de mise en avant d'un composant : publie des couches (cameraIntent, dim, outline) au RSR. |
| **Focus Stack** | Pile des focus imbriqués permettant le retour niveau par niveau (partie de `RuntimeState`). |
| **Selection / Picking** | Détermination de l'objet visé par le pointeur (raycasting), résolue en `Address` typée. |
| **pickTarget** | Granularité de sélection : quel composant est sélectionné au clic. |
| **État (State)** | Configuration nommée de l'objet (Closed, Open, Exploded, Transparent, Cutaway). *(v2 : `Focus` **n'est plus** un état — c'est un mécanisme.)* |
| **État base** | État exclusif (région principale du statechart). |
| **État modifier** | État combinable (région parallèle du statechart, ex. X-ray). |
| **Transition** | Passage animé d'un état/vue à un autre. |
| **Cutaway** | Vue en coupe (via clipping planes). |
| **Exploded view** | Vue éclatée : composants écartés pour montrer l'assemblage. |
| **Breadcrumb** | Fil d'Ariane reflétant la pile de focus / hiérarchie de composants. |

## Animation

| Terme | Définition |
|-------|------------|
| **Tween** | Interpolation d'une propriété d'une valeur à une autre dans le temps. |
| **Timeline** | Composition d'**animations atomiques** (parallèles/séquentielles) au niveau du noyau. *(v2 : la scénarisation riche — DSL — est retirée du core et confiée au plugin `guided-tour`.)* |
| **Clip** | Animation embarquée dans le GLB, jouée par un mixer. |
| **Easing** | Fonction d'accélération d'une animation (linear, easeInOut…). |
| **Marker / Label** | Point nommé d'une timeline utilisé pour la synchronisation. |
| **Time-based** | Animation basée sur le temps réel (deltaTime), indépendante du FPS. |
| **Rendu à la demande** | Ne rendre une frame que si quelque chose a changé (dirty). |

## Modèles & rendu 3D

| Terme | Définition |
|-------|------------|
| **glTF / GLB** | Format pivot de modèle 3D (GLB = binaire auto-contenu). |
| **PBR** | Physically-Based Rendering (metallic-roughness). |
| **IBL** | Image-Based Lighting (éclairage par environment map). |
| **Env map / Environment map** | Image d'environnement pour réflexions et IBL (HDR/EXR/KTX2). |
| **Draco** | Compression de géométrie glTF. |
| **KTX2 / Basis** | Compression de textures GPU (reste compressée en VRAM). |
| **Meshopt** | Compression/optimisation de maillage (`EXT_meshopt_compression`). |
| **LOD** | Level Of Detail : niveaux de détail selon distance/taille écran. |
| **Instancing** | Rendu de N copies identiques en un seul draw call (`InstancedMesh`). |
| **Draw call** | Commande de dessin envoyée au GPU ; à minimiser. |
| **Culling** | Élimination du rendu des objets hors champ (frustum) ou masqués (occlusion). |
| **Clipping plane** | Plan de découpe GPU (utilisé pour le Cutaway). |
| **Bounding box / sphere** | Volume englobant d'un objet (cadrage, near/far, sol). |
| **Color space** | Espace colorimétrique (sRGB pour couleurs, linéaire pour données techniques). |
| **Mipmap** | Versions réduites précalculées d'une texture. |
| **Dispose** | Libération explicite des ressources GPU/DOM/écouteurs. |

## UI, thème & accessibilité

| Terme | Définition |
|-------|------------|
| **Overlay** | Couche UI 2D (DOM) superposée au canvas 3D. |
| **Panel / Panneau** | Zone d'information composée de blocs typés. |
| **Bloc (Block)** | Élément de contenu d'un panneau (text, specs, image, audio…). |
| **Toolbar** | Barre d'outils (contrôles d'états, reset, outils de plugins). |
| **Design token** | Variable de style sémantique (couleur, espacement, rayon…). |
| **Preset (thème)** | Variante de base d'un thème (light/dark/auto). |
| **WCAG 2.1 AA** | Niveau de conformité d'accessibilité visé. |
| **ARIA** | Attributs d'accessibilité pour les technologies d'assistance. |
| **Live region** | Zone ARIA annonçant les changements dynamiques. |
| **prefers-reduced-motion / color-scheme / contrast** | Préférences système respectées par le moteur. |
| **i18n / RTL** | Internationalisation / écriture droite-à-gauche. |
| **Bottom-sheet** | Panneau glissant depuis le bas (mobile). |

## Système & extension

| Terme | Définition |
|-------|------------|
| **Plugin** | Extension apportant une capacité non essentielle sans modifier le noyau. |
| **plugin-sdk** | API stable et restreinte utilisée pour écrire des plugins. |
| **Plugin Context** | Façade d'API fournie à un plugin par le Plugin Manager. |
| **Hook de cycle de vie** | `register/init/start/stop/dispose` d'un plugin. |
| **schemaVersion** | Version du schéma de `config.json` déclarée par un package. |
| **Migration** | Transformation montante d'une config d'une version de schéma à une autre. |
| **ADR** | Architecture Decision Record : trace d'une décision d'architecture. |
| **DAG** | Directed Acyclic Graph : le graphe de dépendances des modules doit être acyclique. |
| **Design Freeze** | Gel de la conception/API (jalon v1.0). |

## Principes (rappel)

| Code | Principe |
|------|----------|
| **P1** | Engine ≠ Content (généricité absolue). |
| **P2** | Data-driven (configuration avant code). |
| **P3** | Single Responsibility. |
| **P4** | Composition / extensibilité par plugins. |
| **P5** | Contrats explicites (interfaces, événements). |
| **P6** | Fail gracefully (dégradation gracieuse). |
| **P7** | Performance by design. |
| **P8** | Accessibility first. |
| **P9** | Déterminisme & testabilité. |
| **P10** | Compatibilité ascendante. |
