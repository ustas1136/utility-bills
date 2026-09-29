import { ArrowRight, Bell } from "lucide-react";
import { Link } from "react-router-dom";

import type { HomeNotification } from "@/api/bff";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/format";

interface Props {
  items: HomeNotification[];
  loading: boolean;
}

export function NotificationList({ items, loading }: Props) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between p-5 pb-3">
        <h3 className="text-base font-semibold">Уведомления</h3>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/settings">
            Настроить <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </div>

      <div className="px-5 pb-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((n) => (
              <li key={n.id} className="flex gap-3">
                <div className="size-8 shrink-0 rounded-md bg-muted flex items-center justify-center">
                  <Bell className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {n.body}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {formatRelative(n.created_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Уведомлений пока нет
          </div>
        )}
      </div>
    </div>
  );
}