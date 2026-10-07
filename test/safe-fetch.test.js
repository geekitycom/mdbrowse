import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, test } from 'node:test';
import { BlockedAddressError, FetchError, TooLargeError, isPublicAddress, readBody, safeGet } from '../safe-fetch.js';

describe('isPublicAddress', () => {
  const blocked = [
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:127.0.0.1', '::ffff:169.254.169.254',
    '2001:db8::1', '2002:7f00:1::', '2001:0:7f00:1::', 'ff02::1', 'not-an-ip',
  ];
  const allowed = ['8.8.8.8', '1.1.1.1', '172.32.0.1', '104.16.0.1', '2606:4700::1111', '2a00:1450:4001::'];

  for (const address of blocked) {
    test(`blocks ${address}`, () => assert.equal(isPublicAddress(address), false));
  }
  for (const address of allowed) {
    test(`allows ${address}`, () => assert.equal(isPublicAddress(address), true));
  }
});

describe('safeGet', () => {
  let server, base;
  const onlyLoopbackV4 = (address) => address === '127.0.0.1';

  before(async () => {
    server = http.createServer((req, res) => {
      const { pathname, searchParams } = new URL(req.url, 'http://x');
      if (pathname === '/to') {
        res.writeHead(302, { Location: searchParams.get('url') });
        return res.end();
      }
      if (pathname === '/loop') {
        res.writeHead(302, { Location: '/loop' });
        return res.end();
      }
      if (pathname === '/endless') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        const chunk = 'x'.repeat(64 * 1024);
        const pump = () => {
          while (res.write(chunk));
          res.once('drain', pump);
        };
        res.on('close', () => res.removeAllListeners('drain'));
        return pump();
      }
      if (pathname === '/bom') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('# Title')]));
      }
      res.writeHead(200, { 'Content-Type': 'text/markdown' });
      res.end('# ok');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  const get = (url, opts = {}) => safeGet(new URL(url), { timeoutMs: 5000, ...opts });

  test('refuses a private IP literal by default', async () => {
    await assert.rejects(get(`${base}/`), BlockedAddressError);
  });

  test('refuses a bracketed IPv6 loopback literal', async () => {
    await assert.rejects(get('http://[::1]:1/'), BlockedAddressError);
  });

  test('refuses a hostname that resolves to a disallowed address', async () => {
    const port = server.address().port;
    await assert.rejects(get(`http://localhost:${port}/`, { isAllowed: () => false }), BlockedAddressError);
  });

  test('fetches when the address is allowed', async () => {
    const { url, response } = await get(`${base}/`, { isAllowed: onlyLoopbackV4 });
    assert.equal(url.href, `${base}/`);
    assert.equal(await readBody(response, 1024), '# ok');
  });

  test('drops a UTF-8 byte order mark so a leading heading still parses', async () => {
    const { response } = await get(`${base}/bom`, { isAllowed: onlyLoopbackV4 });
    assert.equal(await readBody(response, 1024), '# Title');
  });

  test('refuses a redirect to a disallowed address', async () => {
    const target = encodeURIComponent('http://169.254.169.254/latest/meta-data/');
    await assert.rejects(get(`${base}/to?url=${target}`, { isAllowed: onlyLoopbackV4 }), BlockedAddressError);
  });

  test('refuses a redirect to a hostname that resolves to a disallowed address', async () => {
    const target = encodeURIComponent(`http://localhost:${server.address().port}/`);
    let checks = 0;
    const firstHopOnly = () => ++checks === 1;
    await assert.rejects(get(`${base}/to?url=${target}`, { isAllowed: firstHopOnly }), BlockedAddressError);
  });

  test('follows an allowed redirect and reports the final URL', async () => {
    const target = encodeURIComponent(`${base}/final`);
    const { url } = await get(`${base}/to?url=${target}`, { isAllowed: onlyLoopbackV4 });
    assert.equal(url.href, `${base}/final`);
  });

  test('refuses a redirect to a non-http scheme', async () => {
    const target = encodeURIComponent('file:///etc/passwd');
    await assert.rejects(get(`${base}/to?url=${target}`, { isAllowed: onlyLoopbackV4 }), /unsupported file: URL/);
  });

  test('stops a redirect loop', async () => {
    await assert.rejects(get(`${base}/loop`, { isAllowed: onlyLoopbackV4 }), (err) => {
      return err instanceof FetchError && /Stopped after 5 redirects/.test(err.message);
    });
  });

  test('stops reading an endless body at the size cap', async () => {
    const { response } = await get(`${base}/endless`, { isAllowed: onlyLoopbackV4 });
    await assert.rejects(readBody(response, 1024 * 1024), TooLargeError);
  });
});
