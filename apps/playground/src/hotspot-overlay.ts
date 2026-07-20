// Hotspot overlay (playground / UI adapter side, chapter 07 §7.1/§7.9). The core
// Hotspot Manager owns ALL logic (anchoring, occlusion decision, lifecycle); this
// module only RENDERS markers from the data-only snapshot and provides the required
// accessible equivalents: keyboard-focusable markers with ARIA, and a navigable
// alternative list. It never touches Three.js or the 3D scene. DOM is confined here
// (the reusable UI Manager package is P7; this is the Sprint 2 demonstration).
import type { HotspotView } from '@explorer-engine/core';

export interface HotspotOverlayOptions {
  /** Where to mount the marker layer and the alternative list. */
  readonly container: HTMLElement;
  /** Static hotspot identities/labels used to build the DOM once. */
  readonly hotspots: readonly { readonly id: string; readonly label: string }[];
  readonly onActivate: (id: string) => void;
  readonly onHover: (id: string | null) => void;
}

export interface HotspotOverlay {
  /** Reposition/restyle markers and list entries from the latest snapshot. */
  update(views: readonly HotspotView[]): void;
  dispose(): void;
}

function button(label: string, className: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.setAttribute('aria-label', label);
  return el;
}

export function createHotspotOverlay(options: HotspotOverlayOptions): HotspotOverlay {
  const { container, onActivate, onHover } = options;

  // Marker layer: overlays the canvas, transparent to pointer events except markers.
  const layer = document.createElement('div');
  layer.className = 'ee-hotspot-layer';

  // Accessible alternative list (chapter 07 §7.9) — reachable without touching 3D.
  const nav = document.createElement('nav');
  nav.className = 'ee-hotspot-list';
  nav.setAttribute('aria-label', 'Hotspots');
  const heading = document.createElement('h2');
  heading.textContent = 'Hotspots';
  const list = document.createElement('ul');
  nav.append(heading, list);

  const markers = new Map<string, HTMLButtonElement>();
  const listButtons = new Map<string, HTMLButtonElement>();
  const cleanups: (() => void)[] = [];

  for (const { id, label } of options.hotspots) {
    // 44×44 target, role=button (native), Enter/Space activate natively (chapter 07 §7.9).
    const marker = button(label, 'ee-hotspot');
    marker.textContent = '●';
    const onEnter = () => onHover(id);
    const onLeave = () => onHover(null);
    const onClick = () => onActivate(id);
    marker.addEventListener('pointerenter', onEnter);
    marker.addEventListener('pointerleave', onLeave);
    marker.addEventListener('focus', onEnter);
    marker.addEventListener('blur', onLeave);
    marker.addEventListener('click', onClick);
    layer.appendChild(marker);
    markers.set(id, marker);

    const li = document.createElement('li');
    const listBtn = button(label, 'ee-hotspot-listitem');
    listBtn.textContent = label;
    listBtn.addEventListener('click', onClick);
    listBtn.addEventListener('focus', onEnter);
    listBtn.addEventListener('blur', onLeave);
    li.appendChild(listBtn);
    list.appendChild(li);
    listButtons.set(id, listBtn);

    cleanups.push(() => {
      marker.removeEventListener('pointerenter', onEnter);
      marker.removeEventListener('pointerleave', onLeave);
      marker.removeEventListener('focus', onEnter);
      marker.removeEventListener('blur', onLeave);
      marker.removeEventListener('click', onClick);
      listBtn.removeEventListener('click', onClick);
      listBtn.removeEventListener('focus', onEnter);
      listBtn.removeEventListener('blur', onLeave);
    });
  }

  container.append(layer, nav);

  return {
    update(views) {
      for (const view of views) {
        const marker = markers.get(view.id);
        if (marker) {
          marker.style.display = view.visible ? 'block' : 'none';
          if (view.visible) {
            marker.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) translate(-50%, -50%)`;
            marker.style.zIndex = String(Math.max(0, 100000 - Math.round(view.depth * 100)));
          }
          marker.dataset['state'] = view.state;
          marker.setAttribute('aria-pressed', view.state === 'active' ? 'true' : 'false');
        }
        const listBtn = listButtons.get(view.id);
        if (listBtn) {
          listBtn.dataset['state'] = view.state;
          listBtn.setAttribute('aria-pressed', view.state === 'active' ? 'true' : 'false');
          listBtn.setAttribute('aria-hidden', 'false'); // always reachable
        }
      }
    },
    dispose() {
      for (const c of cleanups) c();
      markers.clear();
      listButtons.clear();
      layer.remove();
      nav.remove();
    },
  };
}
