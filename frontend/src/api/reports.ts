import { api } from "./client";

export interface ExpenseByMonthItem {
  month: string;
  category: string;
  amount: string;
  currency: string;
}

export interface ExpensesReport {
  from_date: string;
  to_date: string;
  mode: "paid" | "accrued";
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

export const reportsApi = {
  expenses: (params: {
    from_date?: string;
    to_date?: string;
    mode?: "paid" | "accrued";
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.from_date) qs.set("from_date", params.from_date);
    if (params.to_date) qs.set("to_date", params.to_date);
    if (params.mode) qs.set("mode", params.mode);
    const query = qs.toString();
    return api.get<ExpensesReport>(
      `/reports/expenses${query ? `?${query}` : ""}`,
    );
  },

  byProperty: (params: {
    from_date?: string;
    to_date?: string;
    mode?: "paid" | "accrued";
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.from_date) qs.set("from_date", params.from_date);
    if (params.to_date) qs.set("to_date", params.to_date);
    if (params.mode) qs.set("mode", params.mode);
    const query = qs.toString();
    return api.get<ByPropertyReport>(
      `/reports/by-property${query ? `?${query}` : ""}`,
    );
  },

  consumption: (params: { from_date?: string; to_date?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.from_date) qs.set("from_date", params.from_date);
    if (params.to_date) qs.set("to_date", params.to_date);
    const query = qs.toString();
    return api.get<ConsumptionReport>(
      `/reports/consumption${query ? `?${query}` : ""}`,
    );
  },
};