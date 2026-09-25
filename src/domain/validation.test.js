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

test('work intervals preserve ordinary and overnight wall-clock behavior', async () => {
  const { getWorkInterval } = await validation;
  assert.deepEqual(getWorkInterval('2025-02-10', '08:00', '16:30'), {
    elapsed: 510, clockElapsed: 510, overnight: false,
    startAmbiguous: false, endAmbiguous: false, dstAdjustment: 0,
  });
  assert.deepEqual(getWorkInterval('2025-02-10', '22:00', '06:00'), {
    elapsed: 480, clockElapsed: 480, overnight: true,
    startAmbiguous: false, endAmbiguous: false, dstAdjustment: 0,
  });
});

test('work intervals use actually elapsed time across Berlin DST changes', async () => {
  const { getWorkInterval } = await validation;
  assert.equal(getWorkInterval('2025-03-30', '01:30', '03:30').elapsed, 60);
  assert.equal(getWorkInterval('2025-03-29', '22:00', '06:00').elapsed, 420);
  assert.equal(getWorkInterval('2025-10-26', '01:30', '03:30').elapsed, 180);
  assert.equal(getWorkInterval('2025-10-25', '22:00', '06:00').elapsed, 540);
});

test('DST gaps are rejected with a comprehensible field error', async () => {
  const { workDayError } = await validation;
  assert.match(workDayError('2025-03-30', { start: '02:30', end: '04:00', pause: 0, note: '' }), /Beginn.*existiert.*Zeitumstellung/);
  assert.match(workDayError('2025-03-29', { start: '22:00', end: '02:30', pause: 0, note: '' }), /Ende.*existiert.*Zeitumstellung/);
});

test('DST overlaps deterministically use first start and second end', async () => {
  const { getWorkInterval } = await validation;
  const bothAmbiguous = getWorkInterval('2025-10-26', '02:15', '02:45');
  assert.equal(bothAmbiguous.elapsed, 90);
  assert.equal(bothAmbiguous.startAmbiguous, true);
  assert.equal(bothAmbiguous.endAmbiguous, true);
  assert.equal(getWorkInterval('2025-10-26', '02:15', '03:15').elapsed, 120);
  assert.equal(getWorkInterval('2025-10-26', '01:45', '02:15').elapsed, 90);
});

test('pause validation uses DST-correct gross time', async () => {
  const { workDayError } = await validation;
  assert.match(workDayError('2025-03-30', { start: '01:30', end: '03:30', pause: 60, note: '' }), /60 Minuten/);
  assert.equal(workDayError('2025-10-26', { start: '01:30', end: '03:30', pause: 120, note: '' }), null);
});

test('allowance and billing inputs enforce bounds and precision', async () => {
  const { parseAmountInput, parseHoursInput, parseQuantityInput } = await validation;
  assert.match(parseQuantityInput('0').error, /größer als 0/);
  assert.equal(parseQuantityInput('0', true, true).error, null);
  assert.match(parseAmountInput('12,345').error, /zwei Nachkommastellen/);
  assert.match(parseHoursInput('12:60').error, /vollständig/);
  assert.equal(parseHoursInput('168:30').value, 10_110);
});
