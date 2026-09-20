import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import type { Allowance, AppState, Employment } from '@/domain/model';
import { calculateDay, dateKey, formatDecimal, monthKey } from '@/domain/time';

const STORAGE_KEY = 'stundenbuch-v2';
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
  activeEmployment: Employment;
  update: (recipe: (draft: AppState) => void) => void;
  replace: (next: AppState) => void;
  clearDemo: () => void;
  hasDemo: boolean;
};

const StoreContext = createContext<StoreValue | null>(null);

export function AppStoreProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState(createInitialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const normalized = normalizeState(JSON.parse(raw));
          if (normalized) setState(normalized);
        } catch { /* keep demo state */ }
      }
    }).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const update = (recipe: (draft: AppState) => void) => {
    setState((current) => {
      const draft = JSON.parse(JSON.stringify(current)) as AppState;
      recipe(draft);
      return draft;
    });
  };

  const replace = (next: AppState) => setState(next);
  const hasDemo = state.employments.some((employment) => employment.demo
    || Object.values(employment.days).some((day) => day.demo)
    || employment.allowances.some((allowance: Allowance) => allowance.demo)
    || Object.values(employment.billing).some((billing) => billing.demo));

  const clearDemo = () => update((draft) => {
    draft.employments = draft.employments.filter((employment) => !employment.demo);
    draft.employments.forEach((employment) => {
      Object.keys(employment.days).forEach((key) => { if (employment.days[key].demo) delete employment.days[key]; });
      employment.allowances = employment.allowances.filter((allowance) => !allowance.demo);
      Object.keys(employment.billing).forEach((key) => { if (employment.billing[key].demo) delete employment.billing[key]; });
    });
    if (!draft.employments.length) draft.employments = [newEmployment()];
    if (!draft.employments.some((employment) => employment.id === draft.activeEmploymentId)) {
      draft.activeEmploymentId = draft.employments[0].id;
    }
  });

  const activeEmployment = state.employments.find((item) => item.id === state.activeEmploymentId) ?? state.employments[0];
  const value = { state, hydrated, activeEmployment, update, replace, clearDemo, hasDemo };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider');
  return value;
}
