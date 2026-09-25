import { describe, expect, test } from '@jest/globals';

import { BackupValidationError, MAX_BACKUP_LENGTH, normalizeState, parseBackup } from './validation';

function backup(): any {
  return {
    version: 1,
    activeEmploymentId: 'job-1',
    employments: [{
      id: 'job-1', name: 'Hauptjob', color: 0,
      days: { '2024-02-29': { start: '07:00', end: '15:30', pause: 30, note: 'Schulung', demo: true } },
      allowances: [{ id: 'allowance-1', date: '2024-02-29', label: 'Bereitschaft', quantity: 1.5, amount: 42.5 }],
      billing: { '2024-02': { hours: '8,00', allowances: { Bereitschaft: { quantity: '1,5', amount: '42,50' } } } },
    }],
  };
}

function rejects(mutator: (value: any) => void, expected: RegExp) {
  const value = backup();
  mutator(value);
  expect(() => normalizeState(value)).toThrow(expected);
}

describe('backup validation', () => {
  test('accepts and deeply copies a complete v1 backup', () => {
    const input = backup();
    const result = parseBackup(JSON.stringify(input));
    expect(result).toEqual(input);
    expect(result.employments[0]).not.toBe(input.employments[0]);
    expect(result.employments[0].days['2024-02-29']).not.toBe(input.employments[0].days['2024-02-29']);
  });

  test('rejects unsupported versions, references, and duplicate IDs', () => {
    rejects((value) => { value.version = 2; }, /version.*muss 1 sein/);
    rejects((value) => { value.activeEmploymentId = 'missing'; }, /aktive Arbeitsverhältnis.*ungültig/);
    rejects((value) => { value.employments.push(structuredClone(value.employments[0])); }, /doppelte Arbeitsverhältnis-Kennungen/);
    rejects((value) => { value.employments.push({ ...structuredClone(value.employments[0]), id: 'job-2', days: {}, billing: {} }); }, /doppelte Zulagen-Kennungen/);
  });

  test('validates nested dates, work, allowances, billing, and unknown fields', () => {
    rejects((value) => { value.employments[0].days['2023-02-29'] = value.employments[0].days['2024-02-29']; delete value.employments[0].days['2024-02-29']; }, /existiert nicht/);
    rejects((value) => { value.employments[0].billing['2024-13'] = value.employments[0].billing['2024-02']; delete value.employments[0].billing['2024-02']; }, /Ungültiger Kalendermonat/);
    rejects((value) => { value.employments[0].days['2024-02-29'].pause = 600; }, /kürzer als die Bruttozeit/);
    rejects((value) => { value.employments[0].allowances[0].quantity = Number.POSITIVE_INFINITY; }, /Ungültiger oder zu großer Wert/);
    rejects((value) => { value.employments[0].billing['2024-02'].allowances.Bereitschaft.quantity = 4; }, /quantity.*Text/);
    rejects((value) => { value.employments[0].extra = true; }, /extra.*kein unterstütztes Feld/);
  });

  test('rejects malformed, oversized, and DST-invalid data', () => {
    expect(() => parseBackup('{')).toThrow(BackupValidationError);
    expect(() => parseBackup('x'.repeat(MAX_BACKUP_LENGTH + 1))).toThrow(/größer als 5 MB/);
    rejects((value) => { value.employments[0].days = { '2025-03-30': { start: '02:30', end: '04:00', pause: 0, note: '' } }; }, /Zeitumstellung/);
  });
});
