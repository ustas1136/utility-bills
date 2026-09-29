import { api } from "./client";

export type ChargeStatus =
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled";

export type PaymentMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "online"
  | "other";

export interface ChargeRead {
  id: number;
  property_service_id: number;
  period_start: string;
  period_end: string;
  amount: string;
  currency: string;
  due_date: string;
  status: ChargeStatus;
  source: string;
  external_id: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  paid_amount: string;
}

export interface ChargeCreate {
  property_service_id: number;
  period_start: string;
  period_end: string;
  amount: string;
  currency?: string;
  due_date: string;
  notes?: string | null;
}

export interface ChargeCalculateRequest {
  property_service_id: number;
  period_start: string;
  period_end: string;
  due_date: string;
  notes?: string | null;
}

export interface ChargeUpdate {
  amount?: string;
  due_date?: string;
  notes?: string | null;
}

export interface PaymentRead {
  id: number;
  charge_id: number;
  amount: string;
  currency: string;
  paid_at: string;
  method: PaymentMethod;
  external_id: string | null;
  comment: string | null;
  created_by: number | null;
  created_at: string;
}

export interface PaymentCreate {
  amount: string;
  currency?: string;
  paid_at: string;
  method?: PaymentMethod;
  external_id?: string | null;
  comment?: string | null;
}

export const chargesApi = {
  list: (params: {
    property_service_id?: number;
    status?: ChargeStatus;
    due_before?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.property_service_id)
      qs.set("property_service_id", String(params.property_service_id));
    if (params.status) qs.set("status", params.status);
    if (params.due_before) qs.set("due_before", params.due_before);
    const query = qs.toString();
    return api.get<ChargeRead[]>(`/charges${query ? `?${query}` : ""}`);
  },

  get: (id: number) => api.get<ChargeRead>(`/charges/${id}`),

  create: (data: ChargeCreate) => api.post<ChargeRead>("/charges", data),

  calculate: (data: ChargeCalculateRequest) =>
    api.post<ChargeRead>("/charges/calculate", data),

  update: (id: number, data: ChargeUpdate) =>
    api.patch<ChargeRead>(`/charges/${id}`, data),

  cancel: (id: number) => api.post<ChargeRead>(`/charges/${id}/cancel`),

  payments: (chargeId: number) =>
    api.get<PaymentRead[]>(`/charges/${chargeId}/payments`),

  addPayment: (chargeId: number, data: PaymentCreate) =>
    api.post<PaymentRead>(`/charges/${chargeId}/payments`, data),

  deletePayment: (chargeId: number, paymentId: number) =>
    api.delete(`/charges/${chargeId}/payments/${paymentId}`),
};