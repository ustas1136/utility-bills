import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CalendarClock, Wallet } from "lucide-react";

import { bffApi } from "@/api/bff";
import { reportsApi } from "@/api/reports";
import { CategoryDonutChart } from "@/components/charts/CategoryDonutChart";
import { ExpensesBarChart } from "@/components/charts/ExpensesBarChart";
import { NotificationList } from "@/components/NotificationList";
import { QuickActions } from "@/components/QuickActions";
import { StatCard } from "@/components/StatCard";
import { UpcomingList } from "@/components/UpcomingList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";

export function DashboardPage() {
  const home = useQuery({
    queryKey: ["bff", "home"],
    queryFn: () => bffApi.home(30),
  });

  const expenses = useQuery({
    queryKey: ["reports", "expenses", "paid"],
    queryFn: () => reportsApi.expenses({ mode: "paid" }),
  });

  const totals = home.data?.totals ?? [];
  const currency = totals[0]?.currency ?? "RUB";
  const pending = totals.find((t) => Number(t.pending_amount) > 0);
  const overdue = totals.find((t) => Number(t.overdue_amount) > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Дашборд</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Обзор ближайших платежей и расходов
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {home.isLoading ? (
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
              sublabel={`${home.data?.upcoming.length ?? 0} начислений впереди`}
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
              value={String(home.data?.household_count ?? 0)}
              sublabel="личное и совместные"
              icon={CalendarClock}
            />
            <StatCard
              label="Уведомлений"
              value={String(home.data?.unread_notifications.length ?? 0)}
              sublabel="последних событий"
              icon={Bell}
            />
          </>
        )}
      </div>

      <QuickActions />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Расходы по месяцам</CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.isLoading ? (
              <Skeleton className="h-72" />
            ) : (
              <ExpensesBarChart
                items={expenses.data?.items ?? []}
                currency={currency}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">По категориям</CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.isLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <CategoryDonutChart
                items={expenses.data?.items ?? []}
                currency={currency}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <UpcomingList
            items={home.data?.upcoming ?? []}
            loading={home.isLoading}
          />
        </div>
        <NotificationList
          items={home.data?.unread_notifications ?? []}
          loading={home.isLoading}
        />
      </div>
    </div>
  );
}