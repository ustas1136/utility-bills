import { api } from "./client";

export type ReportMode = "paid" | "accrued";

export interface ExpenseByMonthItem {
  month: string;
  category: string;
  amount: string;
  currency: string;
}

export interface ExpensesReport {
  from_date: string;
  to_date: string;
  mode: ReportMode;
  items: ExpenseByMonthItem[];
}

export interface ExpenseByPropertyItem {
  property_id: number;
  property_name: string;
  property_type: string;
  amount: string;
  currency: string;
}

export interface ByPropertyReport {
  from_date: string;
  to_date: string;
  mode: string;
  items: ExpenseByPropertyItem[];
}

export interface ConsumptionItem {
  service_type_code: string;
  service_type_name: string;
  unit: string | null;
  total_consumption: string;
}

export interface ConsumptionReport {
  from_date: string;
  to_date: string;
  items: ConsumptionItem[];
}

export interface ReportParams {
  from_date?: string;
  to_date?: string;
  mode?: ReportMode;
}

/** Собирает query-строку, пропуская незаданные параметры. */
function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `?${query}` : "";
}

export const reportsApi = {
  expenses: (params: ReportParams = {}) =>
    api.get<ExpensesReport>(
      `/reports/expenses${buildQuery({
        from_date: params.from_date,
        to_date: params.to_date,
        mode: params.mode,
      })}`,
    ),

  byProperty: (params: ReportParams = {}) =>
    api.get<ByPropertyReport>(
      `/reports/by-property${buildQuery({
        from_date: params.from_date,
        to_date: params.to_date,
        mode: params.mode,
      })}`,
    ),

  consumption: (params: { from_date?: string; to_date?: string } = {}) =>
    api.get<ConsumptionReport>(
      `/reports/consumption${buildQuery({
        from_date: params.from_date,
        to_date: params.to_date,
      })}`,
    ),

  /** Тот же отчёт по месяцам, что и `expenses`, но в виде CSV-строки. */
  exportCsv: (params: ReportParams = {}) =>
    api.getText(
      `/reports/export.csv${buildQuery({
        from_date: params.from_date,
        to_date: params.to_date,
        mode: params.mode,
      })}`,
    ),
};
