import type { Allowance, AppState, BilledAllowance, BillingRecord, Employment, WorkDay } from './model';

export const INPUT_LIMITS = {
  id: 120,
  employmentName: 80,
  note: 500,
  allowanceLabel: 80,
  quantity: 10_000,
  amount: 1_000_000,
  billingHours: 744,
  numericText: 24,
  earliestYear: 1900,
  latestYear: 2200,
} as const;

export type ParsedInput<T> = { value: T; error: null } | { value: null; error: string };

export type WorkInterval = {
  elapsed: number;
  clockElapsed: number;
  overnight: boolean;
  startAmbiguous: boolean;
  endAmbiguous: boolean;
  dstAdjustment: number;
};

type LocalDateTime = { year: number; month: number; day: number; hour: number; minute: number };

const WORK_TIME_ZONE = 'Europe/Berlin';
const zonedPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: WORK_TIME_ZONE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function zonedParts(timestamp: number): LocalDateTime & { second: number } {
  const values: Record<string, number> = {};
  for (const part of zonedPartsFormatter.formatToParts(new Date(timestamp))) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second };
}

function possibleInstants(local: LocalDateTime): number[] {
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const offsets = new Set<number>();
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const sample = localAsUtc + hours * 60 * 60 * 1000;
    const parts = zonedParts(sample);
    offsets.add(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - sample);
  }
  const instants: number[] = [];
  for (const offset of offsets) {
    const timestamp = localAsUtc - offset;
    const parts = zonedParts(timestamp);
    if (parts.year === local.year && parts.month === local.month && parts.day === local.day && parts.hour === local.hour && parts.minute === local.minute) {
      instants.push(timestamp);
    }
  }
  return [...new Set(instants)].sort((a, b) => a - b);
}

function nextCalendarDay(local: LocalDateTime): LocalDateTime {
  const next = new Date(Date.UTC(local.year, local.month - 1, local.day + 1));
  return { ...local, year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function resolveWorkInterval(date: string, start: string, end: string): { interval: WorkInterval | null; error: string | null } {
  const [year, month, day] = date.split('-').map(Number);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return { interval: null, error: null };
  const overnight = endMinutes < startMinutes;
  const startLocal: LocalDateTime = { year, month, day, hour: Math.floor(startMinutes / 60), minute: startMinutes % 60 };
  let endLocal: LocalDateTime = { year, month, day, hour: Math.floor(endMinutes / 60), minute: endMinutes % 60 };
  if (overnight) endLocal = nextCalendarDay(endLocal);
  const starts = possibleInstants(startLocal);
  const ends = possibleInstants(endLocal);
  if (!starts.length) return { interval: null, error: 'Beginn: Diese lokale Uhrzeit existiert in Europe/Berlin wegen der Zeitumstellung nicht.' };
  if (!ends.length) return { interval: null, error: 'Ende: Diese lokale Uhrzeit existiert in Europe/Berlin wegen der Zeitumstellung nicht.' };

  // Bei doppelt vorkommenden Uhrzeiten umfasst das Intervall deterministisch die wiederholte Stunde:
  // Beginn = erstes Auftreten, Ende = zweites Auftreten.
  const elapsed = (ends.at(-1)! - starts[0]) / 60_000;
  const clockElapsed = (endMinutes - startMinutes + 1440) % 1440;
  return {
    interval: {
      elapsed, clockElapsed, overnight,
      startAmbiguous: starts.length > 1,
      endAmbiguous: ends.length > 1,
      dstAdjustment: elapsed - clockElapsed,
    },
    error: null,
  };
}

export function getWorkInterval(date: string, start: string, end: string): WorkInterval | null {
  return resolveWorkInterval(date, start, end).interval;
}

const valid = <T>(value: T): ParsedInput<T> => ({ value, error: null });
const invalid = <T>(error: string): ParsedInput<T> => ({ value: null, error });

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

export function calendarDateError(value: string, field = 'Datum'): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return `${field}: Bitte ein gültiges Datum im Format JJJJ-MM-TT eingeben.`;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < INPUT_LIMITS.earliestYear || year > INPUT_LIMITS.latestYear) {
    return `${field}: Das Jahr muss zwischen ${INPUT_LIMITS.earliestYear} und ${INPUT_LIMITS.latestYear} liegen.`;
  }
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? null
    : `${field}: Dieses Kalenderdatum existiert nicht.`;
}

