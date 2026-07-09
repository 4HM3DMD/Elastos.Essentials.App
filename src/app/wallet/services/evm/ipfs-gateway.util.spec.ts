import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replaceIPFSUrl } from './ipfs-gateway.util';

// Unit tests for the pure IPFS gateway rewriter. Run with `npm run test:unit`.

test('passes through a null/empty url unchanged', () => {
  assert.equal(replaceIPFSUrl(null), null);
  assert.equal(replaceIPFSUrl(''), '');
});

test('rewrites an ipfs:// url to the preferred gateway', () => {
  assert.equal(replaceIPFSUrl('ipfs://abc123'), 'https://ipfs.elastos.io/ipfs/abc123');
});

test('dedupes the ipfs://ipfs/ (rarible) form', () => {
  assert.equal(replaceIPFSUrl('ipfs://ipfs/abc123'), 'https://ipfs.elastos.io/ipfs/abc123');
});

test('replaces a hardcoded pinata gateway with the preferred gateway', () => {
  assert.equal(
    replaceIPFSUrl('https://gateway.pinata.cloud/ipfs/abc123'),
    'https://ipfs.elastos.io/ipfs/abc123'
  );
});

test('replaces a hardcoded ipfs.io gateway with the preferred gateway', () => {
  assert.equal(replaceIPFSUrl('https://ipfs.io/ipfs/abc123'), 'https://ipfs.elastos.io/ipfs/abc123');
});

test('leaves an unrelated https url untouched', () => {
  assert.equal(replaceIPFSUrl('https://example.com/image.png'), 'https://example.com/image.png');
});
