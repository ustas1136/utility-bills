import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  propertiesApi,
  type PropertyCreate,
  type PropertyType,
} from "@/api/properties";
import { HttpError } from "@/api/client";
import { PropertyMetadataFields } from "@/components/properties/PropertyMetadataFields";
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
import { PROPERTY_LABELS, PROPERTY_TYPES } from "@/lib/property";

interface Props {
  householdId: number;
}

export function PropertyFormDialog({ householdId }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PropertyType>("apartment");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [metadata, setMetadata] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  // При смене типа сбрасываем метаданные
  useEffect(() => {
    setMetadata({});
  }, [type]);

  // Сброс всей формы при закрытии
  useEffect(() => {
    if (!open) {
      setName("");
      setAddress("");
      setMetadata({});
      setType("apartment");
    }
  }, [open]);

  const create = useMutation({
    mutationFn: (data: PropertyCreate) => propertiesApi.create(data),
    onSuccess: () => {
      toast.success("Объект добавлен");
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["bff", "home"] });
      setOpen(false);
    },
    onError: (error) => {
      if (error instanceof HttpError) {
        toast.error(`Ошибка: ${error.status}`);
      } else {
        toast.error("Не удалось создать объект");
      }
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Введите название");
      return;
    }

    // Преобразуем метаданные: числа — в number, пустые — не включаем
    const cleanMetadata: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (!v) continue;
      const num = Number(v);
      cleanMetadata[k] = !isNaN(num) && v.trim() !== "" ? num : v;
    }

    create.mutate({
      household_id: householdId,
      type,
      name: name.trim(),
      address: address.trim() || null,
      metadata_json: cleanMetadata,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-2" />
          Добавить объект
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Новый объект</DialogTitle>
          <DialogDescription>
            Квартира, дом, участок, автомобиль или что-то другое
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Тип объекта</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as PropertyType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PROPERTY_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prop-name">Название</Label>
            <Input
              id="prop-name"
              placeholder="Например: Квартира на Ленина"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prop-address">Адрес (необязательно)</Label>
            <Input
              id="prop-address"
              placeholder="ул. Ленина, 1, кв. 42"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <PropertyMetadataFields
            type={type}
            values={metadata}
            onChange={(k, v) =>
              setMetadata((prev) => ({ ...prev, [k]: v }))
            }
          />
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