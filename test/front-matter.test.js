import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { fillPlaceholders, frontMatterFeeds, isReadableFeedType, splitFrontMatter } from '../public/front-matter.js';

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

const meta = (yaml) => splitFrontMatter(`---\n${yaml}\n---\n`).meta;

describe('lists in front matter', () => {
  test('reads a list of maps as numbered dotted keys', () => {
    assert.deepEqual(meta(`title: Home
feeds:
  - url: /feed/
    title: "Andrew Shell's Weblog"
  - url: /comments/feed/
    type: application/rss+xml
updated: 2026-11-21`), {
      title: 'Home',
      'feeds.0.url': '/feed/',
      'feeds.0.title': "Andrew Shell's Weblog",
      'feeds.1.url': '/comments/feed/',
      'feeds.1.type': 'application/rss+xml',
      updated: '2026-11-21',
    });
  });

  test('reads a list written at its key\'s own indent', () => {
    assert.deepEqual(meta(`feeds:
- url: /a/
  title: A
- url: /b/
next: /n.md`), { 'feeds.0.url': '/a/', 'feeds.0.title': 'A', 'feeds.1.url': '/b/', next: '/n.md' });
  });

  test('reads a list of plain values, including URLs', () => {
    assert.deepEqual(meta(`feeds:
  - https://example.com/feed/
  - /other.xml`), { 'feeds.0': 'https://example.com/feed/', 'feeds.1': '/other.xml' });
  });

  test('fills a placeholder from a list entry', () => {
    const { meta: fields, body } = splitFrontMatter('---\nfeeds:\n  - title: Posts\n---\n{{ page.feeds.0.title }}');
    assert.equal(fillPlaceholders(body, fields), 'Posts');
  });
});

describe('frontMatterFeeds', () => {
  test('lists feeds in order with their titles and types', () => {
    assert.deepEqual(frontMatterFeeds(meta(`feeds:
  - url: /feed/
    title: Posts
  - url: /comments/feed/
    type: application/rss+xml
  - https://example.com/podcast.xml`)), [
      { url: '/feed/', title: 'Posts', type: undefined },
      { url: '/comments/feed/', title: undefined, type: 'application/rss+xml' },
      { url: 'https://example.com/podcast.xml', title: undefined, type: undefined },
    ]);
  });

  test('skips an entry without a url and keeps the rest', () => {
    assert.deepEqual(frontMatterFeeds(meta('feeds:\n  - title: Missing\n  - url: /feed/')), [
      { url: '/feed/', title: undefined, type: undefined },
    ]);
  });

  test('no feeds field means no feeds', () => {
    assert.deepEqual(frontMatterFeeds(meta('title: Home')), []);
  });
});

describe('isReadableFeedType', () => {
  const readable = [undefined, 'application/rss+xml', 'Application/RSS+XML; charset=utf-8', 'text/xml', 'application/xml'];
  const unreadable = ['application/atom+xml', 'application/feed+json', 'application/json', 'text/html'];
  for (const type of readable) test(`${type} can be shown`, () => assert.equal(isReadableFeedType(type), true));
  for (const type of unreadable) test(`${type} is left out`, () => assert.equal(isReadableFeedType(type), false));
});
