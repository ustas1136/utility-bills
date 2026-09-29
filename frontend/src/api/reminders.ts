import { api } from "./client";

// ── Правила напоминаний ─────────────────────────────────────

export type ReminderKind = "payment_due" | "reading_due" | "custom";
export type NotificationChannel = "email" | "push" | "telegram";

export interface ReminderRule {
  id: number;
  household_id: number;
  user_id: number | null;
  charge_id: number | null;
  service_type_id: number | null;
  kind: ReminderKind;
  days_before: number;
  channels: NotificationChannel[];
  is_active: boolean;
  created_at: string;
}

export interface ReminderRuleCreate {
  user_id?: number | null;
  charge_id?: number | null;
  service_type_id?: number | null;
  kind: ReminderKind;
  days_before: number;
  channels: NotificationChannel[];
  is_active?: boolean;
}

export const remindersApi = {
  listForHousehold: (householdId: number) =>
    api.get<ReminderRule[]>(`/households/${householdId}/reminder-rules`),

  create: (householdId: number, data: ReminderRuleCreate) =>
    api.post<ReminderRule>(
      `/households/${householdId}/reminder-rules`,
      data,
    ),

  update: (
    ruleId: number,
    data: { days_before?: number; channels?: NotificationChannel[]; is_active?: boolean },
  ) => api.patch<ReminderRule>(`/reminder-rules/${ruleId}`, data),

  remove: (ruleId: number) => api.delete(`/reminder-rules/${ruleId}`),
};

// ── Настройки уведомлений ───────────────────────────────────

export interface NotificationPreference {
  id: number;
  user_id: number;
  channel: NotificationChannel;
  enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  updated_at: string;
}

export interface NotificationPreferenceUpdate {
  enabled?: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

export const preferencesApi = {
  list: () =>
    api.get<NotificationPreference[]>("/me/notification-preferences"),

  upsert: (channel: NotificationChannel, data: NotificationPreferenceUpdate) =>
    api.put<NotificationPreference>(
      `/me/notification-preferences/${channel}`,
      data,
    ),
};

// ── Устройства (FCM) ────────────────────────────────────────

export interface Device {
  id: number;
  user_id: number;
  platform: "android" | "ios" | "web";
  device_name: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export const devicesApi = {
  list: () => api.get<Device[]>("/me/devices"),
  remove: (deviceId: number) => api.delete(`/me/devices/${deviceId}`),
};