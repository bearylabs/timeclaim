import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import * as repository from '@/database/repository';
import type { Allowance, AppState, BillingRecord, Employment, WorkDay } from '@/domain/model';
import { calculateDay, dateKey, formatDecimal, monthKey } from '@/domain/time';

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function newEmployment(name = 'Hauptjob', color = 0): Employment {
  return { id: uid(), name, color, days: {}, allowances: [], billing: {} };
}

function seedEmployment(employment: Employment, year: number, month: number, scale: number) {
  const today = new Date();
  const limit = Math.min(new Date(year, month + 1, 0).getDate(), Math.max(today.getDate(), 14));
  const patterns: [string, string, number][] = [
    ['07:00', '15:30', 30], ['06:45', '15:15', 30], ['07:00', '15:30', 0],
    ['07:00', '16:00', 30], ['08:00', '17:15', 45],
  ];
  let index = 0;
  let saturday = 0;
  let net = 0;
  const totals: Record<string, { quantity: number; amount: number }> = {
    Bereitschaft: { quantity: 0, amount: 0 }, Einspringen: { quantity: 0, amount: 0 },
  };
  const addAllowance = (date: string, label: string, amount: number) => {
    employment.allowances.push({ id: uid(), date, label, quantity: 1, amount, demo: true });
    totals[label].quantity += 1;
    totals[label].amount += amount;
  };
  for (let day = 1; day <= limit; day += 1) {
    const weekday = new Date(year, month, day).getDay();
    const key = dateKey(year, month, day);
    if (weekday === 0 || weekday === 6) {
      if (scale === 1 && weekday === 6 && saturday < 2) {
        addAllowance(key, 'Bereitschaft', 85);
        saturday += 1;
      }
      continue;
    }
    if (scale === 1 && index === 5) {
      addAllowance(key, 'Bereitschaft', 45);
      index += 1;
      continue;
    }
    if (scale === 2 && index % 4 !== 1) {
      index += 1;
      continue;
    }
    const pattern = scale === 2 ? ['17:30', '21:00', 0] as [string, string, number]
      : index % 7 === 2 ? patterns[2]
      : index % 5 === 4 ? patterns[4]
      : index % 4 === 1 ? patterns[1]
      : index % 6 === 3 ? patterns[3]
      : patterns[0];
    employment.days[key] = { start: pattern[0], end: pattern[1], pause: pattern[2], note: '', demo: true };
    net += calculateDay(employment.days[key])?.net ?? 0;
    if (scale === 1 && index === 8) addAllowance(key, 'Einspringen', 40);
    index += 1;
  }
  const allowances: Record<string, { quantity: string; amount: string }> = {};
  Object.entries(totals).forEach(([label, total]) => {
    if (total.quantity) allowances[label] = { quantity: String(total.quantity), amount: total.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 }) };
  });
  employment.billing[monthKey(year, month)] = {
    hours: formatDecimal(net - (scale === 1 ? 30 : 0)), allowances, demo: true,
  };
}

function createInitialState(): AppState {
  const now = new Date();
  const main = newEmployment('Hauptjob', 0);
  main.demo = true;
  seedEmployment(main, now.getFullYear(), now.getMonth(), 1);
  const side = newEmployment('Nebenjob', 2);
  side.demo = true;
  seedEmployment(side, now.getFullYear(), now.getMonth(), 2);
  return { version: 1, employments: [main, side], activeEmploymentId: main.id };
}

export function normalizeState(input: unknown): AppState | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<AppState>;
  if (!Array.isArray(candidate.employments) || candidate.employments.length === 0) return null;
  const employments = candidate.employments.filter(Boolean).map((raw, index) => {
    const item = raw as Employment;
    return {
      id: typeof item.id === 'string' && item.id ? item.id : uid(),
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Job',
      color: Math.max(0, Math.min(3, Math.round(Number(item.color) || index % 4))),
      days: item.days && typeof item.days === 'object' ? item.days : {},
      allowances: Array.isArray(item.allowances) ? item.allowances : [],
      billing: item.billing && typeof item.billing === 'object' ? item.billing : {},
      demo: Boolean(item.demo),
    } as Employment;
  });
  const active = employments.some((item) => item.id === candidate.activeEmploymentId)
    ? candidate.activeEmploymentId as string : employments[0].id;
  return { version: 1, employments, activeEmploymentId: active };
}

type StoreValue = {
  state: AppState;
  hydrated: boolean;
  error: string | null;
  activeEmployment: Employment;
  setActiveEmployment: (id: string) => Promise<void>;
  addEmployment: (name: string, color: number) => Promise<Employment>;
  changeEmployment: (id: string, patch: repository.EmploymentPatch) => Promise<void>;
  deleteEmployment: (id: string) => Promise<void>;
  restoreEmployment: (employment: Employment, makeActive?: boolean) => Promise<void>;
  saveDay: (oldDate: string, newDate: string, work: WorkDay | null, managedAllowances: readonly Allowance[]) => Promise<void>;
  deleteDay: (date: string) => Promise<void>;
  restoreDay: (employmentId: string, date: string, work: WorkDay | undefined, allowances: readonly Allowance[]) => Promise<void>;
  saveAllowance: (allowance: Allowance) => Promise<void>;
  deleteAllowance: (id: string) => Promise<void>;
  restoreAllowance: (employmentId: string, allowance: Allowance) => Promise<void>;
  saveBilling: (month: string, billing: BillingRecord) => Promise<void>;
  clearDemo: () => Promise<void>;
  loadBackupState: () => Promise<AppState>;
  replace: (next: AppState) => Promise<void>;
  wipe: () => Promise<void>;
  hasDemo: boolean;
};

