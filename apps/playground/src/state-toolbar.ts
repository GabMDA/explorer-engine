// State toolbar (playground / UI adapter side, chapter 09 §9.8). Bases are a
// mutually-exclusive `radiogroup`; modifiers are `switch`es (X-ray, cutaway). It
// only renders + reports intent — the headless State Manager owns all logic. DOM
// is confined here (the reusable UI Manager package is P7; this is the Sprint 4
// demonstration). Accessibility: proper ARIA roles + aria-checked, keyboard-usable
// native buttons.

export interface StateToolbarOptions {
  readonly container: HTMLElement;
  readonly bases: readonly { readonly id: string; readonly label: string }[];
  readonly modifiers: readonly { readonly id: string; readonly label: string }[];
  readonly onBase: (id: string) => void;
  readonly onModifier: (id: string) => void;
  readonly onReset: () => void;
}

export interface StateToolbar {
  update(base: string | null, modifiers: readonly string[]): void;
  dispose(): void;
}

function button(label: string, className: string, role: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  el.setAttribute('role', role);
  el.setAttribute('aria-checked', 'false');
  return el;
}

export function createStateToolbar(options: StateToolbarOptions): StateToolbar {
  const root = document.createElement('nav');
  root.className = 'ee-toolbar';
  root.setAttribute('aria-label', 'View states');

  const baseGroup = document.createElement('div');
  baseGroup.className = 'ee-toolbar-group';
  baseGroup.setAttribute('role', 'radiogroup');
  baseGroup.setAttribute('aria-label', 'Base state');

  const modGroup = document.createElement('div');
  modGroup.className = 'ee-toolbar-group';
  modGroup.setAttribute('aria-label', 'Modifiers');

  const baseButtons = new Map<string, HTMLButtonElement>();
  const modButtons = new Map<string, HTMLButtonElement>();
  const cleanups: (() => void)[] = [];

  for (const { id, label } of options.bases) {
    const el = button(label, 'ee-toolbar-item', 'radio');
    const on = () => options.onBase(id);
    el.addEventListener('click', on);
    cleanups.push(() => el.removeEventListener('click', on));
    baseGroup.appendChild(el);
    baseButtons.set(id, el);
  }
  for (const { id, label } of options.modifiers) {
    const el = button(label, 'ee-toolbar-item', 'switch');
    const on = () => options.onModifier(id);
    el.addEventListener('click', on);
    cleanups.push(() => el.removeEventListener('click', on));
    modGroup.appendChild(el);
    modButtons.set(id, el);
  }

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'ee-toolbar-item ee-toolbar-reset';
  reset.textContent = 'Reset';
  const onReset = () => options.onReset();
  reset.addEventListener('click', onReset);
  cleanups.push(() => reset.removeEventListener('click', onReset));

  if (options.bases.length > 0) root.appendChild(baseGroup);
  if (options.modifiers.length > 0) root.appendChild(modGroup);
  root.appendChild(reset);
  options.container.appendChild(root);

  return {
    update(base, modifiers) {
      const active = new Set(modifiers);
      for (const [id, el] of baseButtons) {
        const on = id === base;
        el.setAttribute('aria-checked', on ? 'true' : 'false');
        el.dataset['active'] = on ? 'true' : 'false';
      }
      for (const [id, el] of modButtons) {
        const on = active.has(id);
        el.setAttribute('aria-checked', on ? 'true' : 'false');
        el.dataset['active'] = on ? 'true' : 'false';
      }
    },
    dispose() {
      for (const c of cleanups) c();
      baseButtons.clear();
      modButtons.clear();
      root.remove();
    },
  };
}
