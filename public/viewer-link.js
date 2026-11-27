// Markdown viewers that take the document to show in a `url` query parameter.
const VIEWER_HOSTS = new Set(['demo.bonbonweb.org']);

// The document a link to another Markdown viewer shows, so mdbrowse can open
// it itself, or the link unchanged.
export function unwrapViewerLink(target) {
  if (!VIEWER_HOSTS.has(target.hostname) || target.pathname !== '/') return target;
  try {
    const inner = new URL(target.searchParams.get('url'));
    return inner.protocol === 'http:' || inner.protocol === 'https:' ? inner : target;
  } catch {
    return target;
  }
}
