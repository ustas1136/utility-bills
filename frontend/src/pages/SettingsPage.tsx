import { useQuery } from "@tanstack/react-query";
import { KeyRound, Mail, User as UserIcon } from "lucide-react";

import { authApi } from "@/api/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { useAuthStore } from "@/store/auth";

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me(),
    enabled: !!user,
  });

  const data = me.data ?? user;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Профиль и параметры учётной записи
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Профиль</CardTitle>
        </CardHeader>
        <CardContent>
          {me.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : (
            <dl className="space-y-4">
              <div className="flex items-start gap-3">
                <UserIcon className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">Имя</dt>
                  <dd className="text-sm">
                    {data?.full_name ?? "не указано"}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="text-sm">{data?.email}</dd>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <KeyRound className="size-4 mt-0.5 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Аккаунт создан
                  </dt>
                  <dd className="text-sm">
                    {data?.created_at ? formatDate(data.created_at) : "—"}
                  </dd>
                </div>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Уведомления</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Настройка каналов (email, push) и напоминаний появится в следующем
          обновлении.
        </CardContent>
      </Card>
    </div>
  );
}