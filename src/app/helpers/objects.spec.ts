import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evalObjectFieldPath } from './objects';

// Seed unit tests for the pure object field-path evaluator. Run with `npm run test:unit`.

test('resolves a dotted field path', () => {
  assert.equal(evalObjectFieldPath({ field: { data: 2 } }, 'field.data'), 2);
});

test('resolves a bracket-indexed array path', () => {
  assert.equal(evalObjectFieldPath({ a: [{ b: 9 }] }, 'a[0].b'), 9);
});

test('returns undefined for a missing key at object level', () => {
  assert.equal(evalObjectFieldPath({ a: { b: 1 } }, 'a.z'), undefined);
});

// TODO: objects.ts applies the `in` operator to a primitive and throws instead of returning
// undefined per its docstring. This test pins the CURRENT (buggy) behavior; the fix is tracked
// separately so this assertion should flip to `=== undefined` once objects.ts is corrected.
test('throws when traversing into a primitive (documents current behavior)', () => {
  assert.throws(() => evalObjectFieldPath({ a: 1 }, 'a.b'), TypeError);
});
