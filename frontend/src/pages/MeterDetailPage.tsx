import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Gauge,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { metersApi, type Reading } from "@/api/meters";
import { AddReadingDialog } from "@/components/meters/AddReadingDialog";
import { ReadingsChart } from "@/components/meters/ReadingsChart";
import { ReplaceMeterDialog } from "@/components/meters/ReplaceMeterDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

export function MeterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const meterId = Number(id);

  const [addOpen, setAddOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);

  const queryClient = useQueryClient();

  const meter = useQuery({
    queryKey: ["meter", meterId],
    queryFn: () => metersApi.get(meterId),
    enabled: !isNaN(meterId),
  });

  const readings = useQuery({
    queryKey: ["meter", meterId, "readings"],
    queryFn: () => metersApi.readings(meterId),
    enabled: !isNaN(meterId),
  });

  const deleteReading = useMutation({
    mutationFn: (readingId: number) =>
      metersApi.deleteReading(meterId, readingId),
    onSuccess: () => {
      toast.success("Показание удалено");
      queryClient.invalidateQueries({
        queryKey: ["meter", meterId, "readings"],
      });
      queryClient.invalidateQueries({ queryKey: ["meter", meterId] });
    },
    onError: () => toast.error("Не удалось удалить"),
  });

  if (meter.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (meter.error || !meter.data) {
    return (
      <div className="text-center py-16">
        <h1 className="text-xl font-semibold">Счётчик не найден</h1>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/properties">
            <ArrowLeft className="mr-2 size-4" />
            К объектам
          </Link>
        </Button>
      </div>
    );
  }

  const m = meter.data;
  const sortedReadings = (readings.data ?? []).slice().sort(
    (a, b) =>
      new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime(),
  );
  const lastReading: Reading | null = sortedReadings[0] ?? null;
  const lastValue = lastReading
    ? Number(lastReading.value)
    : Number(m.initial_value);
  const isReplaced = !!m.replaced_at;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to={`/properties/${m.property_service_id}`}>
            <ArrowLeft className="size-4 mr-1" />
            К объекту
          </Link>
        </Button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">
                Счётчик {m.serial_number ?? `#${m.id}`}
              </h1>
              {isReplaced ? (
                <Badge
                  variant="outline"
                  className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-transparent"
                >
                  Заменён
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-transparent"
                >
                  Активен
                </Badge>
              )}
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Gauge className="size-4" />
                {m.unit}
              </span>
              {m.installed_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-4" />
                  Установлен {formatDate(m.installed_at)}
                </span>
              )}
              {m.replaced_at && (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="size-4" />
                  Заменён {formatDate(m.replaced_at)}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {!isReplaced && (
              <>
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="size-4 mr-2" />
                  Показание
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReplaceOpen(true)}
                >
                  <RefreshCw className="size-4 mr-2" />
                  Заменить
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Текущее значение */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-normal">
              Текущее показание
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {lastValue.toFixed(3)} {m.unit}
            </div>
            {lastReading && (
              <div className="text-xs text-muted-foreground mt-1">
                на {formatDate(lastReading.taken_at)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-normal">
              Начальное
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {Number(m.initial_value).toFixed(3)} {m.unit}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-normal">
              Всего показаний
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {sortedReadings.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* График */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Потребление по месяцам</CardTitle>
        </CardHeader>
        <CardContent>
          {readings.isLoading ? (
            <Skeleton className="h-56" />
          ) : (
            <ReadingsChart
              meter={m}
              readings={readings.data ?? []}
            />
          )}
        </CardContent>
      </Card>

      {/* История */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">История показаний</CardTitle>
        </CardHeader>
        <CardContent>
          {readings.isLoading ? (
            <Skeleton className="h-20" />
          ) : sortedReadings.length > 0 ? (
            <ul className="divide-y">
              {sortedReadings.map((r, idx) => {
                const next = sortedReadings[idx + 1];
                const prevValue = next
                  ? Number(next.value)
                  : Number(m.initial_value);
                const consumed = Number(r.value) - prevValue;
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium tabular-nums">
                        {Number(r.value).toFixed(3)} {m.unit}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(r.taken_at)}
                        {consumed > 0 && (
                          <span className="ml-2">
                            · расход {consumed.toFixed(3)} {m.unit}
                          </span>
                        )}
                      </div>
                    </div>
                    {!isReplaced && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-8"
                        onClick={() => {
                          if (confirm("Удалить показание?"))
                            deleteReading.mutate(r.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Показаний пока нет. Добавьте первое — и здесь появится график
              потребления.
            </div>
          )}
        </CardContent>
      </Card>

      <AddReadingDialog
        meter={m}
        lastReading={lastReading}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
      <ReplaceMeterDialog
        meter={m}
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
      />
    </div>
  );
}