import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExpression, formatResult } from '../src/calc.js';

test('basic arithmetic', () => {
  assert.equal(evaluateExpression('2 + 3 * 4'), 14);
  assert.equal(evaluateExpression('(2 + 3) * 4'), 20);
  assert.equal(evaluateExpression('2^8'), 256);
  assert.equal(evaluateExpression('10 % 3'), 1);
});

test('functions and constants', () => {
  assert.equal(evaluateExpression('sqrt(144)'), 12);
  assert.equal(evaluateExpression('abs(-5)'), 5);
  assert.ok(Math.abs(evaluateExpression('sin(0)')) < 1e-10);
  assert.ok(Math.abs(evaluateExpression('cos(0)') - 1) < 1e-10);
  assert.ok(Math.abs(evaluateExpression('pi') - Math.PI) < 1e-10);
  assert.ok(Math.abs(evaluateExpression('e') - Math.E) < 1e-10);
  assert.equal(evaluateExpression('log(100)'), 2);
});

test('rejects unsafe or empty input', () => {
  assert.throws(() => evaluateExpression(''), /empty/);
  assert.throws(() => evaluateExpression('process.exit(1)'));
  assert.throws(() => evaluateExpression('require("fs")'));
  assert.throws(() => evaluateExpression('2!'));
  assert.throws(() => evaluateExpression('foo(1)'));
});

test('formatResult trims trailing zeros', () => {
  assert.equal(formatResult(4), '4');
  assert.equal(formatResult(1.5), '1.5');
  assert.equal(formatResult(1.2300000001), '1.23');
});
