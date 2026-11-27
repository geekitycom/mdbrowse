import { marked } from '/vendor/marked.js';
import DOMPurify from '/vendor/purify.js';
import { SANITIZE } from '/sanitize.js';
import { unwrapViewerLink } from '/viewer-link.js';
import { fillPlaceholders, frontMatterFeeds, isReadableFeedType, splitFrontMatter } from '/front-matter.js';

marked.setOptions({ gfm: true });

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeName === 'INPUT') {
    if (node.getAttribute('type') !== 'checkbox') return node.remove();
    node.setAttribute('disabled', '');
  }
  // Hosts with hotlink protection refuse images requested with a foreign
  // Referer, and the Referer would tell them which document is being read.
  if (node.nodeName === 'IMG') node.setAttribute('referrerpolicy', 'no-referrer');
  for (const attr of ['id', 'name']) {
    const value = node.getAttribute(attr);
    if (value) node.setAttribute(attr, `user-content-${value}`);
  }
});

const form = document.getElementById('nav');
const address = document.getElementById('address');
const status = document.getElementById('status');
const docNav = document.getElementById('doc-nav');
const content = document.getElementById('content');
const feedsButton = document.getElementById('feeds');
const feedMenu = document.getElementById('feed-menu');

const HOME_SOURCE = new URL('/homepage.md', location.origin).href;

let currentUrl = null;

function slugify(text, seen) {
  const base = text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count ? `${base}-${count}` : base;
}

function scrollToFragment(hash) {
  const key = `user-content-${decodeURIComponent(hash.slice(1))}`;
  const el = document.getElementById(key) ?? document.getElementsByName(key)[0];
  el?.scrollIntoView();
}

const DOC_NAV = [
  ['previous', 'prev', 'Previous'],
  ['home', 'home', 'Home'],
  ['next', 'next', 'Next'],
];

// An absolute http(s) URL for url, or null. Links built from front matter or
// a feed bypass the sanitizer, so only these are linked.
function httpTarget(url, baseUrl) {
  if (!url) return null;
  try {
    const target = new URL(url, baseUrl);
    return target.protocol === 'http:' || target.protocol === 'https:' ? target.href : null;
  } catch {
    return null;
  }
}

// An http(s) link that opens in mdbrowse, like links in a document.
function appLink(text, target) {
  const a = document.createElement('a');
  a.dataset.target = target;
  a.href = `/?url=${encodeURIComponent(target)}`;
  a.textContent = text;
  return a;
}

// Links between documents named in front matter (previous, home, next), shown
// in the status bar.
function renderDocNav(meta, baseUrl) {
  docNav.replaceChildren();
  for (const [field, rel, label] of DOC_NAV) {
    const target = httpTarget(meta[field], baseUrl);
    if (!target) continue;
    if (docNav.childElementCount) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '·';
      docNav.append(sep);
    }
    const a = appLink(label, target);
    a.rel = rel;
    docNav.append(a);
  }
}

// The feeds a document lists in its front matter that mdbrowse can show, in
// the menu opened by the feed button, which is hidden when there are none.
// Atom and JSON feeds are left out, since they would only open an error.
function renderFeedMenu(feeds, baseUrl) {
  const items = [];
  for (const feed of feeds) {
    const target = httpTarget(feed.url, baseUrl);
    if (!target || !isReadableFeedType(feed.type)) continue;
    const a = appLink(feed.title ?? target, target);
    a.rel = 'alternate';
    if (feed.type) a.type = feed.type;
    const li = document.createElement('li');
    li.append(a);
    items.push(li);
  }
  if (feedMenu.matches(':popover-open')) feedMenu.hidePopover();
  feedMenu.querySelector('ul').replaceChildren(...items);
  feedsButton.hidden = !items.length;
}

