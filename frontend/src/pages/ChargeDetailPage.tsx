import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Calendar, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { chargesApi } from "@/api/charges";
import { AddPaymentDialog } from "@/components/charges/AddPaymentDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney, formatRelative } from "@/lib/format";

export function ChargeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const chargeId = Number(id);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const queryClient = useQueryClient();

  const charge = useQuery({
    queryKey: ["charge", chargeId],
    queryFn: () => chargesApi.get(chargeId),
    enabled: !isNaN(chargeId),
  });

  const payments = useQuery({
    queryKey: ["charge", chargeId, "payments"],
    queryFn: () => chargesApi.payments(chargeId),
    enabled: !isNaN(chargeId),
  });

  const cancel = useMutation({
    mutationFn: () => chargesApi.cancel(chargeId),
    onSuccess: () => {
      toast.success("Начисление отменено");
      queryClient.invalidateQueries({ queryKey: ["charge", chargeId] });
      queryClient.invalidateQueries({ queryKey: ["charges"] });
    },
    onError: () => toast.error("Не удалось отменить"),
  });

  const deletePayment = useMutation({
    mutationFn: (paymentId: number) =>
      chargesApi.deletePayment(chargeId, paymentId),
    onSuccess: () => {
      toast.success("Платёж удалён");
      queryClient.invalidateQueries({ queryKey: ["charge", chargeId] });
      queryClient.invalidateQueries({ queryKey: ["charges"] });
    },
  });

  if (charge.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (charge.error || !charge.data) {
    return (
      <div className="text-center py-16">
        <h1 className="text-xl font-semibold">Начисление не найдено</h1>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/charges">
            <ArrowLeft className="mr-2 size-4" />
            К платежам
          </Link>
        </Button>
      </div>
    );
  }

  const c = charge.data;
  const remaining = Math.max(Number(c.amount) - Number(c.paid_amount), 0);
  const canPay = c.status !== "paid" && c.status !== "cancelled";
  const canCancel = c.status !== "paid" && c.status !== "cancelled";

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/charges">
            <ArrowLeft className="size-4 mr-1" />
            Платежи
          </Link>
        </Button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                Начисление #{c.id}
              </h1>
              <StatusBadge status={c.status} />
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="size-4" />
              Оплатить до {formatDate(c.due_date)}
            </div>
          </div>

          <div className="flex gap-2">
            {canPay && (
              <Button onClick={() => setPaymentOpen(true)}>
                <Wallet className="size-4 mr-2" />
                Оплатить
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm("Отменить начисление?")) cancel.mutate();
                }}
                disabled={cancel.isPending}
              >
                <Ban className="size-4 mr-2" />
                Отменить
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Суммы */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-normal">
              Начислено
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatMoney(c.amount, c.currency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-normal">
              Оплачено
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatMoney(c.paid_amount, c.currency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-normal">
              Осталось
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {formatMoney(remaining, c.currency)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Детали */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Детали</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Период</dt>
              <dd>
                {formatDate(c.period_start)} — {formatDate(c.period_end)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Источник</dt>
              <dd>{c.source === "calculated" ? "По счётчику" : "Вручную"}</dd>
            </div>
            {c.notes && (
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Заметки</dt>
                <dd>{c.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* История платежей */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Платежи</CardTitle>
          {canPay && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaymentOpen(true)}
            >
              <Wallet className="size-4 mr-2" />
              Добавить
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {payments.isLoading ? (
            <Skeleton className="h-16" />
          ) : payments.data && payments.data.length > 0 ? (
            <ul className="divide-y">
              {payments.data.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium tabular-nums">
                      {formatMoney(p.amount, p.currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.method} · {formatRelative(p.paid_at)}
                      {p.comment && ` · ${p.comment}`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-8"
                    onClick={() => {
                      if (confirm("Удалить платёж?"))
                        deletePayment.mutate(p.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Платежей пока нет
            </div>
          )}
        </CardContent>
      </Card>

      <AddPaymentDialog
        charge={c}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
    </div>
  );
}