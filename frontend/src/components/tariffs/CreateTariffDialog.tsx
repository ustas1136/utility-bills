import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { HttpError } from "@/api/client";
import { householdsApi } from "@/api/households";
import { serviceTypesApi } from "@/api/service-types";
import { tariffsApi } from "@/api/tariffs";
import { Button } from "@/components/ui/button";
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


function defaultValidFrom(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1, 1); // первое число прошлого месяца
  return d.toISOString().slice(0, 10);
}

export function CreateTariffDialog() {
  const [open, setOpen] = useState(false);
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [householdId, setHouseholdId] = useState<string>("__global__");
  const [rate, setRate] = useState("");
  const [currency, setCurrency] = useState("RUB");
  const [validFrom, setValidFrom] = useState(defaultValidFrom());
  const [validTo, setValidTo] = useState("");
  const [region, setRegion] = useState("");

  const queryClient = useQueryClient();

  const serviceTypes = useQuery({
    queryKey: ["service-types", "all"],
    queryFn: () => serviceTypesApi.list(),
    enabled: open,
  });

  const households = useQuery({
    queryKey: ["households"],
    queryFn: () => householdsApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setServiceTypeId("");
      setHouseholdId("__global__");
      setRate("");
      setCurrency("RUB");
      setValidFrom(defaultValidFrom());
      setValidTo("");
      setRegion("");
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      tariffsApi.create({
        service_type_id: Number(serviceTypeId),
        household_id:
          householdId === "__global__" ? null : Number(householdId),
        rate,
        currency,
        valid_from: validFrom,
        valid_to: validTo || null,
        region: region.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Тариф создан");
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
      setOpen(false);
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 422) {
        toast.error("Проверьте ставку и даты");
      } else if (error instanceof HttpError && error.status === 403) {
        toast.error("Нет прав для этого household");
      } else {
        toast.error("Не удалось создать тариф");
      }
    },
  });

  const handleSubmit = () => {
    if (!serviceTypeId) {
      toast.error("Выберите услугу");
      return;
    }
    if (!rate || Number(rate) <= 0) {
      toast.error("Укажите положительную ставку");
      return;
    }
    if (validTo && validTo < validFrom) {
      toast.error("Дата окончания не может быть раньше начала");
      return;
    }
    create.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-2" />
          Новый тариф
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый тариф</DialogTitle>
          <DialogDescription>
            Ставка для расчёта начислений. Для одной услуги может быть
            несколько тарифов с разными периодами.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Услуга</Label>
            <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите услугу" />
              </SelectTrigger>
              <SelectContent>
                {(serviceTypes.data ?? []).map((st) => (
                  <SelectItem key={st.id} value={String(st.id)}>
                    {st.name}
                    {st.unit && (
                      <span className="text-muted-foreground ml-2">
                        ({st.unit})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Область применения</Label>
            <Select value={householdId} onValueChange={setHouseholdId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">
                  Глобальный (для всех household)
                </SelectItem>
                {(households.data ?? []).map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Глобальный подходит для региональных нормативов. Household —
              для личных ставок.
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="tariff-rate">Ставка</Label>
              <Input
                id="tariff-rate"
                type="number"
                step="0.0001"
                placeholder="5.4500"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tariff-currency">Валюта</Label>
              <Input
                id="tariff-currency"
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tariff-from">Действует с</Label>
              <Input
                id="tariff-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tariff-to">
                По{" "}
                <span className="text-muted-foreground">(опц.)</span>
              </Label>
              <Input
                id="tariff-to"
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tariff-region">
              Регион <span className="text-muted-foreground">(опц.)</span>
            </Label>
            <Input
              id="tariff-region"
              placeholder="Москва, Самарская область..."
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={create.isPending || !serviceTypeId || !rate}
          >
            {create.isPending ? "Создаём…" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}