// The first of the fields generators use for a last-modified date, in the
// reader's locale. A bare YYYY-MM-DD is a calendar date, not UTC midnight,
// which would show as the day before west of Greenwich.
function updatedDate(meta) {
  const value = meta.updated ?? meta.last_modified ?? meta.modified;
  if (!value) return null;
  const day = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = day ? new Date(day[1], day[2] - 1, day[3]) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

const markdownHtml = (markdown) => DOMPurify.sanitize(marked.parse(markdown), SANITIZE);

// Some generators write HTML entities into titles.
const decodeEntities = (text) => new DOMParser().parseFromString(text, 'text/html').body.textContent;

// Returns the document's front matter.
function render(markdown, baseUrl) {
  const { meta, body } = splitFrontMatter(markdown);
  content.innerHTML = markdownHtml(fillPlaceholders(body, meta));

  if (meta.title && !content.querySelector('h1')) {
    const h1 = document.createElement('h1');
    h1.textContent = decodeEntities(meta.title);
    content.prepend(h1);
  }
  renderDocNav(meta, baseUrl);
  renderFeedMenu(frontMatterFeeds(meta), baseUrl);
  addHeadingIds();
  resolveUrls(content, baseUrl);
  return meta;
}

// A feed's items in feed order, each with its title linked to its page. An
// item's body is shown only when the feed has it as Markdown; an item with
// no title is linked by its date instead.
function renderFeed(feed, feedUrl) {
  content.replaceChildren();
  docNav.replaceChildren();
  renderFeedMenu([]);
  const h1 = document.createElement('h1');
  h1.append(feed.title ? linkTo(decodeEntities(feed.title), feed.link, feedUrl) : feedUrl);
  content.append(h1);
  if (feed.description) {
    const p = document.createElement('p');
    p.textContent = decodeEntities(feed.description);
    content.append(p);
  }
  for (const item of feed.items) {
    const article = document.createElement('article');
    article.className = 'feed-item';
    if (item.title) {
      const h2 = document.createElement('h2');
      h2.append(linkTo(decodeEntities(item.title), item.link, feedUrl));
      article.append(h2);
    }
    if (item.markdown) {
      const body = document.createElement('div');
      body.innerHTML = markdownHtml(item.markdown);
      resolveUrls(body, itemBase(item.link, feedUrl));
      article.append(body);
    }
    if (!item.title && item.link) {
      const p = document.createElement('p');
      p.className = 'feed-permalink';
      p.append(linkTo(feedDate(item.date) ?? item.link, item.link, feedUrl));
      article.append(p);
    }
    content.append(article);
  }
  addHeadingIds();
}

// Text linked to url, or the bare text when url is not http(s).
function linkTo(text, url, baseUrl) {
  const target = httpTarget(url, baseUrl);
  return target ? appLink(text, target) : text;
}

// Relative URLs in an item's Markdown resolve against the item's own page.
function itemBase(link, feedUrl) {
  if (!link) return feedUrl;
  try {
    return new URL(link, feedUrl).href;
  } catch {
    return feedUrl;
  }
}

function feedDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null;
}

function addHeadingIds() {
  const seen = new Map();
  for (const h of content.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!h.id) h.id = `user-content-${slugify(h.textContent, seen)}`;
  }
}

function resolveUrls(root, baseUrl) {
  for (const img of root.querySelectorAll('img[src]')) {
    // A broken image would only show the browser's placeholder, so it is hidden.
    img.addEventListener('error', () => { img.hidden = true; }, { once: true });
    img.src = new URL(img.getAttribute('src'), baseUrl).href;
  }
  for (const a of root.querySelectorAll('a[href]')) pointLink(a, a.getAttribute('href'), baseUrl);
}

// http(s) links point at mdbrowse itself, so opening one in a new tab opens
// it in mdbrowse; the document's own URL is kept in data-target. A link to a
// document in another Markdown viewer opens that document here instead.
function pointLink(a, href, baseUrl) {
  let target;
  try {
    target = unwrapViewerLink(new URL(href, baseUrl));
  } catch {
    return;
  }
  if (target.protocol === 'http:' || target.protocol === 'https:') {
    a.dataset.target = target.href;
    a.href = `/?url=${encodeURIComponent(target.href)}`;
  } else {
    a.href = target.href;
  }
}

function showError(result) {
  content.replaceChildren();
  docNav.replaceChildren();
  renderFeedMenu([]);
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = result.error;
  content.append(p);
  if (result.status) content.append(pageLink(result.url));
}

// A plain link to a page mdbrowse can't show, so it can be opened in the
// browser as a normal page.
function pageLink(url) {
  const target = new URL(url);
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return '';
  const p = document.createElement('p');
  const a = document.createElement('a');
  a.href = a.textContent = target.href;
  p.append(a);
  return p;
}

