import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseRss } from '../feed.js';

const rss = (items, { ns = 'xmlns:source="https://source.scripting.com/"', version = '2.0' } = {}) => `<?xml version="1.0"?>
<rss version="${version}" ${ns}>
  <channel>
    <title>Andrew Shell&apos;s Weblog</title>
    <link>https://andrewshell.org/</link>
    <description>Strategies for thinking.</description>
    ${items}
  </channel>
</rss>`;

describe('parseRss', () => {
  test('reads the channel and its items in feed order', () => {
    const feed = parseRss(rss(`
      <item><title>Second</title><link>https://example.com/2</link><pubDate>Mon, 16 Nov 2026 14:46:46 GMT</pubDate></item>
      <item><title>First</title><link>https://example.com/1</link></item>`));
    assert.equal(feed.title, "Andrew Shell's Weblog");
    assert.equal(feed.link, 'https://andrewshell.org/');
    assert.equal(feed.description, 'Strategies for thinking.');
    assert.deepEqual(feed.items.map((item) => item.title), ['Second', 'First']);
    assert.equal(feed.items[0].date, 'Mon, 16 Nov 2026 14:46:46 GMT');
  });

  test('a single item is still a list', () => {
    assert.equal(parseRss(rss('<item><title>Only</title></item>')).items.length, 1);
  });

  test('keeps source:markdown, from CDATA, and never the HTML description or content', () => {
    const [item] = parseRss(rss(`<item>
      <link>https://example.com/1</link>
      <description>&lt;p&gt;HTML&lt;/p&gt;</description>
      <content:encoded xmlns:content="http://purl.org/rss/1.0/modules/content/"><![CDATA[<p>HTML</p>]]></content:encoded>
      <source:markdown><![CDATA[Some **Markdown** & a [link](/x).]]></source:markdown>
    </item>`)).items;
    assert.deepEqual(item, { title: undefined, link: 'https://example.com/1', date: undefined, markdown: 'Some **Markdown** & a [link](/x).' });
  });

  test('finds source:markdown under any prefix bound to the source namespace', () => {
    const feed = parseRss(rss('<item><s:markdown>Hi</s:markdown></item>', { ns: 'xmlns:s="http://source.scripting.com/"' }));
    assert.equal(feed.items[0].markdown, 'Hi');
  });

  test('ignores a markdown element outside the source namespace', () => {
    const feed = parseRss(rss('<item><source:markdown>Hi</source:markdown></item>', { ns: 'xmlns:source="https://example.com/other"' }));
    assert.equal(feed.items[0].markdown, undefined);
  });

  test('falls back to a permalink guid for the link', () => {
    const [permalink, notPermalink] = parseRss(rss(`
      <item><guid>https://example.com/a</guid></item>
      <item><guid isPermaLink="false">https://example.com/b</guid></item>`)).items;
    assert.equal(permalink.link, 'https://example.com/a');
    assert.equal(notPermalink.link, undefined);
  });

  test('a feed with no items has an empty list', () => {
    assert.deepEqual(parseRss(rss('')).items, []);
  });

  const invalid = {
    'malformed XML': rss('<item><title>Open</item>'),
    'RSS 0.91': rss('', { version: '0.91' }),
    'an Atom feed': '<feed xmlns="http://www.w3.org/2005/Atom"><title>T</title></feed>',
    'RSS without a channel': '<rss version="2.0"></rss>',
    'other XML': '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>',
    'not XML': '# Markdown',
  };
  for (const [name, xml] of Object.entries(invalid)) {
    test(`rejects ${name}`, () => assert.equal(parseRss(xml), null));
  }
});
