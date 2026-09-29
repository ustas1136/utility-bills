import { api } from "./client";

export interface Meter {
  id: number;
  property_service_id: number;
  serial_number: string | null;
  initial_value: string;
  unit: string;
  installed_at: string | null;
  replaced_at: string | null;
  replaced_by_meter_id: number | null;
  created_at: string;
}

export interface MeterCreate {
  property_service_id: number;
  serial_number?: string | null;
  initial_value: string;
  unit: string;
  installed_at?: string | null;
}

export interface MeterUpdate {
  serial_number?: string | null;
  unit?: string;
}

export interface MeterReplace {
  replaced_at: string;
  serial_number?: string | null;
  initial_value: string;
  unit?: string;
  installed_at?: string | null;
}

export interface Reading {
  id: number;
  meter_id: number;
  value: string;
  taken_at: string;
  source: string;
  created_at: string;
}

export interface ReadingCreate {
  value: string;
  taken_at: string;
  force?: boolean;
}

export const metersApi = {
  listForService: (propertyServiceId: number) =>
    api.get<Meter[]>(`/property-services/${propertyServiceId}/meters`),

  get: (meterId: number) => api.get<Meter>(`/meters/${meterId}`),

  create: (data: MeterCreate) => api.post<Meter>("/meters", data),

  update: (meterId: number, data: MeterUpdate) =>
    api.patch<Meter>(`/meters/${meterId}`, data),

  replace: (meterId: number, data: MeterReplace) =>
    api.post<Meter>(`/meters/${meterId}/replace`, data),

  readings: (
    meterId: number,
    params: { date_from?: string; date_to?: string } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.date_from) qs.set("date_from", params.date_from);
    if (params.date_to) qs.set("date_to", params.date_to);
    const query = qs.toString();
    return api.get<Reading[]>(
      `/meters/${meterId}/readings${query ? `?${query}` : ""}`,
    );
  },

  addReading: (meterId: number, data: ReadingCreate) =>
    api.post<Reading>(`/meters/${meterId}/readings`, data),

  deleteReading: (meterId: number, readingId: number) =>
    api.delete(`/meters/${meterId}/readings/${readingId}`),
};