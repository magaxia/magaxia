import test from 'node:test';
import assert from 'node:assert/strict';
import { isCodeUsed, getCodeDays } from '../vip5-code-utils.mjs';

test('detects both legacy and current usage flags', () => {
  assert.equal(isCodeUsed({ usado: true }), true);
  assert.equal(isCodeUsed({ used: true }), true);
  assert.equal(isCodeUsed({ usado: false, used: false }), false);
  assert.equal(isCodeUsed({}), false);
});

test('normalizes days with a safe fallback', () => {
  assert.equal(getCodeDays({ days: 7 }), 7);
  assert.equal(getCodeDays({ days: '10' }), 10);
  assert.equal(getCodeDays({ days: 'abc' }, 30), 30);
  assert.equal(getCodeDays({ days: 0 }, 30), 30);
});
