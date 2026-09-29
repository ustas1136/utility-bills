import { api } from "./client";
import type { PropertyType } from "./properties";

export type ServiceCategory = "utility" | "tax" | "insurance" | "other";

export interface ServiceType {
  id: number;
  code: string;
  name: string;
  category: ServiceCategory;
  unit: string | null;
  periodicity: "monthly" | "quarterly" | "yearly" | "one_time";
  metered: boolean;
  applicable_object_types: string[];
  is_system: boolean;
  created_by: number | null;
  created_at: string;
}

export const serviceTypesApi = {
  list: (params: { category?: ServiceCategory; object_type?: PropertyType } = {}) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set("category", params.category);
    if (params.object_type) qs.set("object_type", params.object_type);
    const query = qs.toString();
    return api.get<ServiceType[]>(
      `/service-types${query ? `?${query}` : ""}`,
    );
  },
};