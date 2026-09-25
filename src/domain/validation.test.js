const assert = require('node:assert/strict');
const test = require('node:test');

const validation = import('./validation.ts');

test('numeric parser rejects partial and malformed values', async () => {
  const { parseNumber } = await validation;
  assert.equal(parseNumber('12abc'), null);
  assert.equal(parseNumber('1,2,3'), null);
  assert.equal(parseNumber('12,50 €'), 12.5);
  assert.equal(parseNumber('1.234,56'), 1234.56);
});

test('calendar validation rejects rollovers and accepts leap days', async () => {
  const { calendarDateError } = await validation;
  assert.equal(calendarDateError('2024-02-29'), null);
  assert.match(calendarDateError('2023-02-29'), /existiert nicht/);
  assert.match(calendarDateError('2024-13-01'), /existiert nicht/);
});

test('work-day validation enforces clock ranges and pause below gross time', async () => {
  const { workDayError } = await validation;
  assert.equal(workDayError('2025-01-01', { start: '22:00', end: '06:00', pause: 30, note: '' }), null);
  assert.match(workDayError('2025-01-01', { start: '24:00', end: '06:00', pause: 30, note: '' }), /Beginn/);
  assert.match(workDayError('2025-01-01', { start: '08:00', end: '09:00', pause: 60, note: '' }), /kürzer/);
});

test('allowance and billing inputs enforce bounds and precision', async () => {
  const { parseAmountInput, parseHoursInput, parseQuantityInput } = await validation;
  assert.match(parseQuantityInput('0').error, /größer als 0/);
  assert.equal(parseQuantityInput('0', true, true).error, null);
  assert.match(parseAmountInput('12,345').error, /zwei Nachkommastellen/);
  assert.match(parseHoursInput('12:60').error, /vollständig/);
  assert.equal(parseHoursInput('168:30').value, 10_110);
});
