export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  base_currency: string;
  locale: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export interface ApiError {
  detail: string | Array<{ msg: string; loc: (string | number)[] }>;
}