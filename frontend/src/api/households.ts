import { api } from "./client";

export interface Household {
  id: number;
  name: string;
  base_currency: string;
  created_by: number;
  is_personal: boolean;
  created_at: string;
  role: string | null;
}

export const householdsApi = {
  list: () => api.get<Household[]>("/households"),
  get: (id: number) => api.get<Household>(`/households/${id}`),
};