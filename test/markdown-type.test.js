import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isMarkdownType } from '../markdown-type.js';

describe('isMarkdownType', () => {
  const markdown = [
    ['text/markdown', 'https://example.com/scripting.jsonl'],
    ['text/x-markdown', 'https://example.com/'],
    ['', 'https://example.com/notes'],
    ['text/plain', 'https://example.com/README.md'],
    ['text/plain', 'https://example.com/docs/Guide.MARKDOWN'],
    ['text/plain', 'https://example.com/llms.txt'],
    ['text/plain', 'https://example.com/llms-full.txt'],
    ['text/plain', 'https://example.com/a.md?raw=1#intro'],
  ];
  const notMarkdown = [
    ['text/plain', 'https://jsonldemo.feedland.org/scripting.jsonl'],
    ['text/plain', 'https://example.com/robots.txt'],
    ['text/plain', 'https://example.com/'],
    ['text/plain', 'https://example.com/notllms.txt'],
    ['text/plain', 'https://example.com/md'],
    ['text/plain', 'https://example.com/page?file=a.md'],
    ['text/html', 'https://example.com/page.md'],
    ['application/json', 'https://example.com/data.md'],
  ];

  for (const [contentType, url] of markdown) {
    test(`${contentType || 'no type'} at ${url} is Markdown`, () => assert.equal(isMarkdownType(contentType, url), true));
  }
  for (const [contentType, url] of notMarkdown) {
    test(`${contentType} at ${url} is not Markdown`, () => assert.equal(isMarkdownType(contentType, url), false));
  }
});
