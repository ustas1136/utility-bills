import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { HttpError } from "@/api/client";
import type { PropertyType } from "@/api/properties";
import { propertyServicesApi } from "@/api/property-services";
import { serviceTypesApi } from "@/api/service-types";
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

interface Props {
  propertyId: number;
  propertyType: PropertyType;
  existingServiceTypeIds: number[];
}

export function AddServiceDialog({
  propertyId,
  propertyType,
  existingServiceTypeIds,
}: Props) {
  const [open, setOpen] = useState(false);
  const [serviceTypeId, setServiceTypeId] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState("");
  const [provider, setProvider] = useState("");

  const queryClient = useQueryClient();

  const services = useQuery({
    queryKey: ["service-types", "for", propertyType],
    queryFn: () => serviceTypesApi.list({ object_type: propertyType }),
    enabled: open,
  });

  // Отфильтровать уже привязанные
  const available = (services.data ?? []).filter(
    (st) => !existingServiceTypeIds.includes(st.id),
  );

  const create = useMutation({
    mutationFn: () =>
      propertyServicesApi.create(propertyId, {
        service_type_id: Number(serviceTypeId),
        account_number: accountNumber.trim() || null,
        provider: provider.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Услуга добавлена");
      queryClient.invalidateQueries({
        queryKey: ["properties", propertyId, "services"],
      });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        toast.error("Эта услуга уже привязана к объекту");
      } else if (error instanceof HttpError && error.status === 422) {
        toast.error("Услуга несовместима с типом объекта");
      } else {
        toast.error("Не удалось добавить услугу");
      }
    },
  });

  const reset = () => {
    setServiceTypeId("");
    setAccountNumber("");
    setProvider("");
  };

  const handleSubmit = () => {
    if (!serviceTypeId) {
      toast.error("Выберите услугу");
      return;
    }
    create.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4 mr-2" />
          Добавить услугу
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Подключить услугу</DialogTitle>
          <DialogDescription>
            Коммунальные услуги, налоги, страховки
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
                {available.map((st) => (
                  <SelectItem key={st.id} value={String(st.id)}>
                    {st.name}
                    {st.unit && (
                      <span className="text-muted-foreground ml-1">
                        ({st.unit})
                      </span>
                    )}
                  </SelectItem>
                ))}
                {available.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Все подходящие услуги уже подключены
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ps-account">Лицевой счёт (необязательно)</Label>
            <Input
              id="ps-account"
              placeholder="1234567890"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ps-provider">Поставщик (необязательно)</Label>
            <Input
              id="ps-provider"
              placeholder="Мосэнергосбыт"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={create.isPending || available.length === 0}
          >
            {create.isPending ? "Добавляем…" : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}