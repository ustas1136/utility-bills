import { api } from "./client";

export interface PropertyServiceRead {
  id: number;
  property_id: number;
  service_type_id: number;
  account_number: string | null;
  provider: string | null;
  is_active: boolean;
  started_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface PropertyServiceCreate {
  service_type_id: number;
  account_number?: string | null;
  provider?: string | null;
  started_at?: string | null;
  closed_at?: string | null;
}

export const propertyServicesApi = {
  list: (propertyId: number) =>
    api.get<PropertyServiceRead[]>(`/properties/${propertyId}/services`),

  create: (propertyId: number, data: PropertyServiceCreate) =>
    api.post<PropertyServiceRead>(`/properties/${propertyId}/services`, data),

  update: (
    propertyId: number,
    serviceId: number,
    data: Partial<PropertyServiceCreate> & { is_active?: boolean },
  ) =>
    api.patch<PropertyServiceRead>(
      `/properties/${propertyId}/services/${serviceId}`,
      data,
    ),

  remove: (propertyId: number, serviceId: number) =>
    api.delete(`/properties/${propertyId}/services/${serviceId}`),
};