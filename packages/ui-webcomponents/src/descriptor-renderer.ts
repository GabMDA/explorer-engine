// Generic UiDescriptor → DOM (ch.12 §12.1.1 "descriptors, not JSX" — plugin UI
// content, delivered through registerSlot/renderSlot). An allowlist keeps this
// safe for untrusted plugin data (L26): unknown tags fall back to a plain `<div>`
// with the type recorded as a data attribute, and only a small set of structural
// attributes may be set — no `on*` handlers, no arbitrary attribute injection.
import type { UiDescriptor } from '@explorer-engine/core';
import { isSafeUrl } from './safe-url';

const ALLOWED_TAGS = new Set([
  'div',
  'span',
  'p',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'button',
  'img',
  'a',
  'h1',
  'h2',
  'h3',
]);

const URL_ATTRS = new Set(['src', 'href']);
const ALLOWED_ATTRS = new Set(['class', 'id', 'alt', 'title', 'aria-label', ...URL_ATTRS]);

/** `true` iff `type` may become a real element tag; otherwise it falls back to `div`. */
export function isSafeTag(type: string): boolean {
  return ALLOWED_TAGS.has(type);
}

/** `true` iff `attr` may be set from descriptor `props` (structural, non-executable). */
export function isSafeAttr(attr: string): boolean {
  return ALLOWED_ATTRS.has(attr);
}

/** Renders a `UiDescriptor` tree into real DOM. Never uses `innerHTML`. */
export function renderDescriptor(descriptor: UiDescriptor): HTMLElement {
  const tag = isSafeTag(descriptor.type) ? descriptor.type : 'div';
  const node = document.createElement(tag);
  if (tag !== descriptor.type) node.dataset['type'] = descriptor.type;

  for (const [key, value] of Object.entries(descriptor.props ?? {})) {
    if (key === 'text') {
      node.textContent = String(value);
      continue;
    }
    if (!isSafeAttr(key) || typeof value !== 'string') continue;
    if (URL_ATTRS.has(key) && !isSafeUrl(value)) continue;
    node.setAttribute(key, value);
  }

  for (const child of descriptor.children ?? []) {
    node.appendChild(renderDescriptor(child));
  }

  return node;
}
