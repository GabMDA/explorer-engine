# Chapitre 10 — Plugins

> Le système de plugins est le mécanisme d'extension du moteur. Il permet d'ajouter des capacités **sans modifier le noyau** (P4, P1). Ce chapitre décrit le système, la création d'un plugin, son chargement, sa communication avec le moteur, et fournit plusieurs exemples.

---

## 10.1 Philosophie

Le noyau d'Explorer Engine reste **minimal et stable**. Toute fonctionnalité non universelle est un **plugin**. Cela découle directement du *Generic Test* (chapitre 01) : si une fonctionnalité ne vaut pas pour *tous* les objets, elle DOIT être un plugin.

**Bénéfices :**

- Noyau petit, testable, durable.
- Capacités ajoutées/retirées à la carte, par package (`config.plugins`).
- Écosystème extensible (plugins officiels + tiers) sans fork du moteur.
- Isolation des risques : un plugin défaillant ne casse pas l'expérience.

---

## 10.2 Contrat d'un plugin

Un plugin est un **objet conforme à un contrat** (interface) défini par le **`plugin-sdk`** (chapitre 03). Conceptuellement, il expose :

| Élément | Rôle |
|---------|------|
| `id` | Identifiant unique (référencé dans `config.plugins`). |
| `name`, `version` | Métadonnées. |
| `requiredCapabilities?` | Capacités que le plugin **exige** du runtime (voir §10.6bis). |
| `optionalCapabilities?` | Capacités **facultatives** (dégradation gracieuse si absentes). |
| `orderAfter?` | **Dépendances d'ordre d'initialisation** : ids de plugins à initialiser avant celui-ci. **N'ouvre aucun accès** à leurs API internes (voir §10.6bis). |
| `incompatibleWith?` | **Incompatibilités explicites** : ids de plugins avec lesquels celui-ci ne peut coexister. |
| `providesCapabilities?` | Capacités que le plugin **fournit** au runtime. |
| **Hooks de cycle de vie** | `register`, `init`, `start`, `stop`, `dispose`. |

> **v2 (N1 tranché)** : le champ générique `dependencies?` de la v1 est **remplacé** par ces déclarations précises. Un plugin ne déclare jamais une « dépendance » ouvrant l'accès à un autre plugin ; il déclare une **capacité**, un **ordre**, ou une **incompatibilité** (§10.6bis).

> Le plugin ne manipule **jamais** les internes du moteur directement. Il reçoit un **contexte d'API** (Plugin Context) restreint et stable, fourni par le Plugin Manager.

---

## 10.3 Le Plugin Context (API offerte aux plugins)

Le **Plugin Context** est la **façade** que le moteur expose aux plugins. Il est **stable** et **versionné** (compatibilité ascendante). Il donne accès de façon contrôlée à :

| Domaine | Capacités offertes (exemples) — v2 |
|---------|-------------------------------------|
| **Événements** | `on/off/once/emit` sur l'**Event Bus typé** (catalogue nom→payload, C9) ; un plugin déclare ses propres événements typés dans un espace de nom. |
| **Scène (lecture)** | Requêter des composants, bounding boxes, l'index (clé **`explorerId`**, C5) — lecture seule. |
| **État visuel** | **`addLayer` / removeLayer / updateLayer`** au Render State Resolver (chapitre 19), dans une **plage de priorité réservée aux plugins** (≥ 200). Un plugin **ne mute jamais** la scène directement (C1). |
| **Focus / États** | Demander un focus (mécanisme), lire l'état courant, demander une transition (statechart). |
| **Hotspots** | Créer/supprimer des hotspots dynamiques (logique). |
| **Animation** | Créer des tweens ; acquérir un **frame handle** (`acquireFrameLoop`) s'il anime en continu (C7). |
| **UI** | Fournir des **descripteurs d'UI** (bouton toolbar, panneau, overlay) via des **slots** du `UiPort` (C3) — **pas de JSX, pas de framework**. |
| **Rendu** | Accès **indirect** via `RendererPort` (le core est headless) ; pas d'accès Three.js brut par défaut. |
| **Config** | Lire ses `options` (`config.plugins[].options`) et la config globale (lecture). |
| **Ressources** | Charger des assets via le Resource Manager (politique de chargement + **annulation** C16). |
| **Diagnostics** | Logger dans l'espace de nom du plugin. |

> Le contexte **n'expose pas** les objets internes bruts (Three.js, DOM). Un accès bas niveau via `RendererPort` PEUT être fourni sous **capacité explicitement déclarée**, à utiliser avec précaution.

---

## 10.4 Cycle de vie d'un plugin

```mermaid
stateDiagram-v2
    [*] --> Registered: register(ctx)
    Registered --> Initialized: init(ctx)  [config chargée, avant modèle]
    Initialized --> Started: start(ctx)    [expérience prête]
    Started --> Stopped: stop(ctx)         [pause / changement de package]
    Stopped --> Started: start(ctx)
    Started --> Disposed: dispose(ctx)
    Stopped --> Disposed
    Disposed --> [*]
