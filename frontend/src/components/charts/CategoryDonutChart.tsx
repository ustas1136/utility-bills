import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { ExpenseByMonthItem } from "@/api/reports";
import { CATEGORY_COLORS, toCategoryTotals } from "@/lib/chart-data";
import { formatMoney } from "@/lib/format";

interface Props {
  items: ExpenseByMonthItem[];
  currency: string;
}

export function CategoryDonutChart({ items, currency }: Props) {
  if (items.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        Нет данных
      </div>
    );
  }

  const data = toCategoryTotals(items);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="h-64 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="category"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            stroke="var(--background)"
            strokeWidth={2}
          >
            {data.map((entry) => (
              <Cell
                key={entry.code}
                fill={CATEGORY_COLORS[entry.code] ?? "var(--primary)"}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
            }}
            formatter={(value) => formatMoney(value as number, currency)}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-xs text-muted-foreground">Всего</div>
        <div className="text-lg font-semibold tabular-nums">
          {formatMoney(total, currency)}
        </div>
      </div>

      <ul className="absolute -bottom-2 inset-x-0 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
        {data.map((d) => (
          <li key={d.code} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ background: CATEGORY_COLORS[d.code] }}
            />
            {d.category}
          </li>
        ))}
      </ul>
    </div>
  );
}