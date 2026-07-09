import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatFiatAmount } from './currency-format';

// Seed unit tests for the pure fiat/crypto amount formatter. Run with `npm run test:unit`.

test('formats a fiat amount with grouping and two decimals', () => {
  assert.equal(formatFiatAmount(2140.2, 'USD'), '$2,140.20');
});

test('drops decimals for zero-decimal currencies', () => {
  assert.equal(formatFiatAmount(2140, 'JPY'), '¥2,140');
});

test('keeps eight decimals for a crypto ticker without clipping', () => {
  assert.equal(formatFiatAmount(0.00042, 'BTC'), '₿0.00042000');
});

test('falls back to a trailing code for an unknown currency', () => {
  assert.equal(formatFiatAmount(10, 'XYZ'), '10.00 XYZ');
});
