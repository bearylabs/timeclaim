import { MAIN_ALLOWANCES, type BilledAllowance, type Employment } from './model';
import { calculateDay, dateKey, daysInMonth, formatHours, formatMoney, formatNumber, isoWeek, isoWeekYear, monthKey, parseDateKey } from './time';
import { parseAmountInput, parseHoursInput, parseQuantityInput } from './validation';

export type MonthDay = {
  date: string;
  day: number;
  weekday: number;
  work: Employment['days'][string] | undefined;
  calculation: ReturnType<typeof calculateDay>;
  allowances: Employment['allowances'];
};

export type MonthInfo = {
  key: string;
  days: MonthDay[];
  net: number;
  worked: number;
  noPause: string[];
  allowances: Employment['allowances'];
};

export type AllowanceTotal = { quantity: number; amount: number; hasAmount: boolean };
export type Comparison = { status: 'ok' | 'bad' | 'idle'; message: string };
export type WeekSummary = { key: string; week: number; year: number; days: MonthDay[]; net: number };

export function getMonthInfo(employment: Employment, year: number, month: number): MonthInfo {
  const key = monthKey(year, month);
  const allowances = employment.allowances.filter((item) => item.date.startsWith(`${key}-`));
  const allowancesByDate = new Map<string, Employment['allowances']>();
  for (const allowance of allowances) {
    const entries = allowancesByDate.get(allowance.date) ?? [];
    entries.push(allowance);
    allowancesByDate.set(allowance.date, entries);
  }

  const days: MonthDay[] = [];
  let net = 0;
  let worked = 0;
  const noPause: string[] = [];
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const date = dateKey(year, month, day);
    const work = employment.days[date];
    const calculation = work ? calculateDay(date, work) : null;
    if (calculation) {
      net += calculation.net;
      worked += 1;
      if (calculation.pause === 0) noPause.push(date);
    }
    days.push({
      date,
      day,
      weekday: parseDateKey(date).getDay(),
      work,
      calculation,
      allowances: allowancesByDate.get(date) ?? [],
    });
  }
  return { key, days, net, worked, noPause, allowances };
}

export function allowanceTotal(info: Pick<MonthInfo, 'allowances'>, label: string): AllowanceTotal {
  const entries = info.allowances.filter((item) => item.label === label);
  return {
    quantity: entries.reduce((sum, item) => sum + item.quantity, 0),
    amount: entries.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    hasAmount: entries.some((item) => item.amount !== null),
  };
}

export function getWeekSummaries(days: readonly MonthDay[]): WeekSummary[] {
  return days.reduce<WeekSummary[]>((groups, day) => {
    const date = parseDateKey(day.date);
    const week = isoWeek(date);
    const year = isoWeekYear(date);
    const key = `${year}-W${String(week).padStart(2, '0')}`;
    const last = groups.at(-1);
    if (!last || last.key !== key) groups.push({ key, week, year, days: [day], net: day.calculation?.net ?? 0 });
    else {
      last.days.push(day);
      last.net += day.calculation?.net ?? 0;
    }
    return groups;
  }, []);
}

export function compareHours(raw: string, ownMinutes: number): Comparison {
  const parsed = parseHoursInput(raw);
  if (parsed.error) return { status: 'bad', message: parsed.error };
  if (parsed.value === null) return { status: 'idle', message: '' };
  const difference = parsed.value - ownMinutes;
  if (Math.abs(difference) <= 1) return { status: 'ok', message: '' };
  return {
    status: 'bad',
    message: `Abrechnung: ${formatHours(Math.abs(difference))} Std ${difference < 0 ? 'weniger' : 'mehr'} als erfasst`,
  };
}

export function compareAllowance(
  info: Pick<MonthInfo, 'allowances'>,
  label: string,
  billed?: BilledAllowance,
): Comparison {
  const own = allowanceTotal(info, label);
  const quantity = parseQuantityInput(billed?.quantity ?? '', true, true);
  const amount = parseAmountInput(billed?.amount ?? '', true);
  const errors = [quantity.error, amount.error].filter((error): error is string => Boolean(error));
  if (errors.length) return { status: 'bad', message: errors.join('\n') };
  if (quantity.value === null && amount.value === null) return { status: 'idle', message: '' };

  const messages: string[] = [];
  if (quantity.value !== null && Math.abs(quantity.value - own.quantity) > 0.001) {
    messages.push(`Anzahl: ${formatNumber(Math.abs(quantity.value - own.quantity))} ${quantity.value < own.quantity ? 'weniger' : 'mehr'} als erfasst`);
  }
  if (amount.value !== null && own.hasAmount && Math.abs(amount.value - own.amount) > 0.004) {
    messages.push(`Betrag: ${formatMoney(Math.abs(amount.value - own.amount))} ${amount.value < own.amount ? 'weniger' : 'mehr'} als erfasst`);
  }
  return { status: messages.length ? 'bad' : 'ok', message: messages.join('\n') };
}

export function getDeviationCount(employment: Employment, info: MonthInfo): number {
  const billing = employment.billing[info.key];
  if (!billing) return 0;
  const labels = [...new Set([
    ...MAIN_ALLOWANCES,
    ...info.allowances.map((item) => item.label),
    ...Object.keys(billing.allowances),
  ])];
  const hourResult = compareHours(billing.hours, info.net);
  return (hourResult.status === 'bad' ? 1 : 0)
    + labels.filter((label) => compareAllowance(info, label, billing.allowances[label]).status === 'bad').length;
}
