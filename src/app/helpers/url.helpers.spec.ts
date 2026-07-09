import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlDomain } from './url.helpers';

// Seed unit tests for the pure URL-origin helper. Run with `npm run test:unit`.

test('returns the scheme + host, stripping path and query', () => {
  assert.equal(urlDomain('https://my.url.com/path?query=1'), 'https://my.url.com');
});

test('preserves a non-default port', () => {
  assert.equal(urlDomain('http://localhost:8080/x'), 'http://localhost:8080');
});
