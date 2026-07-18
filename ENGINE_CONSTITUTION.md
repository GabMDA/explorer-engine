# Explorer Engine — Constitution du moteur

> **Statut** : Loi fondamentale du projet. Ce document prime sur toute autre considération de développement, à l'exception de la [Spécification d'architecture](./docs/README.md) (v2) qu'il résume et protège.
>
> **Portée** : ces règles sont des **invariants absolus**. Elles ne se négocient pas dans une Pull Request. Les enfreindre est un défaut, quelle que soit la qualité du reste du code.
>
> **Modification** : un invariant ne peut être amendé que par une révision explicite de la spécification (nouvel ADR + mise à jour des chapitres concernés + accord du mainteneur), jamais au fil d'une PR ordinaire.

---

## 1. Objet

Cette constitution énonce les **lois non négociables** d'Explorer Engine. Elle existe pour qu'une équipe entière, sur plusieurs années, prenne des décisions cohérentes sans avoir à re-débattre les fondations. Chaque loi est reliée au principe fondateur (P1–P10, [chapitre 01](./docs/01-vision.md)) et/ou à la correction d'architecture (C1–C17, [change-log v2](./docs/reviews/spec-v2-change-log.md)) qui la justifie.

Mots-clés normatifs (RFC 2119) : **DOIT / NE DOIT JAMAIS / DEVRAIT / PEUT**.

---

## 2. Les lois fondamentales

### Titre I — Généricité (moteur ≠ contenu)

- **L1. Le moteur NE CONNAÎT JAMAIS un objet métier.** Aucun code ne contient de logique spécifique à une voiture, une montre, un cerveau, etc. Aucun `if (type === "...")` métier, nulle part. *(P1)*
- **L2. Toute expérience est décrite par un Explorer Package.** Ajouter un objet = ajouter un package (data-only), JAMAIS modifier le moteur. *(P1, ch.04)*
- **L3. Le comportement est déclaratif.** Ce qu'une expérience courante doit faire DOIT être exprimable en `config.json` ou par des ressources. Si cela exige du code, on étend le schéma — on ne code pas un cas particulier. *(P2, ch.05)*
- **L4. Aucun hotspot, état, vue ou panneau n'est codé en dur.** Ces entités sont des données de package. *(P2, ch.05/07/09)*

### Titre II — État visuel (Render State Resolver)

- **L5. Toute mutation visuelle passe OBLIGATOIREMENT par le Render State Resolver.** Aucun module, aucun plugin ne mute directement la scène (transform, matériau, opacité, visibilité, caméra, éclairage). On publie des **couches** ; le RSR compose. *(C1, ch.19)*
- **L6. On ne « restaure » jamais un état visuel.** La réversibilité s'obtient en **retirant une couche** et en recomposant, pas par un mécanisme sauvegarde/restauration. *(C1, ch.19)*
- **L7. Les transforms sont ABSOLUS depuis la rest pose canonique.** Les transforms « relatifs » sont interdits. *(C1, ch.19)*

### Titre III — Architecture (core headless)

- **L8. Le Core reste HEADLESS.** `@explorer-engine/core` ne contient AUCUN accès au DOM ni à WebGL ; il ne connaît que des **ports** (`RendererPort`, `UiPort`, `InputPort`). *(C2, ch.02/03)*
- **L9. Le Core NE DÉPEND JAMAIS de Three.js.** `three` n'apparaît QUE dans l'adaptateur `renderer-three`. Toute autre occurrence est un défaut, vérifié en CI. *(C2, ch.15)*
- **L10. Le graphe de dépendances est un DAG.** Aucun cycle entre modules ; aucune dépendance « remontante » (les notifications montent par événements). Vérifié automatiquement. *(C6, ch.02/15)*
- **L11. Communication montante = événements TYPÉS.** Le catalogue d'événements est typé (nom → payload). Les chaînes d'événement libres sont interdites. **Aucune donnée par frame ne transite par le bus.** *(C9, ch.02/15)*

### Titre IV — Identité & adressage

- **L12. L'identité des composants est STABLE via `extras.explorerId`.** Le nom de nœud n'est qu'un **repli**, signalé par un avertissement de validation. *(C5, ch.05/06)*
- **L13. L'adressage des cibles est TYPÉ** (`Address { kind, id }`). Les préfixes de chaîne (`"group:..."`) sont interdits. *(C5, ch.05)*

### Titre V — Extensibilité (plugins)

