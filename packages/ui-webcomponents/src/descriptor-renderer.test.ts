import { describe, it, expect } from 'vitest';
import { isSafeTag, isSafeAttr } from './descriptor-renderer';

describe('isSafeTag', () => {
  it('allows a small structural allowlist', () => {
    expect(isSafeTag('div')).toBe(true);
    expect(isSafeTag('button')).toBe(true);
    expect(isSafeTag('img')).toBe(true);
  });

  it('rejects scriptable/embedding tags', () => {
    expect(isSafeTag('script')).toBe(false);
    expect(isSafeTag('iframe')).toBe(false);
    expect(isSafeTag('style')).toBe(false);
    expect(isSafeTag('object')).toBe(false);
  });
});

describe('isSafeAttr', () => {
  it('allows structural attributes', () => {
    expect(isSafeAttr('class')).toBe(true);
    expect(isSafeAttr('href')).toBe(true);
    expect(isSafeAttr('aria-label')).toBe(true);
  });

  it('rejects event handler and arbitrary attributes', () => {
    expect(isSafeAttr('onclick')).toBe(false);
    expect(isSafeAttr('onerror')).toBe(false);
    expect(isSafeAttr('style')).toBe(false);
  });
});
