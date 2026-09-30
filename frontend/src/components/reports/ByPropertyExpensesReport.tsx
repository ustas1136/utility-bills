import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Building2, PieChart, Wallet } from "lucide-react";

import type { ExpenseByPropertyItem } from "@/api/reports";
import { EmptyState } from "@/components/EmptyState";
import { PropertyTypeBadge } from "@/components/properties/PropertyTypeBadge";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatPercent } from "@/lib/format";
import { PROPERTY_TYPES } from "@/lib/property";
import { toPropertyRows } from "@/lib/report-data";
import type { PropertyType } from "@/api/properties";

interface Props {
  items: ExpenseByPropertyItem[];
  currency: string;
  isLoading: boolean;
}

function propertyTypeOf(value: string): PropertyType {
  return PROPERTY_TYPES.includes(value as PropertyType)
    ? (value as PropertyType)
    : "other";
}

export function ByPropertyExpensesReport({
  items,
  currency,
  isLoading,
}: Props) {
  const rows = useMemo(() => toPropertyRows(items), [items]);
  const total = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amount), 0),
    [rows],
  );
  const top = rows[0];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="Нет расходов по объектам"
        description="За выбранный период по объектам нет оплаченных начислений."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Всего за период"
          value={formatMoney(total, currency)}
          sublabel="по всем объектам"
          icon={Wallet}
        />
        <StatCard
          label="Объектов с расходами"
          value={String(rows.length)}
          sublabel="из всех объектов"
          icon={Building2}
        />
        <StatCard
          label="Больше всего"
          value={top?.property_name ?? "—"}
          sublabel={
            top
              ? `${formatMoney(top.amount, top.currency)} · ${formatPercent(top.share)}`
              : undefined
          }
          icon={PieChart}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Расходы по объектам</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.property_id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/properties/${row.property_id}`}
                        className="font-medium hover:underline"
                      >
                        {row.property_name}
                      </Link>
                      <PropertyTypeBadge
                        type={propertyTypeOf(row.property_type)}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress
                        value={row.share * 100}
                        className="h-2 w-40 sm:w-64"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatPercent(row.share)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right tabular-nums font-medium whitespace-nowrap">
                    {formatMoney(row.amount, row.currency)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
