import { api } from "./client";

export interface HomeChargeItem {
  charge_id: number;
  property_name: string;
  service_name: string;
  amount: string;
  paid_amount: string;
  currency: string;
  due_date: string;
  days_left: number;
  status: "pending" | "partial" | "overdue" | "paid" | "cancelled";
}

export interface HomeTotals {
  currency: string;
  pending_amount: string;
  overdue_amount: string;
}

export interface HomeNotification {
  id: number;
  channel: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
}

export interface HomeResponse {
  user_email: string;
  household_count: number;
  upcoming: HomeChargeItem[];
  unread_notifications: HomeNotification[];
  totals: HomeTotals[];
}

export const bffApi = {
  home: (days = 30) =>
    api.get<HomeResponse>(`/bff/home?upcoming_days=${days}`),
};