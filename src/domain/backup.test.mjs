import assert from 'node:assert/strict';
import test from 'node:test';

import { BackupValidationError, MAX_BACKUP_LENGTH, normalizeState, parseBackup } from './validation.ts';

function backup() {
  return {
    version: 1,
    activeEmploymentId: 'job-1',
    employments: [{
      id: 'job-1',
      name: 'Hauptjob',
      color: 0,
      days: {
        '2024-02-29': { start: '07:00', end: '15:30', pause: 30, note: 'Schulung', demo: true },
      },
      allowances: [{ id: 'allowance-1', date: '2024-02-29', label: 'Bereitschaft', quantity: 1.5, amount: 42.5 }],
      billing: {
        '2024-02': { hours: '8,00', allowances: { Bereitschaft: { quantity: '1,5', amount: '42,50' } } },
      },
    }],
  };
}

function rejects(mutator, expected) {
  const value = backup();
  mutator(value);
  assert.throws(() => normalizeState(value), (error) => {
    assert.ok(error instanceof BackupValidationError);
    assert.match(error.message, expected);
    return true;
  });
}

test('accepts and copies a complete version 1 backup', () => {
  const input = backup();
  const result = parseBackup(JSON.stringify(input));
  assert.deepEqual(result, input);
  assert.notEqual(result.employments[0], input.employments[0]);
  assert.notEqual(result.employments[0].days['2024-02-29'], input.employments[0].days['2024-02-29']);
});

test('rejects unsupported versions and invalid active employment references', () => {
  rejects((value) => { value.version = 2; }, /version.*muss 1 sein/);
  rejects((value) => { value.activeEmploymentId = 'missing'; }, /aktive Arbeitsverhältnis.*ungültig/);
});

test('rejects duplicate employment and globally duplicate allowance IDs', () => {
  rejects((value) => { value.employments.push({ ...structuredClone(value.employments[0]), allowances: [], billing: {}, days: {} }); }, /doppelte Arbeitsverhältnis-Kennungen/);
  rejects((value) => {
    value.employments.push({ ...structuredClone(value.employments[0]), id: 'job-2', days: {}, billing: {} });
  }, /doppelte Zulagen-Kennungen/);
});

test('validates calendar keys, month keys, work days, allowances, and billing deeply', () => {
  rejects((value) => { value.employments[0].days['2023-02-29'] = value.employments[0].days['2024-02-29']; delete value.employments[0].days['2024-02-29']; }, /existiert nicht/);
  rejects((value) => { value.employments[0].billing['2024-13'] = value.employments[0].billing['2024-02']; delete value.employments[0].billing['2024-02']; }, /Ungültiger Kalendermonat/);
  rejects((value) => { value.employments[0].days['2024-02-29'].start = '25:00'; }, /gültige Uhrzeit/);
  rejects((value) => { value.employments[0].days['2024-02-29'].pause = 600; }, /kürzer als die Bruttozeit/);
  rejects((value) => { value.employments[0].allowances[0].quantity = Number.POSITIVE_INFINITY; }, /Ungültiger oder zu großer Wert/);
  rejects((value) => { value.employments[0].allowances[0].amount = 1_000_000_001; }, /Ungültiger oder zu großer Wert/);
  rejects((value) => { value.employments[0].billing['2024-02'].allowances.Bereitschaft.quantity = 4; }, /quantity.*Text/);
});

test('rejects missing, unknown, and oversized data instead of filling defaults', () => {
  rejects((value) => { delete value.employments[0].days; }, /days.*Objekt/);
  rejects((value) => { value.employments[0].extra = true; }, /extra.*kein unterstütztes Feld/);
  rejects((value) => { value.employments[0].name = 'x'.repeat(81); }, /1 bis 80 Zeichen/);
  assert.throws(() => parseBackup('x'.repeat(MAX_BACKUP_LENGTH + 1)), /größer als 5 MB/);
  assert.throws(() => parseBackup('{'), /kein gültiges JSON/);
});

test('applies Berlin DST work-day validation to imported backups', () => {
  rejects((value) => {
    value.employments[0].days = {
      '2025-03-30': { start: '02:30', end: '04:00', pause: 0, note: '' },
    };
  }, /Beginn.*existiert.*Zeitumstellung/);

  const value = backup();
  value.employments[0].days = {
    '2025-10-26': { start: '02:15', end: '02:45', pause: 60, note: '' },
  };
  assert.doesNotThrow(() => normalizeState(value));
});
