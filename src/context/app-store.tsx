import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { StartupError } from '@/components/startup-error';
import * as repository from '@/database/repository';
import type { Allowance, AppState, BillingRecord, Employment, WorkDay } from '@/domain/model';
import { normalizeState } from '@/domain/validation';

export { normalizeState } from '@/domain/validation';

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function newEmployment(name = 'Hauptjob', color = 0): Employment {
  return { id: uid(), name, color, days: {}, allowances: [], billing: {} };
}

function createInitialState(): AppState {
  const main = newEmployment('Hauptjob', 0);
  return { version: 1, employments: [main], activeEmploymentId: main.id };
}

type StoreValue = {
  state: AppState;
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

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(createInitialState);
  const [initialized, setInitialized] = useState(false);
  const [startupFailed, setStartupFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const initialStateRef = useRef(state);
  const initializingRef = useRef(false);
  const mountedRef = useRef(true);

  const initialize = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;
    try {
      await repository.initializeState(initialStateRef.current);
      const loaded = await repository.loadState();
      if (!loaded) throw new Error('Die lokale Datenbank enthält kein Arbeitsverhältnis.');
      if (mountedRef.current) {
        setState(loaded);
        setStartupFailed(false);
        setInitialized(true);
      }
    } catch (reason: unknown) {
      console.error('SQLite database could not be initialized.', reason);
      if (mountedRef.current) setStartupFailed(true);
    } finally {
      initializingRef.current = false;
      if (mountedRef.current) setRetrying(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Initialization synchronizes React with the external SQLite store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initialize();
    return () => { mountedRef.current = false; };
  }, [initialize]);

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
    // Keep this boundary defensive even when the caller already validated parsed input.
    const validated = normalizeState(next);
    await repository.replaceState(validated);
    // Do not expose imported data before SQLite has committed the complete replacement.
    setState(validated);
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

  if (!initialized) {
    return startupFailed
      ? <StartupError onRetry={() => { setRetrying(true); void initialize(); }} retrying={retrying} />
      : null;
  }

  const activeEmployment = state.employments.find((item) => item.id === state.activeEmploymentId) ?? state.employments[0];
  const value = {
    state,
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
