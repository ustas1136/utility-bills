import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Droplet, Plus, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { metersApi } from "@/api/meters";
import { propertyServicesApi } from "@/api/property-services";
import type { PropertyServiceRead } from "@/api/property-services";
import { serviceTypesApi } from "@/api/service-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  service: PropertyServiceRead;
}

export function ServiceRow({ service }: Props) {
  const [meterDialogOpen, setMeterDialogOpen] = useState(false);

  const serviceType = useQuery({
    queryKey: ["service-type", service.service_type_id],
    queryFn: () =>
      serviceTypesApi
        .list()
        .then((items) => items.find((s) => s.id === service.service_type_id)),
  });

  const meters = useQuery({
    queryKey: ["meters", "for-service", service.id],
    queryFn: () => metersApi.listForService(service.id),
  });

  const st = serviceType.data;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-4">
        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {st?.metered ? (
            <Droplet className="size-5 text-primary" />
          ) : (
            <Zap className="size-5 text-primary" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-medium">{st?.name ?? "…"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {service.provider ?? "Поставщик не указан"}
            {service.account_number && (
              <span className="ml-2">· л/с {service.account_number}</span>
            )}
          </div>

          {st?.metered && (
            <div className="mt-3">
              {meters.isLoading ? (
                <Skeleton className="h-8" />
              ) : meters.data && meters.data.length > 0 ? (
                <ul className="space-y-1">
                  {meters.data.map((m) => (
                    <li
                      key={m.id}
                      className="text-xs text-muted-foreground flex items-center gap-2"
                    >
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {m.serial_number ?? "без номера"} · {m.unit} · начальное{" "}
                      {Number(m.initial_value).toFixed(2)}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Счётчик не установлен
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-7 px-2 text-xs"
                onClick={() => setMeterDialogOpen(true)}
              >
                <Plus className="size-3 mr-1" />
                Добавить счётчик
              </Button>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (!confirm("Удалить услугу?")) return;
            try {
              await propertyServicesApi.remove(
                service.property_id,
                service.id,
              );
              toast.success("Услуга удалена");
              window.location.reload();
            } catch {
              toast.error("Не удалось удалить");
            }
          }}
          className="text-destructive"
        >
          Удалить
        </Button>
      </div>

      <AddMeterDialog
        open={meterDialogOpen}
        onOpenChange={setMeterDialogOpen}
        propertyServiceId={service.id}
        defaultUnit={st?.unit ?? "kWh"}
      />
    </div>
  );
}

// ── AddMeterDialog ──────────────────────────────────────────

interface AddMeterProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyServiceId: number;
  defaultUnit: string;
}

function AddMeterDialog({
  open,
  onOpenChange,
  propertyServiceId,
  defaultUnit,
}: AddMeterProps) {
  const [serial, setSerial] = useState("");
  const [initialValue, setInitialValue] = useState("0");
  const [unit, setUnit] = useState(defaultUnit);
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: () =>
      metersApi.create({
        property_service_id: propertyServiceId,
        serial_number: serial.trim() || null,
        initial_value: initialValue,
        unit,
      }),
    onSuccess: () => {
      toast.success("Счётчик добавлен");
      queryClient.invalidateQueries({
        queryKey: ["meters", "for-service", propertyServiceId],
      });
      onOpenChange(false);
      setSerial("");
      setInitialValue("0");
    },
    onError: () => toast.error("Не удалось добавить счётчик"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Новый счётчик</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Серийный номер (необязательно)</Label>
            <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Начальное показание</Label>
            <Input
              type="number"
              value={initialValue}
              onChange={(e) => setInitialValue(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Единица измерения</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}