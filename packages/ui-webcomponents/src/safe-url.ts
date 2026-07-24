// Defense-in-depth URL guard for package-provided `src`/`href` values (ch.12
// §12.3.2, L26 "no arbitrary code from a package"). `<img src>`/`<video src>`
// never execute `javascript:` URIs natively, but this still rejects the schemes
// that CAN carry executable/markup content, so a hostile package.json can't rely
// on a future markup change (e.g. an `<a>` wrapper) reintroducing the risk.
const UNSAFE_SCHEME_RE = /^\s*(javascript|vbscript):/i;
const UNSAFE_DATA_RE = /^\s*data:text\/html/i;

/** `true` iff `url` is safe to assign to a `src`/`href`/`poster` attribute. */
export function isSafeUrl(url: string): boolean {
  return !UNSAFE_SCHEME_RE.test(url) && !UNSAFE_DATA_RE.test(url);
}
