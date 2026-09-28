import { api } from "./client";
import type { TokenPair, User } from "@/types/api";

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  register: (data: RegisterPayload) => api.post<User>("/auth/register", data),
  login: (data: LoginPayload) => api.post<TokenPair>("/auth/login", data),
  me: () => api.get<User>("/auth/me"),
  refresh: (refresh_token: string) =>
    api.post<TokenPair>("/auth/refresh", { refresh_token }),
};