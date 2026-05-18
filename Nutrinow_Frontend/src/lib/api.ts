function resolveApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL;
  if (configuredUrl) return configuredUrl;

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return "http://127.0.0.1:8000";
}

export const API_BASE_URL = resolveApiBaseUrl().replace(/\/+$/, "");

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

function getCookie(name: string) {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${encodeURIComponent(name)}=`));
  if (!cookie) return null;

  return decodeURIComponent(cookie.split("=").slice(1).join("="));
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const withError = payload as { error?: unknown; message?: unknown };
  if (typeof withError.error === "string" && withError.error.trim()) return withError.error;
  if (typeof withError.message === "string" && withError.message.trim()) return withError.message;
  return fallback;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { token, sessionId, headers, body, credentials, ...rest } = options;
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const isFormData = body instanceof FormData;

  const requestHeaders: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...headers,
  };

  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (sessionId) requestHeaders["X-Session-ID"] = sessionId;

  const requestPath = new URL(url).pathname;
  if (requestPath === "/refresh" && !requestHeaders["X-CSRF-TOKEN"]) {
    const refreshCsrfToken = getCookie("csrf_refresh_token");
    if (refreshCsrfToken) requestHeaders["X-CSRF-TOKEN"] = refreshCsrfToken;
  }

  const response = await fetch(url, {
    ...rest,
    credentials: credentials ?? "include",
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
