// Tiny typed client for the TeamOS API. Always sends an X-Request-Id so server
// logs can correlate the call (api-spec.md common headers).

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
  requestId?: string;
}

function requestId(): string {
  try {
    return `req_${crypto.randomUUID()}`;
  } catch {
    return `req_${Date.now().toString(36)}`;
  }
}

export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId(), ...(init?.headers ?? {}) },
    });
    return (await res.json()) as ApiResult<T>;
  } catch {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Network error.' } };
  }
}

export const getJson = <T = unknown>(url: string) => apiFetch<T>(url);
export const postJson = <T = unknown>(url: string, body: unknown) =>
  apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body) });
export const patchJson = <T = unknown>(url: string, body: unknown) =>
  apiFetch<T>(url, { method: 'PATCH', body: JSON.stringify(body) });
