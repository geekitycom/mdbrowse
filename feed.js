import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const FEED_TYPES = new Set(['application/rss+xml', 'text/xml', 'application/xml']);

// The namespace of <source:markdown>, which carries an item's Markdown.
// https://source.scripting.com
const SOURCE_NAMESPACE = /^https?:\/\/source\.scripting\.com\/?$/;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,
  isArray: (_name, path) => path === 'rss.channel.item',
});

// An element's text, whether it has attributes or appears more than once.
function text(value) {
  if (Array.isArray(value)) return text(value[0]);
  if (value && typeof value === 'object') value = value['#text'];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function itemLink(item) {
  const link = text(item.link);
  if (link) return link;
  const guid = Array.isArray(item.guid) ? item.guid[0] : item.guid;
  if (guid?.['@isPermaLink'] === 'false') return undefined;
  return text(guid)?.match(/^https?:\/\//) ? text(guid) : undefined;
}

// Reads an RSS 2.0 feed: the channel's title, link and description, and its
// items in feed order. An item keeps its title and link, its date, and its
// Markdown if the feed has source:markdown, never its HTML description.
// Returns null for anything that is not well-formed RSS 2.0.
export function parseRss(xml) {
  if (XMLValidator.validate(xml) !== true) return null;
  const { rss } = parser.parse(xml);
  if (rss?.['@version'] !== '2.0' || !rss.channel || typeof rss.channel !== 'object') return null;

  const prefix = Object.entries(rss)
    .find(([name, uri]) => name.startsWith('@xmlns:') && SOURCE_NAMESPACE.test(uri))?.[0]
    .slice('@xmlns:'.length);
  const channel = Array.isArray(rss.channel) ? rss.channel[0] : rss.channel;
  return {
    title: text(channel.title),
    link: text(channel.link),
    description: text(channel.description),
    items: (channel.item ?? []).filter((item) => item && typeof item === 'object').map((item) => ({
      title: text(item.title),
      link: itemLink(item),
      date: text(item.pubDate),
      markdown: prefix ? text(item[`${prefix}:markdown`]) : undefined,
    })),
  };
}
