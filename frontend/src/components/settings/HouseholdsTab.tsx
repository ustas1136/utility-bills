import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Home, Mail, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  invitationsApi,
  membersApi,
  type HouseholdRole,
} from "@/api/household-members";
import { householdsApi } from "@/api/households";
import { InviteMemberDialog } from "@/components/settings/InviteMemberDialog";
import { MemberRow } from "@/components/settings/MemberRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/format";

export function HouseholdsTab() {
  const queryClient = useQueryClient();

  const households = useQuery({
    queryKey: ["households"],
    queryFn: () => householdsApi.list(),
  });

  const [activeHouseholdId, setActiveHouseholdId] = useState<number | null>(
    null,
  );

  const currentHouseholdId =
    activeHouseholdId ??
    households.data?.find((h) => h.is_personal)?.id ??
    households.data?.[0]?.id ??
    null;

  const currentHousehold = households.data?.find(
    (h) => h.id === currentHouseholdId,
  );

  const members = useQuery({
    queryKey: ["members", currentHouseholdId],
    queryFn: () => membersApi.list(currentHouseholdId!),
    enabled: !!currentHouseholdId,
  });

  const invitations = useQuery({
    queryKey: ["invitations", currentHouseholdId],
    queryFn: () => invitationsApi.list(currentHouseholdId!),
    enabled: !!currentHouseholdId,
  });

  const cancelInvitation = useMutation({
    mutationFn: async (_invId: number) => {
      // Backend пока не поддерживает DELETE invitations.
      // Когда добавим — заменим на реальный вызов.
      throw new Error("not implemented");
    },
    onError: () => toast.error("Отмена приглашений пока не реализована"),
  });

  if (households.isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  const currentUserRole: HouseholdRole =
    (currentHousehold?.role as HouseholdRole) ?? "member";
  const canInvite =
    currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" />
            Участники
          </CardTitle>
          {canInvite && currentHouseholdId && (
            <InviteMemberDialog householdId={currentHouseholdId} />
          )}
        </CardHeader>
        <CardContent>
          {/* Селектор household */}
          {households.data && households.data.length > 1 && (
            <div className="mb-4">
              <Select
                value={String(currentHouseholdId ?? "")}
                onValueChange={(v) => setActiveHouseholdId(Number(v))}
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Выберите семью" />
                </SelectTrigger>
                <SelectContent>
                  {households.data.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      {h.name}
                      {h.is_personal && (
                        <span className="text-muted-foreground ml-2">
                          (личный)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {members.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : members.data && members.data.length > 0 ? (
            <div className="divide-y">
              {members.data.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  householdId={currentHouseholdId!}
                  currentUserRole={currentUserRole}
                  memberEmail={m.email ?? undefined}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Участников нет
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending приглашения */}
      {invitations.data && invitations.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="size-4" />
              Ожидают принятия
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {invitations.data
                .filter((inv) => !inv.accepted_at)
                .map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Clock className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {inv.email}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Роль: {inv.role} · истекает{" "}
                        {formatRelative(inv.expires_at)}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs font-normal bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-transparent"
                    >
                      Ожидает
                    </Badge>
                    {canInvite && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={() => cancelInvitation.mutate(inv.id)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Информация */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Home className="size-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium text-foreground">
                Домашние хозяйства
              </div>
              <p className="mt-1">
                Все объекты, услуги и платежи привязаны к household.
                Приглашайте членов семьи для совместного учёта. Права
                зависят от роли: владелец и администратор могут управлять
                всем, участник — вносить показания и оплачивать,
                наблюдатель — только смотреть.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}