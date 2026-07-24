import { describe, it, expect } from 'vitest';
import { cssVarName, themeTokensToCssText } from './theme-css-vars';

describe('cssVarName', () => {
  it('prefixes a token key with --ee-', () => {
    expect(cssVarName('colorAccent')).toBe('--ee-colorAccent');
  });
});

describe('themeTokensToCssText', () => {
  it('builds one custom-property declaration per token', () => {
    const css = themeTokensToCssText({ colorAccent: '#c9a227', radiusMd: '2px' });
    expect(css).toBe('--ee-colorAccent:#c9a227;--ee-radiusMd:2px;');
  });

  it('returns an empty string for no tokens', () => {
    expect(themeTokensToCssText({})).toBe('');
  });
});
