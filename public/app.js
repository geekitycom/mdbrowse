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
const content = document.getElementById('content');

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

function render(markdown, baseUrl) {
  const body = markdown.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  content.innerHTML = DOMPurify.sanitize(marked.parse(body), SANITIZE);

  const seen = new Map();
  for (const h of content.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (!h.id) h.id = `user-content-${slugify(h.textContent, seen)}`;
  }
  for (const img of content.querySelectorAll('img[src]')) {
    img.src = new URL(img.getAttribute('src'), baseUrl).href;
  }
  for (const a of content.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    try {
      a.href = new URL(href, baseUrl).href;
    } catch {}
  }
}

function showError(result) {
  content.replaceChildren();
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = result.error;
  content.append(p);
}

function candidatesFor(input) {
  const trimmed = input.trim();
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? [trimmed] : [`https://${trimmed}`, `http://${trimmed}`];
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

async function load(url, { push = true } = {}) {
  address.value = url;
  let result;
  for (const candidate of candidatesFor(url)) {
    status.textContent = `Loading ${candidate}…`;
    const attempt = await fetch(`/api/fetch?url=${encodeURIComponent(candidate)}`).then((r) => r.json());
    result ??= attempt;
    if (attempt.ok) {
      result = attempt;
      break;
    }
  }
  const fragment = url.includes('#') ? url.slice(url.indexOf('#')) : '';
  if (fragment && !result.url.includes('#')) result.url += fragment;

  setLocation(result.url, push);

  if (result.ok) {
    status.textContent = [
      result.status >= 400 && `HTTP ${result.status}`,
      result.contentType,
      result.fallbackFrom && `no markdown at ${result.fallbackFrom}, showing llms.txt`,
    ].filter(Boolean).join(' · ');
    render(result.markdown, result.url);
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

content.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const target = new URL(a.href);
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return;
  e.preventDefault();
  if (isSameDoc(target.href) && target.hash) {
    setLocation(target.href, target.href !== currentUrl);
    scrollToFragment(target.hash);
  } else {
    load(target.href);
  }
});

document.getElementById('back').addEventListener('click', () => history.back());
document.getElementById('forward').addEventListener('click', () => history.forward());
document.getElementById('reload').addEventListener('click', () => currentUrl && load(currentUrl, { push: false }));

window.addEventListener('popstate', (e) => {
  if (e.state?.url && isSameDoc(e.state.url)) {
    currentUrl = address.value = e.state.url;
    return showPosition(e.state.url);
  }
  if (e.state?.url) return load(e.state.url, { push: false });
  currentUrl = null;
  address.value = '';
  status.textContent = '';
  content.replaceChildren();
  document.title = 'mdbrowse';
});

const initial = new URLSearchParams(location.search).get('url');
if (initial) load(initial, { push: false });
