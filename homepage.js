import { readFile } from 'node:fs/promises';

const TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 5000;

// Returns a function that gives the start page's Markdown. With a URL, the
// page is fetched from there and kept for ttlMs, so the list of sites can
// change without a new image. When a fetch fails, the last copy that loaded
// is served, or the bundled file if none has.
export function homepageSource({ url, file, ttlMs = TTL_MS, timeoutMs = TIMEOUT_MS }) {
  if (!url) return () => readFile(file, 'utf8');

  let cached = null;
  let fetchedAt = 0;
  let pending = null;

  async function refresh() {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cached = await res.text();
    } catch (err) {
      console.warn(`Could not fetch the homepage from ${url}: ${err.message}`);
    }
    fetchedAt = Date.now();
    return cached ?? readFile(file, 'utf8');
  }

  return () => {
    if (cached !== null && Date.now() - fetchedAt < ttlMs) return Promise.resolve(cached);
    pending ??= refresh().finally(() => {
      pending = null;
    });
    return pending;
  };
}
