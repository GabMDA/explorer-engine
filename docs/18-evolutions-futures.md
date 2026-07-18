# Chapitre 18 — Évolutions futures

> Ce chapitre décrit les fonctionnalités envisagées à long terme, au-delà de la v1. Elles ne font **pas** partie du périmètre initial (chapitre 01 §1.5) mais **orientent** l'architecture : le moteur doit être conçu pour les rendre possibles sans réécriture.

---

## 18.1 Principe directeur

L'architecture v1 (modularité, plugins, data-driven, backend 3D isolé, schéma versionné) est **délibérément** conçue pour accueillir ces évolutions **par extension**, jamais par refonte du noyau (P4, P10). Chaque évolution ci-dessous est mappée à son **point d'ancrage** dans l'architecture existante.

| Évolution | Point d'ancrage | Impact noyau |
|-----------|-----------------|--------------|
| Explorer Studio | Schéma + outils + API | Faible (consomme l'existant) |
| IA / génération de hotspots | Plugins + outils | Faible |
| Annotations | Plugin (existe déjà en réf.) | Nul |
| Visites guidées avancées | Plugin + timelines | Nul |
| VR / AR | Renderer/Controls (abstraction) | Moyen |
| Multijoueur | State sync + plugin transport | Moyen |
| WebGPU | Abstraction Renderer | Moyen |

---

## 18.2 Explorer Studio (éditeur visuel)

**Vision** : un éditeur graphique pour créer/éditer des Explorer Packages **sans écrire de JSON à la main**.

- **Fonctions** : importer un GLB, nommer/mapper les composants, placer des hotspots visuellement, définir des états (exploded/cutaway) par manipulation directe, éditer les panneaux et le thème avec prévisualisation temps réel, valider et exporter le package.
- **Prévisualisation** : utilise **le moteur lui-même** comme moteur de rendu (le Studio est une application au-dessus du moteur).
- **Ancrage architectural** : s'appuie sur le **schéma** (`packages/schema`), les **outils** (`tools/`), et l'**API** du moteur. Aucune modification du noyau : le Studio *produit* ce que le moteur *consomme*.
- **Bénéfice** : ouvre la création à des non-développeurs (muséographes, formateurs, marketeurs) — accélère massivement le time-to-experience.

---

## 18.3 Intelligence artificielle

Plusieurs usages, tous branchables **par plugins/outils** :

| Usage | Description | Ancrage |
|-------|-------------|---------|
| **Génération de hotspots** | Détecter automatiquement les composants remarquables d'un GLB et proposer des hotspots. | Outil/Studio (offline) |
| **Segmentation de composants** | Regrouper les nœuds en composants logiques automatiquement. | Outil (offline) |
| **Génération de contenu** | Rédiger descriptions/specs des composants (à partir de données produit). | Outil/Studio |
| **Assistant conversationnel** | « Montre-moi le GPU », « explique le refroidissement » → pilote le moteur (focus/état). | Plugin (runtime) |
| **Recommandation de parcours** | Suggérer une visite adaptée à l'utilisateur. | Plugin |

> L'IA **produit** ou **pilote** ; elle ne remplace pas le moteur. L'assistant conversationnel se branche via l'**API/événements** (comme n'importe quel plugin), traduisant l'intention en actions (`focus`, `goToState`).

---

## 18.4 Génération automatique de hotspots (détail)

Cas d'usage récurrent méritant une mention dédiée :

- **Entrée** : un GLB, éventuellement des métadonnées.
- **Traitement** (offline, outil/Studio) : analyse de la structure (nœuds, tailles, hiérarchie), heuristiques + IA pour identifier composants et points d'ancrage pertinents, placement automatique.
- **Sortie** : une proposition de `hotspots`/`components` **éditable** dans le `config.json`.
- **Garde-fou** : la génération est une **assistance** ; le résultat reste du contenu déclaratif validable et modifiable par un humain (P2).

---

## 18.5 Système d'annotations (avancé)

Extension du plugin d'annotations (chapitre 10) :

- Annotations **persistées** (backend), **partagées**, **collaboratives**.
- **Fils de discussion** ancrés sur des composants.
- **Versionnage** des annotations.
- **Export** (PDF/rapport) des annotations d'une revue.
- Utile pour la revue de conception, la formation, le SAV.

---

## 18.6 Visites guidées avancées

Extension du plugin Guided Tour :

