import { useMemo } from "react";
import { BarChart3, CalendarRange, Layers, Wallet } from "lucide-react";

import type { ExpenseByMonthItem } from "@/api/reports";
import { CategoryDonutChart } from "@/components/charts/CategoryDonutChart";
import { ExpensesBarChart } from "@/components/charts/ExpensesBarChart";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryLabel } from "@/lib/chart-data";
import { formatMoney } from "@/lib/format";
import { categoriesOf, toMonthlyRows } from "@/lib/report-data";

interface Props {
  items: ExpenseByMonthItem[];
  currency: string;
  isLoading: boolean;
}

export function MonthlyExpensesReport({ items, currency, isLoading }: Props) {
  const rows = useMemo(() => toMonthlyRows(items), [items]);
  const categories = useMemo(() => categoriesOf(items), [items]);

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const row of rows) {
      for (const [category, amount] of Object.entries(row.byCategory)) {
        totals[category] = (totals[category] ?? 0) + amount;
      }
    }
    return totals;
  }, [rows]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.total, 0),
    [rows],
  );
  const average = rows.length > 0 ? total / rows.length : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Нет данных за выбранный период"
        description="Измените период или убедитесь, что по услугам есть оплаченные начисления."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Всего за период"
          value={formatMoney(total, currency)}
          sublabel={`${rows.length} мес. с расходами`}
          icon={Wallet}
        />
        <StatCard
          label="В среднем в месяц"
          value={formatMoney(average, currency)}
          sublabel="по месяцам с данными"
          icon={CalendarRange}
        />
        <StatCard
          label="Категорий"
          value={String(categories.length)}
          sublabel={categories.map(categoryLabel).join(", ") || "—"}
          icon={Layers}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Расходы по месяцам</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpensesBarChart items={items} currency={currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">По категориям</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryDonutChart items={items} currency={currency} />
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Месяц</th>
                {categories.map((category) => (
                  <th
                    key={category}
                    className="px-4 py-3 text-right font-medium whitespace-nowrap"
                  >
                    {categoryLabel(category)}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium">Итого</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.month}>
                  <td className="px-4 py-3 whitespace-nowrap">{row.label}</td>
                  {categories.map((category) => (
                    <td
                      key={category}
                      className="px-4 py-3 text-right tabular-nums"
                    >
                      {row.byCategory[category] === undefined
                        ? "—"
                        : formatMoney(row.byCategory[category], currency)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatMoney(row.total, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40 font-medium">
                <td className="px-4 py-3">Итого</td>
                {categories.map((category) => (
                  <td
                    key={category}
                    className="px-4 py-3 text-right tabular-nums"
                  >
                    {formatMoney(columnTotals[category] ?? 0, currency)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(total, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
