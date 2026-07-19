import { describe, it, expect } from 'vitest';
import { resolveResourcePath, isAbsolutePath } from './resolve-path';

describe('isAbsolutePath', () => {
  it('detects schemes and protocol-relative URLs', () => {
    expect(isAbsolutePath('https://cdn.example.com/a.bin')).toBe(true);
    expect(isAbsolutePath('data:text/plain;base64,AAAA')).toBe(true);
    expect(isAbsolutePath('//cdn.example.com/a.bin')).toBe(true);
    expect(isAbsolutePath('models/car.bin')).toBe(false);
    expect(isAbsolutePath('./a.bin')).toBe(false);
    expect(isAbsolutePath('/a.bin')).toBe(false);
  });
});

describe('resolveResourcePath', () => {
  it('resolves a relative path against a package base URL', () => {
    expect(resolveResourcePath('https://cdn.example.com/pkg/', 'models/car.bin')).toBe(
      'https://cdn.example.com/pkg/models/car.bin',
    );
  });

  it('treats the base as a directory when it does not end with a slash', () => {
    expect(resolveResourcePath('https://cdn.example.com/pkg/config.json', 'a.bin')).toBe(
      'https://cdn.example.com/pkg/a.bin',
    );
  });

  it('keeps an absolute URL unchanged (base ignored)', () => {
    expect(resolveResourcePath('https://cdn.example.com/pkg/', 'https://other.com/x.bin')).toBe(
      'https://other.com/x.bin',
    );
  });

  it('normalises . and .. segments', () => {
    expect(resolveResourcePath('https://cdn.example.com/pkg/models/', '../textures/t.ktx2')).toBe(
      'https://cdn.example.com/pkg/textures/t.ktx2',
    );
    expect(resolveResourcePath('https://cdn.example.com/pkg/', './a/./b.bin')).toBe(
      'https://cdn.example.com/pkg/a/b.bin',
    );
  });

  it('resolves a root-relative path against the base authority', () => {
    expect(resolveResourcePath('https://cdn.example.com/pkg/models/', '/root.bin')).toBe(
      'https://cdn.example.com/root.bin',
    );
  });

  it('works without a base URL (relative path normalised as-is)', () => {
    expect(resolveResourcePath(undefined, './models/car.bin')).toBe('models/car.bin');
  });

  it('produces a stable, canonical key for equivalent inputs', () => {
    const a = resolveResourcePath('https://cdn.example.com/pkg/', 'models/car.bin');
    const b = resolveResourcePath('https://cdn.example.com/pkg/models/', '../models/car.bin');
    expect(a).toBe(b);
  });
});
