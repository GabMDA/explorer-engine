// Panel block → DOM (ch.12 §12.3.2). Package content is untrusted (ch.04 §4.4.4):
// every block uses `textContent` (never `innerHTML`) and URL attributes go through
// `isSafeUrl` — no markup/script from a package is ever parsed as HTML (L26).
import type { PanelBlock } from '@explorer-engine/core';
import { isSafeUrl } from './safe-url';

function el<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  return document.createElement(tag);
}

function setSafeSrc(target: HTMLElement, attr: string, url: string): void {
  if (isSafeUrl(url)) target.setAttribute(attr, url);
}

/** Builds the DOM node for one panel block. `onAction` fires for `action` blocks. */
export function buildBlockElement(
  block: PanelBlock,
  onAction: (actionId: string) => void,
): HTMLElement {
  switch (block.type) {
    case 'text': {
      const p = el('p');
      p.className = 'ee-block-text';
      p.textContent = block.text;
      return p;
    }
    case 'image': {
      const img = el('img');
      img.className = 'ee-block-image';
      img.alt = block.alt;
      img.loading = 'lazy';
      setSafeSrc(img, 'src', block.src);
      return img;
    }
    case 'video': {
      const video = el('video');
      video.className = 'ee-block-video';
      video.controls = true;
      video.preload = 'none';
      setSafeSrc(video, 'src', block.src);
      if (block.poster !== undefined) setSafeSrc(video, 'poster', block.poster);
      return video;
    }
    case 'audio': {
      const audio = el('audio');
      audio.className = 'ee-block-audio';
      audio.controls = true;
      audio.preload = 'none';
      setSafeSrc(audio, 'src', block.src);
      return audio;
    }
    case 'list': {
      const ul = el('ul');
      ul.className = 'ee-block-list';
      for (const item of block.items) {
        const li = el('li');
        li.textContent = item;
        ul.appendChild(li);
      }
      return ul;
    }
    case 'specs': {
      const table = el('table');
      table.className = 'ee-block-specs';
      const body = el('tbody');
      for (const row of block.rows) {
        const tr = el('tr');
        const key = el('th');
        key.scope = 'row';
        key.textContent = row.key;
        const value = el('td');
        value.textContent = row.value;
        tr.append(key, value);
        body.appendChild(tr);
      }
      table.appendChild(body);
      return table;
    }
    case 'divider':
      return el('hr');
    case 'action': {
      const button = el('button');
      button.type = 'button';
      button.className = 'ee-block-action';
      button.textContent = block.label;
      button.addEventListener('click', () => onAction(block.actionId));
      return button;
    }
  }
}