const StoreContext = createContext<StoreValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Die lokale Datenbank konnte nicht geladen werden.';
}

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(createInitialState);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      try {
        await repository.initializeState(state);
        let loaded = await repository.loadState();
        if (!loaded) {
          const employment = newEmployment();
          await repository.clearAll(employment);
          loaded = await repository.loadState();
        }
        if (!loaded) throw new Error('Die lokale Datenbank enthält kein Arbeitsverhältnis.');
        if (mounted) {
          setState(loaded);
          setHydrated(true);
        }
      } catch (reason: unknown) {
        console.error('SQLite database could not be initialized.', reason);
        if (mounted) setError(errorMessage(reason));
      }
    };
    void initialize();
    return () => { mounted = false; };
    // The initial demo state must be captured exactly once for first-run seeding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = async () => {
    const loaded = await repository.loadState();
    if (!loaded) throw new Error('Die lokale Datenbank enthält kein Arbeitsverhältnis.');
    setState(loaded);
  };

  const setActiveEmployment = async (id: string) => {
    await repository.setActiveEmployment(id);
    await reload();
  };

  const addEmployment = async (name: string, color: number) => {
    const employment = newEmployment(name, color);
    await repository.createEmployment(employment, true);
    await reload();
    return employment;
  };

  const changeEmployment = async (id: string, patch: repository.EmploymentPatch) => {
    await repository.updateEmployment(id, patch);
    await reload();
  };

  const deleteEmployment = async (id: string) => {
    if (state.employments.length <= 1) throw new Error('Das letzte Arbeitsverhältnis kann nicht gelöscht werden.');
    await repository.deleteEmployment(id);
    await reload();
  };

  const restoreEmployment = async (employment: Employment, makeActive = false) => {
    await repository.restoreEmployment(employment, makeActive);
    await reload();
  };

  const saveDay = async (
    oldDate: string,
    newDate: string,
    work: WorkDay | null,
    managedAllowances: readonly Allowance[],
  ) => {
    await repository.saveDay(state.activeEmploymentId, oldDate, newDate, work, managedAllowances);
    await reload();
  };

  const deleteDay = async (date: string) => {
    await repository.deleteDay(state.activeEmploymentId, date);
    await reload();
  };

  const restoreDay = async (employmentId: string, date: string, work: WorkDay | undefined, allowances: readonly Allowance[]) => {
    await repository.restoreDay(employmentId, date, work, allowances);
    await reload();
  };

  const saveAllowance = async (allowance: Allowance) => {
    await repository.saveAllowance(state.activeEmploymentId, allowance);
    await reload();
  };

  const deleteAllowance = async (id: string) => {
    await repository.deleteAllowance(id);
    await reload();
  };

  const restoreAllowance = async (employmentId: string, allowance: Allowance) => {
    await repository.saveAllowance(employmentId, allowance);
    await reload();
  };

  const saveBilling = async (month: string, billing: BillingRecord) => {
    await repository.saveBilling(state.activeEmploymentId, month, billing);
    await reload();
  };

  const clearDemo = async () => {
    await repository.clearDemoData(newEmployment());
    await reload();
  };

  const loadBackupState = async () => {
    const loaded = await repository.loadState();
    if (!loaded) throw new Error('Die lokale Datenbank enthält kein Arbeitsverhältnis.');
    return loaded;
  };

  const replace = async (next: AppState) => {
    await repository.replaceState(next);
    // Do not expose imported data before SQLite has committed the complete replacement.
    setState(next);
  };

  const wipe = async () => {
    const employment = newEmployment();
    await repository.clearAll(employment);
    setState({ version: 1, employments: [employment], activeEmploymentId: employment.id });
  };

  const hasDemo = state.employments.some((employment) => employment.demo
    || Object.values(employment.days).some((day) => day.demo)
    || employment.allowances.some((allowance: Allowance) => allowance.demo)
    || Object.values(employment.billing).some((billing) => billing.demo));

  if (!hydrated) return null;

  const activeEmployment = state.employments.find((item) => item.id === state.activeEmploymentId) ?? state.employments[0];
  const value = {
    state,
    hydrated,
    error,
    activeEmployment,
    setActiveEmployment,
    addEmployment,
    changeEmployment,
    deleteEmployment,
    restoreEmployment,
    saveDay,
    deleteDay,
    restoreDay,
    saveAllowance,
    deleteAllowance,
    restoreAllowance,
    saveBilling,
    clearDemo,
    loadBackupState,
    replace,
    wipe,
    hasDemo,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}
