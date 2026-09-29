import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  remindersApi,
  type NotificationChannel,
  type ReminderRule,
} from "@/api/reminders";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  rule: ReminderRule;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "push", label: "Push" },
  { value: "telegram", label: "Telegram" },
];

export function EditReminderDialog({ rule, open, onOpenChange }: Props) {
  const [daysBefore, setDaysBefore] = useState(String(rule.days_before));
  const [channels, setChannels] = useState<NotificationChannel[]>(rule.channels);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setDaysBefore(String(rule.days_before));
      setChannels(rule.channels);
    }
  }, [open, rule]);

  const update = useMutation({
    mutationFn: () =>
      remindersApi.update(rule.id, {
        days_before: Number(daysBefore),
        channels,
      }),
    onSuccess: () => {
      toast.success("Правило обновлено");
      queryClient.invalidateQueries({
        queryKey: ["reminder-rules", rule.household_id],
      });
      onOpenChange(false);
    },
    onError: () => toast.error("Не удалось обновить"),
  });

  const toggleChannel = (ch: NotificationChannel) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать правило</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-days">За сколько дней</Label>
            <Input
              id="edit-days"
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
                <div key={ch.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`edit-ch-${ch.value}`}
                    checked={channels.includes(ch.value)}
                    onCheckedChange={() => toggleChannel(ch.value)}
                  />
                  <Label
                    htmlFor={`edit-ch-${ch.value}`}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => update.mutate()}
            disabled={update.isPending || channels.length === 0}
          >
            {update.isPending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}