```

| Hook | Moment | Usage typique |
|------|--------|---------------|
| `register` | Découverte du plugin. | Déclarer capacités/dépendances, réserver un espace de nom. |
| `init` | Après config chargée, avant/pendant construction de la scène. | Lire les options, s'abonner aux événements, préparer l'état interne. |
| `start` | Expérience prête (`package:loaded`). | Créer hotspots/UI, démarrer les comportements. |
| `stop` | Pause / avant changement de package. | Suspendre les comportements, détacher l'UI temporaire. |
| `dispose` | Teardown. | Libérer **toutes** les ressources, désabonner tous les événements. |

> **Exigence (P6)** : `dispose` DOIT tout nettoyer (aucun listener/DOM/ressource orphelin). Un plugin est responsable de sa propre libération.

---

## 10.5 Chargement et enregistrement

### 10.5.1 Deux voies d'enregistrement

| Voie | Description | Qui décide |
|------|-------------|-----------|
| **Programmatique** | L'application hôte enregistre des plugins connus au démarrage du moteur (registre de plugins disponibles). | Développeur intégrateur |
| **Déclarative** | Le package **active et configure** des plugins par `config.plugins` (`{ id, enabled, options }`). | Créateur de contenu |

**Règle de sécurité (P1 + sécurité)** : un package **ne fournit pas** le code d'un plugin ; il ne peut activer que des plugins **déjà enregistrés** dans le runtime hôte. Cela évite l'exécution de code arbitraire venu d'un package. (Un futur mode « plugins sandboxés » pourra assouplir cela — chapitre 18.)

### 10.5.1bis Portabilité et `requiredCapabilities` (v2, C8)

La v1 était contradictoire : un package était dit « autonome et portable » (chapitre 04), mais ses plugins devaient être enregistrés par l'hôte (donc un package utilisant un plugin **ne fonctionnait pas** sur un hôte qui ne l'avait pas enregistré). La v2 réconcilie :

1. **Runtime de référence** : un profil officiel embarque un **jeu de plugins standard garanti** (au minimum : `guided-tour`, `measure`, `annotations`). Un package qui n'utilise que ces plugins est **portable sur tout runtime de référence**.
2. **`requiredCapabilities`** : un package déclare les **capacités** dont il a besoin (ex. `["scenario", "measure"]`), pas des ids de plugins concrets. Le runtime associe capacités → plugins disponibles.
3. **Dégradation gracieuse** : si une capacité requise est absente, le moteur **charge l'objet sans la fonctionnalité** concernée + diagnostic clair (jamais d'écran noir). Une capacité `optional` manquante est ignorée silencieusement.

> Reformulation normative : un package est **« portable sur tout runtime conforme au profil de capacités qu'il déclare »**. Le mot « autonome » (chapitre 04) est reprécisé en ce sens (correction C8).

### 10.5.2 Résolution et ordre

```mermaid
graph LR
    A[Registre de plugins disponibles] --> B[config.plugins actifs]
    B --> C[Résolution des dépendances]
    C --> D[Tri topologique]
    D --> E[register → init → start dans l'ordre]
```

- Le Plugin Manager résout les **capacités** et les **dépendances d'ordre** (`orderAfter`), puis applique un **tri topologique** pour l'ordre d'init.
- Le **graphe des dépendances d'ordre DOIT rester acyclique (DAG)** : un cycle entre `orderAfter` est **rejeté** au démarrage avec une erreur claire (aucun plugin du cycle n'est initialisé). *(Règle de validation N1.)*
- Une **capacité requise** manquante → le plugin est désactivé proprement avec un avertissement (pas de plantage) ; une **capacité optionnelle** manquante → dégradation gracieuse.
- Une **incompatibilité** (`incompatibleWith`) détectée → l'un des plugins en conflit est désactivé avec un diagnostic explicite.

### 10.5.3 Isolation des erreurs

Chaque hook de plugin est exécuté de façon **isolée** (try/catch). Une erreur dans un plugin :

- est **journalisée** avec son espace de nom ;
- **désactive** le plugin fautif proprement ;
- **ne casse pas** le moteur ni les autres plugins.

---

## 10.6 Communication avec le moteur

Le mode de communication **privilégié** est l'**Event Bus** (découplage). Deux directions :

| Direction | Mécanisme | Exemple |
|-----------|-----------|---------|
| **Moteur → plugin** | Le plugin **écoute** des événements. | Sur `hotspot:activated`, un plugin d'analytics enregistre l'action. |
| **Plugin → moteur** | Le plugin **émet** des événements ou appelle l'API du contexte. | Un plugin de visite guidée appelle `focus`/`goToState`. |
| **Plugin → plugin** | **Exclusivement** via le **catalogue d'événements typé**, les **capacités déclarées** ou les **ports/contrats publics** du moteur — **jamais** par import/appel direct. | Un plugin d'annotations émet `annotation:created` ; un autre l'écoute. |

**Points d'extension UI** : le contexte offre des « slots » où un plugin peut injecter des éléments (bouton de toolbar, entrée de menu, panneau) sans connaître l'implémentation de l'UI Manager.

---

## 10.6bis Gouvernance des dépendances entre plugins (N1 — définitif)

> **Règle définitive** : un plugin **NE DOIT JAMAIS importer, appeler directement, ni dépendre** des classes, fonctions, fichiers ou détails internes d'un autre plugin. Il **PEUT** en revanche déclarer, de façon purement déclarative : une **capacité requise**, une **dépendance d'ordre d'initialisation**, une **incompatibilité explicite**, une **capacité optionnelle** (dégradation gracieuse). **Toute** communication inter-plugins passe **exclusivement** par les contrats publics du moteur, le **catalogue d'événements typé**, les **capacités déclarées** ou les **ports officiellement exposés**. Cette règle empêche tout **couplage d'implémentation** entre plugins sans interdire l'**orchestration déclarative** nécessaire au runtime.

### Définitions

| Notion | Définition |
|--------|------------|
| **Dépendance d'implémentation** | Lien où un plugin importe/appelle/référence le **code ou les internes** d'un autre plugin (classe, fonction, fichier, état privé). **INTERDITE** — c'est le couplage que la règle proscrit. |
| **Dépendance de capacité** | Déclaration qu'un plugin **requiert une capacité** (ex. `"scenario"`, `"measure"`) fournie *par le runtime* (pas par un plugin nommé). Le runtime la satisfait via un plugin fournisseur, interchangeable. **Autorisée.** |
| **Dépendance d'ordre** | Déclaration (`orderAfter`) qu'un plugin doit être **initialisé après** un autre, pour l'ordonnancement du cycle de vie **uniquement**. Elle **n'accorde AUCUN accès** aux API internes du plugin référencé. **Autorisée.** |
| **Capacité optionnelle** | Capacité que le plugin **exploite si présente**, mais dont l'absence n'empêche pas son fonctionnement (comportement réduit). **Autorisée.** |
| **Dégradation gracieuse** | Comportement par lequel, en l'absence d'une capacité optionnelle (ou d'une capacité requise, au niveau package), la fonctionnalité concernée est **désactivée proprement** avec diagnostic, **sans** écran noir ni plantage. |

### Règles normatives (N1)

1. **Aucun couplage d'implémentation** : pas d'import/appel/référence des internes d'un autre plugin (dépendance d'implémentation interdite).
2. **Orchestration déclarative autorisée** : capacité requise, dépendance d'ordre, incompatibilité explicite, capacité optionnelle.
3. **Communication canalisée** : uniquement via événements typés, capacités déclarées, ou ports/contrats publics.
4. **Ordre sans accès** : une dépendance d'ordre (`orderAfter`) **n'ouvre aucun accès** aux API internes du plugin référencé ; elle ne sert qu'à séquencer l'initialisation.
5. **Graphe d'ordre acyclique** : l'ensemble des `orderAfter` **DOIT former un DAG** ; tout cycle est **rejeté** au démarrage (diagnostic clair).
6. **Capacités, pas plugins nommés** : une dépendance fonctionnelle se déclare par **capacité** (satisfaite par le runtime), non par référence à un plugin concret — ce qui préserve l'interchangeabilité et le découplage.

---

## 10.7 Exemples de plugins

### 10.7.1 Guided Tour (visite guidée)

> **Propriétaire de la scénarisation (v2, C12)** : toute séquence riche (visite, présentation branchée, narration synchronisée) vit **ici**, dans ce plugin, au-dessus de l'Animation Engine. Le **noyau d'animation ne contient plus de DSL de scénario** ; il n'expose que des transitions atomiques et de l'interpolation.

- **But** : enchaîner automatiquement une séquence de points d'intérêt avec narration.
- **Options** : `{ steps: [hotspotId|componentId], autoStart, narration?, loop? }`.
- **Fonctionnement** : au `start`, ajoute un bouton toolbar « Visite ». Sur activation, itère les étapes : pour chaque étape, demande un `focus`, ouvre le panneau, joue l'audio, attend, puis passe à la suivante. Émet `tour:step`, `tour:completed`.
- **Communication** : consomme `focus`, `goToState`, l'audio ; émet ses propres événements.

### 10.7.2 Measure (mesure de distances)

- **But** : mesurer des distances entre points de la surface 3D.
- **Fonctionnement** : mode « mesure » activé via toolbar ; l'utilisateur clique deux points (picking via Selection), le plugin dessine une ligne + label de distance (overlay UI + éventuellement objet 3D). Respecte l'échelle réelle (`model.scale`).
- **Communication** : utilise le raycasting exposé, crée des overlays UI, lit l'échelle.

### 10.7.3 Annotations

- **But** : ajouter des notes/étiquettes utilisateur ancrées sur le modèle.
- **Fonctionnement** : crée des **hotspots dynamiques** à la volée ; persiste les annotations (localStorage / backend via l'hôte). Émet `annotation:created/updated/deleted`.
- **Communication** : API de création de hotspots, ressources/persistance.

### 10.7.4 Minimap / Orientation

- **But** : afficher une mini-vue (boussole/axes ou vue miniature) pour situer la caméra.
- **Fonctionnement** : overlay UI mis à jour depuis les événements caméra (`controls:changed`).

### 10.7.5 Spatial Audio

- **But** : sons positionnés dans l'espace 3D (ronronnement d'un moteur, bips…).
- **Fonctionnement** : place des sources audio spatialisées ancrées à des composants ; volume/pan selon la position caméra. Se synchronise avec les états (ex. son au démarrage d'une animation).

### 10.7.6 Analytics

- **But** : mesurer l'usage (hotspots consultés, temps par composant).
- **Fonctionnement** : écoute passivement les événements (`hotspot:activated`, `state:changed`, `focus:*`) et les transmet à l'hôte. **Ne modifie rien** (plugin purement observateur).

### 10.7.7 Tableau récapitulatif

| Plugin | Consomme (écoute/API) | Produit (émet/UI) | Catégorie |
|--------|-----------------------|-------------------|-----------|
| Guided Tour | focus, state, audio | tour:*, bouton toolbar | Narration |
| Measure | picking, échelle | overlays, ligne 3D | Outil |
| Annotations | hotspots API, persistance | annotation:*, hotspots | Contenu utilisateur |
| Minimap | controls:changed | overlay | Orientation |
| Spatial Audio | états, positions | sources audio 3D | Ambiance |
| Analytics | tous événements | (externe) | Observation |

---

## 10.8 Bonnes pratiques de développement de plugins

1. **Dépendre uniquement du `plugin-sdk`**, jamais des internes du core.
2. **Nettoyer dans `dispose`** : chaque abonnement/élément DOM/ressource créé doit être libéré.
3. **Espace de nom** : préfixer ses événements (`measure:*`) pour éviter les collisions.
4. **Fail soft** : un plugin ne doit jamais faire planter l'expérience ; capter ses propres erreurs.
5. **Configurable** : exposer un maximum via `options` (data-driven, cohérent avec P2).
6. **Respecter le budget de performance** (chapitre 14) : pas de travail lourd par frame sans nécessité.
7. **Accessibilité** : tout UI ajouté par un plugin respecte les mêmes exigences (P8).
8. **Idempotence** du cycle de vie : `start`/`stop` doivent pouvoir s'enchaîner sans fuite.

---

## 10.9 Règles normatives (synthèse)

1. Toute capacité non universelle est un **plugin**, pas du code noyau (P4).
2. Un plugin communique via le **Plugin Context** (façade stable), jamais avec les internes bruts par défaut.
3. Un package **active/configure** des plugins **enregistrés** ; il n'apporte pas leur code (sécurité).
4. Les erreurs de plugins sont **isolées** ; un plugin défaillant est désactivé proprement.
5. Le cycle de vie (`register→init→start→stop→dispose`) est respecté ; `dispose` **libère tout**.
6. La communication privilégiée est l'**Event Bus** typé avec espaces de noms.
7. **Découplage inter-plugins (N1, §10.6bis)** : aucun import/appel/dépendance d'implémentation entre plugins ; seules sont autorisées les déclarations de **capacité requise/optionnelle**, de **dépendance d'ordre** et d'**incompatibilité**. Le graphe des dépendances d'ordre **DOIT rester acyclique**, et une dépendance d'ordre **ne donne aucun accès** aux API internes du plugin référencé.
