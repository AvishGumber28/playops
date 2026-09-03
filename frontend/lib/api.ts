const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export interface ApiErrorShape {
  statusCode: number;
  path: string;
  timestamp: string;
  message: string | string[];
}

export class ApiError extends Error {
  statusCode: number;
  constructor(shape: ApiErrorShape) {
    super(Array.isArray(shape.message) ? shape.message.join(', ') : shape.message);
    this.statusCode = shape.statusCode;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data as ApiErrorShape);
  }
  return data as T;
}

// ---- Shapes matching docs/api-contract.md exactly ----

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  user: { id: string; email: string; name: string };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface HostelRef {
  id: string;
  code: string;
  name: string;
}

export interface MeResponse {
  id: string;
  email: string;
  name: string;
  hostelId: string | null;
  isSportsAdmin: boolean;
  caretakerOfHostels: HostelRef[];
  secretaryOfHostels: HostelRef[];
}

export const api = {
  signup: (input: SignupInput) =>
    request<SignupResponse>('/api/auth/signup', { method: 'POST', body: input }),

  login: (input: LoginInput) =>
    request<LoginResponse>('/api/auth/login', { method: 'POST', body: input }),

  me: (token: string) => request<MeResponse>('/api/me', { token }),
};
