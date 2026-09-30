import type {
  ConsumptionItem,
  ExpenseByMonthItem,
  ExpenseByPropertyItem,
} from "@/api/reports";
import { categoryLabel, monthLabel } from "@/lib/chart-data";

export interface MonthlyRow {
  month: string; // "2026-09"
  label: string; // "сен 2026"
  byCategory: Record<string, number>;
  total: number;
}

/** Разворачивает плоский список «месяц × категория» в строки по месяцам. */
export function toMonthlyRows(items: ExpenseByMonthItem[]): MonthlyRow[] {
  const map = new Map<string, MonthlyRow>();

  for (const it of items) {
    let row = map.get(it.month);
    if (!row) {
      row = {
        month: it.month,
        label: `${monthLabel(it.month)} ${it.month.slice(0, 4)}`,
        byCategory: {},
        total: 0,
      };
      map.set(it.month, row);
    }
    const amount = Number(it.amount);
    row.byCategory[it.category] = (row.byCategory[it.category] ?? 0) + amount;
    row.total += amount;
  }

  // Свежие месяцы — сверху.
  return Array.from(map.values()).sort((a, b) =>
    b.month.localeCompare(a.month),
  );
}

/** Категории, встречающиеся в отчёте, по алфавиту русских подписей. */
export function categoriesOf(items: ExpenseByMonthItem[]): string[] {
  return Array.from(new Set(items.map((i) => i.category))).sort((a, b) =>
    categoryLabel(a).localeCompare(categoryLabel(b), "ru"),
  );
}

export interface CurrencyTotal {
  currency: string;
  amount: number;
}

/** Суммы по валютам, от большей к меньшей. */
export function totalsByCurrency(
  items: { amount: string | number; currency: string }[],
): CurrencyTotal[] {
  const map = new Map<string, number>();
  for (const it of items) {
    map.set(it.currency, (map.get(it.currency) ?? 0) + Number(it.amount));
  }
  return Array.from(map.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export interface PropertyRow extends ExpenseByPropertyItem {
  share: number;
}

/** Доля объекта считается внутри его собственной валюты. */
export function toPropertyRows(items: ExpenseByPropertyItem[]): PropertyRow[] {
  const totals = new Map<string, number>();
  for (const it of items) {
    totals.set(it.currency, (totals.get(it.currency) ?? 0) + Number(it.amount));
  }

  return items
    .map((it) => {
      const total = totals.get(it.currency) ?? 0;
      return { ...it, share: total > 0 ? Number(it.amount) / total : 0 };
    })
    .sort((a, b) => Number(b.amount) - Number(a.amount));
}

export interface ConsumptionRow extends ConsumptionItem {
  value: number;
}

export function toConsumptionRows(items: ConsumptionItem[]): ConsumptionRow[] {
  return items
    .map((it) => ({ ...it, value: Number(it.total_consumption) }))
    .sort((a, b) => b.value - a.value);
}

/** Имя CSV-файла с периодом, чтобы выгрузки не перезаписывали друг друга. */
export function csvFilename(from: string, to: string): string {
  return `expenses_${from}_${to}.csv`;
}
