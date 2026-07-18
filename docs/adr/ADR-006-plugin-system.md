# ADR-006 — Système de plugins

- **Statut** : Accepted
- **Date** : 2026-07-18
- **Décideurs** : Lead Architect, équipe moteur
- **Corrections liées** : C8 (portabilité/capacités), C1 (contributions par couches), C9 (événements typés) · **Principes** : P4, P5, P6 · **Chapitres** : 10, 04

---

## Contexte

Explorer Engine doit rester **minimal et stable** au cœur, tout en permettant des capacités variées : visites guidées, mesures, annotations, mini-carte, audio spatial, analytics… Ces capacités ne valent pas pour *tous* les objets.

## Problème

Comment ajouter des fonctionnalités **sans complexifier ni patcher le noyau** (Open/Closed), sans coupler ces fonctionnalités entre elles, sans exécuter de code arbitraire venu d'un package, et sans casser l'expérience si l'une échoue ? Et comment concilier cela avec la promesse de **portabilité** d'un package ?

## Options envisagées

- **Option A — Tout dans le noyau (options de config).** *Inconvénient* : noyau obèse, viole le Generic Test ; certaines capacités ne sont pas exprimables déclarativement.
- **Option B — Système de plugins via un SDK et un Plugin Context (façade stable).** Les plugins étendent le moteur par des points d'extension, communiquent par événements typés, contribuent à l'état visuel par des **couches**. *Avantage* : noyau minimal, extensibilité ouverte, isolation des erreurs. *Inconvénient* : nécessite un contrat SDK stable et une gouvernance des capacités.
- **Option C — Plugins fournis par le package (code embarqué).** *Inconvénient* : faille de sécurité (code arbitraire), couplage package↔moteur.

## Décision

**Option B**, avec les garde-fous suivants ([chapitre 10](../10-plugins.md)) :

- Un plugin dépend **uniquement** du `plugin-sdk` (jamais des internes du core).
- Communication via le **Plugin Context** (façade) et l'**Event Bus typé** ; contributions visuelles via **`addLayer`** au Render State Resolver (jamais de mutation directe — C1).
- **Découplage inter-plugins (N1, définitif)** : aucune **dépendance d'implémentation** (import/appel/référence des internes d'un autre plugin). Seules déclarations autorisées, purement déclaratives : **capacité requise**, **dépendance d'ordre** (`orderAfter`), **incompatibilité explicite**, **capacité optionnelle**. Une dépendance d'ordre **n'ouvre aucun accès** aux internes et le **graphe d'ordre reste acyclique** ; toute communication passe par le catalogue d'événements typé / capacités déclarées / ports publics. *(Constitution L15 ; [ch.10 §10.6bis](../10-plugins.md).)*
- **Sécurité** : un package **active/configure** des plugins **enregistrés côté hôte** ; il n'apporte pas leur code.
- **Portabilité (C8)** : un package déclare `requiredCapabilities` ; un **runtime de référence** garantit un jeu de plugins standard ; une capacité absente → **dégradation gracieuse**. Le package est « portable sur tout runtime conforme au profil de capacités déclaré ».
- **Isolation des erreurs** : un plugin défaillant est désactivé proprement, sans casser le moteur ; il libère tout dans `dispose`.

## Conséquences

- **Positives** : noyau stable et durable ; écosystème extensible ; risques isolés ; portabilité réconciliée avec l'extensibilité.
- **Négatives / coûts** : le `plugin-sdk` et le catalogue d'événements deviennent des **contrats publics** à versionner ; la gouvernance des capacités et du runtime de référence doit être maintenue ; le mode « plugins tiers sandboxés » (assouplissement de la règle de sécurité) est repoussé (chapitre 18).
- **Impacts** : ch.10 (SDK, cycle de vie, capacités), ch.04 (portabilité reformulée), ch.02/03 (`plugin-sdk` séparé), ch.11 (scénarios = plugin `guided-tour`, C12).
- **Invariants créés** : L14 (capacité non universelle = plugin), L15 (plugins non couplés), L16 (via Plugin Context + couches), L17 (défaillance isolée).

## Notes

Le retrait du DSL de scénario du noyau ([ADR lié : C12, chapitre 11](../11-animation-engine.md)) confie la scénarisation au plugin `guided-tour` : un seul système de séquençage, au bon niveau.
