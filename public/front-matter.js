const FRONT_MATTER = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const FIELD = /^( *)([A-Za-z_][\w-]*):\s*(.*?)\s*$/;

// Reads `key: value` lines, and nested maps by indentation, into a flat object
// whose nested keys are dotted paths (`source.url`), so every value is a
// string. Lists and other YAML are skipped, since the fields used here are all
// plain strings.
export function splitFrontMatter(markdown) {
  const match = markdown.match(FRONT_MATTER);
  if (!match) return { meta: {}, body: markdown };
  const meta = {};
  const parents = [{ indent: -1, path: '' }];
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(FIELD);
    if (!field) continue;
    const [, spaces, key, value] = field;
    while (parents.at(-1).indent >= spaces.length) parents.pop();
    const path = parents.at(-1).path + key;
    if (value) meta[path] = value.replace(/^(['"])(.*)\1$/, '$2');
    else parents.push({ indent: spaces.length, path: `${path}.` });
  }
  return { meta, body: markdown.slice(match[0].length) };
}

const PLACEHOLDER = /\{\{\s*page\.([A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*)\s*\}\}/g;

// Fills Jekyll-style `{{ page.key }}` placeholders with front matter values.
// One whose key is missing is left as written.
export function fillPlaceholders(body, meta) {
  return body.replace(PLACEHOLDER, (placeholder, key) => (Object.hasOwn(meta, key) ? meta[key] : placeholder));
}
