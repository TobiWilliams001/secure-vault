export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions extends Omit<RequestInit, "headers"> {
  token?: string;
  headers?: Record<string, string>;
}

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_API_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { token, headers: extraHeaders, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
  const url = `${getBaseUrl()}/api${path}`;
  const response = await fetch(url, { ...fetchOptions, headers });
  if (response.status === 204) return {} as T;
  const data = await response.json().catch(() => ({ error: "Network error" }));
  if (!response.ok) {
    throw new ApiError(
      (data as { error?: string }).error ?? `HTTP ${response.status}`,
      response.status
    );
  }
  return data as T;
}
