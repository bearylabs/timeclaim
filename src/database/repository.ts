import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/database/database';
import {
  amountToCents,
  booleanToInteger,
  rowsToState,
  type AllowanceRow,
  type BillingAllowanceRow,
  type BillingRecordRow,
  type EmploymentRow,
  type WorkDayRow,
} from '@/database/mapper';
import {
  MAIN_ALLOWANCES,
  type Allowance,
  type AppState,
  type BillingRecord,
  type Employment,
  type WorkDay,
} from '@/domain/model';

const ACTIVE_EMPLOYMENT_KEY = 'active_employment_id';

export type EmploymentPatch = Partial<Pick<Employment, 'name' | 'color' | 'demo'>>;

type SettingRow = { value: string };
type IdRow = { id: string };

async function setSetting(database: SQLiteDatabase, key: string, value: string): Promise<void> {
  await database.runAsync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

async function insertEmploymentRow(database: SQLiteDatabase, employment: Employment): Promise<void> {
  await database.runAsync(
    'INSERT INTO employments (id, name, color, demo) VALUES (?, ?, ?, ?)',
    employment.id,
    employment.name,
    employment.color,
    booleanToInteger(employment.demo),
  );
}

async function insertWorkDay(
  database: SQLiteDatabase,
  employmentId: string,
  date: string,
  workDay: WorkDay,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO work_days
       (employment_id, date, start_time, end_time, pause_minutes, note, demo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    employmentId,
    date,
    workDay.start,
    workDay.end,
    workDay.pause,
    workDay.note,
    booleanToInteger(workDay.demo),
  );
}

async function insertAllowance(
  database: SQLiteDatabase,
  employmentId: string,
  allowance: Allowance,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO allowances
       (id, employment_id, date, label, quantity, amount_cents, demo)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    allowance.id,
    employmentId,
    allowance.date,
    allowance.label,
    allowance.quantity,
    amountToCents(allowance.amount),
    booleanToInteger(allowance.demo),
  );
}

async function insertBilling(
  database: SQLiteDatabase,
  employmentId: string,
  month: string,
  billing: BillingRecord,
): Promise<void> {
  await database.runAsync(
    'INSERT INTO billing_records (employment_id, month, hours, demo) VALUES (?, ?, ?, ?)',
    employmentId,
    month,
    billing.hours,
    booleanToInteger(billing.demo),
  );
  for (const [label, allowance] of Object.entries(billing.allowances)) {
    await database.runAsync(
      `INSERT INTO billing_allowances
         (employment_id, month, label, quantity, amount)
       VALUES (?, ?, ?, ?, ?)`,
      employmentId,
      month,
      label,
      allowance.quantity,
      allowance.amount,
    );
  }
}

async function insertEmployment(database: SQLiteDatabase, employment: Employment): Promise<void> {
  await insertEmploymentRow(database, employment);
  for (const [date, workDay] of Object.entries(employment.days)) {
    await insertWorkDay(database, employment.id, date, workDay);
  }
  for (const allowance of employment.allowances) {
    await insertAllowance(database, employment.id, allowance);
  }
  for (const [month, billing] of Object.entries(employment.billing)) {
    await insertBilling(database, employment.id, month, billing);
  }
}

async function repairActiveEmployment(database: SQLiteDatabase): Promise<string | null> {
  const setting = await database.getFirstAsync<SettingRow>(
    'SELECT value FROM app_settings WHERE key = ?',
    ACTIVE_EMPLOYMENT_KEY,
  );
  if (setting) {
    const active = await database.getFirstAsync<IdRow>(
      'SELECT id FROM employments WHERE id = ?',
      setting.value,
    );
    if (active) return active.id;
  }

  const first = await database.getFirstAsync<IdRow>('SELECT id FROM employments ORDER BY rowid LIMIT 1');
  if (first) await setSetting(database, ACTIVE_EMPLOYMENT_KEY, first.id);
  else await database.runAsync('DELETE FROM app_settings WHERE key = ?', ACTIVE_EMPLOYMENT_KEY);
  return first?.id ?? null;
}

export async function loadState(): Promise<AppState | null> {
  const database = await getDatabase();
  const employmentRows = await database.getAllAsync<EmploymentRow>('SELECT * FROM employments ORDER BY rowid');
  if (employmentRows.length === 0) {
    await repairActiveEmployment(database);
    return null;
  }

  const workDayRows = await database.getAllAsync<WorkDayRow>(
    'SELECT * FROM work_days ORDER BY employment_id, date',
  );
  const allowanceRows = await database.getAllAsync<AllowanceRow>(
    'SELECT * FROM allowances ORDER BY employment_id, date, rowid',
  );
  const billingRows = await database.getAllAsync<BillingRecordRow>(
    'SELECT * FROM billing_records ORDER BY employment_id, month',
  );
  const billingAllowanceRows = await database.getAllAsync<BillingAllowanceRow>(
    'SELECT * FROM billing_allowances ORDER BY employment_id, month, rowid',
  );
  const activeEmploymentId = await repairActiveEmployment(database);

  return rowsToState(
    employmentRows,
    workDayRows,
    allowanceRows,
    billingRows,
    billingAllowanceRows,
    activeEmploymentId ?? employmentRows[0].id,
  );
}

export async function createEmployment(employment: Employment): Promise<void> {
  const database = await getDatabase();
  await insertEmploymentRow(database, employment);
}

