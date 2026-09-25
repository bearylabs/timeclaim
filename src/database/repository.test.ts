import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from './database';
import { replaceState, saveDay } from './repository';
import type { AppState } from '@/domain/model';

jest.mock('./database', () => ({ getDatabase: jest.fn() }));
const mockedGetDatabase = jest.mocked(getDatabase);

const state: AppState = {
  version: 1,
  activeEmploymentId: 'job',
  employments: [{
    id: 'job', name: 'Job', color: 0,
    days: { '2025-01-01': { start: '08:00', end: '16:30', pause: 30, note: '' } },
    allowances: [{ id: 'a', date: '2025-01-01', label: 'Bonus', quantity: 1, amount: 12.5 }],
    billing: { '2025-01': { hours: '8', allowances: { Bonus: { quantity: '1', amount: '12,50' } } } },
  }],
};

function transactionalDatabase(failAt?: number) {
  const committed: { sql: string; args: unknown[] }[] = [{ sql: 'existing data', args: [] }];
  let calls = 0;
  const db = {
    withExclusiveTransactionAsync: jest.fn(async (callback: (tx: { runAsync: (sql: string, ...args: unknown[]) => Promise<void> }) => Promise<void>) => {
      const staged: { sql: string; args: unknown[] }[] = [];
      const tx = {
        runAsync: async (sql: string, ...args: unknown[]) => {
          calls += 1;
          if (calls === failAt) throw new Error('simulated write failure');
          staged.push({ sql, args });
        },
      };
      await callback(tx);
      committed.splice(0, committed.length, ...staged);
    }),
  } as unknown as SQLiteDatabase;
  return { db, committed };
}

describe('atomic repository writes', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('replaces all state in one exclusive transaction', async () => {
    const { db, committed } = transactionalDatabase();
    mockedGetDatabase.mockResolvedValue(db);
    await replaceState(state);
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(committed.some(({ sql }) => sql.includes('DELETE FROM employments'))).toBe(true);
    expect(committed.some(({ sql }) => sql.includes('INSERT INTO employments'))).toBe(true);
    expect(committed.some(({ sql }) => sql.includes('INSERT INTO work_days'))).toBe(true);
    expect(committed.some(({ sql }) => sql.includes('INSERT INTO allowances'))).toBe(true);
    expect(committed.some(({ sql }) => sql.includes('INSERT INTO billing_records'))).toBe(true);
  });

  test('does not commit a partial restore after a write failure', async () => {
    const { db, committed } = transactionalDatabase(4);
    mockedGetDatabase.mockResolvedValue(db);
    await expect(replaceState(state)).rejects.toThrow('simulated write failure');
    expect(committed).toEqual([{ sql: 'existing data', args: [] }]);
  });

  test('validates a day before opening a transaction', async () => {
    const { db } = transactionalDatabase();
    mockedGetDatabase.mockResolvedValue(db);
    await expect(saveDay('job', '2025-01-01', '2025-02-30', null, [])).rejects.toThrow(/existiert nicht/);
    expect(mockedGetDatabase).not.toHaveBeenCalled();
  });
});
