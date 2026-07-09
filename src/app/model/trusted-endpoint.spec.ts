import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  safeOrigin,
  isHttps,
  isKnownScheme,
  isLocalhost,
  isPrivateHost,
  matchesAllowlist
} from './trusted-endpoint';

// Unit tests for the pure endpoint-trust validators. Run with `npm run test:unit`.

test('safeOrigin returns the origin and null on malformed input', () => {
  assert.equal(safeOrigin('https://my.url.com/path?q=1'), 'https://my.url.com');
  assert.equal(safeOrigin('https://host:8545/rpc'), 'https://host:8545');
  assert.equal(safeOrigin('not a url'), null);
  assert.equal(safeOrigin(''), null);
});

test('isHttps only accepts the https scheme', () => {
  assert.equal(isHttps('https://a.com'), true);
  assert.equal(isHttps('http://a.com'), false);
  assert.equal(isHttps('wss://a.com'), false);
  assert.equal(isHttps('garbage'), false);
});

test('isKnownScheme accepts https/wss by default and rejects others', () => {
  assert.equal(isKnownScheme('https://a.com'), true);
  assert.equal(isKnownScheme('wss://a.com'), true);
  assert.equal(isKnownScheme('http://a.com'), false);
  assert.equal(isKnownScheme('ftp://a.com'), false);
  assert.equal(isKnownScheme('file:///etc/passwd'), false);
  assert.equal(isKnownScheme('http://a.com', ['http:', 'https:']), true);
});

test('isLocalhost detects loopback and .local hosts', () => {
  assert.equal(isLocalhost('http://localhost:8080/x'), true);
  assert.equal(isLocalhost('http://127.0.0.1'), true);
  assert.equal(isLocalhost('http://[::1]:3000'), true);
  assert.equal(isLocalhost('http://printer.local'), true);
  assert.equal(isLocalhost('https://public.example.com'), false);
});

test('isPrivateHost flags literal private/loopback/link-local ranges only', () => {
  assert.equal(isPrivateHost('http://10.0.0.5'), true);
  assert.equal(isPrivateHost('http://172.16.3.1'), true);
  assert.equal(isPrivateHost('http://172.31.255.1'), true);
  assert.equal(isPrivateHost('http://192.168.1.1'), true);
  assert.equal(isPrivateHost('http://169.254.10.10'), true);
  assert.equal(isPrivateHost('http://localhost'), true);
  assert.equal(isPrivateHost('http://172.32.0.1'), false); // just outside 172.16-31
  assert.equal(isPrivateHost('https://8.8.8.8'), false);
  assert.equal(isPrivateHost('https://public.example.com'), false); // no DNS resolution
});

test('matchesAllowlist compares by origin including port', () => {
  const allow = ['https://api.example.com', 'https://rpc.example.com:8545'];
  assert.equal(matchesAllowlist('https://api.example.com/v1/data', allow), true);
  assert.equal(matchesAllowlist('https://rpc.example.com:8545/', allow), true);
  assert.equal(matchesAllowlist('https://rpc.example.com/', allow), false); // wrong port
  assert.equal(matchesAllowlist('https://evil.example.com', allow), false);
  assert.equal(matchesAllowlist('not a url', allow), false);
});
