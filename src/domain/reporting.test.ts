import { describe, expect, test } from '@jest/globals';

import type { Employment } from './model';
import { allowanceTotal, compareAllowance, compareHours, getDeviationCount, getMonthInfo, getWeekSummaries } from './reporting';

function employment(): Employment {
  return {
    id: 'job-1',
    name: 'Job',
    color: 0,
    days: {
      '2024-12-30': { start: '08:00', end: '16:30', pause: 30, note: '' },
      '2024-12-31': { start: '22:00', end: '06:00', pause: 60, note: '' },
      '2025-01-01': { start: '09:00', end: '12:00', pause: 0, note: '' },
      '2025-01-06': { start: '08:00', end: '10:00', pause: 0, note: '' },
    },
    allowances: [
      { id: 'a1', date: '2024-12-30', label: 'Bereitschaft', quantity: 1, amount: 20 },
      { id: 'a2', date: '2024-12-31', label: 'Bereitschaft', quantity: 1.5, amount: null },
      { id: 'a3', date: '2024-12-31', label: 'Einspringen', quantity: 2, amount: 35.5 },
      { id: 'a4', date: '2025-01-01', label: 'Bereitschaft', quantity: 9, amount: 999 },
    ],
    billing: {},
  };
}

describe('month and week totals', () => {
  test('keeps month/year boundaries strict and totals net work', () => {
    const info = getMonthInfo(employment(), 2024, 11);
    expect(info.key).toBe('2024-12');
    expect(info.worked).toBe(2);
    expect(info.net).toBe(900);
    expect(info.allowances).toHaveLength(3);
    expect(info.days.find((day) => day.date === '2024-12-31')?.calculation?.net).toBe(420);
    expect(info.noPause).toEqual([]);
  });

  test('groups ISO weeks with their ISO week-year and sums visible days', () => {
    const january = getMonthInfo(employment(), 2025, 0);
    const recorded = january.days.filter((day) => day.calculation);
    expect(getWeekSummaries(recorded).map(({ key, week, year, net }) => ({ key, week, year, net }))).toEqual([
      { key: '2025-W01', week: 1, year: 2025, net: 180 },
      { key: '2025-W02', week: 2, year: 2025, net: 120 },
    ]);
  });
});

describe('allowances and reconciliation', () => {
  const info = getMonthInfo(employment(), 2024, 11);

  test('totals fractional quantities, amounts, and missing amounts separately', () => {
    expect(allowanceTotal(info, 'Bereitschaft')).toEqual({ quantity: 2.5, amount: 20, hasAmount: true });
    expect(allowanceTotal(info, 'Einspringen')).toEqual({ quantity: 2, amount: 35.5, hasAmount: true });
    expect(allowanceTotal(info, 'Unbekannt')).toEqual({ quantity: 0, amount: 0, hasAmount: false });
  });

  test('distinguishes open, matching, malformed, lower, and higher hour values', () => {
    expect(compareHours('', info.net).status).toBe('idle');
    expect(compareHours('15:00', info.net).status).toBe('ok');
    expect(compareHours('14:59', info.net).status).toBe('ok');
    expect(compareHours('14:58', info.net)).toMatchObject({ status: 'bad', message: expect.stringMatching(/0:02.*weniger/) });
    expect(compareHours('15,50', info.net)).toMatchObject({ status: 'bad', message: expect.stringMatching(/0:30.*mehr/) });
    expect(compareHours('n/a', info.net)).toMatchObject({ status: 'bad', message: expect.stringMatching(/Stunden/) });
  });

  test('distinguishes open positions and quantity/amount deviations', () => {
    expect(compareAllowance(info, 'Bereitschaft')).toEqual({ status: 'idle', message: '' });
    expect(compareAllowance(info, 'Bereitschaft', { quantity: '2,5', amount: '20,00' }).status).toBe('ok');
    expect(compareAllowance(info, 'Bereitschaft', { quantity: '2', amount: '18' })).toMatchObject({
      status: 'bad',
      message: expect.stringMatching(/Anzahl: 0,5 weniger[\s\S]*Betrag: 2,00.*weniger/),
    });
    expect(compareAllowance(info, 'Bereitschaft', { quantity: '3', amount: '21' }).message).toMatch(/mehr/);
    expect(compareAllowance(info, 'Einspringen', { quantity: 'x', amount: '-1' }).message).toMatch(/Anzahl:[\s\S]*Betrag:/);
  });

  test('counts only bad positions, not still-open positions', () => {
    const job = employment();
    job.billing['2024-12'] = {
      hours: '14:58',
      allowances: {
        Bereitschaft: { quantity: '2,5', amount: '20' },
        Einspringen: { quantity: '', amount: '' },
        Bonus: { quantity: '1', amount: '' },
      },
    };
    expect(getDeviationCount(job, info)).toBe(2);
  });
});
