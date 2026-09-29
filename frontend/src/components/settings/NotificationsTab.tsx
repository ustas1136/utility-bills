import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Mail, Send, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  devicesApi,
  preferencesApi,
  type NotificationChannel,
  type NotificationPreference,
} from "@/api/reminders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatRelative } from "@/lib/format";

const CHANNELS: {
  value: NotificationChannel;
  label: string;
  description: string;
  icon: typeof Mail;
}[] = [
  {
    value: "email",
    label: "Email",
    description: "Уведомления на почту",
    icon: Mail,
  },
  {
    value: "push",
    label: "Push",
    description: "Мобильное приложение (FCM)",
    icon: Smartphone,
  },
  {
    value: "telegram",
    label: "Telegram",
    description: "Бот-уведомления (в разработке)",
    icon: Send,
  },
];

export function NotificationsTab() {
  const queryClient = useQueryClient();

  const prefs = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => preferencesApi.list(),
  });

  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: () => devicesApi.list(),
  });

  // Соответствие: канал → текущая preference
  const prefsMap = new Map(
    (prefs.data ?? []).map((p) => [p.channel, p]),
  );

  const upsert = useMutation({
    mutationFn: ({
      channel,
      data,
    }: {
      channel: NotificationChannel;
      data: Parameters<typeof preferencesApi.upsert>[1];
    }) => preferencesApi.upsert(channel, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
    onError: () => toast.error("Не удалось сохранить"),
  });

  const deleteDevice = useMutation({
    mutationFn: (id: number) => devicesApi.remove(id),
    onSuccess: () => {
      toast.success("Устройство отключено");
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Каналы уведомлений</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefs.isLoading ? (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          ) : (
            CHANNELS.map((ch) => (
              <ChannelRow
                key={ch.value}
                channel={ch}
                pref={prefsMap.get(ch.value)}
                onChange={(data) =>
                  upsert.mutate({ channel: ch.value, data })
                }
                saving={upsert.isPending}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Устройства</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.isLoading ? (
            <Skeleton className="h-16" />
          ) : devices.data && devices.data.length > 0 ? (
            <ul className="divide-y">
              {devices.data.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 py-3"
                >
                  <Smartphone className="size-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">
                      {d.device_name ?? d.platform}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.platform}
                      {d.last_seen_at &&
                        ` · последний раз ${formatRelative(d.last_seen_at)}`}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-8"
                    onClick={() => {
                      if (confirm("Отключить устройство?"))
                        deleteDevice.mutate(d.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Bell className="size-6 mx-auto mb-2 text-muted-foreground/50" />
              Устройств не подключено. Push-уведомления появятся, когда
              вы установите мобильное приложение.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── ChannelRow ──────────────────────────────────────────────

interface ChannelRowProps {
  channel: (typeof CHANNELS)[number];
  pref?: NotificationPreference;
  onChange: (data: {
    enabled?: boolean;
    quiet_hours_start?: string | null;
    quiet_hours_end?: string | null;
  }) => void;
  saving: boolean;
}

function ChannelRow({ channel, pref, onChange, saving }: ChannelRowProps) {
  const [enabled, setEnabled] = useState(pref?.enabled ?? true);
  const [start, setStart] = useState(pref?.quiet_hours_start?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(pref?.quiet_hours_end?.slice(0, 5) ?? "");

  // Обновляем локальное состояние, когда подгрузились данные
  useEffect(() => {
    if (pref) {
      setEnabled(pref.enabled);
      setStart(pref.quiet_hours_start?.slice(0, 5) ?? "");
      setEnd(pref.quiet_hours_end?.slice(0, 5) ?? "");
    }
  }, [pref]);

  const handleToggle = (value: boolean) => {
    setEnabled(value);
    onChange({ enabled: value });
  };

  const handleQuietHoursSave = () => {
    onChange({
      quiet_hours_start: start ? `${start}:00` : null,
      quiet_hours_end: end ? `${end}:00` : null,
    });
    toast.success("Тихие часы сохранены");
  };

  const Icon = channel.icon;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">{channel.label}</div>
          <div className="text-xs text-muted-foreground">
            {channel.description}
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
      </div>

      {enabled && (
        <div className="pl-12 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Тихие часы: с</Label>
            <Input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">до</Label>
            <Input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-28"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleQuietHoursSave}
            disabled={saving}
          >
            Сохранить
          </Button>
        </div>
      )}
    </div>
  );
}