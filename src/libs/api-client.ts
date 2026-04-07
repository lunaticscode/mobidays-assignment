// ---------------------------------------------------------------------------
// API Client
//
// 네이티브 fetch 를 얇게 감싼 래퍼.
// - 절대/상대 경로 모두 지원 (`VITE_API_BASE_URL` prefix)
// - 쿼리 파라미터 직렬화 (배열은 다중 키로 펼침)
// - JSON 자동 직렬화 / 역직렬화, 204 No Content 안전 처리
// - 실패 시 ApiError throw (status / body 보존)
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  query?: QueryParams;
  body?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function buildQueryString(query?: QueryParams): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null) continue;
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value === undefined || value === null) continue;
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  return text.length > 0 ? text : null;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { query, body, headers, ...rest } = options;
  const url = `${BASE_URL}${path}${buildQueryString(query)}`;

  const init: RequestInit = {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  };

  const response = await fetch(url, init);
  const payload = await parseBody(response);

  if (!response.ok) {
    const message =
      (typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof (payload as { message: unknown }).message === "string" &&
        (payload as { message: string }).message) ||
      `API Error: ${response.status}`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
