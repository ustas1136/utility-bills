import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import { bffApi } from "@/api/bff";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  daysLeftLabel,
  formatDate,
  formatMoney,
  formatRelative,
} from "@/lib/format";

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["bff", "home"],
    queryFn: () => bffApi.home(30),
  });

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="pt-6 text-sm text-destructive">
          Не удалось загрузить данные. Проверьте, что вы авторизованы и backend
          доступен.
        </CardContent>
      </Card>
    );
  }

  const totals = data?.totals ?? [];
  const pending = totals.find((t) => Number(t.pending_amount) > 0);
  const overdue = totals.find((t) => Number(t.overdue_amount) > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Обзор ближайших платежей и последних событий
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <StatCard
              label="К оплате"
              value={
                pending
                  ? formatMoney(pending.pending_amount, pending.currency)
                  : "—"
              }
              sublabel={`${data?.upcoming.length ?? 0} начислений впереди`}
              icon={Wallet}
              tone="default"
            />
            <StatCard
              label="Просрочено"
              value={
                overdue
                  ? formatMoney(overdue.overdue_amount, overdue.currency)
                  : "—"
              }
              sublabel={overdue ? "Требуется внимание" : "Всё в порядке"}
              icon={AlertTriangle}
              tone={overdue ? "destructive" : "success"}
            />
            <StatCard
              label="Домохозяйств"
              value={String(data?.household_count ?? 0)}
              sublabel="личное и совместные"
              icon={CalendarClock}
            />
            <StatCard
              label="Уведомлений"
              value={String(data?.unread_notifications.length ?? 0)}
              sublabel="последних событий"
              icon={Bell}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Ближайшие платежи</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/charges">
                Все <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : data && data.upcoming.length > 0 ? (
              <ul className="divide-y -mx-2">
                {data.upcoming.slice(0, 6).map((item) => (
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
                          оплачено{" "}
                          {formatMoney(item.paid_amount, item.currency)}
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Уведомления</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/settings">
                Настроить <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : data && data.unread_notifications.length > 0 ? (
              <ul className="space-y-3">
                {data.unread_notifications.map((n) => (
                  <li key={n.id} className="flex gap-3">
                    <div className="size-8 shrink-0 rounded-md bg-muted flex items-center justify-center">
                      <Bell className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {n.title}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {n.body}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {formatRelative(n.created_at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Уведомлений пока нет
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}