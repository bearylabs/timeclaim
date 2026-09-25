import type { DayCalculation, WorkDay } from './model';
import { parseHoursInput, timeToMinutes, workDayError } from './validation';

export { parseNumber } from './validation';

export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export const pad = (value: number) => String(value).padStart(2, '0');
export const monthKey = (year: number, month: number) => `${year}-${pad(month + 1)}`;
export const dateKey = (year: number, month: number, day: number) => `${monthKey(year, month)}-${pad(day)}`;
export const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
export const parseDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
export const toDateKey = (date: Date) => dateKey(date.getFullYear(), date.getMonth(), date.getDate());

export const toMinutes = timeToMinutes;

export function calculateDay(day: Pick<WorkDay, 'start' | 'end' | 'pause'>): DayCalculation | null {
  const completeDay: WorkDay = { ...day, note: '' };
  if (workDayError('2000-01-01', completeDay)) return null;
  const start = timeToMinutes(day.start)!;
  const end = timeToMinutes(day.end)!;
  const elapsed = (end - start + 1440) % 1440;
  return { elapsed, pause: day.pause, net: elapsed - day.pause, overnight: end < start };
}

export function formatHours(minutes: number) {
  const sign = minutes < 0 ? '−' : '';
  const absolute = Math.abs(Math.round(minutes));
  return `${sign}${Math.floor(absolute / 60)}:${pad(absolute % 60)}`;
}

export function formatDecimal(minutes: number) {
  return (minutes / 60).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatMoney(value: number) {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function formatNumber(value: number) {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

export function parseHours(value: string) {
  return parseHoursInput(value).value;
}

export function isoWeek(date: Date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
