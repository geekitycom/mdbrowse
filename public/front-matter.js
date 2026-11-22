const FRONT_MATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const FIELD = /^([A-Za-z_][\w-]*):(?:\s+(.*?))?\s*$/;
const ITEM = /^(- +|-$)(.*)$/;
const unquote = (value) => value.replace(/^(['"])(.*)\1$/, '$2');

// Reads `key: value` lines, nested maps and lists by indentation into a flat
// object whose keys are dotted paths, so every value is a string: `source.url`
// for a nested map, `feeds.0.url` for the first entry of a list. Other YAML is
// skipped, since the fields used here are all plain strings.
export function splitFrontMatter(markdown) {
  const match = markdown.match(FRONT_MATTER);
  if (!match) return { meta: {}, body: markdown };
  const meta = {};
  // Open maps and list entries, innermost last. `indent` is the column of a
  // map's key or of a list entry's dash.
  const parents = [{ indent: -1, path: '', entries: 0 }];
  const readField = (text, indent) => {
    const field = text.match(FIELD);
    if (!field) return;
    while (parents.at(-1).indent >= indent) parents.pop();
    const path = parents.at(-1).path + field[1];
    if (field[2]) meta[path] = unquote(field[2]);
    else parents.push({ indent, path: `${path}.`, entries: 0 });
  };
  for (const line of match[1].split(/\r?\n/)) {
    const indent = line.length - line.trimStart().length;
    const text = line.trim();
    const item = text.match(ITEM);
    if (!item) {
      readField(text, indent);
      continue;
    }
    // A list may sit at its key's own indent, so only list entries at this
    // column close here.
    while (parents.at(-1).indent > indent || (parents.at(-1).indent === indent && parents.at(-1).isEntry)) parents.pop();
    const list = parents.at(-1);
    if (list.indent < 0) continue;
    const path = `${list.path}${list.entries++}`;
    parents.push({ indent, path: `${path}.`, entries: 0, isEntry: true });
    if (item[2].match(FIELD)) readField(item[2], indent + item[1].length);
    else if (item[2]) meta[path] = unquote(item[2]);
  }
  return { meta, body: markdown.slice(match[0].length) };
}

// The feeds a document lists in its `feeds` front matter, in order. Each is a
// map with a `url` and an optional `title` and `type`; a bare URL is accepted
// as an entry too.
export function frontMatterFeeds(meta) {
  const feeds = [];
  for (let i = 0; ; i++) {
    const url = meta[`feeds.${i}.url`] ?? meta[`feeds.${i}`];
    const isEntry = url !== undefined || Object.keys(meta).some((key) => key.startsWith(`feeds.${i}.`));
    if (!isEntry) return feeds;
    if (url) feeds.push({ url, title: meta[`feeds.${i}.title`], type: meta[`feeds.${i}.type`] });
  }
}

// The types mdbrowse can show a feed of: RSS, and the generic XML types RSS
// is often served as.
const READABLE_FEED_TYPES = new Set(['application/rss+xml', 'text/xml', 'application/xml']);

// Whether mdbrowse can show a feed of this type. A feed with no type may
// well be RSS, so it counts.
export function isReadableFeedType(type) {
  return !type || READABLE_FEED_TYPES.has(type.split(';')[0].trim().toLowerCase());
}

const PLACEHOLDER = /\{\{\s*page\.([A-Za-z_][\w-]*(?:\.[\w-]+)*)\s*\}\}/g;

// Fills Jekyll-style `{{ page.key }}` placeholders with front matter values.
// One whose key is missing is left as written.
export function fillPlaceholders(body, meta) {
  return body.replace(PLACEHOLDER, (placeholder, key) => (Object.hasOwn(meta, key) ? meta[key] : placeholder));
}
