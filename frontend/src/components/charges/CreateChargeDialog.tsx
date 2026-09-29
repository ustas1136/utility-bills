import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { chargesApi } from "@/api/charges";
import { HttpError } from "@/api/client";
import { propertiesApi } from "@/api/properties";
import { propertyServicesApi } from "@/api/property-services";
import { serviceTypesApi } from "@/api/service-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function CreateChargeDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "calculated">("manual");

  const properties = useQuery({
    queryKey: ["properties", "for-charge-create"],
    queryFn: () => propertiesApi.list(),
    enabled: open,
  });

  const serviceList = useQuery({
    queryKey: ["property-services-list", properties.data?.map((p) => p.id)],
    queryFn: async () => {
      if (!properties.data) return [];
      const all = await Promise.all(
        properties.data.map(async (p) => {
          const services = await propertyServicesApi.list(p.id);
          return services.map((s) => ({ ...s, property: p }));
        }),
      );
      return all.flat();
    },
    enabled: open && !!properties.data,
  });

  const serviceTypes = useQuery({
    queryKey: ["service-types", "all"],
    queryFn: () => serviceTypesApi.list(),
    enabled: open,
  });

  const serviceTypesMap = new Map(
    (serviceTypes.data ?? []).map((s) => [s.id, s]),
  );

  const [propertyServiceId, setPropertyServiceId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setPropertyServiceId("");
      setPeriodStart("");
      setPeriodEnd("");
      setDueDate("");
      setAmount("");
      setNotes("");
      setMode("manual");
    }
  }, [open]);

  useEffect(() => {
    if (open && !periodStart) {
      const today = new Date();
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const due = new Date(today.getFullYear(), today.getMonth() + 1, 10);
      setPeriodStart(toISO(first));
      setPeriodEnd(toISO(last));
      setDueDate(toISO(due));
    }
  }, [open, periodStart]);

  const queryClient = useQueryClient();

  const createManual = useMutation({
    mutationFn: () =>
      chargesApi.create({
        property_service_id: Number(propertyServiceId),
        period_start: periodStart,
        period_end: periodEnd,
        amount,
        due_date: dueDate,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Начисление создано");
      queryClient.invalidateQueries({ queryKey: ["charges"] });
      queryClient.invalidateQueries({ queryKey: ["bff", "home"] });
      setOpen(false);
    },
    onError: (e) => {
      if (e instanceof HttpError && e.status === 422) {
        toast.error("Проверьте даты и сумму");
      } else {
        toast.error("Не удалось создать начисление");
      }
    },
  });

  const createCalculated = useMutation({
    mutationFn: () =>
      chargesApi.calculate({
        property_service_id: Number(propertyServiceId),
        period_start: periodStart,
        period_end: periodEnd,
        due_date: dueDate,
        notes: notes.trim() || null,
      }),
    onSuccess: (charge) => {
      toast.success(
        `Рассчитано: ${charge.amount} ${charge.currency}`,
      );
      queryClient.invalidateQueries({ queryKey: ["charges"] });
      queryClient.invalidateQueries({ queryKey: ["bff", "home"] });
      setOpen(false);
    },
    onError: (e) => {
      if (e instanceof HttpError && e.status === 422) {
        toast.error(
          "Недостаточно данных: нужны счётчик, показания и тариф",
        );
      } else {
        toast.error("Не удалось рассчитать");
      }
    },
  });

  const isPending = createManual.isPending || createCalculated.isPending;
  const canSubmit =
    !!propertyServiceId && !!periodStart && !!periodEnd && !!dueDate;

  // Опции для селекта услуги
  const serviceOptions = (serviceList.data ?? []).map((s) => {
    const st = serviceTypesMap.get(s.service_type_id);
    return {
      value: String(s.id),
      label: `${s.property.name} · ${st?.name ?? `услуга #${s.service_type_id}`}`,
    };
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-2" />
          Новое начисление
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Начисление</DialogTitle>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "manual" | "calculated")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Вручную</TabsTrigger>
            <TabsTrigger value="calculated">
              <Calculator className="size-4 mr-1.5" />
              По счётчику
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>Услуга</Label>
              <Select
                value={propertyServiceId}
                onValueChange={setPropertyServiceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите услугу" />
                </SelectTrigger>
                <SelectContent>
                  {serviceOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                  {serviceOptions.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Сначала привяжите услугу к объекту
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Начало периода</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Конец периода</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Сумма</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Оплатить до</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Заметки</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="calculated" className="space-y-4 pt-4">
            <div className="text-sm text-muted-foreground">
              Сумма будет рассчитана автоматически по последнему показанию
              счётчика, предыдущему показанию и тарифу.
            </div>

            <div className="space-y-1.5">
              <Label>Услуга с счётчиком</Label>
              <Select
                value={propertyServiceId}
                onValueChange={setPropertyServiceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите услугу" />
                </SelectTrigger>
                <SelectContent>
                  {serviceOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                  {serviceOptions.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Сначала привяжите услугу к объекту
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Начало периода</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Конец периода</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Оплатить до</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          {mode === "manual" ? (
            <Button
              onClick={() => createManual.mutate()}
              disabled={isPending || !canSubmit || !amount}
            >
              {isPending ? "Создаём…" : "Создать"}
            </Button>
          ) : (
            <Button
              onClick={() => createCalculated.mutate()}
              disabled={isPending || !canSubmit}
            >
              {isPending ? "Считаем…" : "Рассчитать и создать"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}