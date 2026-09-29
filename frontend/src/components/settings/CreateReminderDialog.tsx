import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { HttpError } from "@/api/client";
import {
  remindersApi,
  type NotificationChannel,
  type ReminderKind,
} from "@/api/reminders";
import { serviceTypesApi } from "@/api/service-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  householdId: number;
}

const KINDS: { value: ReminderKind; label: string; hint: string }[] = [
  {
    value: "payment_due",
    label: "Срок оплаты",
    hint: "Напомнить до даты, указанной в начислении",
  },
  {
    value: "reading_due",
    label: "Передать показания",
    hint: "Напомнить снять показания счётчика",
  },
  {
    value: "custom",
    label: "Произвольное",
    hint: "Своё напоминание",
  },
];

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "push", label: "Push" },
  { value: "telegram", label: "Telegram" },
];

export function CreateReminderDialog({ householdId }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReminderKind>("payment_due");
  const [serviceTypeId, setServiceTypeId] = useState<string>("__any__");
  const [daysBefore, setDaysBefore] = useState("3");
  const [channels, setChannels] = useState<NotificationChannel[]>(["email"]);

  const queryClient = useQueryClient();

  const serviceTypes = useQuery({
    queryKey: ["service-types", "all"],
    queryFn: () => serviceTypesApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setKind("payment_due");
      setServiceTypeId("__any__");
      setDaysBefore("3");
      setChannels(["email"]);
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      remindersApi.create(householdId, {
        kind,
        days_before: Number(daysBefore),
        channels,
        service_type_id:
          serviceTypeId === "__any__" ? null : Number(serviceTypeId),
        charge_id: null,
        user_id: null,
        is_active: true,
      }),
    onSuccess: () => {
      toast.success("Правило создано");
      queryClient.invalidateQueries({
        queryKey: ["reminder-rules", householdId],
      });
      setOpen(false);
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 422) {
        toast.error("Проверьте параметры правила");
      } else {
        toast.error("Не удалось создать правило");
      }
    },
  });

  const toggleChannel = (ch: NotificationChannel) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  const handleSubmit = () => {
    if (channels.length === 0) {
      toast.error("Выберите хотя бы один канал");
      return;
    }
    if (!daysBefore || Number(daysBefore) < 0) {
      toast.error("Укажите количество дней");
      return;
    }
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-2" />
          Новое правило
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Правило напоминания</DialogTitle>
          <DialogDescription>
            Система отправит уведомление за N дней до события
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Тип напоминания</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as ReminderKind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {KINDS.find((k) => k.value === kind)?.hint}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Услуга (необязательно)</Label>
            <Select
              value={serviceTypeId}
              onValueChange={setServiceTypeId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">
                  Все услуги
                </SelectItem>
                {(serviceTypes.data ?? []).map((st) => (
                  <SelectItem key={st.id} value={String(st.id)}>
                    {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Оставьте «Все услуги», чтобы напоминать по любому начислению
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="days-before">За сколько дней</Label>
            <Input
              id="days-before"
              type="number"
              min={0}
              max={365}
              value={daysBefore}
              onChange={(e) => setDaysBefore(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Каналы доставки</Label>
            <div className="space-y-2">
              {CHANNELS.map((ch) => (
                <div
                  key={ch.value}
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    id={`ch-${ch.value}`}
                    checked={channels.includes(ch.value)}
                    onCheckedChange={() => toggleChannel(ch.value)}
                  />
                  <Label
                    htmlFor={`ch-${ch.value}`}
                    className="cursor-pointer text-sm"
                  >
                    {ch.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "Создаём…" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}