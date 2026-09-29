import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Globe, Home, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Tariff } from "@/api/tariffs";
import { tariffsApi } from "@/api/tariffs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

interface Props {
  tariff: Tariff;
  serviceName: string;
  householdName?: string;
}

export function TariffCard({ tariff, serviceName, householdName }: Props) {
  const isGlobal = tariff.household_id === null;
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => tariffsApi.remove(tariff.id),
    onSuccess: () => {
      toast.success("Тариф удалён");
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
    },
    onError: () => toast.error("Не удалось удалить тариф"),
  });

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">{serviceName}</div>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {Number(tariff.rate).toFixed(4)}
            </span>
            <span className="text-sm text-muted-foreground">
              {tariff.currency} / ед.
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              с {formatDate(tariff.valid_from)}
              {tariff.valid_to
                ? ` по ${formatDate(tariff.valid_to)}`
                : " (бессрочно)"}
            </span>

            <span className="flex items-center gap-1">
              {isGlobal ? (
                <>
                  <Globe className="size-3" />
                  Глобальный
                </>
              ) : (
                <>
                  <Home className="size-3" />
                  {householdName ?? `Household #${tariff.household_id}`}
                </>
              )}
            </span>

            {tariff.region && <span>{tariff.region}</span>}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-destructive"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm(`Удалить тариф на ${serviceName}?`)) {
              remove.mutate();
            }
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Card>
  );
}