import { describe, expect, test } from '@jest/globals';

import { calculateDay, dateKey, daysInMonth, isoWeek, isoWeekYear, monthKey, parseDateKey, toDateKey } from './time';
import { getWorkInterval, workDayError } from './validation';

describe('work duration and pauses', () => {
  test('calculates an ordinary shift and deducts the pause', () => {
    expect(calculateDay('2025-02-10', { start: '08:00', end: '16:30', pause: 30 })).toEqual({
      elapsed: 510,
      pause: 30,
      net: 480,
      overnight: false,
      dstAdjustment: 0,
      startAmbiguous: false,
      endAmbiguous: false,
    });
  });

  test('calculates an overnight shift on the following calendar day', () => {
    expect(calculateDay('2025-02-10', { start: '22:00', end: '06:00', pause: 45 })).toEqual({
      elapsed: 480,
      pause: 45,
      net: 435,
      overnight: true,
      dstAdjustment: 0,
      startAmbiguous: false,
      endAmbiguous: false,
    });
  });

  test('rejects equal times and pauses that consume the gross duration', () => {
    expect(calculateDay('2025-01-01', { start: '08:00', end: '08:00', pause: 0 })).toBeNull();
    expect(workDayError('2025-01-01', { start: '08:00', end: '09:00', pause: 60, note: '' })).toMatch(/kürzer/);
  });
});

describe('Europe/Berlin daylight saving time', () => {
  test.each([
    ['2025-03-30', '01:30', '03:30', 60, -60],
    ['2025-03-29', '22:00', '06:00', 420, -60],
    ['2025-10-26', '01:30', '03:30', 180, 60],
    ['2025-10-25', '22:00', '06:00', 540, 60],
  ])('uses elapsed time for %s %s–%s', (date, start, end, elapsed, adjustment) => {
    expect(getWorkInterval(date, start, end)).toMatchObject({ elapsed, dstAdjustment: adjustment });
  });

  test('rejects nonexistent start and end times in the spring gap', () => {
    expect(workDayError('2025-03-30', { start: '02:30', end: '04:00', pause: 0, note: '' })).toMatch(/Beginn.*existiert.*Zeitumstellung/);
    expect(workDayError('2025-03-29', { start: '22:00', end: '02:30', pause: 0, note: '' })).toMatch(/Ende.*existiert.*Zeitumstellung/);
  });

  test('resolves overlap times to first start and second end', () => {
    expect(getWorkInterval('2025-10-26', '02:15', '02:45')).toEqual({
      elapsed: 90,
      clockElapsed: 30,
      overnight: false,
      startAmbiguous: true,
      endAmbiguous: true,
      dstAdjustment: 60,
    });
    expect(getWorkInterval('2025-10-26', '02:15', '03:15')?.elapsed).toBe(120);
    expect(getWorkInterval('2025-10-26', '01:45', '02:15')?.elapsed).toBe(90);
  });

  test('validates pauses against DST-correct gross duration', () => {
    expect(workDayError('2025-03-30', { start: '01:30', end: '03:30', pause: 60, note: '' })).toMatch(/60 Minuten/);
    expect(workDayError('2025-10-26', { start: '01:30', end: '03:30', pause: 120, note: '' })).toBeNull();
  });
});

describe('calendar and ISO week boundaries', () => {
  test('handles leap years and month/year key boundaries', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2023, 1)).toBe(28);
    expect(monthKey(2025, 11)).toBe('2025-12');
    expect(dateKey(2026, 0, 1)).toBe('2026-01-01');
    expect(toDateKey(parseDateKey('2026-01-01'))).toBe('2026-01-01');
  });

  test.each([
    ['2020-12-31', 2020, 53],
    ['2021-01-01', 2020, 53],
    ['2021-01-04', 2021, 1],
    ['2024-12-30', 2025, 1],
    ['2025-12-29', 2026, 1],
  ])('assigns %s to ISO %i-W%i', (key, year, week) => {
    const date = parseDateKey(key);
    expect(isoWeekYear(date)).toBe(year);
    expect(isoWeek(date)).toBe(week);
  });
});