export function calendarMonthError(value: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return 'Abrechnungsmonat: Ungültiges Format.';
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < INPUT_LIMITS.earliestYear || year > INPUT_LIMITS.latestYear || month < 1 || month > 12) {
    return 'Abrechnungsmonat: Ungültiger Kalendermonat.';
  }
  return null;
}

export function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > INPUT_LIMITS.numericText) return null;
  const withoutCurrency = trimmed.replace(/\s*€$/, '').trim();
  let normalized: string;
  if (/^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(withoutCurrency)) {
    normalized = withoutCurrency.replace(/\./g, '').replace(',', '.');
  } else if (/^[+-]?\d+(?:[.,]\d+)?$/.test(withoutCurrency)) {
    normalized = withoutCurrency.replace(',', '.');
  } else {
    return null;
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function decimalPlacesAreValid(value: number, places: number): boolean {
  const factor = 10 ** places;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-7;
}

export function parseQuantityInput(value: string, optional = false, allowZero = false): ParsedInput<number | null> {
  if (!value.trim()) return optional ? valid(null) : invalid('Anzahl: Bitte einen Wert eingeben.');
  const number = parseNumber(value);
  if (number === null) return invalid('Anzahl: Bitte eine vollständige Zahl eingeben (z. B. 1 oder 1,5).');
  if (number < 0 || (!allowZero && number === 0) || number > INPUT_LIMITS.quantity) return invalid(`Anzahl: Der Wert muss ${allowZero ? 'mindestens 0' : 'größer als 0'} und höchstens ${INPUT_LIMITS.quantity.toLocaleString('de-DE')} sein.`);
  if (!decimalPlacesAreValid(number, 3)) return invalid('Anzahl: Höchstens drei Nachkommastellen sind erlaubt.');
  return valid(number);
}

export function parseAmountInput(value: string, optional = true): ParsedInput<number | null> {
  if (!value.trim()) return optional ? valid(null) : invalid('Betrag: Bitte einen Wert eingeben.');
  const number = parseNumber(value);
  if (number === null) return invalid('Betrag: Bitte einen vollständigen Betrag eingeben (z. B. 12,50).');
  if (number < 0 || number > INPUT_LIMITS.amount) return invalid(`Betrag: Der Wert muss zwischen 0 und ${INPUT_LIMITS.amount.toLocaleString('de-DE')} € liegen.`);
  if (!decimalPlacesAreValid(number, 2)) return invalid('Betrag: Höchstens zwei Nachkommastellen sind erlaubt.');
  return valid(number);
}

export function parseHoursInput(value: string, optional = true): ParsedInput<number | null> {
  const trimmed = value.trim();
  if (!trimmed) return optional ? valid(null) : invalid('Stunden: Bitte einen Wert eingeben.');
  if (trimmed.length > INPUT_LIMITS.numericText) return invalid('Stunden: Die Eingabe ist zu lang.');
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(trimmed);
  const decimal = /^\d+(?:[.,]\d{1,2})?$/.test(trimmed) ? Number(trimmed.replace(',', '.')) : null;
  const minutes = clock ? Number(clock[1]) * 60 + Number(clock[2]) : decimal === null ? null : Math.round(decimal * 60);
  if (minutes === null) return invalid('Stunden: Bitte vollständig als Dezimalzahl mit höchstens zwei Nachkommastellen oder als Stunden:Minuten eingeben.');
  if (minutes < 0 || minutes > INPUT_LIMITS.billingHours * 60) return invalid(`Stunden: Der Wert muss zwischen 0 und ${INPUT_LIMITS.billingHours} liegen.`);
  return valid(minutes);
}

export function workDayError(date: string, day: WorkDay): string | null {
  if (!day || typeof day !== 'object' || typeof day.start !== 'string' || typeof day.end !== 'string' || typeof day.pause !== 'number' || typeof day.note !== 'string') return 'Arbeitszeit: Unvollständige oder ungültige Daten.';
  const dateError = calendarDateError(date);
  if (dateError) return dateError;
  const start = timeToMinutes(day.start);
  const end = timeToMinutes(day.end);
  if (start === null) return 'Beginn: Bitte eine gültige Uhrzeit zwischen 00:00 und 23:59 eingeben.';
  if (end === null) return 'Ende: Bitte eine gültige Uhrzeit zwischen 00:00 und 23:59 eingeben.';
  if (start === end) return 'Arbeitszeit: Beginn und Ende müssen unterschiedlich sein.';
  const resolved = resolveWorkInterval(date, day.start, day.end);
  if (resolved.error) return resolved.error;
  if (!Number.isInteger(day.pause) || day.pause < 0) return 'Pause: Bitte eine ganze, nicht negative Minutenzahl eingeben.';
  const gross = resolved.interval!.elapsed;
  if (day.pause >= gross) return `Pause: Sie muss kürzer als die Bruttozeit von ${gross} Minuten sein.`;
  if (day.note.length > INPUT_LIMITS.note) return `Notiz: Maximal ${INPUT_LIMITS.note} Zeichen sind erlaubt.`;
  return null;
}

export function allowanceError(allowance: Allowance): string | null {
  if (!allowance || typeof allowance !== 'object' || typeof allowance.id !== 'string' || typeof allowance.date !== 'string' || typeof allowance.label !== 'string' || typeof allowance.quantity !== 'number' || (allowance.amount !== null && typeof allowance.amount !== 'number')) return 'Zulage: Unvollständige oder ungültige Daten.';
  const dateError = calendarDateError(allowance.date);
  if (dateError) return dateError;
  if (!allowance.id || allowance.id.length > INPUT_LIMITS.id) return 'Zulage: Ungültige Kennung.';
  const label = allowance.label.trim();
  if (!label) return 'Bezeichnung: Bitte einen Namen eingeben.';
  if (label.length > INPUT_LIMITS.allowanceLabel) return `Bezeichnung: Maximal ${INPUT_LIMITS.allowanceLabel} Zeichen sind erlaubt.`;
  if (!Number.isFinite(allowance.quantity) || allowance.quantity <= 0 || allowance.quantity > INPUT_LIMITS.quantity || !decimalPlacesAreValid(allowance.quantity, 3)) return 'Anzahl: Ungültiger oder zu großer Wert.';
  if (allowance.amount !== null && (!Number.isFinite(allowance.amount) || allowance.amount < 0 || allowance.amount > INPUT_LIMITS.amount || !decimalPlacesAreValid(allowance.amount, 2))) return 'Betrag: Ungültiger oder zu großer Wert.';
  return null;
}

export function billingError(month: string, billing: BillingRecord): string | null {
  if (!billing || typeof billing !== 'object' || typeof billing.hours !== 'string' || !billing.allowances || typeof billing.allowances !== 'object' || Array.isArray(billing.allowances)) return 'Abrechnung: Unvollständige oder ungültige Daten.';
  const monthError = calendarMonthError(month);
  if (monthError) return monthError;
  const hours = parseHoursInput(billing.hours);
  if (hours.error) return `Abrechnung – ${hours.error}`;
  for (const [rawLabel, allowance] of Object.entries(billing.allowances)) {
    if (!allowance || typeof allowance !== 'object' || typeof allowance.quantity !== 'string' || typeof allowance.amount !== 'string') return `Abrechnung „${rawLabel}“: Unvollständige Daten.`;
    const label = rawLabel.trim();
    if (!label || label.length > INPUT_LIMITS.allowanceLabel) return `Abrechnung: Eine Positionsbezeichnung ist leer oder länger als ${INPUT_LIMITS.allowanceLabel} Zeichen.`;
    const quantity = parseQuantityInput(allowance.quantity, true, true);
    if (quantity.error) return `Abrechnung „${label}“ – ${quantity.error}`;
    const amount = parseAmountInput(allowance.amount, true);
    if (amount.error) return `Abrechnung „${label}“ – ${amount.error}`;
  }
  return null;
}

export function employmentError(employment: Employment): string | null {
  if (!employment || typeof employment !== 'object' || typeof employment.id !== 'string' || typeof employment.name !== 'string' || typeof employment.color !== 'number') return 'Arbeitsverhältnis: Unvollständige oder ungültige Daten.';
  if (!employment.id || employment.id.length > INPUT_LIMITS.id) return 'Arbeitsverhältnis: Ungültige Kennung.';
  const name = employment.name.trim();
  if (!name || name.length > INPUT_LIMITS.employmentName) return `Arbeitsverhältnis: Der Name muss 1 bis ${INPUT_LIMITS.employmentName} Zeichen lang sein.`;
  if (!Number.isInteger(employment.color) || employment.color < 0 || employment.color > 3) return 'Arbeitsverhältnis: Ungültige Farbe.';
  if (!employment.days || typeof employment.days !== 'object' || Array.isArray(employment.days) || !Array.isArray(employment.allowances) || !employment.billing || typeof employment.billing !== 'object' || Array.isArray(employment.billing)) return 'Arbeitsverhältnis: Einträge haben ein ungültiges Format.';
  for (const [date, day] of Object.entries(employment.days)) {
    if (!day || typeof day !== 'object') return `Arbeitstag ${date}: Ungültige Daten.`;
    const error = workDayError(date, day);
    if (error) return error;
  }
  for (const allowance of employment.allowances) {
    const error = allowanceError(allowance);
    if (error) return error;
  }
  for (const [month, billing] of Object.entries(employment.billing)) {
    const error = billingError(month, billing);
    if (error) return error;
  }
  return null;
}

export function appStateError(state: AppState): string | null {
  if (!state || typeof state !== 'object' || state.version !== 1 || !Array.isArray(state.employments) || state.employments.length === 0 || typeof state.activeEmploymentId !== 'string') return 'Die Sicherung enthält keinen gültigen TimeClaim-Zustand.';
  const ids = new Set<string>();
  const allowanceIds = new Set<string>();
  for (const employment of state.employments) {
    const error = employmentError(employment);
    if (error) return error;
    if (ids.has(employment.id)) return 'Die Sicherung enthält doppelte Arbeitsverhältnis-Kennungen.';
    ids.add(employment.id);
    for (const allowance of employment.allowances) {
      if (allowanceIds.has(allowance.id)) return 'Die Sicherung enthält doppelte Zulagen-Kennungen.';
      allowanceIds.add(allowance.id);
    }
  }
  return ids.has(state.activeEmploymentId) ? null : 'Das aktive Arbeitsverhältnis ist ungültig.';
}

export function assertValid(error: string | null): asserts error is null {
  if (error) throw new Error(error);
}

export const MAX_BACKUP_LENGTH = 5_000_000;

const COLLECTION_LIMITS = {
  employments: 100,
  workDays: 50_000,
  allowances: 50_000,
  billingRecords: 12_000,
  billingAllowances: 50_000,
} as const;

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

function invalidBackup(path: string, message: string): never {
  throw new BackupValidationError(`${path}: ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalidBackup(path, 'muss ein Objekt sein.');
  }
  return value as Record<string, unknown>;
}

function fields(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedFields = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedFields.has(key));
  if (unknown !== undefined) invalidBackup(`${path}.${unknown}`, 'ist kein unterstütztes Feld.');
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== 'string') invalidBackup(path, 'muss Text sein.');
  if (value.includes('\0')) invalidBackup(path, 'darf kein Nullzeichen enthalten.');
  return value;
}

function numberValue(value: unknown, path: string): number {
  if (typeof value !== 'number') invalidBackup(path, 'muss eine Zahl sein.');
  return value;
}

function demoValue(value: unknown, path: string): boolean {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') invalidBackup(path, 'muss true oder false sein.');
  return value;
}

function validateWorkDay(value: unknown, path: string): WorkDay {
  const item = record(value, path);
  fields(item, ['start', 'end', 'pause', 'note', 'demo'], path);
  const start = stringValue(item.start, `${path}.start`);
  const end = stringValue(item.end, `${path}.end`);
  const pause = numberValue(item.pause, `${path}.pause`);
  const note = stringValue(item.note, `${path}.note`);
  const demo = demoValue(item.demo, `${path}.demo`);
  return { start, end, pause, note, ...(demo ? { demo: true } : {}) };
}

function validateAllowance(value: unknown, path: string): Allowance {
  const item = record(value, path);
  fields(item, ['id', 'date', 'label', 'quantity', 'amount', 'demo'], path);
  const id = stringValue(item.id, `${path}.id`);
  const date = stringValue(item.date, `${path}.date`);
  const label = stringValue(item.label, `${path}.label`);
  const quantity = numberValue(item.quantity, `${path}.quantity`);
  const amount = item.amount === null ? null : numberValue(item.amount, `${path}.amount`);
  const demo = demoValue(item.demo, `${path}.demo`);
  return { id, date, label: label.trim(), quantity, amount, ...(demo ? { demo: true } : {}) };
}

function validateBilledAllowance(value: unknown, path: string): BilledAllowance {
  const item = record(value, path);
  fields(item, ['quantity', 'amount'], path);
  return {
    quantity: stringValue(item.quantity, `${path}.quantity`),
    amount: stringValue(item.amount, `${path}.amount`),
  };
}

function validateBilling(value: unknown, path: string, totals: Totals): BillingRecord {
  const item = record(value, path);
  fields(item, ['hours', 'allowances', 'demo'], path);
  const hours = stringValue(item.hours, `${path}.hours`);
  const rawAllowances = record(item.allowances, `${path}.allowances`);
  const allowanceEntries = Object.entries(rawAllowances);
  totals.billingAllowances += allowanceEntries.length;
  if (totals.billingAllowances > COLLECTION_LIMITS.billingAllowances) {
    invalidBackup(`${path}.allowances`, `enthält insgesamt mehr als ${COLLECTION_LIMITS.billingAllowances} Positionen.`);
  }
  const allowances = Object.fromEntries(allowanceEntries.map(([label, allowance]) => {
    stringValue(label, `${path}.allowances`);
    return [label, validateBilledAllowance(allowance, `${path}.allowances[${JSON.stringify(label)}]`)];
  }));
  const demo = demoValue(item.demo, `${path}.demo`);
  return { hours, allowances, ...(demo ? { demo: true } : {}) };
}

type Totals = { workDays: number; allowances: number; billingRecords: number; billingAllowances: number };

function validateEmployment(value: unknown, index: number, totals: Totals): Employment {
  const path = `employments[${index}]`;
  const item = record(value, path);
  fields(item, ['id', 'name', 'color', 'days', 'allowances', 'billing', 'demo'], path);
  const id = stringValue(item.id, `${path}.id`);
  const name = stringValue(item.name, `${path}.name`);
  const color = numberValue(item.color, `${path}.color`);

  const rawDays = record(item.days, `${path}.days`);
  const dayEntries = Object.entries(rawDays);
  totals.workDays += dayEntries.length;
  if (totals.workDays > COLLECTION_LIMITS.workDays) {
    invalidBackup(`${path}.days`, `enthält insgesamt mehr als ${COLLECTION_LIMITS.workDays} Arbeitstage.`);
  }
  const days = Object.fromEntries(dayEntries.map(([date, day]) => [
    stringValue(date, `${path}.days`),
    validateWorkDay(day, `${path}.days[${JSON.stringify(date)}]`),
  ]));

  if (!Array.isArray(item.allowances)) invalidBackup(`${path}.allowances`, 'muss eine Liste sein.');
  totals.allowances += item.allowances.length;
  if (totals.allowances > COLLECTION_LIMITS.allowances) {
    invalidBackup(`${path}.allowances`, `enthält insgesamt mehr als ${COLLECTION_LIMITS.allowances} Zulagen.`);
  }
  const allowances = item.allowances.map((allowance, allowanceIndex) =>
    validateAllowance(allowance, `${path}.allowances[${allowanceIndex}]`));

  const rawBilling = record(item.billing, `${path}.billing`);
  const billingEntries = Object.entries(rawBilling);
  totals.billingRecords += billingEntries.length;
  if (totals.billingRecords > COLLECTION_LIMITS.billingRecords) {
    invalidBackup(`${path}.billing`, `enthält insgesamt mehr als ${COLLECTION_LIMITS.billingRecords} Monatsabrechnungen.`);
  }
  const billing = Object.fromEntries(billingEntries.map(([month, bill]) => [
    stringValue(month, `${path}.billing`),
    validateBilling(bill, `${path}.billing[${JSON.stringify(month)}]`, totals),
  ]));

  const demo = demoValue(item.demo, `${path}.demo`);
  return { id, name: name.trim(), color, days, allowances, billing, ...(demo ? { demo: true } : {}) };
}

/**
 * Strictly checks the complete v1 wire format and then applies the same domain
 * invariants used by interactive writes, including Europe/Berlin DST rules.
 */
export function normalizeState(input: unknown): AppState {
  const candidate = record(input, 'Sicherung');
  fields(candidate, ['version', 'employments', 'activeEmploymentId'], 'Sicherung');
  if (candidate.version !== 1) invalidBackup('Sicherung.version', 'muss 1 sein. Neuere Sicherungen werden nicht unterstützt.');
  if (!Array.isArray(candidate.employments)) invalidBackup('Sicherung.employments', 'muss eine Liste sein.');
  if (candidate.employments.length === 0) invalidBackup('Sicherung.employments', 'muss mindestens ein Arbeitsverhältnis enthalten.');
  if (candidate.employments.length > COLLECTION_LIMITS.employments) {
    invalidBackup('Sicherung.employments', `darf höchstens ${COLLECTION_LIMITS.employments} Arbeitsverhältnisse enthalten.`);
  }

  const totals: Totals = { workDays: 0, allowances: 0, billingRecords: 0, billingAllowances: 0 };
  const state: AppState = {
    version: 1,
    employments: candidate.employments.map((employment, index) => validateEmployment(employment, index, totals)),
    activeEmploymentId: stringValue(candidate.activeEmploymentId, 'Sicherung.activeEmploymentId'),
  };
  const domainError = appStateError(state);
  if (domainError) invalidBackup('Sicherung', domainError);
  return state;
}

export function parseBackup(text: string): AppState {
  if (text.length > MAX_BACKUP_LENGTH) {
    throw new BackupValidationError(`Die Sicherung ist größer als ${Math.round(MAX_BACKUP_LENGTH / 1_000_000)} MB.`);
  }
  let input: unknown;
  try {
    input = JSON.parse(text) as unknown;
  } catch {
    throw new BackupValidationError('Der Sicherungstext ist kein gültiges JSON.');
  }
  return normalizeState(input);
}
