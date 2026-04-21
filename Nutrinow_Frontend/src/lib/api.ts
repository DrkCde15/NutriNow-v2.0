export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

interface ApiRequestOptions extends Omit<RequestInit, "headers"> {
  token?: string | null;
  sessionId?: string;
  headers?: Record<string, string>;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const withError = payload as { error?: unknown; message?: unknown };
  if (typeof withError.error === "string" && withError.error.trim()) return withError.error;
  if (typeof withError.message === "string" && withError.message.trim()) return withError.message;
  return fallback;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { token, sessionId, headers, body, ...rest } = options;
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const isFormData = body instanceof FormData;

  const requestHeaders: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...headers,
  };

  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (sessionId) requestHeaders["X-Session-ID"] = sessionId;

  const response = await fetch(url, {
    ...rest,
    headers: requestHeaders,
    body,
  });

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(getErrorMessage(payload, "Falha na comunicação com o servidor"), response.status);
  }

  return payload as T;
}
