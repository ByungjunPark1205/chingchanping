import { hash, compare } from "bcryptjs";
import { first, run } from "./db";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Account = {
  id: string;
  chat_nickname: string;
  lol_nickname: string;
  nickname_key: string;
  password_hash: string;
  role: "member" | "admin";
  avatar: number;
  last_read_at: number;
  is_active: number;
};
export const COOKIE = "hogamping_session";
export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function rawToken(req: Request) {
  return (
    (req.headers.get("cookie") ?? "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1) ?? ""
  );
}
export async function currentUser(req: Request) {
  const token = rawToken(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return first<Account>(
    "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.is_active=1",
    await digest(token),
    Date.now(),
  );
}
export async function requireUser(req: Request) {
  const u = await currentUser(req);
  return u ?? fail(401, "로그인하고 마음을 전해주세요.");
}
export async function requireAdmin(req: Request) {
  const u = await requireUser(req);
  if (u.role !== "admin") fail(403, "운영자만 확인할 수 있는 공간이에요.");
  return u;
}
export function clearSessionCookie(req: Request) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function createSession(
  req: Request,
  userId: string,
  remember: boolean,
) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const age = remember ? 30 * 86400 : 86400;
  await run(
    "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)",
    await digest(token),
    userId,
    Date.now() + age * 1000,
  );
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${remember ? `; Max-Age=${age}` : ""}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
export function password(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 10 ||
    value.length > 64 ||
    new TextEncoder().encode(value).length > 72
  )
    fail(400, "비밀번호는 10~64자, UTF-8 기준 72바이트 이내로 입력해주세요.");
  return value as string;
}
export async function hashPassword(value: string) {
  return hash(value, 12);
}
export async function verifyPassword(value: string, stored: string) {
  return compare(value, stored);
}
export function clean(value: unknown, name: string, max: number, min = 1) {
  if (typeof value !== "string") fail(400, `${name}을 입력해주세요.`);
  const text = (value as string).normalize("NFKC").trim();
  if (
    text.length < min ||
    text.length > max ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)
  )
    fail(400, `${name}은 ${min}~${max}자로 입력해주세요.`);
  return text;
}
export async function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const item = await first<{ count: number }>(
    `INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=? THEN ? ELSE expires_at END RETURNING count`,
    key,
    now + windowMs,
    now,
    now,
    now + windowMs,
  );
  if (!item || item.count > max)
    fail(429, "잠깐 쉬어갈까요? 시도가 많아 잠시 후 다시 이용해주세요.");
}
export async function ipKey(req: Request) {
  return digest(req.headers.get("cf-connecting-ip") ?? "local-preview");
}
export async function jsonBody(req: Request) {
  const origin = req.headers.get("origin");
  if (origin !== new URL(req.url).origin)
    fail(403, "요청을 확인할 수 없어요. 페이지를 새로고침해주세요.");
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "JSON 요청만 사용할 수 있어요.");
  if (Number(req.headers.get("content-length") ?? 0) > 12000)
    fail(413, "입력 내용이 너무 길어요.");
  const reader = req.body?.getReader();
  if (!reader) fail(400, "입력 내용이 없어요.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    length += value.length;
    if (length > 12000) {
      await reader!.cancel();
      fail(413, "입력 내용이 너무 길어요.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let value;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail(400, "입력 형식을 확인해주세요.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(400, "입력 형식을 확인해주세요.");
  return value as Record<string, unknown>;
}
