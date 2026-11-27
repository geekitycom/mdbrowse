import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { unwrapViewerLink } from '../public/viewer-link.js';

const unwrap = (url) => unwrapViewerLink(new URL(url)).href;

describe('unwrapViewerLink', () => {
  test('opens the document a BonBon link shows', () => {
    assert.equal(
      unwrap('https://demo.bonbonweb.org/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fscripting%2FbonBon%2Frefs%2Fheads%2Fmain%2Fdocs%2Fcharter.md'),
      'https://raw.githubusercontent.com/scripting/bonBon/refs/heads/main/docs/charter.md',
    );
  });

  test('keeps the fragment of the document', () => {
    assert.equal(unwrap('https://demo.bonbonweb.org/?url=https%3A%2F%2Fexample.com%2Fa.md%23intro'), 'https://example.com/a.md#intro');
  });

  const unchanged = [
    'https://demo.bonbonweb.org/',
    'https://demo.bonbonweb.org/?url=',
    'https://demo.bonbonweb.org/?url=not-a-url',
    'https://demo.bonbonweb.org/?url=javascript%3Aalert(1)',
    'https://demo.bonbonweb.org/about?url=https%3A%2F%2Fexample.com%2Fa.md',
    'https://example.com/?url=https%3A%2F%2Fexample.com%2Fa.md',
  ];
  for (const url of unchanged) {
    test(`leaves ${url}`, () => assert.equal(unwrap(url), url));
  }
});
