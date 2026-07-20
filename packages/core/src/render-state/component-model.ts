// Component model (chapter 05 §5.3.7, chapter 06) — the headless, data-only
// bridge from the config's logical entities to node identities. It answers the
// two questions the interaction stack needs, WITHOUT any Three.js:
//   1. expand(address) → which node identities does a component/group/node cover?
//   2. resolvePick(identity) → which component does a click on this node select?
//
// A "node identity" is the string the renderer's node index resolves: the
// `explorerId` (preferred, ADR-003 / L12) or the node `name` (fragile fallback).
// The adapter maps identity → Object3D; the core never sees the object (L8/L9).
import type { Address, ComponentConfig, NodeRef, ResolvedConfig } from '@explorer-engine/schema';

/** The identity string a {@link NodeRef} resolves to (explorerId or name). */
export function nodeRefIdentity(ref: NodeRef): string {
  return 'explorerId' in ref ? ref.explorerId : ref.name;
}

export interface ComponentModel {
  /** Node identities covered by a typed address. Empty for unknown ids. */
  expand(address: Address): readonly string[];
  /** The component that owns a node identity, or undefined. */
  componentOfNode(identity: string): string | undefined;
  /**
   * The component a click on `identity` selects: the owning component's
   * `pickTarget` (granularity), or undefined when the node maps to nothing / is
   * not selectable.
   */
  resolvePick(identity: string): string | undefined;
  /** The component config by id, or undefined. */
  component(id: string): ComponentConfig | undefined;
  /** Component ids belonging to a group. */
  groupMembers(groupId: string): readonly string[];
  /** All component ids, in declaration order. */
  componentIds(): readonly string[];
}

const EMPTY: readonly string[] = Object.freeze([]);

export function createComponentModel(config: ResolvedConfig): ComponentModel {
  const byId = new Map<string, ComponentConfig>();
  const identitiesOf = new Map<string, readonly string[]>();
  const ownerOfIdentity = new Map<string, string>();
  const groupToComponents = new Map<string, string[]>();

  for (const component of config.components) {
    byId.set(component.id, component);
    const identities = component.nodes.map(nodeRefIdentity);
    identitiesOf.set(component.id, identities);
    for (const identity of identities) {
      // First declaration wins ownership (deterministic on cross-component homonyms).
      if (!ownerOfIdentity.has(identity)) ownerOfIdentity.set(identity, component.id);
    }
    if (component.group !== null && component.group.length > 0) {
      const list = groupToComponents.get(component.group);
      if (list) list.push(component.id);
      else groupToComponents.set(component.group, [component.id]);
    }
  }

  const expand = (address: Address): readonly string[] => {
    switch (address.kind) {
      case 'node':
        return [address.id];
      case 'component':
        return identitiesOf.get(address.id) ?? EMPTY;
      case 'group': {
        const members = groupToComponents.get(address.id);
        if (!members) return EMPTY;
        const out: string[] = [];
        for (const cid of members) out.push(...(identitiesOf.get(cid) ?? EMPTY));
        return out;
      }
    }
  };

  return {
    expand,
    componentOfNode: (identity) => ownerOfIdentity.get(identity),
    resolvePick: (identity) => {
      const owner = ownerOfIdentity.get(identity);
      if (owner === undefined) return undefined;
      const component = byId.get(owner);
      if (component === undefined || !component.selectable) return undefined;
      return component.pickTarget;
    },
    component: (id) => byId.get(id),
    groupMembers: (groupId) => groupToComponents.get(groupId) ?? EMPTY,
    componentIds: () => config.components.map((c) => c.id),
  };
}
