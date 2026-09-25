import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from '@/database/migrations';

const DATABASE_NAME = 'timeclaim.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function openDatabase(): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync(DATABASE_NAME);
  await database.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
  `);
  await migrateDatabase(database);
  return database;
}

export function getDatabase(): Promise<SQLiteDatabase> {
  databasePromise ??= openDatabase().catch((error) => {
    databasePromise = null;
    throw error;
  });
  return databasePromise;
}
