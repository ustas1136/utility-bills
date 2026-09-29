import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ExpenseByMonthItem } from "@/api/reports";
import {
  CATEGORY_COLORS,
  categoryLabel,
  toMonthlySeries,
} from "@/lib/chart-data";
import { formatMoney } from "@/lib/format";

interface Props {
  items: ExpenseByMonthItem[];
  currency: string;
}

export function ExpensesBarChart({ items, currency }: Props) {
  if (items.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
        Нет данных за выбранный период
      </div>
    );
  }

  const data = toMonthlySeries(items);
  const categories = Array.from(new Set(items.map((i) => i.category)));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            stroke="var(--muted-foreground)"
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              formatMoney(value as number, currency),
              categoryLabel(name as string),
            ]}
          />
          <Legend
            formatter={(value) => categoryLabel(value as string)}
            wrapperStyle={{ fontSize: 12 }}
          />
          {categories.map((c) => (
            <Bar
              key={c}
              dataKey={c}
              stackId="a"
              fill={CATEGORY_COLORS[c] ?? "var(--primary)"}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}