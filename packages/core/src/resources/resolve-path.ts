// Package-relative path resolution (roadmap P2-T1). DOM-free: the WHATWG `URL`
// type is not available in the headless Core (no DOM lib), so this resolves paths
// with plain string logic. It is intentionally minimal — join a package base URL
// with a relative path and normalise `.`/`..` segments — and does NOT implement a
// network security policy (that is a later concern).

/** True when `path` already carries a scheme (`https:`, `data:`) or is protocol-relative (`//`). */
export function isAbsolutePath(path: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//');
}

/** Collapse `.` and `..` segments in a `/`-separated path body. */
function normalizeSegments(path: string): string {
  const trailingSlash = path.endsWith('/');
  const out: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else out.push('..');
    } else {
      out.push(segment);
    }
  }
  return out.join('/') + (trailingSlash && out.length > 0 ? '/' : '');
}

/**
 * Resolve `path` against `baseUrl` (the package root, treated as a directory).
 * Absolute paths are returned unchanged. The result is a canonical cache key.
 */
export function resolveResourcePath(baseUrl: string | undefined, path: string): string {
  if (isAbsolutePath(path)) return path;

  const base = baseUrl ?? '';
  // Split an absolute base into "<scheme>://<authority>" prefix and its path body.
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/]*)(\/.*)?$/i.exec(base);
  const prefix = match ? (match[1] ?? '') : '';
  const basePath = match ? (match[2] ?? '/') : base;

  let body: string;
  if (path.startsWith('/')) {
    // Root-relative: replace the base path body entirely.
    body = path;
  } else {
    // Directory of the base: everything up to and including the last '/'.
    const dir = basePath.slice(0, basePath.lastIndexOf('/') + 1) || (prefix ? '/' : '');
    body = dir + path;
  }

  const normalized = normalizeSegments(body);
  if (prefix) return prefix + (normalized.startsWith('/') ? normalized : '/' + normalized);
  return normalized;
}
