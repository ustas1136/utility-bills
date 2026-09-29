import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { HttpError } from "@/api/client";
import { metersApi, type Meter, type Reading } from "@/api/meters";
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
  meter: Meter;
  lastReading: Reading | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddReadingDialog({
  meter,
  lastReading,
  open,
  onOpenChange,
}: Props) {
  const [value, setValue] = useState("");
  const [takenAt, setTakenAt] = useState(today());
  const [force, setForce] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      setValue("");
      setTakenAt(today());
      setForce(false);
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      metersApi.addReading(meter.id, {
        value,
        taken_at: takenAt,
        force,
      }),
    onSuccess: () => {
      toast.success("Показание добавлено");
      queryClient.invalidateQueries({ queryKey: ["meter", meter.id] });
      queryClient.invalidateQueries({
        queryKey: ["meters", "for-service", meter.property_service_id],
      });
      onOpenChange(false);
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 422) {
        toast.error(
          "Показание меньше предыдущего. Поставьте галочку «Принудительно», если это замена счётчика.",
        );
      } else if (error instanceof HttpError && error.status === 409) {
        toast.error("На эту дату показание уже есть");
      } else {
        toast.error("Не удалось сохранить показание");
      }
    },
  });

  const lastValue = lastReading
    ? Number(lastReading.value)
    : Number(meter.initial_value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Новое показание</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Предыдущее значение
              </span>
              <span className="font-medium tabular-nums">
                {lastValue.toFixed(2)} {meter.unit}
              </span>
            </div>
            {lastReading && (
              <div className="text-xs text-muted-foreground mt-1">
                от {new Date(lastReading.taken_at).toLocaleDateString("ru-RU")}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reading-value">
              Новое значение ({meter.unit})
            </Label>
            <Input
              id="reading-value"
              type="number"
              step="0.001"
              placeholder={lastValue.toFixed(3)}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reading-date">Дата снятия</Label>
            <Input
              id="reading-date"
              type="date"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="reading-force"
              checked={force}
              onCheckedChange={(c) => setForce(c === true)}
            />
            <Label
              htmlFor="reading-force"
              className="text-xs text-muted-foreground cursor-pointer leading-tight"
            >
              Принудительно (обойти проверку монотонности) — например, при
              замене счётчика
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !value}
          >
            {create.isPending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}