import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SANITIZE } from '../public/sanitize.js';

// DOMPurify keeps a URI attribute when ALLOWED_URI_REGEXP matches it.
const kept = (uri) => SANITIZE.ALLOWED_URI_REGEXP.test(uri);

describe('ALLOWED_URI_REGEXP', () => {
  const allowed = [
    'gemini://example.com/page.gmi', 'gopher://example.com/1/', 'xmpp:user@example.com', 'tel:+15555550100',
    'sms:+15555550100', 'geo:37.786971,-122.399677', 'magnet:?xt=urn:btih:abc', 'irc://irc.libera.chat/mdbrowse',
    'ircs://irc.libera.chat:6697/mdbrowse', 'matrix:r/mdbrowse:example.com', 'GEMINI://example.com/',
    'https://example.com/a.md', 'http://example.com/', 'mailto:me@example.com',
    '/a.md', 'a.md', 'docs/a.md', '../a.md', '#section', '?page=2',
  ];
  const stripped = [
    'javascript:alert(1)', 'JavaScript:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd', 'ftp://example.com/', 'geminix://example.com/', 'blob:https://example.com/x',
  ];

  for (const uri of allowed) {
    test(`keeps ${uri}`, () => assert.equal(kept(uri), true));
  }
  for (const uri of stripped) {
    test(`strips ${uri}`, () => assert.equal(kept(uri), false));
  }
});
