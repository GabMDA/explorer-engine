# Chapitre 15 — Standards de code

> Ce chapitre définit les conventions, l'organisation, l'architecture logicielle, les principes SOLID, la modularité et l'extensibilité qui régissent le développement du moteur. Il est **normatif** pour tout code futur.

> Rappel : aucun code n'est produit à ce stade. Ce chapitre fixe les **règles** que le futur code devra respecter.

---

## 15.1 Langage et fondations

| Élément | Décision | Justification |
|---------|----------|---------------|
| **Langage** | **TypeScript strict** | Sûreté de type, contrats explicites, maintenabilité sur plusieurs années. |
| **Moteur 3D** | **Three.js** (isolé derrière le Renderer) | Maturité, écosystème, support glTF/Draco/KTX2. Isolé pour permettre une évolution. |
| **Modules** | **ESM** | Standard, tree-shaking. |
| **Cible** | Navigateurs modernes, WebGL 2 | Voir chapitre 14. |
| **Build** | Bundler moderne (à trancher en roadmap) | HMR en dev, bundles optimisés en prod. |

**`strict: true`** est **obligatoire** (pas de `any` implicite, null-safety). L'usage de `any` explicite est proscrit sauf justification documentée et localisée.

---

## 15.2 Principes SOLID appliqués

| Principe | Application dans Explorer Engine |
|----------|----------------------------------|
| **S** — Single Responsibility | Chaque module (chapitre 02) a **une** responsabilité. Un module qui « fait deux choses » doit être scindé. |
| **O** — Open/Closed | Le moteur est **ouvert à l'extension** (plugins, config) et **fermé à la modification** (le noyau ne change pas pour ajouter un objet ou une capacité). |
| **L** — Liskov Substitution | Les implémentations d'un contrat (ex. stratégies d'occlusion, backends de rendu) sont **interchangeables** sans casser les consommateurs. |
| **I** — Interface Segregation | Contrats **fins et ciblés** ; le Plugin Context expose des capacités séparées, pas un objet monolithique. |
| **D** — Dependency Inversion | Les modules dépendent d'**abstractions** (interfaces/contrats), pas d'implémentations concrètes ; injection via le Core. |

> **Conséquence directe (P1)** : le principe Open/Closed **interdit** de modifier le noyau pour supporter un objet particulier. Un nouvel objet = un package ; une nouvelle capacité = un plugin.

---

## 15.3 Architecture logicielle

### 15.3.1 Règles structurantes (rappel + précisions)

1. **Graphe de dépendances acyclique (DAG)** entre modules (chapitre 02). Un cycle = défaut d'architecture.
2. **Encapsulation par module** : l'extérieur importe uniquement l'API publique (`index`), jamais un fichier interne (chapitre 03).
3. **Dépendances inversées** : un module reçoit ses dépendances (injection) plutôt que de les instancier lui-même.
4. **Communication montante par événements** ; communication descendante par appels via le Core.
5. **Aucune connaissance d'objet spécifique** nulle part (P1) — pas de branchement conditionnel sur un type d'objet.

### 15.3.2 Injection de dépendances

Le **Core** est le **compositeur** : il instancie les managers et leur fournit leurs dépendances (Event Bus, autres managers via interfaces, config). Aucun manager ne crée ses propres dépendances lourdes en dur. Cela facilite le test (mock) et l'évolution (substitution).

### 15.3.3 État et immutabilité

- La **config résolue** est **immuable** après chargement (source de vérité du contenu).
- L'état runtime (état courant, focus stack…) est **encapsulé** dans son manager, muté par des méthodes explicites, et chaque mutation significative **émet un événement**.
- Pas d'état global mutable partagé hors des managers.

### 15.3.4 Gestion des erreurs

- **Erreurs typées** avec messages exploitables (quoi, où, comment corriger).
- **Dégradation gracieuse** (P6) : une erreur de contenu n'arrête pas le moteur.
- **Frontières d'erreur** : les plugins et le chargement de package sont isolés (try/catch) ; une erreur locale reste locale.
- **Pas d'échec silencieux** : toute erreur avalée est au minimum journalisée (Diagnostics).

---

## 15.4 Conventions de nommage et de style

### 15.4.1 Nommage

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Fichiers/dossiers | `kebab-case` | `hotspot-manager` |
| Types/interfaces/classes | `PascalCase` | `HotspotManager`, `HotspotConfig` |
| Variables/fonctions | `camelCase` | `projectToScreen` |
| Constantes | `UPPER_SNAKE_CASE` | `DEFAULT_FOV` |
| Événements | `domaine:action` (kebab) | `hotspot:activated`, `state:changed` |
| Tokens de thème | `camelCase`/point | `colorAccent`, `button.bg` |
| Booléens | préfixe `is/has/should/can` | `isVisible`, `hasShadow` |

### 15.4.2 Style

