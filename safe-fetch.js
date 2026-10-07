import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const blockedV4 = new net.BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]) {
  blockedV4.addSubnet(network, prefix, 'ipv4');
}

// IPv6 is allowlisted: only global unicast, minus the ranges inside it that
// tunnel to arbitrary IPv4 (Teredo, 6to4) or are reserved for documentation.
// That also rules out loopback, link-local, unique-local and IPv4-mapped.
const globalV6 = new net.BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const reservedV6 = new net.BlockList();
for (const [network, prefix] of [
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
]) {
  reservedV6.addSubnet(network, prefix, 'ipv6');
}

export function isPublicAddress(address) {
  switch (net.isIP(address)) {
    case 4:
      return !blockedV4.check(address, 'ipv4');
    case 6:
      return globalV6.check(address, 'ipv6') && !reservedV6.check(address, 'ipv6');
    default:
      return false;
  }
}

// Every error a caller may show to a user. Anything else is reported
// generically, so connection details don't map out the network.
export class FetchError extends Error {}
export class BlockedAddressError extends FetchError {
  constructor() {
    super('Refusing to fetch a private or local network address.');
  }
}
export class TooLargeError extends FetchError {}

// Runs as the connection's own DNS lookup, so the addresses checked are the
// addresses connected to, and a hostname cannot resolve publicly for a check
// and privately for the request.
function guardedLookup(isAllowed) {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err);
      if (addresses.some(({ address }) => !isAllowed(address))) {
        return callback(new BlockedAddressError());
      }
      if (options.all) return callback(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

function request(url, { headers, signal, isAllowed }) {
  // Node skips `lookup` for IP literals, so those are checked here.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !isAllowed(host)) {
    return Promise.reject(new BlockedAddressError());
  }
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    client.get(url, { headers, signal, lookup: guardedLookup(isAllowed) }, resolve).on('error', reject);
  });
}

// GET `url`, following up to `maxRedirects` redirects, each one checked like
// the first: every address connected to must pass `isAllowed`. Resolves with
// the final URL and the unread response.
export async function safeGet(url, { headers, timeoutMs, maxRedirects = 5, isAllowed = isPublicAddress }) {
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; ; hop++) {
    const response = await request(url, { headers, signal, isAllowed });
    const { location } = response.headers;
    if (!REDIRECT_STATUSES.has(response.statusCode) || !location) return { url, response };

    response.resume();
    if (hop === maxRedirects) throw new FetchError(`Stopped after ${maxRedirects} redirects.`);
    url = new URL(location, url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new FetchError(`Redirected to an unsupported ${url.protocol} URL.`);
    }
  }
}

// Reads the body as UTF-8, dropping a byte order mark as fetch's text() does,
// and stops as soon as it passes `maxBytes` whatever the headers claimed.
export async function readBody(response, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > maxBytes) {
      response.destroy();
      throw new TooLargeError(`Document is larger than ${maxBytes / 1024 / 1024} MB.`);
    }
    chunks.push(chunk);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
