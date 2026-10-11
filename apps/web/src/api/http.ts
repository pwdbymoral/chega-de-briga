export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public payload: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const value = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(
      typeof value.message === "string" ? value.message : "Não foi possível concluir a solicitação.",
      response.status,
      typeof value.code === "string" ? value.code : "unknown",
      value,
    );
  }
  return value as T;
}

export const json = (method: string, value?: unknown): RequestInit => ({
  method,
  ...(value === undefined ? {} : { body: JSON.stringify(value) }),
});
