# Chapitre 02 — Architecture générale

> Ce chapitre décrit l'ensemble des modules du moteur : leur rôle, leurs responsabilités, leurs dépendances et leurs interactions. Il constitue la carte mentale de référence pour toute l'équipe.

---

## 2.1 Vue d'ensemble

Explorer Engine est structuré en **couches** et en **modules**. Une règle absolue gouverne l'ensemble : **les dépendances vont de haut en bas et de la périphérie vers le noyau, jamais l'inverse**. Le noyau ne connaît ni les plugins, ni les objets, ni l'application hôte.

### 2.1.1 Couches

```mermaid
graph TD
    subgraph "Couche Application"
        HOST[Application hôte / Page web]
    end
    subgraph "Couche Orchestration"
        ENGINE[Explorer Engine Core - Kernel]
    end
    subgraph "Couche Managers"
        REN[Renderer]
        SCN[Scene Manager]
        CAM[Camera Manager]
        CTRL[Controls Manager]
        LIGHT[Lighting Manager]
        MODEL[Model Loader]
        ENV[Environment Manager]
        HOT[Hotspot Manager]
        FOCUS[Focus Manager]
        SEL[Selection Manager]
        STATE[State Manager]
        ANIM[Animation Manager]
        UI[UI Manager]
        THEME[Theme Manager]
    end
    subgraph "Couche Services (transverses)"
        CFG[Config Loader]
        PLUG[Plugin Manager]
        BUS[Event Bus]
        RES[Resource Manager]
        LOG[Diagnostics/Logger]
    end
    HOST --> ENGINE
    ENGINE --> REN & SCN & CAM & CTRL & LIGHT & MODEL & ENV & HOT & FOCUS & SEL & STATE & ANIM & UI & THEME
    ENGINE --> CFG & PLUG & BUS & RES & LOG
    PLUG -.étend.-> ENGINE
```

### 2.1.2 Principe de communication : l'Event Bus

Les modules **ne s'appellent pas directement** entre eux pour les notifications. Ils émettent et écoutent des **événements** via un **Event Bus** central. Cela garantit un couplage faible (P3, P5).

