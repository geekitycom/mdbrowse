import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { githubRawUrl } from '../github.js';

describe('githubRawUrl', () => {
  const raw = [
    ['https://github.com/scripting/bonBon/blob/main/docs/charter.md', 'https://raw.githubusercontent.com/scripting/bonBon/main/docs/charter.md'],
    ['https://github.com/o/r/blob/feature/x/README.markdown', 'https://raw.githubusercontent.com/o/r/feature/x/README.markdown'],
    ['https://github.com/o/r/blob/v1.0/a.MD?plain=1', 'https://raw.githubusercontent.com/o/r/v1.0/a.MD'],
    ['https://github.com/o/r/blob/main/a.md#usage', 'https://raw.githubusercontent.com/o/r/main/a.md#usage'],
    ['https://github.com/o/r/blob/main/a%20b.md', 'https://raw.githubusercontent.com/o/r/main/a%20b.md'],
  ];
  for (const [page, file] of raw) {
    test(`maps ${page}`, () => assert.equal(githubRawUrl(page), file));
  }

  const others = [
    'https://github.com/o/r', 'https://github.com/o/r/blob/main/a.js', 'https://github.com/o/r/tree/main/docs.md',
    'https://github.com/o/r/blob/main', 'https://gist.github.com/o/r/blob/main/a.md', 'http://github.com/o/r/blob/main/a.md',
    'https://raw.githubusercontent.com/o/r/main/a.md', 'not a url',
  ];
  for (const url of others) {
    test(`leaves ${url}`, () => assert.equal(githubRawUrl(url), null));
  }
});
