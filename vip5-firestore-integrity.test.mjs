import test from 'node:test';
import assert from 'node:assert/strict';
import { collectIntegrityIssues } from '../vip5-firestore-integrity.mjs';

test('detects a code used without a matching user document', () => {
  const issues = collectIntegrityIssues({
    codeDoc: { usado: true, usadoPor: 'user-1', status: 'usado' },
    userDoc: null,
  });

  assert.deepEqual(issues.map((issue) => issue.type), ['code_without_user']);
});

test('detects a participation document without a corresponding user document', () => {
  const issues = collectIntegrityIssues({
    participantDoc: { uid: 'user-2', sorteioId: 'sorteio-1' },
    userDoc: null,
  });

  assert.deepEqual(issues.map((issue) => issue.type), ['participation_without_user']);
});

test('detects a code linked to a sorteio that does not exist', () => {
  const issues = collectIntegrityIssues({
    codeDoc: { codigo: 'ABC12345', sorteioId: 'missing-sorteio' },
    sorteioDoc: null,
  });

  assert.deepEqual(issues.map((issue) => issue.type), ['code_without_sorteio']);
});
