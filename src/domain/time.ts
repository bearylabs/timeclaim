import type { DayCalculation, WorkDay } from './model';

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

export function toMinutes(time: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function calculateDay(day: Pick<WorkDay, 'start' | 'end' | 'pause'>): DayCalculation | null {
  const start = toMinutes(day.start);
  const end = toMinutes(day.end);
  if (start === null || end === null || start === end) return null;
  let elapsed = end - start;
  let overnight = false;
  if (elapsed < 0) {
    elapsed += 1440;
    overnight = true;
  }
  const pause = Math.max(0, Math.round(Number(day.pause) || 0));
  return { elapsed, pause, net: Math.max(0, elapsed - pause), overnight };
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

export function parseNumber(value: string) {
  let normalized = value.replace(/[\s€]/g, '');
  if (!normalized) return null;
  if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.');
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : null;
}

export function parseHours(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const clock = /^(-?\d+):(\d{1,2})$/.exec(trimmed);
  if (clock) {
    const sign = clock[1].startsWith('-') ? -1 : 1;
    return Number(clock[1]) * 60 + sign * Number(clock[2]);
  }
  const number = parseNumber(trimmed);
  return number === null ? null : Math.round(number * 60);
}

export function isoWeek(date: Date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
