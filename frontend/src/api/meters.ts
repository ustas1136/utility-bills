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

export interface Reading {
  id: number;
  meter_id: number;
  value: string;
  taken_at: string;
  source: string;
  created_at: string;
}

export const metersApi = {
  listForService: (propertyServiceId: number) =>
    api.get<Meter[]>(`/property-services/${propertyServiceId}/meters`),

  create: (data: MeterCreate) => api.post<Meter>("/meters", data),

  readings: (meterId: number) =>
    api.get<Reading[]>(`/meters/${meterId}/readings`),
};