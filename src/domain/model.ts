export const MAIN_ALLOWANCES = ['Bereitschaft', 'Einspringen'] as const;
export type MainAllowance = (typeof MAIN_ALLOWANCES)[number];

export type WorkDay = {
  start: string;
  end: string;
  pause: number;
  note: string;
  demo?: boolean;
};

export type Allowance = {
  id: string;
  date: string;
  label: string;
  quantity: number;
  amount: number | null;
  demo?: boolean;
};

export type BilledAllowance = { quantity: string; amount: string };
export type BillingRecord = {
  hours: string;
  allowances: Record<string, BilledAllowance>;
  demo?: boolean;
};

export type Employment = {
  id: string;
  name: string;
  color: number;
  days: Record<string, WorkDay>;
  allowances: Allowance[];
  billing: Record<string, BillingRecord>;
  demo?: boolean;
};

export type AppState = {
  version: 1;
  employments: Employment[];
  activeEmploymentId: string;
};

export type DayCalculation = {
  elapsed: number;
  pause: number;
  net: number;
  overnight: boolean;
};
