import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { FetchError, isPublicAddress, readBody, safeGet } from './safe-fetch.js';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = import.meta.dirname;
const MAX_BYTES = 5 * 1024 * 1024;
// For local development against servers on this machine or the LAN.
const isAllowed = process.env.MDBROWSE_ALLOW_PRIVATE === 'true' ? () => true : isPublicAddress;

const STATIC = {
  '/': 'public/index.html',
  '/app.js': 'public/app.js',
  '/homepage.md': 'homepage.md',
  '/vendor/marked.js': 'node_modules/marked/lib/marked.esm.js',
  '/vendor/purify.js': 'node_modules/dompurify/dist/purify.es.mjs',
  '/vendor/github-markdown.css': 'node_modules/github-markdown-css/github-markdown.css',
};

const MIME = { '.md': 'text/markdown; charset=utf-8', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };

const MARKDOWN_TYPES = new Set(['text/markdown', 'text/x-markdown', 'text/plain']);

function looksLikeHtml(body) {
  const head = body.slice(0, 1024).replace(/^﻿/, '').replace(/^\s*(<!--[\s\S]*?-->\s*)*/, '').toLowerCase();
  return /^<(!doctype html|html|head|body)[\s>]/.test(head);
}

async function fetchOne(target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return { ok: false, url: target, error: 'Not a valid URL.' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, url: target, error: 'Only http and https URLs are supported.' };
  }

  const failedTo = (err) => {
    if (err instanceof FetchError) return err.message;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return `Timed out fetching from ${url.host}.`;
    return `Could not connect to ${url.host}.`;
  };

  let finalUrl, res;
  try {
    ({ url: finalUrl, response: res } = await safeGet(url, {
      headers: {
        Accept: 'text/markdown, text/x-markdown;q=0.9, text/plain;q=0.8',
        'Accept-Encoding': 'identity',
        'User-Agent': 'mdbrowse',
      },
      timeoutMs: 15000,
      isAllowed,
    }));
  } catch (err) {
    return { ok: false, url: url.href, error: failedTo(err) };
  }

  const status = res.statusCode;
  const ok = status >= 200 && status < 300;
  const contentType = (res.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  const fail = (error) => {
    res.destroy();
    return { ok: false, url: finalUrl.href, status, error: ok ? error : `Server responded ${status} ${res.statusMessage}.` };
  };

  if (contentType && !MARKDOWN_TYPES.has(contentType)) {
    return fail(`Not markdown: server returned ${contentType}.`);
  }
  if (Number(res.headers['content-length']) > MAX_BYTES) {
    return fail('Document is larger than 5 MB.');
  }

  let markdown;
  try {
    markdown = await readBody(res, MAX_BYTES);
  } catch (err) {
    return { ok: false, url: finalUrl.href, status, error: failedTo(err) };
  }
  if (looksLikeHtml(markdown)) {
    return fail(`Not markdown: ${contentType || 'response'} body is an HTML document.`);
  }
  if (!ok && !markdown.trim()) return fail();
  return { ok: true, url: finalUrl.href, status, contentType: contentType || 'unknown', markdown };
}

function isSiteRoot(target) {
  try {
    const { pathname, search } = new URL(target);
    return pathname === '/' && !search;
  } catch {
    return false;
  }
}

// A site whose homepage has no markdown may still describe itself in
// /llms.txt (https://llmstxt.org), so a root that answered with something
// else falls back to that.
async function fetchMarkdown(target) {
  const result = await fetchOne(target);
  if (result.ok || !result.status || !isSiteRoot(target)) return result;
  const llms = await fetchOne(new URL('/llms.txt', result.url).href);
  return llms.ok && llms.status < 300 ? { ...llms, fallbackFrom: result.url } : result;
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
