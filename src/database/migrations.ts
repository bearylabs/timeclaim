import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_VERSION = 1;

type UserVersionRow = {
  user_version: number;
};

const CREATE_SCHEMA_VERSION_1 = `
  CREATE TABLE app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE TABLE employments (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color INTEGER NOT NULL,
    demo INTEGER NOT NULL DEFAULT 0 CHECK (demo IN (0, 1))
  );

  CREATE TABLE work_days (
    employment_id TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    pause_minutes INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    demo INTEGER NOT NULL DEFAULT 0 CHECK (demo IN (0, 1)),
    PRIMARY KEY (employment_id, date),
    FOREIGN KEY (employment_id)
      REFERENCES employments(id) ON DELETE CASCADE
  );

  CREATE TABLE allowances (
    id TEXT PRIMARY KEY NOT NULL,
    employment_id TEXT NOT NULL,
    date TEXT NOT NULL,
    label TEXT NOT NULL,
    quantity REAL NOT NULL,
    amount_cents INTEGER,
    demo INTEGER NOT NULL DEFAULT 0 CHECK (demo IN (0, 1)),
    FOREIGN KEY (employment_id)
      REFERENCES employments(id) ON DELETE CASCADE
  );

  CREATE TABLE billing_records (
    employment_id TEXT NOT NULL,
    month TEXT NOT NULL,
    hours TEXT NOT NULL,
    demo INTEGER NOT NULL DEFAULT 0 CHECK (demo IN (0, 1)),
    PRIMARY KEY (employment_id, month),
    FOREIGN KEY (employment_id)
      REFERENCES employments(id) ON DELETE CASCADE
  );

  CREATE TABLE billing_allowances (
    employment_id TEXT NOT NULL,
    month TEXT NOT NULL,
    label TEXT NOT NULL,
    quantity TEXT NOT NULL,
    amount TEXT NOT NULL,
    PRIMARY KEY (employment_id, month, label),
    FOREIGN KEY (employment_id, month)
      REFERENCES billing_records(employment_id, month) ON DELETE CASCADE
  );

  CREATE INDEX idx_work_days_date
    ON work_days(date);

  CREATE INDEX idx_allowances_employment_date
    ON allowances(employment_id, date);

  CREATE INDEX idx_billing_records_month
    ON billing_records(month);
`;

export async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (!Number.isInteger(version) || version < 0) {
    throw new Error(`Ungültige SQLite-Schemaversion: ${version}`);
  }

  if (version > DATABASE_VERSION) {
    throw new Error(
      `Die SQLite-Schemaversion ${version} ist neuer als die unterstützte Version ${DATABASE_VERSION}.`,
    );
  }

  if (version === 0) {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(CREATE_SCHEMA_VERSION_1);
      await transaction.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
    });
  }
}
