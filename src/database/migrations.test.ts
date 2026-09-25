import { describe, expect, jest, test } from '@jest/globals';
import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_VERSION, migrateDatabase } from './migrations';

function database(version: number) {
  const execAsync = jest.fn<(sql: string) => Promise<void>>(async () => undefined);
  const transaction = { execAsync };
  const db = {
    getFirstAsync: jest.fn(async () => ({ user_version: version })),
    withExclusiveTransactionAsync: jest.fn(async (callback: (value: typeof transaction) => Promise<void>) => callback(transaction)),
  } as unknown as SQLiteDatabase;
  return { db, execAsync };
}

describe('database migrations', () => {
  test('creates schema and version atomically for a new database', async () => {
    const { db, execAsync } = database(0);
    await migrateDatabase(db);
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(execAsync.mock.calls[0][0]).toContain('CREATE TABLE employments');
    expect(execAsync.mock.calls[0][0]).toContain('FOREIGN KEY');
    expect(execAsync.mock.calls[1][0]).toBe(`PRAGMA user_version = ${DATABASE_VERSION}`);
  });

  test('leaves a current schema untouched', async () => {
    const { db } = database(DATABASE_VERSION);
    await migrateDatabase(db);
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  test.each([-1, 1.5, DATABASE_VERSION + 1])('rejects unsupported schema version %s', async (version) => {
    const { db } = database(version);
    await expect(migrateDatabase(db)).rejects.toThrow(/Schemaversion/);
  });
});
