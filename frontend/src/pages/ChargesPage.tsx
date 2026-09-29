import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { useState } from "react";

import { chargesApi, type ChargeStatus } from "@/api/charges";
import { propertiesApi } from "@/api/properties";
import { propertyServicesApi } from "@/api/property-services";
import { serviceTypesApi } from "@/api/service-types";
import { ChargeCard } from "@/components/charges/ChargeCard";
import { CreateChargeDialog } from "@/components/charges/CreateChargeDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Filter = ChargeStatus | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "pending", label: "Ожидают" },
  { value: "overdue", label: "Просрочены" },
  { value: "partial", label: "Частично" },
  { value: "paid", label: "Оплачено" },
  { value: "cancelled", label: "Отменено" },
];

export function ChargesPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const charges = useQuery({
    queryKey: ["charges", filter],
    queryFn: () =>
      chargesApi.list(filter === "all" ? {} : { status: filter }),
  });

  const properties = useQuery({
    queryKey: ["properties", "for-charges"],
    queryFn: () => propertiesApi.list(),
  });

  // Плоский список property_services с информацией о property
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
    enabled: !!properties.data,
  });

  const serviceTypes = useQuery({
    queryKey: ["service-types", "all"],
    queryFn: () => serviceTypesApi.list(),
  });

  // Карты для быстрого поиска
  const servicesMap = new Map(
    (serviceList.data ?? []).map((s) => [s.id, s]),
  );
  const serviceTypesMap = new Map(
    (serviceTypes.data ?? []).map((s) => [s.id, s]),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Платежи</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Начисления и оплаты
          </p>
        </div>
        <CreateChargeDialog />
      </div>

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

      {charges.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : charges.data && charges.data.length > 0 ? (
        <div className="space-y-3">
          {charges.data.map((charge) => {
            const ps = servicesMap.get(charge.property_service_id);
            const st = ps ? serviceTypesMap.get(ps.service_type_id) : undefined;
            return (
              <ChargeCard
                key={charge.id}
                charge={charge}
                propertyName={ps?.property.name}
                serviceName={st?.name}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Receipt}
          title="Нет начислений"
          description="Создайте начисление вручную или рассчитайте его по показаниям счётчика."
        />
      )}
    </div>
  );
}