import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { householdsApi } from "@/api/households";
import {
  propertiesApi,
  type PropertyType,
} from "@/api/properties";
import { EmptyState } from "@/components/EmptyState";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyFormDialog } from "@/components/properties/PropertyFormDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PROPERTY_LABELS_PLURAL, PROPERTY_TYPES } from "@/lib/property";

type Filter = PropertyType | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Все" },
  ...PROPERTY_TYPES.map((t) => ({
    value: t as Filter,
    label: PROPERTY_LABELS_PLURAL[t],
  })),
];

export function PropertiesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  // Deep-link из палитры команд: /properties?new=1 открывает форму объекта.
  // Состояние выводим из параметра (без эффекта), URL чистим при закрытии.
  const wantsNew = params.get("new") === "1";
  const handleCreateOpenChange = (v: boolean) => {
    setCreateOpen(v);
    if (!v && wantsNew) setParams({}, { replace: true });
  };

  const households = useQuery({
    queryKey: ["households"],
    queryFn: () => householdsApi.list(),
  });

  const properties = useQuery({
    queryKey: ["properties", filter],
    queryFn: () =>
      propertiesApi.list(filter === "all" ? {} : { type: filter }),
  });

  // Личный household — первый с is_personal, или просто первый
  const personalHousehold =
    households.data?.find((h) => h.is_personal) ?? households.data?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[1.75rem] leading-9 sm:text-[2rem] sm:leading-10 font-semibold tracking-tight">Объекты</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Квартиры, дома, участки, автомобили
          </p>
        </div>
        {personalHousehold && (
          <PropertyFormDialog
            householdId={personalHousehold.id}
            open={createOpen || wantsNew}
            onOpenChange={handleCreateOpenChange}
          />
        )}
      </div>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.value)}
            className={cn("rounded-full")}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Список */}
      {properties.isLoading || households.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : properties.data && properties.data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {properties.data.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="Пока нет объектов"
          description="Добавьте квартиру, дом, участок или автомобиль — и мы будем напоминать о платежах за них."
          action={
            personalHousehold ? (
              <PropertyFormDialog householdId={personalHousehold.id} />
            ) : undefined
          }
        />
      )}
    </div>
  );
}