function setLocation(url, push) {
  currentUrl = url;
  address.value = url;
  const appUrl = `?url=${encodeURIComponent(url)}`;
  if (push) history.pushState({ url }, '', appUrl);
  else history.replaceState({ url }, '', appUrl);
}

function showPosition(url) {
  const { hash } = new URL(url);
  if (hash) scrollToFragment(hash);
  else scrollTo(0, 0);
}

function isSameDoc(url) {
  return currentUrl && url.split('#')[0] === currentUrl.split('#')[0];
}

// `handoff` is for followed links: a page that turns out not to be markdown
// opens in this tab as a normal web page.
async function load(url, { push = true, handoff = false } = {}) {
  const previousStatus = status.textContent;
  address.value = url;
  status.textContent = `Loading ${url}…`;
  const result = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`).then((r) => r.json());
  if (handoff && !result.ok && result.status) {
    // Back restores this page from the back/forward cache as it was left.
    address.value = currentUrl ?? '';
    status.textContent = previousStatus;
    return location.assign(result.url);
  }
  show(result, { push });
}

function show(result, { push }) {
  setLocation(result.url, push);

  if (result.ok) {
    let meta = {};
    if (result.feed) renderFeed(result.feed, result.url);
    else meta = render(result.markdown, result.url);
    const updated = updatedDate(meta);
    status.textContent = [
      result.status >= 400 && `HTTP ${result.status}`,
      result.contentType,
      updated && `Updated ${updated}`,
      result.alternateOf && `Markdown version of ${result.alternateOf}`,
      result.fallbackFrom && `no markdown at ${result.fallbackFrom}, showing llms.txt`,
    ].filter(Boolean).join(' · ');
    document.title = content.querySelector('h1')?.textContent || result.url;
    showPosition(result.url);
  } else {
    status.textContent = result.status ? `HTTP ${result.status}` : 'Error';
    showError(result);
    document.title = 'mdbrowse';
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (address.value.trim()) load(address.value.trim());
});

function followLink(e) {
  const a = e.target.closest('a[data-target]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  const target = new URL(a.dataset.target);
  if (isSameDoc(target.href) && target.hash) {
    setLocation(target.href, target.href !== currentUrl);
    scrollToFragment(target.hash);
  } else {
    load(target.href, { handoff: true });
  }
}

content.addEventListener('click', followLink);
docNav.addEventListener('click', followLink);
feedMenu.addEventListener('click', (e) => {
  followLink(e);
  if (e.target.closest('a')) feedMenu.hidePopover();
});

// The menu sits in the top layer, so it is placed under the button when it opens.
feedMenu.addEventListener('beforetoggle', (e) => {
  if (e.newState !== 'open') return;
  const { bottom, right } = feedsButton.getBoundingClientRect();
  feedMenu.style.top = `${bottom + 4}px`;
  feedMenu.style.right = `${document.documentElement.clientWidth - right}px`;
});

document.getElementById('back').addEventListener('click', () => history.back());
document.getElementById('forward').addEventListener('click', () => history.forward());
document.getElementById('reload').addEventListener('click', () => (currentUrl ? load(currentUrl, { push: false }) : showHome()));

async function showHome() {
  currentUrl = null;
  address.value = '';
  status.textContent = '';
  const res = await fetch(HOME_SOURCE);
  if (!res.ok) return showError({ error: 'Could not load the homepage.' });
  render(await res.text(), HOME_SOURCE);
  document.title = content.querySelector('h1')?.textContent || 'mdbrowse';
  scrollTo(0, 0);
}

document.getElementById('home').addEventListener('click', () => {
  if (location.search) history.pushState(null, '', '/');
  showHome();
});

window.addEventListener('popstate', (e) => {
  if (e.state?.url && isSameDoc(e.state.url)) {
    currentUrl = address.value = e.state.url;
    return showPosition(e.state.url);
  }
  if (e.state?.url) return load(e.state.url, { push: false });
  showHome();
});

const initial = new URLSearchParams(location.search).get('url');
const embedded = document.getElementById('initial-result');
if (embedded) show(JSON.parse(embedded.textContent), { push: false });
else if (initial) load(initial, { push: false });
else showHome();