- **L14. Toute capacité non universelle est un PLUGIN.** Le noyau reste minimal ; si une fonctionnalité ne vaut pas pour *tout* objet, elle DOIT être un plugin ou une option de configuration. *(P4, ch.10, « Generic Test »)*
- **L15. Les plugins ne se COUPLENT JAMAIS par l'implémentation.** Un plugin NE DOIT JAMAIS importer, appeler directement, ni dépendre des classes, fonctions, fichiers ou détails internes d'un autre plugin. Un plugin PEUT, de façon **purement déclarative**, déclarer : une **capacité requise**, une **dépendance d'ordre d'initialisation**, une **incompatibilité explicite**, une **capacité optionnelle** (dégradation gracieuse). **Toute** communication inter-plugins passe **exclusivement** par les contrats publics du moteur, le **catalogue d'événements typé**, les **capacités déclarées** ou les **ports officiellement exposés**. Une **dépendance d'ordre ne donne AUCUN accès** aux API internes du plugin référencé, et le **graphe des dépendances d'ordre DOIT rester acyclique**. Cette règle interdit tout couplage d'implémentation sans empêcher l'orchestration déclarative nécessaire au runtime. *(P4/P5, ch.10 §10.6bis — décision N1 définitive.)*
- **L16. Un plugin communique via le Plugin Context** (façade stable) et contribue à l'état visuel par des **couches** (jamais de mutation directe). Un package **active/configure** des plugins **enregistrés** par le runtime ; il n'apporte pas leur code. *(C1/C8, ch.10)*
- **L17. Un plugin défaillant NE DOIT JAMAIS casser le moteur.** Ses erreurs sont isolées ; il se désactive proprement. Il libère tout dans `dispose`. *(P6, ch.10)*

### Titre VI — Rendu & performance

- **L18. Le rendu est PILOTÉ.** Il se déclenche par `requestRender()` ou tant qu'un **frame handle** est vivant. Jamais de boucle 60 FPS inconditionnelle sur scène stable. *(C7, ch.02/14)*
- **L19. Aucune allocation dans la boucle chaude** (render, animation, projection, résolution de couches). *(P7, ch.14)*
- **L20. Aucune fuite mémoire.** Tout ce qui est alloué (GPU/DOM/écouteurs) est libéré par `dispose` ; les chargements sont annulables. *(P6/C16, ch.14)*
- **L21. Aucune lecture GPU→CPU SYNCHRONE** (pas de `readPixels`/depth readback bloquant). *(C13, ch.07)*

### Titre VII — État runtime & robustesse

- **L22. L'état runtime est SÉRIALISABLE** (base + modifiers + focus stack + vue + sélection) pour le deep-linking, l'historique et le partage. *(C10, ch.20)*
- **L23. Le moteur DÉGRADE gracieusement.** Un package/asset imparfait ne provoque jamais d'écran noir : défauts, placeholders, diagnostics exploitables. *(P6, ch.04)*
- **L24. Aucun échec silencieux.** Toute erreur avalée est au minimum journalisée. *(P6, ch.15)*

### Titre VIII — Accessibilité & sécurité

- **L25. L'accessibilité est un invariant, pas une option.** Clavier complet, ARIA, contraste WCAG 2.1 AA, préférences système respectées, équivalent non-3D des hotspots. *(P8, ch.07/12)*
- **L26. Aucun code arbitraire de package n'est exécuté.** Le contenu textuel rendu est assaini ; la politique de chargement (relatif / liste blanche) est respectée. *(sécurité, ch.04/15)*

### Titre IX — Gouvernance

- **L27. Toute nouvelle fonctionnalité DOIT respecter la Spécification.** En cas de conflit code ↔ spec, la **spec fait foi** jusqu'à amendement explicite. *(ch.00)*
- **L28. Toute décision d'architecture significative est tracée par un ADR** ([docs/adr/](./docs/adr/README.md)). *(ch.15)*
- **L29. Les packages d'exemple restent DATA-ONLY.** Ils sont la preuve continue de L1/L2 ; aucun code moteur ne s'y glisse. *(P1, ch.03)*

---

## 3. Règle d'arbitrage

En cas de conflit entre deux options, l'ordre de priorité est **immuable** ([ch.01 §1.6.2](./docs/01-vision.md)) :

1. Sécurité & robustesse de l'utilisateur final (L23–L26)
2. Généricité & séparation moteur/contenu (L1–L4)
3. Simplicité & modularité (L5–L17)
4. Performance (L18–L21)
5. Richesse fonctionnelle

> On préfère toujours un moteur **plus simple et plus générique** à un moteur plus riche mais couplé. La richesse passe par les plugins et la configuration.

---

## 4. Le « Generic Test » (test décisif)

Avant d'ajouter quoi que ce soit au **noyau**, poser la question :

> « Cette fonctionnalité a-t-elle du sens pour *n'importe quel* objet ? »

- **Oui** → candidate au noyau (à confronter à la responsabilité unique).
- **Non** → PLUGIN ou option de configuration. Jamais dans le noyau.

---

## 5. Portée et application

- Ces lois s'appliquent à **tout** le code du dépôt : core, adaptateurs, plugins officiels, outils.
- La [Checklist de revue](./docs/CODE_REVIEW_CHECKLIST.md) et la [Definition of Done](./docs/DEFINITION_OF_DONE.md) opérationnalisent ces lois.
- Une PR qui enfreint une loi **ne peut pas être fusionnée**, même verte, tant que l'écart n'est pas corrigé ou l'invariant explicitement amendé (via ADR + spec).

*Ces lois sont les fondations. On construit dessus ; on ne creuse pas dessous.*