export async function restoreEmployment(employment: Employment): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await insertEmployment(transaction, employment);
  });
}

export async function updateEmployment(id: string, patch: EmploymentPatch): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (patch.name !== undefined) {
      await transaction.runAsync('UPDATE employments SET name = ? WHERE id = ?', patch.name, id);
    }
    if (patch.color !== undefined) {
      await transaction.runAsync('UPDATE employments SET color = ? WHERE id = ?', patch.color, id);
    }
    if (patch.demo !== undefined) {
      await transaction.runAsync(
        'UPDATE employments SET demo = ? WHERE id = ?',
        booleanToInteger(patch.demo),
        id,
      );
    }
  });
}

export async function deleteEmployment(id: string): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM employments WHERE id = ?', id);
    await repairActiveEmployment(transaction);
  });
}

export async function setActiveEmployment(id: string): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const employment = await transaction.getFirstAsync<IdRow>('SELECT id FROM employments WHERE id = ?', id);
    if (!employment) throw new Error('Das Arbeitsverhältnis wurde nicht gefunden.');
    await setSetting(transaction, ACTIVE_EMPLOYMENT_KEY, id);
  });
}

/**
 * Replaces a day and its two managed allowances (Bereitschaft and Einspringen)
 * atomically. A move to an occupied target date fails instead of overwriting it.
 */
export async function saveDay(
  employmentId: string,
  oldDate: string,
  newDate: string,
  workDay: WorkDay | null,
  managedAllowances: readonly Allowance[],
): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      'DELETE FROM allowances WHERE employment_id = ? AND date = ? AND label IN (?, ?)',
      employmentId,
      oldDate,
      MAIN_ALLOWANCES[0],
      MAIN_ALLOWANCES[1],
    );
    await transaction.runAsync(
      'DELETE FROM work_days WHERE employment_id = ? AND date = ?',
      employmentId,
      oldDate,
    );

    if (workDay) await insertWorkDay(transaction, employmentId, newDate, workDay);
    for (const allowance of managedAllowances) {
      if (!MAIN_ALLOWANCES.includes(allowance.label as (typeof MAIN_ALLOWANCES)[number])) {
        throw new Error(`„${allowance.label}“ ist keine verwaltete Zulage.`);
      }
      await insertAllowance(transaction, employmentId, { ...allowance, date: newDate });
    }
  });
}

export async function deleteDay(employmentId: string, date: string): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM allowances WHERE employment_id = ? AND date = ?', employmentId, date);
    await transaction.runAsync('DELETE FROM work_days WHERE employment_id = ? AND date = ?', employmentId, date);
  });
}

export async function restoreDay(
  employmentId: string,
  date: string,
  workDay: WorkDay | undefined,
  allowances: readonly Allowance[],
): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (workDay) await insertWorkDay(transaction, employmentId, date, workDay);
    for (const allowance of allowances) {
      await insertAllowance(transaction, employmentId, allowance);
    }
  });
}

export async function saveAllowance(employmentId: string, allowance: Allowance): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO allowances
       (id, employment_id, date, label, quantity, amount_cents, demo)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       employment_id = excluded.employment_id,
       date = excluded.date,
       label = excluded.label,
       quantity = excluded.quantity,
       amount_cents = excluded.amount_cents,
       demo = excluded.demo`,
    allowance.id,
    employmentId,
    allowance.date,
    allowance.label,
    allowance.quantity,
    amountToCents(allowance.amount),
    booleanToInteger(allowance.demo),
  );
}

export async function deleteAllowance(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM allowances WHERE id = ?', id);
}

export async function saveBilling(
  employmentId: string,
  month: string,
  billing: BillingRecord,
): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      'DELETE FROM billing_records WHERE employment_id = ? AND month = ?',
      employmentId,
      month,
    );
    await insertBilling(transaction, employmentId, month, billing);
  });
}

export async function clearDemoData(): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM work_days WHERE demo = 1');
    await transaction.runAsync('DELETE FROM allowances WHERE demo = 1');
    await transaction.runAsync('DELETE FROM billing_records WHERE demo = 1');
    await transaction.runAsync('DELETE FROM employments WHERE demo = 1');
    await repairActiveEmployment(transaction);
  });
}

export async function replaceState(state: AppState): Promise<void> {
  if (state.employments.length === 0) throw new Error('Der Zustand enthält kein Arbeitsverhältnis.');
  if (!state.employments.some((employment) => employment.id === state.activeEmploymentId)) {
    throw new Error('Das aktive Arbeitsverhältnis ist ungültig.');
  }

  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM employments');
    await transaction.runAsync('DELETE FROM app_settings WHERE key = ?', ACTIVE_EMPLOYMENT_KEY);
    for (const employment of state.employments) await insertEmployment(transaction, employment);
    await setSetting(transaction, ACTIVE_EMPLOYMENT_KEY, state.activeEmploymentId);
  });
}

/** Deletes all domain data. Passing an employment creates the post-wipe default atomically. */
export async function clearAll(defaultEmployment?: Employment): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM employments');
    await transaction.runAsync('DELETE FROM app_settings WHERE key = ?', ACTIVE_EMPLOYMENT_KEY);
    if (defaultEmployment) {
      await insertEmployment(transaction, defaultEmployment);
      await setSetting(transaction, ACTIVE_EMPLOYMENT_KEY, defaultEmployment.id);
    }
  });
}
