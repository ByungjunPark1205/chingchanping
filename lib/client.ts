export async function api<T = Record<string, unknown>>(
  path: string,
  data?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: method ?? (data ? "POST" : "GET"),
    credentials: "same-origin",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok)
    throw new Error(result.error || "잠시 연결이 어려워요. 다시 시도해주세요.");
  return result as T;
}
