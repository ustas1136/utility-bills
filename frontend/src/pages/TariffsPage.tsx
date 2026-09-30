import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { householdsApi } from "@/api/households";
import { serviceTypesApi } from "@/api/service-types";
import { tariffsApi, type Tariff } from "@/api/tariffs";
import { EmptyState } from "@/components/EmptyState";
import { CreateTariffDialog } from "@/components/tariffs/CreateTariffDialog";
import { TariffCard } from "@/components/tariffs/TariffCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TariffsPage() {
  const [serviceFilter, setServiceFilter] = useState<string>("__all__");

  const tariffs = useQuery({
    queryKey: ["tariffs", serviceFilter],
    queryFn: () =>
      tariffsApi.list(
        serviceFilter === "__all__"
          ? {}
          : { service_type_id: Number(serviceFilter) },
      ),
  });

  const serviceTypes = useQuery({
    queryKey: ["service-types", "all"],
    queryFn: () => serviceTypesApi.list(),
  });

  const households = useQuery({
    queryKey: ["households"],
    queryFn: () => householdsApi.list(),
  });

  // Карты для быстрого поиска
  const serviceTypesMap = useMemo(
    () => new Map((serviceTypes.data ?? []).map((s) => [s.id, s])),
    [serviceTypes.data],
  );
  const householdsMap = useMemo(
    () => new Map((households.data ?? []).map((h) => [h.id, h])),
    [households.data],
  );

  // Группировка по услугам (для читаемости списка)
  const grouped = useMemo(() => {
    const map = new Map<number, { serviceName: string; items: Tariff[] }>();
    for (const t of tariffs.data ?? []) {
      const st = serviceTypesMap.get(t.service_type_id);
      const key = t.service_type_id;
      if (!map.has(key)) {
        map.set(key, { serviceName: st?.name ?? `Услуга #${key}`, items: [] });
      }
      map.get(key)!.items.push(t);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.serviceName.localeCompare(b.serviceName),
    );
  }, [tariffs.data, serviceTypesMap]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Тарифы</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ставки для расчёта начислений
          </p>
        </div>
        <CreateTariffDialog />
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Все услуги</SelectItem>
            {(serviceTypes.data ?? []).map((st) => (
              <SelectItem key={st.id} value={String(st.id)}>
                {st.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tariffs.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : grouped.length > 0 ? (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.serviceName} className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {group.serviceName}
              </h2>
              <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-3")}>
                {group.items.map((t) => (
                  <TariffCard
                    key={t.id}
                    tariff={t}
                    serviceName={
                      serviceTypesMap.get(t.service_type_id)?.name ??
                      `Услуга #${t.service_type_id}`
                    }
                    householdName={
                      t.household_id
                        ? householdsMap.get(t.household_id)?.name
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title="Тарифов нет"
          description="Добавьте первый тариф — без него не получится автоматически рассчитывать начисления по показаниям счётчика."
          action={<CreateTariffDialog />}
        />
      )}
    </div>
  );
}