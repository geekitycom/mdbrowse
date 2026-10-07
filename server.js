import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = import.meta.dirname;
const MAX_BYTES = 5 * 1024 * 1024;

const STATIC = {
  '/': 'public/index.html',
  '/app.js': 'public/app.js',
  '/vendor/marked.js': 'node_modules/marked/lib/marked.esm.js',
  '/vendor/purify.js': 'node_modules/dompurify/dist/purify.es.mjs',
  '/vendor/github-markdown.css': 'node_modules/github-markdown-css/github-markdown.css',
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };

const MARKDOWN_TYPES = new Set(['text/markdown', 'text/x-markdown', 'text/plain']);

function looksLikeHtml(body) {
  const head = body.slice(0, 1024).replace(/^﻿/, '').replace(/^\s*(<!--[\s\S]*?-->\s*)*/, '').toLowerCase();
  return /^<(!doctype html|html|head|body)[\s>]/.test(head);
}

async function fetchMarkdown(target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return { ok: false, url: target, error: 'Not a valid URL.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, url: target, error: 'Only http and https URLs are supported.' };
  }

  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'text/markdown, text/x-markdown;q=0.9, text/plain;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    return { ok: false, url: url.href, error: `Fetch failed: ${err.cause?.message ?? err.message}` };
  }

  const finalUrl = res.url || url.href;
  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();

  const { status } = res;
  const fail = (error) => ({ ok: false, url: finalUrl, status, error: res.ok ? error : `Server responded ${status} ${res.statusText}.` });

  if (contentType && !MARKDOWN_TYPES.has(contentType)) {
    res.body?.cancel();
    return fail(`Not markdown: server returned ${contentType}.`);
  }
  if (Number(res.headers.get('content-length')) > MAX_BYTES) {
    res.body?.cancel();
    return fail('Document is larger than 5 MB.');
  }

  const markdown = await res.text();
  if (looksLikeHtml(markdown)) {
    return fail(`Not markdown: ${contentType || 'response'} body is an HTML document.`);
  }
  if (!res.ok && !markdown.trim()) return fail();
  return { ok: true, url: finalUrl, status, contentType: contentType || 'unknown', markdown };
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

http
  .createServer(async (req, res) => {
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');

    if (pathname === '/healthz') return send(res, 200, 'text/plain', 'ok');

    if (pathname === '/api/fetch') {
      const result = await fetchMarkdown(searchParams.get('url') ?? '');
      return send(res, 200, 'application/json', JSON.stringify(result));
    }

    const file = STATIC[pathname];
    if (!file) return send(res, 404, 'text/plain', 'Not found');
    try {
      const body = await readFile(join(ROOT, file));
      send(res, 200, MIME[extname(file)] ?? 'application/octet-stream', body);
    } catch {
      send(res, 500, 'text/plain', 'Could not read file');
    }
  })
  .listen(PORT, () => console.log(`mdbrowse on http://localhost:${PORT}`));
