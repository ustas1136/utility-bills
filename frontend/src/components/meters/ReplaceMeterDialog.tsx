import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { HttpError } from "@/api/client";
import { metersApi, type Meter } from "@/api/meters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  meter: Meter;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReplaceMeterDialog({ meter, open, onOpenChange }: Props) {
  const [replacedAt, setReplacedAt] = useState(today());
  const [serialNumber, setSerialNumber] = useState("");
  const [initialValue, setInitialValue] = useState("0");
  const [unit, setUnit] = useState(meter.unit);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      setReplacedAt(today());
      setSerialNumber("");
      setInitialValue("0");
      setUnit(meter.unit);
    }
  }, [open, meter.unit]);

  const create = useMutation({
    mutationFn: () =>
      metersApi.replace(meter.id, {
        replaced_at: replacedAt,
        serial_number: serialNumber.trim() || null,
        initial_value: initialValue,
        unit,
      }),
    onSuccess: (newMeter) => {
      toast.success(
        `Счётчик заменён. Новый ID: ${newMeter.id}. Открываем…`,
      );
      queryClient.invalidateQueries({
        queryKey: ["meters", "for-service", meter.property_service_id],
      });
      onOpenChange(false);
      // Переходим на страницу нового счётчика
      window.location.href = `/meters/${newMeter.id}`;
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        toast.error("Этот счётчик уже заменён");
      } else {
        toast.error("Не удалось заменить счётчик");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Замена счётчика</DialogTitle>
          <DialogDescription>
            Старый счётчик будет помечен как заменённый. Показания сохранятся
            в истории.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Дата замены</Label>
            <Input
              type="date"
              value={replacedAt}
              onChange={(e) => setReplacedAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Серийный номер нового счётчика</Label>
            <Input
              placeholder="EE00002"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Начальное показание</Label>
              <Input
                type="number"
                step="0.001"
                value={initialValue}
                onChange={(e) => setInitialValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Единица</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Меняем…" : "Заменить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}