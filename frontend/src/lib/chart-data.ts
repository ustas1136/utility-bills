import type { ExpenseByMonthItem } from "@/api/reports";

const CATEGORY_LABELS: Record<string, string> = {
  utility: "Коммунальные",
  tax: "Налоги",
  insurance: "Страховки",
  other: "Прочее",
};

const MONTH_NAMES = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

export function categoryLabel(code: string): string {
  return CATEGORY_LABELS[code] ?? code;
}

export function monthLabel(yyyymm: string): string {
  const [, month] = yyyymm.split("-");
  const idx = Number(month) - 1;
  return MONTH_NAMES[idx] ?? yyyymm;
}

export function toMonthlySeries(items: ExpenseByMonthItem[]) {
  const map = new Map<string, Record<string, number | string>>();

  for (const it of items) {
    const key = it.month;
    if (!map.has(key)) {
      map.set(key, { month: monthLabel(key) });
    }
    const row = map.get(key)!;
    row[it.category] = ((row[it.category] as number) ?? 0) + Number(it.amount);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}

export function toCategoryTotals(items: ExpenseByMonthItem[]) {
  const map = new Map<string, number>();
  for (const it of items) {
    map.set(it.category, (map.get(it.category) ?? 0) + Number(it.amount));
  }
  return Array.from(map.entries()).map(([code, value]) => ({
    code,
    category: categoryLabel(code),
    value,
  }));
}

export const CATEGORY_COLORS: Record<string, string> = {
  utility: "hsl(160, 60%, 45%)",
  tax: "hsl(240, 60%, 55%)",
  insurance: "hsl(45, 85%, 55%)",
  other: "hsl(310, 55%, 55%)",
};