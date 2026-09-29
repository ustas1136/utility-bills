import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Meter, Reading } from "@/api/meters";
import { formatDate } from "@/lib/format";

interface Props {
  meter: Meter;
  readings: Reading[];
}

interface ChartPoint {
  date: string;
  consumed: number;
}

/**
 * Строит точки графика: для каждого показания (кроме первого) считает
 * разницу с предыдущим. Первое показание считается от initial_value.
 */
function buildSeries(meter: Meter, readings: Reading[]): ChartPoint[] {
  if (readings.length === 0) return [];

  // readings приходят от backend по убыванию даты (DESC).
  // Разворачиваем, чтобы идти от старых к новым.
  const sorted = [...readings].sort(
    (a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime(),
  );

  const points: ChartPoint[] = [];
  let prev = Number(meter.initial_value);

  for (const r of sorted) {
    const value = Number(r.value);
    const consumed = value - prev;
    points.push({ date: r.taken_at, consumed });
    prev = value;
  }

  return points;
}

export function ReadingsChart({ meter, readings }: Props) {
  const data = buildSeries(meter, readings);

  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
        Нет данных для графика
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="var(--muted-foreground)"
            tickFormatter={(v) => {
              const d = new Date(v);
              return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="var(--muted-foreground)"
            width={40}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
            }}
            formatter={(value) => [`${Number(value).toFixed(3)} ${meter.unit}`, "Расход"]}
            labelFormatter={(v) => formatDate(String(v))}
          />
          <Bar
            dataKey="consumed"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}