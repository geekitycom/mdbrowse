const MARKDOWN_ALTERNATE_TYPES = new Set(['text/markdown', 'text/x-markdown']);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(value) {
  return value.replace(/&(?:#x([\da-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi, (match, hex, dec, name) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(Number(dec)) : ENTITIES[name.toLowerCase()],
  );
}

function attributes(tag) {
  const attrs = {};
  for (const [, name, double, single, bare] of tag.matchAll(/([^\s"'=<>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs[name.toLowerCase()] ??= decodeEntities(double ?? single ?? bare ?? '');
  }
  return attrs;
}

// The Markdown version an HTML page points to in its head with
// <link rel="alternate" type="text/markdown" href="...">, resolved against
// `baseUrl`, or null when it has none.
export function markdownAlternate(html, baseUrl) {
  const head = html.split(/<\/head\s*>|<body[\s>]/i)[0];
  for (const [, tag] of head.matchAll(/<link\b([^>]*)>/gi)) {
    const { rel = '', type = '', href } = attributes(tag);
    if (!href || !rel.toLowerCase().split(/\s+/).includes('alternate')) continue;
    if (!MARKDOWN_ALTERNATE_TYPES.has(type.split(';')[0].trim().toLowerCase())) continue;
    try {
      const url = new URL(href, baseUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch {}
  }
  return null;
}
