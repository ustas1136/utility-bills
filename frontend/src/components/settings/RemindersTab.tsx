import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarClock,
  Mail,
  Pencil,
  Send,
  Smartphone,
  Trash2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { householdsApi } from "@/api/households";
import {
  remindersApi,
  type NotificationChannel,
  type ReminderKind,
  type ReminderRule,
} from "@/api/reminders";
import { serviceTypesApi } from "@/api/service-types";
import { CreateReminderDialog } from "@/components/settings/CreateReminderDialog";
import { EditReminderDialog } from "@/components/settings/EditReminderDialog";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const KIND_LABELS: Record<ReminderKind, string> = {
  payment_due: "Срок оплаты",
  reading_due: "Передать показания",
  custom: "Произвольное",
};

const CHANNEL_ICONS: Record<NotificationChannel, typeof Mail> = {
  email: Mail,
  push: Smartphone,
  telegram: Send,
};

export function RemindersTab() {
  const queryClient = useQueryClient();

  const households = useQuery({
    queryKey: ["households"],
    queryFn: () => householdsApi.list(),
  });

  // Состояние выбранного household
  const [activeHouseholdId, setActiveHouseholdId] = useState<number | null>(
    null,
  );

  // Эффективно выбранный: явно выбранный, или первый личный, или первый
  const currentHouseholdId =
    activeHouseholdId ??
    households.data?.find((h) => h.is_personal)?.id ??
    households.data?.[0]?.id ??
    null;

  const rules = useQuery({
    queryKey: ["reminder-rules", currentHouseholdId],
    queryFn: () => remindersApi.listForHousehold(currentHouseholdId!),
    enabled: !!currentHouseholdId,
  });

  const serviceTypes = useQuery({
    queryKey: ["service-types", "all"],
    queryFn: () => serviceTypesApi.list(),
  });

  const serviceTypesMap = new Map(
    (serviceTypes.data ?? []).map((s) => [s.id, s]),
  );

  const updateRule = useMutation({
    mutationFn: ({
      ruleId,
      is_active,
    }: {
      ruleId: number;
      is_active: boolean;
    }) => remindersApi.update(ruleId, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["reminder-rules", currentHouseholdId],
      });
    },
    onError: () => toast.error("Не удалось изменить"),
  });

  const deleteRule = useMutation({
    mutationFn: (ruleId: number) => remindersApi.remove(ruleId),
    onSuccess: () => {
      toast.success("Правило удалено");
      queryClient.invalidateQueries({
        queryKey: ["reminder-rules", currentHouseholdId],
      });
    },
    onError: () => toast.error("Не удалось удалить"),
  });

  const [editRule, setEditRule] = useState<ReminderRule | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Напоминания</CardTitle>
          {currentHouseholdId && (
            <CreateReminderDialog householdId={currentHouseholdId} />
          )}
        </CardHeader>
        <CardContent>
          {/* Селектор household, если их несколько */}
          {households.data && households.data.length > 1 && (
            <div className="mb-4">
              <Select
                value={String(currentHouseholdId ?? "")}
                onValueChange={(v) => setActiveHouseholdId(Number(v))}
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Выберите семью" />
                </SelectTrigger>
                <SelectContent>
                  {households.data.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      {h.name}
                      {h.is_personal && (
                        <span className="text-muted-foreground ml-2">
                          (личный)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {rules.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : rules.data && rules.data.length > 0 ? (
            <ul className="space-y-3">
              {rules.data.map((rule) => {
                const st = rule.service_type_id
                  ? serviceTypesMap.get(rule.service_type_id)
                  : null;
                const Icon = CalendarClock;

                return (
                  <li
                    key={rule.id}
                    className="rounded-lg border bg-background/40 p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="size-5 text-primary" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {KIND_LABELS[rule.kind]}
                          </span>
                          {!rule.is_active && (
                            <Badge
                              variant="outline"
                              className="bg-muted text-muted-foreground border-transparent text-xs"
                            >
                              Отключено
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground mt-1">
                          За <span className="font-medium">{rule.days_before}</span>{" "}
                          {rule.days_before === 1
                            ? "день"
                            : rule.days_before < 5
                              ? "дня"
                              : "дней"}{" "}
                          до срока
                          {st && <span> · {st.name}</span>}
                          {!st && <span> · все услуги</span>}
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          {rule.channels.map((ch) => {
                            const ChIcon = CHANNEL_ICONS[ch];
                            return (
                              <Badge
                                key={ch}
                                variant="outline"
                                className="text-xs font-normal gap-1"
                              >
                                <ChIcon className="size-3" />
                                {ch}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(v) =>
                            updateRule.mutate({
                              ruleId: rule.id,
                              is_active: v,
                            })
                          }
                          disabled={updateRule.isPending}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setEditRule(rule)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          onClick={() => {
                            if (confirm("Удалить правило?"))
                              deleteRule.mutate(rule.id);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={Bell}
              title="Правил напоминаний нет"
              description="Создайте первое правило — и система будет напоминать о платежах и передаче показаний."
              action={
                currentHouseholdId ? (
                  <CreateReminderDialog householdId={currentHouseholdId} />
                ) : undefined
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Небольшая справка снизу */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Zap className="size-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-foreground">
                Как работают напоминания
              </div>
              <p className="mt-1">
                Планировщик проверяет правила раз в час. Если срок начисления
                приближается (за N дней), создаётся уведомление в выбранных
                каналах. Push требует мобильного приложения; Email работает
                сразу.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {editRule && (
        <EditReminderDialog
          rule={editRule}
          open={!!editRule}
          onOpenChange={(v) => {
            if (!v) setEditRule(null);
          }}
        />
      )}
    </div>
  );
}