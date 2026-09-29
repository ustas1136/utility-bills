import { api } from "./client";

export interface Tariff {
  id: number;
  service_type_id: number;
  household_id: number | null;
  region: string | null;
  rate: string;
  currency: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
}

export interface TariffCreate {
  service_type_id: number;
  household_id?: number | null;
  region?: string | null;
  rate: string;
  currency?: string;
  valid_from: string;
  valid_to?: string | null;
}

export const tariffsApi = {
  list: (params: {
    service_type_id?: number;
    on_date?: string;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.service_type_id)
      qs.set("service_type_id", String(params.service_type_id));
    if (params.on_date) qs.set("on_date", params.on_date);
    const query = qs.toString();
    return api.get<Tariff[]>(`/tariffs${query ? `?${query}` : ""}`);
  },

  create: (data: TariffCreate) => api.post<Tariff>("/tariffs", data),

  // Backend пока не поддерживает DELETE /tariffs/:id.
  // Когда добавим — раскомментируем.
  remove: (id: number) => api.delete(`/tariffs/${id}`),
};