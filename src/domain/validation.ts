import type { Allowance, AppState, BillingRecord, Employment, WorkDay } from './model';

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
  if (!Number.isInteger(day.pause) || day.pause < 0) return 'Pause: Bitte eine ganze, nicht negative Minutenzahl eingeben.';
  const gross = (end - start + 1440) % 1440;
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
