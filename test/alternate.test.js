import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { markdownAlternate } from '../alternate.js';

const base = 'https://example.com/posts/page.html';
const page = (head, body = '') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('markdownAlternate', () => {
  test('finds an absolute markdown alternate among other links', () => {
    const html = page(`
      <link rel="alternate" type="application/rss+xml" href="https://example.com/feed.xml" />
      <link rel="alternate" type="text/markdown" href="https://example.com/posts/page.md">`);
    assert.equal(markdownAlternate(html, base), 'https://example.com/posts/page.md');
  });

  test('resolves a relative href against the page', () => {
    assert.equal(markdownAlternate(page('<link rel=alternate type=text/markdown href=page.md>'), base), 'https://example.com/posts/page.md');
  });

  test('accepts any attribute order, case, quoting, type parameters and rel lists', () => {
    const html = page(`<LINK
      HREF='/a.md?x=1&amp;y=2' TYPE="Text/Markdown; charset=utf-8" rel="nofollow Alternate">`);
    assert.equal(markdownAlternate(html, base), 'https://example.com/a.md?x=1&y=2');
  });

  test('accepts text/x-markdown', () => {
    assert.equal(markdownAlternate(page('<link rel="alternate" type="text/x-markdown" href="/a.md">'), base), 'https://example.com/a.md');
  });

  test('ignores links that are not markdown alternates', () => {
    const html = page(`
      <link rel="stylesheet" type="text/markdown" href="/style.md">
      <link rel="alternate" type="text/plain" href="/a.txt">
      <link rel="alternate" href="/a.md">
      <link rel="alternate" type="text/markdown">
      <link rel="alternate" type="text/markdown" href="javascript:alert(1)">`);
    assert.equal(markdownAlternate(html, base), null);
  });

  test('ignores links in the body', () => {
    assert.equal(markdownAlternate(page('', '<link rel="alternate" type="text/markdown" href="/a.md">'), base), null);
  });
});
