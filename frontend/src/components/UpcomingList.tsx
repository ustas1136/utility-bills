import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { HomeChargeItem } from "@/api/bff";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { daysLeftLabel, formatDate, formatMoney } from "@/lib/format";

interface Props {
  items: HomeChargeItem[];
  loading: boolean;
}

export function UpcomingList({ items, loading }: Props) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between p-5 pb-3">
        <h3 className="text-base font-semibold">Ближайшие платежи</h3>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/charges">
            Все <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </div>

      <div className="px-5 pb-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : items.length > 0 ? (
          <ul className="divide-y -mx-2">
            {items.slice(0, 6).map((item) => (
              <li
                key={item.charge_id}
                className="flex items-center gap-3 px-2 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {item.service_name}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {item.property_name} · до {formatDate(item.due_date)} ·{" "}
                    {daysLeftLabel(item.days_left)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold tabular-nums">
                    {formatMoney(item.amount, item.currency)}
                  </div>
                  {Number(item.paid_amount) > 0 && (
                    <div className="text-xs text-muted-foreground tabular-nums">
                      оплачено {formatMoney(item.paid_amount, item.currency)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Нет ближайших платежей в течение 30 дней. 🎉
          </div>
        )}
      </div>
    </div>
  );
}