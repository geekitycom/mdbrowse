import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { homepageSource } from '../homepage.js';

describe('homepageSource', () => {
  const file = join(tmpdir(), `mdbrowse-homepage-${process.pid}.md`);
  let server, base, body, status, hits;

  before(async () => {
    await writeFile(file, '# Bundled');
    server = http.createServer((req, res) => {
      hits++;
      res.writeHead(status, { 'Content-Type': 'text/plain' });
      res.end(body);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/homepage.md`;
  });
  after(() => server.close());
  beforeEach(() => {
    body = '# Remote';
    status = 200;
    hits = 0;
  });

  test('reads the bundled file without a URL', async () => {
    assert.equal(await homepageSource({ file })(), '# Bundled');
  });

  test('serves the remote copy and caches it', async () => {
    const homepage = homepageSource({ url: base, file });
    assert.equal(await homepage(), '# Remote');
    body = '# Changed';
    assert.equal(await homepage(), '# Remote');
    assert.equal(hits, 1);
  });

  test('refetches once the copy expires', async () => {
    const homepage = homepageSource({ url: base, file, ttlMs: 0 });
    assert.equal(await homepage(), '# Remote');
    body = '# Changed';
    assert.equal(await homepage(), '# Changed');
  });

  test('falls back to the bundled file when the first fetch fails', async () => {
    status = 404;
    assert.equal(await homepageSource({ url: base, file })(), '# Bundled');
  });

  test('keeps the last good copy when a later fetch fails', async () => {
    const homepage = homepageSource({ url: base, file, ttlMs: 0 });
    assert.equal(await homepage(), '# Remote');
    status = 500;
    assert.equal(await homepage(), '# Remote');
  });
});
