import type { Allowance, AppState, BillingRecord, Employment, WorkDay } from '@/domain/model';

export type EmploymentRow = {
  id: string;
  name: string;
  color: number;
  demo: number;
};

export type WorkDayRow = {
  employment_id: string;
  date: string;
  start_time: string;
  end_time: string;
  pause_minutes: number;
  note: string;
  demo: number;
};

export type AllowanceRow = {
  id: string;
  employment_id: string;
  date: string;
  label: string;
  quantity: number;
  amount_cents: number | null;
  demo: number;
};

export type BillingRecordRow = {
  employment_id: string;
  month: string;
  hours: string;
  demo: number;
};

export type BillingAllowanceRow = {
  employment_id: string;
  month: string;
  label: string;
  quantity: string;
  amount: string;
};

export function booleanToInteger(value: boolean | undefined): number {
  return value ? 1 : 0;
}

export function amountToCents(amount: number | null): number | null {
  if (amount === null) return null;
  if (!Number.isFinite(amount)) throw new Error('Der Zulagenbetrag muss eine endliche Zahl sein.');
  return Math.round(amount * 100);
}

export function rowToWorkDay(row: WorkDayRow): WorkDay {
  return {
    start: row.start_time,
    end: row.end_time,
    pause: row.pause_minutes,
    note: row.note,
    ...(row.demo ? { demo: true } : {}),
  };
}

export function rowToAllowance(row: AllowanceRow): Allowance {
  return {
    id: row.id,
    date: row.date,
    label: row.label,
    quantity: row.quantity,
    amount: row.amount_cents === null ? null : row.amount_cents / 100,
    ...(row.demo ? { demo: true } : {}),
  };
}

export function rowsToState(
  employmentRows: EmploymentRow[],
  workDayRows: WorkDayRow[],
  allowanceRows: AllowanceRow[],
  billingRows: BillingRecordRow[],
  billingAllowanceRows: BillingAllowanceRow[],
  activeEmploymentId: string,
): AppState {
  const employments: Employment[] = employmentRows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    days: {},
    allowances: [],
    billing: {},
    ...(row.demo ? { demo: true } : {}),
  }));
  const byId = new Map(employments.map((employment) => [employment.id, employment]));

  for (const row of workDayRows) {
    const employment = byId.get(row.employment_id);
    if (employment) employment.days[row.date] = rowToWorkDay(row);
  }
  for (const row of allowanceRows) {
    byId.get(row.employment_id)?.allowances.push(rowToAllowance(row));
  }
  for (const row of billingRows) {
    const billing: BillingRecord = {
      hours: row.hours,
      allowances: {},
      ...(row.demo ? { demo: true } : {}),
    };
    const employment = byId.get(row.employment_id);
    if (employment) employment.billing[row.month] = billing;
  }
  for (const row of billingAllowanceRows) {
    const billing = byId.get(row.employment_id)?.billing[row.month];
    if (billing) billing.allowances[row.label] = { quantity: row.quantity, amount: row.amount };
  }

  return { version: 1, employments, activeEmploymentId };
}
