import { marked } from '/vendor/marked.js';
import DOMPurify from '/vendor/purify.js';

marked.setOptions({ gfm: true });

// Modeled on GitHub's html-pipeline SanitizationFilter allowlist.
const SANITIZE = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'div', 'span', 'blockquote', 'pre', 'code', 'tt',
    'b', 'i', 'strong', 'em', 's', 'strike', 'del', 'ins', 'sup', 'sub', 'small', 'mark', 'kbd', 'q', 'samp',
    'var', 'abbr', 'cite', 'dfn', 'time', 'bdo', 'ruby', 'rt', 'rp', 'wbr', 'a', 'img', 'picture', 'source',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'details', 'summary', 'figure', 'figcaption', 'input',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'srcset', 'media', 'alt', 'title', 'width', 'height', 'align', 'valign', 'colspan',
    'rowspan', 'scope', 'headers', 'start', 'type', 'checked', 'disabled', 'open', 'datetime', 'dir', 'lang',
    'id', 'name', 'aria-label', 'aria-hidden', 'aria-describedby', 'aria-labelledby', 'role', 'cite',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_ATTR: false,
};

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.nodeName === 'INPUT') {
    if (node.getAttribute('type') !== 'checkbox') return node.remove();
    node.setAttribute('disabled', '');
  }
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

const FRONT_MATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n/;

// Only top-level `key: value` lines are read; nested fields and lists are
// skipped, since the fields used here are all plain strings.
function splitFrontMatter(markdown) {
  const match = markdown.match(FRONT_MATTER);
  if (!match) return { meta: {}, body: markdown };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z_][\w-]*):\s*(.+?)\s*$/);
    if (field) meta[field[1]] = field[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return { meta, body: markdown.slice(match[0].length) };
}

const DOC_NAV = [
  ['previous', 'prev', 'Previous'],
  ['home', 'home', 'Home'],
  ['next', 'next', 'Next'],
];

// Links between documents named in front matter (previous, home, next), shown
// in the status bar. They bypass the sanitizer, so only http(s) targets are kept.
function renderDocNav(meta, baseUrl) {
  docNav.replaceChildren();
  for (const [field, rel, label] of DOC_NAV) {
    if (!meta[field]) continue;
    let target;
    try {
      target = new URL(meta[field], baseUrl);
    } catch {
      continue;
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') continue;
    if (docNav.childElementCount) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '·';
      docNav.append(sep);
    }
    const a = document.createElement('a');
    a.rel = rel;
    a.dataset.target = target.href;
    a.href = `/?url=${encodeURIComponent(target.href)}`;
    a.textContent = label;
    docNav.append(a);
  }
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

// Returns the document's front matter.
function render(markdown, baseUrl) {
  const { meta, body } = splitFrontMatter(markdown);
  content.innerHTML = DOMPurify.sanitize(marked.parse(body), SANITIZE);

  if (meta.title && !content.querySelector('h1')) {
    const h1 = document.createElement('h1');
    // Some generators write HTML entities into the title.
    h1.textContent = new DOMParser().parseFromString(meta.title, 'text/html').body.textContent;
    content.prepend(h1);
  }
  renderDocNav(meta, baseUrl);

  const seen = new Map();
  for (const h of content.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!h.id) h.id = `user-content-${slugify(h.textContent, seen)}`;
  }
  for (const img of content.querySelectorAll('img[src]')) {
    img.src = new URL(img.getAttribute('src'), baseUrl).href;
  }
  // http(s) links point at mdbrowse itself, so opening one in a new tab opens
  // it in mdbrowse; the document's own URL is kept in data-target.
  for (const a of content.querySelectorAll('a[href]')) {
    let target;
    try {
      target = new URL(a.getAttribute('href'), baseUrl);
    } catch {
      continue;
    }
    if (target.protocol === 'http:' || target.protocol === 'https:') {
      a.dataset.target = target.href;
      a.href = `/?url=${encodeURIComponent(target.href)}`;
    } else {
      a.href = target.href;
    }
  }
  return meta;
}

function showError(result) {
  content.replaceChildren();
  docNav.replaceChildren();
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = result.error;
  content.append(p);
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
    const meta = render(result.markdown, result.url);
    const updated = updatedDate(meta);
    status.textContent = [
      result.status >= 400 && `HTTP ${result.status}`,
      result.contentType,
      updated && `Updated ${updated}`,
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
