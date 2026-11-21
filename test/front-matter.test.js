import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fillPlaceholders, splitFrontMatter } from '../public/front-matter.js';

const render = (markdown) => {
  const { meta, body } = splitFrontMatter(markdown);
  return fillPlaceholders(body, meta);
};

const DOC = `---
title: "That About Wraps It Up"
author: 'Brent Simmons'
pubDate: Tue, 22 Sep 2026 18:35:22 GMT
source:
  url: "https://inessential.com/xml/rss.xml"
  title: "inessential"
tags:
  - mac
urlPrev: "../../08/26/after-fixin-the-bugs.md"
---
`;

describe('splitFrontMatter', () => {
  test('reads top-level fields and unquotes them', () => {
    const { meta } = splitFrontMatter(DOC);
    assert.equal(meta.title, 'That About Wraps It Up');
    assert.equal(meta.author, 'Brent Simmons');
    assert.equal(meta.pubDate, 'Tue, 22 Sep 2026 18:35:22 GMT');
    assert.equal(meta.urlPrev, '../../08/26/after-fixin-the-bugs.md');
  });

  test('reads nested maps as dotted keys and returns to the top level after them', () => {
    const { meta } = splitFrontMatter(DOC);
    assert.equal(meta['source.url'], 'https://inessential.com/xml/rss.xml');
    assert.equal(meta['source.title'], 'inessential');
    assert.equal(meta.source, undefined);
    assert.equal(meta.urlPrev, '../../08/26/after-fixin-the-bugs.md');
  });

  test('every value is a string', () => {
    const { meta } = splitFrontMatter(DOC);
    for (const value of Object.values(meta)) assert.equal(typeof value, 'string');
  });

  test('a document without front matter is returned whole', () => {
    assert.deepEqual(splitFrontMatter('# Hi\n'), { meta: {}, body: '# Hi\n' });
  });
});

describe('fillPlaceholders', () => {
  test('fills placeholders with and without spaces', () => {
    assert.equal(
      render(`${DOC}# {{page.title}}\n\nBy {{ page.author }} on {{  page.pubDate}}.\n`),
      '# That About Wraps It Up\n\nBy Brent Simmons on Tue, 22 Sep 2026 18:35:22 GMT.\n',
    );
  });

  test('fills a dotted path from a nested map', () => {
    assert.equal(render(`${DOC}From [{{page.source.title}}]({{page.source.url}})`), 'From [inessential](https://inessential.com/xml/rss.xml)');
  });

  test('leaves a missing key, a map, and non-page variables as written', () => {
    const text = '{{page.missing}} {{ page.source }} {{site.title}} {{page.title.extra}}';
    assert.equal(render(`${DOC}${text}`), text);
  });

  test('leaves placeholders alone in a document without front matter', () => {
    assert.equal(render('# {{page.title}}'), '# {{page.title}}');
  });
});
