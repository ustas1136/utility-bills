import { Calendar, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { ChargeRead } from "@/api/charges";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatMoney } from "@/lib/format";

interface Props {
  charge: ChargeRead;
  propertyName?: string;
  serviceName?: string;
}

export function ChargeCard({ charge, propertyName, serviceName }: Props) {
  const paid = Number(charge.paid_amount);
  const total = Number(charge.amount);
  const progress = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  const remaining = Math.max(total - paid, 0);

  return (
    <Link
      to={`/charges/${charge.id}`}
      className="group rounded-xl border bg-card p-4 hover:border-primary/40 hover:bg-accent/20 transition-colors block"
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">
              {serviceName ?? `Услуга #${charge.property_service_id}`}
            </span>
            <StatusBadge status={charge.status} />
          </div>
          {propertyName && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {propertyName}
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              до {formatDate(charge.due_date)}
            </span>
            <span>
              период: {formatDate(charge.period_start)} —{" "}
              {formatDate(charge.period_end)}
            </span>
          </div>

          {paid > 0 && charge.status !== "paid" && (
            <div className="mt-2">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground mt-1">
                Оплачено {formatMoney(paid, charge.currency)} из{" "}
                {formatMoney(total, charge.currency)}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div className="font-semibold tabular-nums">
            {formatMoney(charge.status === "paid" ? total : remaining, charge.currency)}
          </div>
          {charge.status !== "paid" && paid > 0 && (
            <div className="text-[11px] text-muted-foreground">
              из {formatMoney(total, charge.currency)}
            </div>
          )}
        </div>

        <ChevronRight className="size-4 shrink-0 mt-1 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </Link>
  );
}