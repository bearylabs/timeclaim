import { describe, expect, test } from '@jest/globals';

import { amountToCents, booleanToInteger, rowsToState } from './mapper';

describe('SQLite mapper', () => {
  test('stores money as integer cents and booleans as integers', () => {
    expect(amountToCents(null)).toBeNull();
    expect(amountToCents(12.345)).toBe(1235);
    expect(() => amountToCents(Number.NaN)).toThrow(/endliche Zahl/);
    expect(booleanToInteger(true)).toBe(1);
    expect(booleanToInteger(undefined)).toBe(0);
  });

  test('reconstructs a complete state and ignores orphan rows', () => {
    const result = rowsToState(
      [{ id: 'job', name: 'Job', color: 2, demo: 1 }],
      [
        { employment_id: 'job', date: '2025-01-02', start_time: '08:00', end_time: '16:00', pause_minutes: 30, note: 'x', demo: 0 },
        { employment_id: 'missing', date: '2025-01-03', start_time: '08:00', end_time: '09:00', pause_minutes: 0, note: '', demo: 0 },
      ],
      [{ id: 'a', employment_id: 'job', date: '2025-01-02', label: 'Bonus', quantity: 1.5, amount_cents: 1250, demo: 1 }],
      [{ employment_id: 'job', month: '2025-01', hours: '7,50', demo: 0 }],
      [{ employment_id: 'job', month: '2025-01', label: 'Bonus', quantity: '1,5', amount: '12,50' }],
      'job',
    );
    expect(result).toEqual({
      version: 1,
      activeEmploymentId: 'job',
      employments: [{
        id: 'job', name: 'Job', color: 2, demo: true,
        days: { '2025-01-02': { start: '08:00', end: '16:00', pause: 30, note: 'x' } },
        allowances: [{ id: 'a', date: '2025-01-02', label: 'Bonus', quantity: 1.5, amount: 12.5, demo: true }],
        billing: { '2025-01': { hours: '7,50', allowances: { Bonus: { quantity: '1,5', amount: '12,50' } } } },
      }],
    });
  });
});