- Communication **directe** (appel de méthode) : autorisée **uniquement** via l'orchestrateur (le Core appelle les managers) et via des contrats explicites (ex. le Focus Manager demande à la Camera de se déplacer).
- Communication **indirecte** (événements) : privilégiée pour tout ce qui est notification/réaction (« un hotspot a été cliqué », « l'état a changé », « le modèle est chargé »).

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant HOT as Hotspot Manager
    participant BUS as Event Bus
    participant FOCUS as Focus Manager
    participant CAM as Camera Manager
    participant UI as UI Manager
    U->>HOT: clic sur hotspot "GPU"
    HOT->>BUS: emit("hotspot:activated", {id:"gpu"})
    BUS->>FOCUS: notify
    BUS->>UI: notify
    FOCUS->>CAM: focusOn(target)
    UI->>UI: ouvre panneau d'info "GPU"
```

### 2.1.3 Catégories de modules

| Catégorie | Modules | Nature |
|-----------|---------|--------|
| **Rendu 3D** | Renderer, Scene Manager, Camera Manager, Controls Manager, Lighting Manager, Environment Manager | Bas niveau, WebGL/Three.js |
| **Contenu** | Model Loader, Resource Manager | Chargement des assets |
| **Interaction & narration** | Hotspot Manager, Selection Manager, Focus Manager, State Manager, Animation Manager | Cœur de l'expérience |
| **Présentation** | UI Manager, Theme Manager | Interface 2D |
| **Système** | Config Loader, Plugin Manager, Event Bus, Diagnostics | Services transverses |

---

## 2.2 Le noyau (Explorer Engine Core / Kernel)

### Rôle
Orchestrateur central. Point d'entrée unique du moteur. Il instancie, initialise, connecte et pilote tous les managers selon un cycle de vie déterministe.

### Responsabilités
- Exposer l'**API publique** du moteur (création d'une instance, chargement d'un package, contrôle du cycle de vie).
- Séquencer le **bootstrap** : charger la config → préparer le rendu → charger le modèle → construire hotspots/états → monter l'UI → démarrer la boucle de rendu.
- Détenir et fournir le **contexte partagé** (accès contrôlé aux managers, à l'Event Bus, à la config résolue).
- Gérer la **boucle de rendu** (render loop) et la distribuer aux modules qui en ont besoin (update par frame).
- Gérer le **teardown** propre (libération mémoire, dispose des ressources GPU, désabonnement des événements).

### Dépendances
- Tous les managers et services (il les possède).

### Interactions
- Reçoit les ordres de l'application hôte.
- Émet les événements de cycle de vie (`engine:ready`, `package:loaded`, `engine:disposed`).

### Cycle de vie (bootstrap)

```mermaid
graph LR
    A[create] --> B[loadConfig]
    B --> C[initRenderer/Scene/Camera]
    C --> D[loadModel + resources]
    D --> E[buildHotspots/States]
    E --> F[initPlugins]
    F --> G[mountUI]
    G --> H[start render loop]
    H --> I[ready]
```

---

## 2.3 Renderer

### Rôle
Encapsule le moteur de rendu WebGL (Three.js `WebGLRenderer`, avec ouverture possible à WebGPU au chapitre 14/18). Il transforme la scène 3D en pixels.

### Responsabilités
- Créer et configurer le contexte de rendu (canvas, résolution, `pixelRatio`, antialiasing, gestion du color space, tone mapping).
- Exécuter le **render pass** à chaque frame.
- Gérer le **redimensionnement** (resize) et l'adaptation à la densité de pixels.
- Héberger le **post-processing** (composer, passes : bloom, outline, SSAO…) de manière optionnelle et paramétrable.
- Exposer des **métriques** de rendu (draw calls, triangles, temps GPU approx.) au module Diagnostics.

### Dépendances
- Scene Manager (source de la scène), Camera Manager (source de la caméra).

### Interactions
- Piloté par le Core (render loop).
- Fournit le canvas au DOM ; coopère avec le UI Manager pour l'agencement (overlay UI au-dessus du canvas).
- Le Theme Manager peut influencer certains paramètres visuels (couleur de fond, exposition) via la config.

---

## 2.4 Scene Manager

### Rôle
Détient et organise le **graphe de scène** (scene graph) : la hiérarchie des objets 3D.

### Responsabilités
- Créer la scène racine.
- Ajouter/retirer des objets (modèle chargé, lumières, helpers, environnement).
- Maintenir un **index** des objets nommés/taggés (pour retrouver un composant par identifiant — essentiel pour hotspots, focus, états).
- Gérer les **groupes logiques** (ex. « composants internes », « carrosserie ») utilisés par les états.
- Fournir des utilitaires de requête sur le graphe (trouver par nom, par tag, calculer bounding boxes).

### Dépendances
- Model Loader (fournit le contenu), Lighting Manager, Environment Manager (ajoutent des objets).

### Interactions
- Interrogé par Hotspot Manager (positions d'ancrage), Focus Manager (bounding boxes), State Manager (groupes à animer), Selection Manager (raycasting).

---

## 2.5 Camera Manager

### Rôle
Gère la ou les caméras et leur comportement (cadrage, transitions, projections).

### Responsabilités
- Créer et configurer la caméra (perspective par défaut ; orthographique en option pour certains objets/plans).
- Gérer des **presets de vues** (positions/orientations nommées, définies dans la config : « vue de face », « trois-quarts »…).
- Exécuter des **transitions caméra** fluides (interpolation position + cible + FOV) — en coordination avec l'Animation Manager.
- Fournir les primitives au Focus Manager (cadrer un objet : calcul de la distance pour englober une bounding box).
- Gérer les **limites** (distances min/max, angles) en coordination avec le Controls Manager.

### Dépendances
- Scene Manager (cibles), Animation Manager (interpolations).

### Interactions
- Sollicité par Focus Manager et State Manager pour recadrer.
- Coopère avec Controls Manager (qui manipule la caméra en réponse à l'utilisateur).

---

## 2.6 Controls Manager

### Rôle
Traduit les entrées utilisateur (souris, tactile, clavier, gyroscope) en manipulation de la caméra/objet.

### Responsabilités
- Implémenter les schémas de contrôle : **orbit** (rotation autour de l'objet), pan, zoom/dolly ; option « turntable ».
- Appliquer l'**inertie/damping** pour un rendu fluide.
- Respecter les **contraintes** définies par la config (limites d'angle, de distance, verrouillage d'axes).
- Gérer les **modes** : contrôle libre vs. contrôle verrouillé (pendant une transition de focus ou un état animé, les contrôles peuvent être temporairement désactivés/restreints).
- Fournir un **contrôle clavier complet** (accessibilité).

### Dépendances
- Camera Manager (cible de la manipulation).

### Interactions
- Écoute les événements d'état (ex. `focus:started` → réduire/désactiver les contrôles ; `focus:ended` → réactiver).
- Émet des événements d'interaction (`controls:changed`) utiles pour la projection des hotspots.

---

## 2.7 Lighting Manager

### Rôle
Gère l'éclairage de la scène.

### Responsabilités
- Créer les lumières selon la config (directionnelle, ambiante, ponctuelle, spot, hémisphérique).
- Gérer l'**IBL** (Image-Based Lighting) via des environment maps (HDR/EXR → prefiltrées) pour un rendu PBR réaliste.
- Gérer les **ombres** (shadow maps) de façon paramétrable et budgétée (coût GPU).
- Fournir des **presets d'éclairage** (studio, extérieur, nuit…) sélectionnables par la config ou par les états.

### Dépendances
- Scene Manager (ajout des lumières), Environment Manager (env maps).

### Interactions
- Peut être modifié par les états (ex. état `Focus` assombrit l'ambiance et éclaire le composant ciblé) et par le Theme Manager.

---

## 2.8 Model Loader

### Rôle
Charge et prépare les modèles 3D (GLB/glTF) et leurs dérivés.

### Responsabilités
- Charger le **GLB** via le loader glTF, avec support des décodeurs **Draco** (géométrie) et **KTX2/Basis** (textures compressées), et **Meshopt**.
- Traverser le modèle pour **indexer** les meshes/nœuds nommés (mapping nom → objet), base du système de hotspots/focus/états.
- Préparer les **matériaux** (vérification PBR, assignation des env maps, réglages color space).
- Extraire les **animations** intégrées au GLB et les remettre à l'Animation Manager.
- Gérer les **LOD** (niveaux de détail) si fournis, et l'**instancing** pour les éléments répétés.
- Rapporter la progression du chargement (pour le loader UI) et gérer les erreurs (asset manquant, format invalide).

### Dépendances
- Resource Manager (résolution des chemins et cache), Scene Manager (insertion), Animation Manager (clips).

### Interactions
- Émet `model:loading` (progress), `model:loaded`, `model:error`.
- Fournit l'index des composants au Hotspot/Focus/State Managers.

---

## 2.9 Environment Manager

### Rôle
Gère l'environnement visuel autour de l'objet : arrière-plan, sol, brouillard, environment map.

### Responsabilités
- Configurer l'**arrière-plan** (couleur unie, dégradé, skybox, image, transparent).
- Charger et appliquer l'**environment map** (réflexions/IBL) — coordonné avec le Lighting Manager.
- Gérer un **sol** optionnel (plan, ombre de contact, grille).
- Gérer le **brouillard**/atmosphère si pertinent.

### Dépendances
- Lighting Manager (partage des env maps), Scene Manager, Resource Manager.

### Interactions
- Piloté par la config et par le Theme Manager (l'arrière-plan fait partie de l'identité visuelle).

---

## 2.10 Hotspot Manager

> Détaillé au [chapitre 07](./07-hotspots.md).

### Rôle
Gère les **points d'intérêt** ancrés sur le modèle 3D et projetés en 2D.

### Responsabilités
- Créer les hotspots à partir de la config (ancrage à un nœud/position, contenu, icône, comportement).
- **Projeter** les positions 3D → coordonnées écran à chaque frame.
- Gérer l'**occlusion** (masquer un hotspot caché derrière la géométrie).
- Gérer les **états visuels** (repos, survol, actif, désactivé) et leurs animations.
- Émettre les événements d'interaction (`hotspot:hover`, `hotspot:activated`).
- Gérer l'**accessibilité** (focusables clavier, ARIA).

### Dépendances
- Scene/Camera Manager (projection, occlusion), UI Manager (rendu des marqueurs 2D), Event Bus.

### Interactions
- Source principale d'interaction déclenchant le Focus Manager, l'UI, les états.

---

## 2.11 Focus Manager

> Détaillé au [chapitre 08](./08-focus-system.md).

### Rôle
Met en avant un composant sélectionné : cadrage caméra, isolation, mise en valeur, et retour.

### Responsabilités
- Recevoir une demande de focus (depuis un hotspot, la sélection, l'UI, ou un plugin).
- Calculer le **cadrage** optimal (via Camera Manager) pour englober la cible.
- Appliquer la **mise en valeur** : dimming du reste, outline, transparence des occultants, éclairage dédié.
- Gérer la **pile de focus** (focus imbriqués / sous-composants) et le **retour** (revenir au niveau précédent).
- Coordonner avec l'UI (panneau d'information) et le State Manager.

### Dépendances
- Camera Manager, Selection Manager, Scene Manager, Animation Manager, UI Manager.

### Interactions
- Émet `focus:started`, `focus:ended`, `focus:changed`.
- Modifie temporairement contrôles, éclairage, matériaux.

---

## 2.12 Selection Manager

### Rôle
Détermine quel objet 3D est visé/sélectionné par l'utilisateur (picking).

### Responsabilités
- Réaliser le **raycasting** depuis la position du pointeur vers la scène.
- Résoudre la sélection au bon **niveau logique** (un clic sur une vis peut sélectionner « le moteur » selon la granularité configurée).
- Gérer la **surbrillance de survol** (hover highlight) sur la géométrie.
- Fournir la cible aux consommateurs (Focus, UI, plugins).
- Gérer la **désélection** et la sélection multiple (option).

### Dépendances
- Scene Manager (géométrie), Camera Manager (rayon), Event Bus.

### Interactions
- Émet `selection:changed`, `selection:cleared`.
- Alimente le Focus Manager et l'UI.

---

## 2.13 State Manager

> Détaillé au [chapitre 09](./09-etats.md).

### Rôle
Gère les **états macroscopiques** de l'objet (Closed, Open, Exploded, Transparent, Cutaway, Focus…) et leurs transitions.

### Responsabilités
- Charger la **définition des états** depuis la config (quels groupes bougent/se transforment, quels réglages visuels).
- Exposer l'**état courant** et l'API de transition (`goToState`).
- Orchestrer les **transitions** via l'Animation Manager (déplacements, opacités, coupes).
- Garantir la **cohérence** (états mutuellement exclusifs vs. modificateurs combinables).
- Gérer une **machine à états** validée (transitions autorisées).

### Dépendances
- Animation Manager, Scene Manager, Camera Manager, Lighting Manager.

### Interactions
- Émet `state:changing`, `state:changed`.
- Écoute les demandes de l'UI, des hotspots, des plugins.

---

## 2.14 Animation Manager (Animation Engine)

> Détaillé au [chapitre 11](./11-animation-engine.md).

### Rôle
Moteur d'animation générique : interpole des valeurs dans le temps, orchestre timelines et séquences.

### Responsabilités
- Fournir un système de **tweening** (interpolation avec easing) pour toute propriété (position, rotation, échelle, opacité, couleur, FOV…).
- Gérer des **timelines** (séquences d'animations parallèles/séquentielles avec délais).
- Jouer les **clips d'animation** issus du GLB (via un mixer).
- Émettre des **événements** de timeline (start, update, complete, keyframe/marker).
- Assurer la **synchronisation** (avec l'audio, entre plusieurs animations, avec la caméra).
- S'intégrer à la **render loop** (update par frame, delta time).

### Dépendances
- Core (delta time), et fournit ses services à State/Focus/Camera Managers.

### Interactions
- Utilisé par presque tous les modules d'interaction. Émet des événements d'animation consommables par les plugins et l'UI.

---

## 2.15 UI Manager

> Détaillé au [chapitre 12](./12-interface-utilisateur.md).

### Rôle
Gère l'interface 2D superposée à la scène (overlay) : panneaux, boutons, breadcrumb, loaders, marqueurs de hotspots.

### Responsabilités
- Monter/démonter les **composants d'interface** selon la config et l'état.
- Afficher les **panneaux d'information** (contenu de hotspots/composants), la **toolbar**, la **navigation**, le **breadcrumb**, les **loaders**.
- Positionner les **marqueurs de hotspots** (recevant les coordonnées projetées du Hotspot Manager).
- Gérer le **responsive** (desktop/tablette/mobile) et l'**accessibilité** (ARIA, focus, clavier).
- Router les interactions UI vers le moteur (via événements/API).

### Dépendances
- Theme Manager (styles), Hotspot Manager (positions), Config Loader (contenu), Event Bus.

### Interactions
- Écoute la plupart des événements du moteur pour refléter l'état. Émet des commandes utilisateur (`ui:action`).

---

## 2.16 Theme Manager

> Détaillé au [chapitre 13](./13-systeme-themes.md).

### Rôle
Gère l'identité visuelle de l'interface (et certains aspects de la scène : fond, accent).

### Responsabilités
- Charger un **thème** (couleurs, typographies, rayons, ombres, espacements, icônes) depuis la config, sous forme de **design tokens**.
- Appliquer le thème à l'UI (via variables CSS / tokens) et exposer certains tokens à la scène (couleur de fond, couleur d'accent des hotspots).
- Supporter des **variantes** (clair/sombre, marque) et le respect des **préférences système** (`prefers-color-scheme`, `prefers-reduced-motion`).

### Dépendances
- Config Loader, UI Manager.

### Interactions
- Émet `theme:changed`. Consommé par UI Manager et, partiellement, Renderer/Environment.

---

## 2.17 Config Loader

> Détaillé aux [chapitres 04](./04-explorer-packages.md) et [05](./05-config-format.md).

### Rôle
Charge, valide et résout le `config.json` du package.

### Responsabilités
- Récupérer le `config.json` (fetch), le **parser**, le **valider** contre le schéma normatif.
- Appliquer les **valeurs par défaut** et **normaliser** (résolution des chemins relatifs vers les assets).
- Gérer le **versionnage** du schéma et les **migrations** éventuelles.
- Fournir une **config résolue** immuable au reste du moteur, avec des erreurs claires en cas d'invalidité.

### Dépendances
- Resource Manager (fetch), Diagnostics (rapport d'erreurs).

### Interactions
- Première étape du bootstrap ; alimente tous les modules.

---

## 2.18 Plugin Manager

> Détaillé au [chapitre 10](./10-plugins.md).

### Rôle
Découvre, charge, initialise et orchestre les plugins qui étendent le moteur.

### Responsabilités
- Lire la liste des plugins activés (config + enregistrement programmatique).
- Gérer le **cycle de vie** des plugins (register → init → start → stop → dispose).
- Fournir aux plugins un **contexte d'API contrôlé** (accès à l'Event Bus, à certains managers, à l'UI, à la config).
- Isoler les erreurs d'un plugin (un plugin défaillant ne casse pas le moteur).
- Gérer les **dépendances** et l'**ordre** d'initialisation entre plugins.

### Dépendances
- Core (contexte), Event Bus.

### Interactions
- Point d'extension central. Les plugins écoutent/émettent des événements et ajoutent des capacités (UI, comportements, sources de données).

---

## 2.19 Services transverses

### 2.19.1 Event Bus
Bus d'événements typé, pub/sub. Permet le découplage entre modules. Fournit `on/off/once/emit`, avec espaces de noms d'événements (`hotspot:*`, `state:*`, etc.). DOIT être performant (les événements par frame comme la projection ne passent pas forcément par le bus mais par la render loop).

### 2.19.2 Resource Manager
Chargement et cache des ressources (fetch, `ObjectURL`, `blob`, textures, audio). Gère la résolution des chemins relatifs au package, un cache mémoire, la déduplication des requêtes, et la libération (dispose) coordonnée avec le teardown. Centralise la politique réseau (retry, timeout).

### 2.19.3 Diagnostics / Logger
Journalisation structurée (niveaux : debug/info/warn/error), overlay de performance (FPS, draw calls, mémoire), et rapport d'erreurs exploitable. Activable via config/URL param. **Absolument silencieux** en production sauf erreurs.

---

## 2.20 Matrice de dépendances (synthèse)

Lecture : une ligne « dépend de » les colonnes cochées. Le noyau et les services transverses sont omis (tous en dépendent).

| Module ↓ dépend de → | Scene | Camera | Anim | Model | Lighting | Env | UI | Theme | EventBus |
|----------------------|:-----:|:------:|:----:|:-----:|:--------:|:---:|:--:|:-----:|:--------:|
| Renderer | ✔ | ✔ | | | | | | | |
| Camera Manager | ✔ | — | ✔ | | | | | | ✔ |
| Controls Manager | | ✔ | | | | | | | ✔ |
| Lighting Manager | ✔ | | | | — | ✔ | | | |
| Model Loader | ✔ | | ✔ | — | ✔ | | | | ✔ |
| Environment Manager | ✔ | | | | ✔ | — | | ✔ | |
| Hotspot Manager | ✔ | ✔ | ✔ | | | | ✔ | | ✔ |
| Selection Manager | ✔ | ✔ | | | | | | | ✔ |
| Focus Manager | ✔ | ✔ | ✔ | | ✔ | | ✔ | | ✔ |
| State Manager | ✔ | ✔ | ✔ | | ✔ | | | | ✔ |
| UI Manager | | | | | | | — | ✔ | ✔ |

> **Règle** : aucune dépendance ne remonte vers le Core ou vers les plugins. Le graphe de dépendances DOIT rester acyclique (DAG). Toute interaction « remontante » passe par l'Event Bus.

---

## 2.21 Règles d'architecture (normatives)

1. **DAG obligatoire** : le graphe de dépendances entre modules est acyclique. Un cycle est un bug d'architecture.
2. **Le noyau ne connaît pas les plugins** : l'extension va des plugins vers le moteur, jamais l'inverse.
3. **Aucun module ne connaît un objet spécifique** : pas de `if (objet === "voiture")` où que ce soit (P1).
4. **Communication montante = événements** : un module bas niveau n'appelle jamais un module haut niveau directement.
5. **État observable, mutations traçables** : chaque changement d'état significatif émet un événement.
6. **Dispose systématique** : tout module qui alloue des ressources GPU/DOM/écouteurs implémente un `dispose` appelé au teardown.
