# Chapitre 22 — Guide plugin : développer une extension

> Guide **pratique**, complémentaire au [chapitre 10](./10-plugins.md) (contrat normatif) et à [CONTRIBUTING §4](../CONTRIBUTING.md#4-créer-un-plugin) (checklist). Ici, on regarde le **code réel** des deux plugins officiels livrés avec le moteur — `@explorer-engine/plugin-guided-tour` et `@explorer-engine/plugin-measure` (`packages/plugins/`) — pour comprendre concrètement comment un plugin s'écrit, se déclare et se teste.

---

## 22.1 Un plugin ne dépend que du SDK

```json
// packages/plugins/guided-tour/package.json
"dependencies": { "@explorer-engine/plugin-sdk": "0.0.0" }
```

`@explorer-engine/plugin-sdk` est une **façade pure** (aucune logique propre) qui ré-exporte exactement ce dont un plugin a besoin depuis le core : le contrat `Plugin`/`PluginContext`, les types d'adressage (`Address`), le vocabulaire du Render State Resolver (`Channel`, `RenderLayer`…), les descripteurs UI, et le catalogue d'événements typé. Un plugin **n'importe jamais** `@explorer-engine/core` directement, et **jamais** un autre plugin (L15) — voir `packages/plugin-sdk/src/index.ts` pour la liste exacte.

## 22.2 Le contrat minimal

```ts
export interface Plugin {
  readonly id: string;
  readonly name?: string;
  readonly providesCapabilities?: readonly string[];
  register?(ctx: PluginContext): void;   // découverte — pas d'I/O
  init?(ctx: PluginContext): void;       // la config est disponible
  start?(ctx: PluginContext): void;      // l'expérience est prête
  stop?(ctx: PluginContext): void;       // suspendre
  dispose?(ctx: PluginContext): void;    // tout libérer (L20)
}
```

Tous les hooks sont **optionnels** — n'implémente que ceux dont ton plugin a réellement besoin. `Measure` n'utilise que `register`/`dispose` (rien à préparer à l'avance : tout est piloté par `setActive`/`pickAt`, appelés par l'hôte). `Guided Tour` utilise en plus `init` (lire ses `steps` depuis la config) et `start`/`stop` (démarrage auto optionnel, interruption propre).

## 22.3 Exemple 1 — Measure : un plugin sans configuration, piloté par l'hôte

`packages/plugins/measure/src/measure-plugin.ts` mesure la distance réelle entre deux points cliqués :

```ts
export function createMeasurePlugin(options: MeasurePluginOptions = {}): MeasurePlugin {
  let ctx: PluginContext | null = null;
  let active = false;
  const points: Vec3[] = [];

  return {
    id: options.id ?? 'measure',
    name: 'Measure',
    providesCapabilities: ['measure'],

    register(pluginContext) {
      ctx = pluginContext;
      ctx.ui?.registerSlot(`${this.id}-overlay`);   // slot UI déclaré, contenu vide au départ
    },
    dispose(pluginContext) {
      points.length = 0;
      pluginContext.resolver.clear();               // retire TOUTES les couches publiées par ce plugin
      pluginContext.ui?.renderSlot(`${this.id}-overlay`, null);
      ctx = null;
    },

    setActive: (next) => { active = next; },
    isActive: () => active,
    pickAt(ndcX, ndcY) {
      if (!active || !ctx?.raycaster) return false;
      const hit = ctx.raycaster.pick(ndcX, ndcY);    // picking en lecture seule, fourni par le contexte
      if (!hit) return false;
      // … pousse le point, marque-le via une couche colorOverride, émet measure:point-added…
    },
  };
}
```

Points à retenir :

- **`register`** ne fait jamais d'I/O — seulement de la découverte (déclarer un slot, garder la référence au contexte).
- **`pickAt` est piloté par l'hôte** : le plugin n'écoute aucun événement DOM lui-même (le core est headless, L8/L9) — c'est le Playground qui appelle `measure.pickAt(ndcX, ndcY)` sur un clic canvas.
- **Toute contribution visuelle passe par `ctx.resolver.addLayer(...)`** (ici un `colorOverride` sur le point pické) — jamais de mutation directe d'un objet 3D (L5/L16).
- **`dispose` libère tout** : couches (`resolver.clear()`), slot UI (`renderSlot(id, null)`), état interne.

## 22.4 Exemple 2 — Guided Tour : un plugin entièrement piloté par les données du package

`packages/plugins/guided-tour/src/guided-tour-plugin.ts` lit sa configuration dans `init` :

```ts
init(pluginContext) {
  const raw = pluginContext.config.options;          // ex. config.plugins[0].options du package
  if (isStringArray(raw['steps'])) steps = raw['steps'];
  if (typeof raw['autoStart'] === 'boolean') autoStart = raw['autoStart'];
  if (isStringArray(raw['narration'])) narration = raw['narration'];
},
```

Le package `gaming-pc` déclare ainsi sa visite **sans aucun code** :

```json
{ "id": "guided-tour", "enabled": true,
  "options": { "steps": ["case", "side-panel", "motherboard", "…"], "narration": ["…"] } }
```

`ctx.config.options` (le `options` de CE plugin dans `config.plugins`) est la **seule** interface entre un package et un plugin — un package ne référence jamais le code du plugin, il ne fait que remplir ses données déclarées. Avancer dans la visite (`next()`) utilise **exclusivement** `ctx.focus.focus({ kind: 'component', id })`, jamais une manipulation directe de la caméra.

## 22.5 Déclarer une capacité, pas une dépendance à un autre plugin

```ts
providesCapabilities: ['measure'],
```

Un package peut exiger cette capacité (`requiredCapabilities: ["measure"]` dans son `config.json`) sans jamais nommer `@explorer-engine/plugin-measure` — le Plugin Manager résout la capacité contre **n'importe quel** plugin enregistré qui la fournit. Si un autre plugin a besoin d'être initialisé après le tien, il déclare `orderAfter: ["measure"]` — cela ne lui donne **aucun accès** à tes internes (L15, [chapitre 10 §10.6bis](./10-plugins.md)).

## 22.6 Tester un plugin (isolément, sans moteur réel)

Les deux plugins se testent avec un `PluginContext` factice — extrait de `packages/plugins/measure/src/measure-plugin.test.ts` :

```ts
function fakeContext(overrides = {}): PluginContext {
  return {
    pluginId: 'measure',
    events: { emit: (e, p) => emitted.push({ e, p }), on: vi.fn(), off: vi.fn(), once: vi.fn() },
    config: { options: {}, resolved: {} },
    resolver: { addLayer: vi.fn(), updateLayer: vi.fn(), removeLayer: vi.fn(), clear: vi.fn() },
    ui: { registerSlot: vi.fn(), renderSlot: vi.fn() },
    raycaster: { pick: vi.fn(() => null) },
    ...overrides,
  } as unknown as PluginContext;
}
```

Aucun rendu, aucun DOM, aucun WebGL n'est nécessaire : le plugin ne connaît que le contrat `PluginContext`, donc un test unitaire se contente de vérifier les hooks + un contexte factice. Ajoute un test d'**intégration du cycle de vie** (`register → init → start → stop → dispose` sans fuite : plus aucun listener/slot/couche après `dispose`) — c'est la vérification la plus fréquemment oubliée.

## 22.7 Enregistrer ton plugin (côté hôte, pas côté package)

Un plugin est du **code moteur/extension**, enregistré **programmatiquement** par l'hôte (le Playground, ou toute application intégrant le moteur) — jamais par un package ([ch.10 §10.5.1](./10-plugins.md)) :

```ts
// apps/playground/src/main.ts — extrait réel
const guidedTour = createGuidedTourPlugin({ steps: [] });   // valeurs par défaut ; init() les remplace
if (isActivated('guided-tour')) {
  pluginManager.registerPlugin(guidedTour, () => buildPluginContext('guided-tour'));
}
```

Un package ne fait qu'**activer/configurer** un plugin déjà enregistré par l'hôte (`config.plugins[].enabled` + `.options`) — il ne peut jamais introduire un plugin que l'hôte n'a pas explicitement enregistré.

## 22.8 Checklist finale

- [ ] Dépend uniquement de `@explorer-engine/plugin-sdk` (jamais de `@explorer-engine/core`, jamais d'un autre plugin).
- [ ] Toute contribution visuelle passe par `ctx.resolver.addLayer`/`updateLayer`/`removeLayer` — jamais de mutation directe.
- [ ] `dispose` libère tout ce qu'`init`/`start` a alloué (listeners, slots UI, couches).
- [ ] Toute interaction avec un autre plugin passe par une **capacité déclarée** (`providesCapabilities`/`requiredCapabilities`/`optionalCapabilities`) ou `orderAfter` — jamais par un import direct.
- [ ] Erreurs interceptées localement (le plugin ne fait jamais planter le moteur, L24).
- [ ] Testé isolément avec un `PluginContext` factice, y compris le cycle de vie complet sans fuite.

## Références

[Chapitre 10 — Plugins](./10-plugins.md) · [ADR-006 — Système de plugins](./adr/ADR-006-plugin-system.md) · [CONTRIBUTING §4](../CONTRIBUTING.md#4-créer-un-plugin) · [`packages/plugin-sdk/src/index.ts`](../packages/plugin-sdk/src/index.ts) · [`packages/plugins/guided-tour/`](../packages/plugins/guided-tour/) · [`packages/plugins/measure/`](../packages/plugins/measure/).
