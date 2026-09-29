import { api } from "./client";

export type PropertyType =
  | "apartment"
  | "house"
  | "land"
  | "vehicle"
  | "other";

export interface PropertyBase {
  type: PropertyType;
  name: string;
  address: string | null;
  metadata_json: Record<string, unknown>;
}

export interface PropertyRead extends PropertyBase {
  id: number;
  household_id: number;
  is_archived: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyCreate extends PropertyBase {
  household_id: number;
}

export interface PropertyUpdate {
  name?: string;
  address?: string | null;
  metadata_json?: Record<string, unknown>;
  is_archived?: boolean;
}

export const propertiesApi = {
  list: (params: { type?: PropertyType; include_archived?: boolean } = {}) => {
    const qs = new URLSearchParams();
    if (params.type) qs.set("type", params.type);
    if (params.include_archived) qs.set("include_archived", "true");
    const query = qs.toString();
    return api.get<PropertyRead[]>(
      `/properties${query ? `?${query}` : ""}`,
    );
  },

  get: (id: number) => api.get<PropertyRead>(`/properties/${id}`),

  create: (data: PropertyCreate) => api.post<PropertyRead>("/properties", data),

  update: (id: number, data: PropertyUpdate) =>
    api.patch<PropertyRead>(`/properties/${id}`, data),

  archive: (id: number) => api.delete(`/properties/${id}`),
};