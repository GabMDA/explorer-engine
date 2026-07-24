import { describe, it, expect } from 'vitest';
import { isSafeUrl } from './safe-url';

describe('isSafeUrl', () => {
  it('accepts relative paths, http(s), and data:image', () => {
    expect(isSafeUrl('images/gpu.png')).toBe(true);
    expect(isSafeUrl('https://cdn.example.com/gpu.png')).toBe(true);
    expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('rejects javascript:, vbscript:, and data:text/html', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('  javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('VBScript:msgbox(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });
});
