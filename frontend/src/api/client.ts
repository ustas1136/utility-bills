import { useAuthStore } from "@/store/auth";
import type { ApiError, TokenPair } from "@/types/api";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

export class HttpError extends Error {
  constructor(
    public status: number,
    public body: ApiError | unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

/**
 * Выполняет запрос с авторизацией и одной попыткой refresh при 401.
 * Возвращает сырой Response — для эндпоинтов, отдающих не JSON
 * (например, `/reports/export.csv`).
 */
async function requestRaw(
  path: string,
  options: RequestInit = {},
  retryOn401 = true,
): Promise<Response> {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (response.status === 401 && retryOn401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return requestRaw(path, options, false);
    }
    useAuthStore.getState().logout();
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // ignore
    }
    throw new HttpError(response.status, body);
  }

  return response;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true,
): Promise<T> {
  const response = await requestRaw(path, options, retryOn401);

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function tryRefresh(): Promise<boolean> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as TokenPair;
    useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  getText: (path: string) =>
    requestRaw(path, { method: "GET" }).then((r) => r.text()),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};