- **Formatage automatique** (Prettier ou équivalent) — pas de débat de style en revue.
- **Linter** (ESLint + règles TS) **bloquant en CI** : interdiction des imports profonds, `any` implicite, cycles de dépendances, variables inutilisées, etc.
- **Commentaires** : expliquer le *pourquoi*, pas le *quoi*. Densité alignée sur le code environnant. Documenter l'API publique (TSDoc) et les invariants non évidents.
- **Fonctions courtes**, à responsabilité unique ; éviter les fonctions « fourre-tout ».
- **Pas de nombres magiques** : constantes nommées.

---

## 15.5 Modularité

| Règle | Détail |
|-------|--------|
| **Un module = un dossier + une API publique** | Chapitre 03. |
| **Faible couplage** | Communication par contrats/événements ; pas d'accès aux internes d'autrui. |
| **Forte cohésion** | Ce qui change ensemble vit ensemble (feature-based). |
| **Substituabilité** | Les stratégies (occlusion, easing, backend rendu) sont des implémentations d'un contrat, remplaçables. |
| **Testabilité** | Modules conçus pour être testés isolément (dépendances injectées/mocables). |

---

## 15.6 Extensibilité

| Point d'extension | Mécanisme | Chapitre |
|-------------------|-----------|----------|
| **Nouveaux objets** | Explorer Package (data) | 04, 05 |
| **Nouvelles capacités** | Plugins (via `plugin-sdk`) | 10 |
| **Nouveaux comportements déclaratifs** | Extension du schéma `config.json` (rétrocompatible) | 05 |
| **Nouvelle apparence** | Thèmes / design tokens | 13 |
| **Nouveau backend de rendu** | Abstraction Renderer | 14 |

> **Règle d'or de l'extensibilité** : ajouter une capacité NE DOIT PAS nécessiter de modifier le noyau. Si c'est le cas, l'architecture doit être revue (le point d'extension manque).

---

## 15.7 Tests

| Niveau | Cible | Exemples |
|--------|-------|----------|
| **Unitaire** | Logique pure des modules. | Validation de config, machine à états, calcul de cadrage, easings, projection. |
| **Intégration** | Interaction entre modules. | Chargement d'un package → hotspots/états construits ; transition d'état complète. |
| **End-to-end** | Parcours utilisateur. | Charger un package d'exemple, cliquer un hotspot, vérifier le focus/panneau. |
| **Performance** | Non-régression de perf. | FPS/mémoire/draw calls sur packages de référence. |
| **Visuel (option)** | Régression de rendu. | Snapshots d'images sur scènes canoniques. |
| **Accessibilité** | Conformité. | Audit automatisé (axe-core) + tests clavier. |

**Exigences** : couverture significative de la **logique du noyau** ; tout bug corrigé s'accompagne d'un **test de non-régression** ; la CI **bloque** en cas d'échec (tests, lint, types).

---

## 15.8 Documentation du code

- **API publique** documentée (TSDoc) et alignée sur cette spécification.
- Chaque module renvoie au **chapitre de documentation** correspondant.
- Le **schéma `config.json`** est documenté et versionné (chapitre 05), avec un **CHANGELOG de schéma**.
- Les **décisions d'architecture** significatives sont consignées (ADR — Architecture Decision Records) dans le dépôt.

---

## 15.9 Intégration continue (CI) — exigences

Le pipeline CI DOIT au minimum, sur chaque changement :

1. **Type-check** (`tsc` strict).
2. **Lint** (règles bloquantes, dont interdiction de cycles et d'imports profonds).
3. **Format check**.
4. **Tests** (unitaires + intégration ; e2e sur les critiques).
5. **Build** (vérifier que tout compile/bundle).
6. **Validation des packages d'exemple** (outil `validate-package`).
7. (Recommandé) **Budgets de perf** et **audit a11y** sur packages de référence.

Un changement ne peut être fusionné que si **tout est vert**.

---

## 15.10 Sécurité (règles de code)

- **Assainir** tout contenu textuel/HTML issu d'un package avant rendu (chapitre 04/12).
- **Politique de chargement** : seules les ressources autorisées (relatives / liste blanche) sont chargées (chapitre 04).
- **Pas d'exécution de code arbitraire** depuis un package (les plugins sont enregistrés côté hôte, chapitre 10).
- **Dépendances** : minimales, auditées, mises à jour ; éviter les dépendances lourdes ou non maintenues.

---

## 15.11 Règles normatives (synthèse)

1. **TypeScript strict**, ESM, Three.js isolé derrière le Renderer.
2. **SOLID** appliqué ; Open/Closed **interdit** de patcher le noyau pour un objet/capacité.
3. **DAG**, encapsulation par module, **injection de dépendances**, config **immuable**.
4. Conventions de nommage/style **automatisées** et **bloquantes en CI**.
5. **Tests** multi-niveaux ; non-régression obligatoire ; CI verte pour fusionner.
6. **Sécurité** : assainissement, politique de chargement, pas de code arbitraire de package.