- **Branchements** (parcours non linéaires selon les choix).
- **Narration synchronisée** (audio + sous-titres + markers de timeline, chapitre 11).
- **Quiz/interactions** pédagogiques intégrés.
- **Analytics** de parcours (quels composants captent l'attention).
- **Édition** des visites dans Explorer Studio.

---

## 18.7 Réalité virtuelle / augmentée (XR)

**Vision** : explorer l'objet en immersion (VR) ou superposé au réel (AR), via WebXR.

- **AR** : poser l'objet à l'échelle réelle dans l'environnement de l'utilisateur (mobile/casque).
- **VR** : manipuler l'objet à deux mains, focus par le regard/pointeur, états à la demande.
- **Ancrage architectural** : nécessite une **abstraction Renderer/Controls** (déjà prévue — le backend 3D est isolé) pour ajouter une boucle et des contrôles XR. Les **hotspots, focus, états** restent valables (repensés en interactions spatiales). L'UI overlay 2D devient de l'UI **spatiale**.
- **Impact** : moyen — un nouveau mode de rendu/contrôle, mais la logique d'expérience (états, focus, contenu) est réutilisée.

---

## 18.8 Multijoueur / collaboration temps réel

**Vision** : plusieurs utilisateurs explorent **ensemble** le même objet (formation à distance, revue produit, showroom guidé).

- **Fonctions** : présence (avatars/curseurs), synchronisation de l'état (caméra d'un guide, état courant, focus), pointage partagé, voix/chat.
- **Ancrage architectural (v2)** : le multijoueur repose sur la **synchronisation d'état** — pas sur une simulation déterministe (le déterminisme *de rendu* est illusoire en WebGL/async ; correction v1 F20). Le module d'**état runtime sérialisable** (chapitre 20) fournit `serialize`/`apply`/`diff`/`patch` ; un **plugin de transport** (WebRTC/WebSocket) diffuse des **snapshots/patches** que les pairs **appliquent** via le Render State Resolver. Même état macroscopique partout, indépendamment des micro-différences de rendu.
- **Modes** : « suivi du guide » (un pair pousse son `RuntimeState`, les autres l'appliquent) ; « exploration libre partagée » (curseurs/sélections superposés).
- **Impact** : moyen — surtout un plugin de transport au-dessus de la sérialisation d'état **déjà présente au noyau** (chapitre 20). P9 est reprécisé : « transitions **logiques** déterministes à entrées égales », pas déterminisme de rendu.

---

## 18.9 WebGPU et rendu avancé

- **WebGPU** : backend de rendu alternatif pour de meilleures performances et le **compute** (culling GPU, effets avancés).
- **Ancrage** : l'abstraction du **Renderer** (chapitre 14) permet de basculer de backend sans réécrire le moteur.
- **Effets avancés** : global illumination approximée, meilleures ombres, post-processing plus riche — activés selon capacités et budget.

---

## 18.10 Autres pistes

| Piste | Description |
|-------|-------------|
| **Marketplace de packages** | Galerie/distribution d'Explorer Packages. |
| **Bibliothèque de thèmes** | Thèmes prêts à l'emploi partagés. |
| **Écosystème de plugins tiers** | Plugins communautaires, éventuellement **sandboxés** (sécurité) pour lever la restriction actuelle. |
| **Variants de matériaux / configurateur** | Changer couleurs/finitions (glTF `KHR_materials_variants`) — configurateur produit. |
| **Mode « comparaison »** | Comparer deux objets/états côte à côte. |
| **Export / captures** | Générer images/vidéos/GIFs de l'objet dans un état donné. |
| **Données temps réel** | Superposer des données live (capteurs, télémétrie) sur un jumeau numérique. |
| **Analytics produit** | Tableau de bord d'usage agrégé. |

---

## 18.11 Ce que ces évolutions exigent de la v1 (implications de conception)

Pour que ces évolutions restent possibles **sans réécriture**, la v1 DOIT respecter :

1. **Backend 3D isolé** (Renderer/Controls abstraits) → VR/AR, WebGPU.
2. **État observable et déterministe** (événements exhaustifs) → multijoueur, IA, analytics.
3. **Schéma versionné et rétrocompatible** → Explorer Studio, génération automatique.
4. **Système de plugins riche** (API/points d'extension) → IA conversationnelle, annotations, transport multijoueur.
5. **Outils autour du schéma** (`tools/`, `schema`) → Studio, génération, validation.
6. **UI thématisable et découplée** → UI spatiale (XR), thèmes partagés.

> Ces exigences ne sont pas des « fonctionnalités futures » : ce sont des **contraintes présentes** que la v1 respecte déjà (chapitres 02, 05, 10, 13, 14). C'est le sens d'un moteur conçu pour durer.
