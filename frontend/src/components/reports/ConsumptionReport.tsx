import { useMemo } from "react";
import { Gauge } from "lucide-react";

import type { ConsumptionItem } from "@/api/reports";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQuantity } from "@/lib/format";
import { toConsumptionRows } from "@/lib/report-data";

interface Props {
  items: ConsumptionItem[];
  isLoading: boolean;
}

export function ConsumptionReport({ items, isLoading }: Props) {
  const rows = useMemo(() => toConsumptionRows(items), [items]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Gauge}
        title="Нет данных о потреблении"
        description="Потребление считается по разнице показаний счётчиков за выбранный период."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Потребление по услугам</CardTitle>
        <p className="text-xs text-muted-foreground">
          Суммарный расход по показаниям счётчиков. Единицы измерения у услуг
          разные, поэтому значения не складываются.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Услуга</th>
                <th className="px-4 py-3 text-left font-medium">Единица</th>
                <th className="px-4 py-3 text-right font-medium">Расход</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.service_type_code}>
                  <td className="px-4 py-3">{row.service_type_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.unit ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap">
                    {formatQuantity(row.value)}
                    {row.unit && (
                      <span className="ml-1 text-muted-foreground font-normal">
                        {row.unit}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
