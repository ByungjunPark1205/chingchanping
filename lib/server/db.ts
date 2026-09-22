import { env } from "cloudflare:workers";
export function database(): D1Database {
  if (!env.DB) throw new Error("D1 database unavailable");
  return env.DB;
}
export async function first<T>(
  sql: string,
  ...bindings: (string | number | null)[]
): Promise<T | null> {
  return database()
    .prepare(sql)
    .bind(...bindings)
    .first<T>();
}
export async function all<T>(
  sql: string,
  ...bindings: (string | number | null)[]
): Promise<T[]> {
  const result = await database()
    .prepare(sql)
    .bind(...bindings)
    .all<T>();
  return result.results;
}
export async function run(
  sql: string,
  ...bindings: (string | number | null)[]
) {
  return database()
    .prepare(sql)
    .bind(...bindings)
    .run();
}
