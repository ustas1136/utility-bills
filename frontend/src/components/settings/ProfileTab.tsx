import { useQuery } from "@tanstack/react-query";
import { Calendar, Globe, KeyRound, Mail, User as UserIcon } from "lucide-react";

import { authApi } from "@/api/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { useAuthStore } from "@/store/auth";

export function ProfileTab() {
  const cached = useAuthStore((s) => s.user);

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authApi.me(),
    enabled: !!cached,
  });

  const data = me.data ?? cached;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Профиль</CardTitle>
      </CardHeader>
      <CardContent>
        {me.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <div className="flex items-start gap-3">
              <UserIcon className="size-4 mt-0.5 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Имя</dt>
                <dd className="text-sm mt-0.5">
                  {data?.full_name ?? "не указано"}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="size-4 mt-0.5 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="text-sm mt-0.5">{data?.email}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Globe className="size-4 mt-0.5 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Валюта</dt>
                <dd className="text-sm mt-0.5">
                  {data?.base_currency ?? "RUB"}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Globe className="size-4 mt-0.5 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Часовой пояс</dt>
                <dd className="text-sm mt-0.5">{data?.timezone}</dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <KeyRound className="size-4 mt-0.5 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">
                  Аккаунт создан
                </dt>
                <dd className="text-sm mt-0.5">
                  {data?.created_at ? formatDate(data.created_at) : "—"}
                </dd>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="size-4 mt-0.5 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Язык</dt>
                <dd className="text-sm mt-0.5">{data?.locale ?? "ru-RU"}</dd>
              </div>
            </div>
          </dl>
        )}

        <div className="mt-6 pt-6 border-t text-xs text-muted-foreground">
          Редактирование профиля появится в следующем обновлении.
        </div>
      </CardContent>
    </Card>
  );
}