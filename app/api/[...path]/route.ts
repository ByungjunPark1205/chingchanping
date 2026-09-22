import { env } from "cloudflare:workers";
import { categories } from "@/lib/types";
import { all, database, first, run } from "@/lib/server/db";
import {
  HttpError,
  fail,
  currentUser,
  requireUser,
  requireAdmin,
  jsonBody,
  clean,
  password,
  hashPassword,
  verifyPassword,
  createSession,
  clearSessionCookie,
  rawToken,
  digest,
  rateLimit,
  ipKey,
  type Account,
} from "@/lib/server/auth";
import {
  member,
  members,
  pings,
  stats,
  viewer,
  startOfSeoulDay,
} from "@/lib/server/service";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200, cookie?: string) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
      "Referrer-Policy": "same-origin",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });

async function get(req: Request) {
  const path = new URL(req.url).pathname.replace(/^\/api/, "");
  if (path === "/home") {
    const user = await currentUser(req);
    const [me, board, people, numbers] = await Promise.all([
      viewer(user),
      pings(),
      members(),
      stats(),
    ]);
    return json({ viewer: me, pings: board, members: people, stats: numbers });
  }
  if (path === "/received") {
    const user = await requireUser(req);
    return json({ member: await member(user.id), pings: await pings(user.id) });
  }
  if (path.startsWith("/users/")) {
    const id = decodeURIComponent(path.slice(7));
    const person = await member(id);
    if (!person) fail(404, "해당 사용자를 찾을 수 없어요.");
    return json({ member: person, pings: await pings(id) });
  }
  if (path === "/admin") {
    await requireAdmin(req);
    const users = await all(
      "SELECT id,chat_nickname AS chatNickname,lol_nickname AS lolNickname,created_at AS createdAt,is_active AS isActive,role FROM users ORDER BY created_at DESC LIMIT 1000",
    );
    const board = await all(
      `SELECT c.id,c.message,c.created_at AS createdAt,c.is_hidden AS isHidden,s.chat_nickname AS sender,r.chat_nickname AS receiver,(SELECT COUNT(*) FROM reports WHERE compliment_id=c.id) AS reportCount FROM compliments c JOIN users s ON s.id=c.sender_id JOIN users r ON r.id=c.receiver_id ORDER BY c.created_at DESC LIMIT 1000`,
    );
    const reports = await all(
      `SELECT r.id,r.compliment_id AS complimentId,c.message,r.reason,u.chat_nickname AS reporter,r.status,r.created_at AS createdAt FROM reports r JOIN compliments c ON c.id=r.compliment_id JOIN users u ON u.id=r.reporter_id ORDER BY CASE WHEN r.status='pending' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 1000`,
    );
    return json({ users, pings: board, reports });
  }
  return json({ error: "요청한 경로를 찾을 수 없어요." }, 404);
}
async function post(req: Request) {
  const path = new URL(req.url).pathname.replace(/^\/api/, "");
  const body = await jsonBody(req);
  const now = Date.now();
  if (path === "/auth/register") {
    await rateLimit(`register:${await ipKey(req)}`, 5, 3600000);
    const chat = clean(body.chatNickname, "톡방 닉네임", 24, 2);
    const lol = clean(body.lolNickname, "게임 닉네임", 40, 2);
    const pass = password(body.password);
    if (/[\r\n\t]/.test(chat + lol))
      fail(400, "닉네임에는 줄바꿈을 넣을 수 없어요.");
    const key = chat.toLocaleLowerCase("ko-KR");
    if (await first("SELECT id FROM users WHERE nickname_key=?", key))
      fail(409, "이미 등록된 톡방 닉네임이에요.");
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(pass);
    try {
      await run(
        "INSERT INTO users (id,chat_nickname,nickname_key,lol_nickname,password_hash,role,avatar,created_at,is_active,last_read_at) VALUES (?,?,?,?,?,'member',?,?,1,0)",
        id,
        chat,
        key,
        lol,
        passwordHash,
        crypto.getRandomValues(new Uint8Array(1))[0] % 6,
        now,
      );
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        fail(409, "이미 등록된 톡방 닉네임이에요.");
      throw e;
    }
    return json(
      { ok: true },
      201,
      await createSession(req, id, body.remember === true),
    );
  }
  if (path === "/auth/login") {
    const chat = clean(
      body.chatNickname,
      "톡방 닉네임",
      24,
      2,
    ).toLocaleLowerCase("ko-KR");
    const pass = password(body.password);
    await rateLimit(`login-ip:${await ipKey(req)}`, 30, 15 * 60000);
    await rateLimit(`login-name:${await digest(chat)}`, 8, 15 * 60000);
    const user = await first<Account>(
      "SELECT * FROM users WHERE nickname_key=?",
      chat,
    );
    // Fixed cost comparison also runs for missing users to reduce account enumeration by timing.
    const valid = await verifyPassword(
      pass,
      user?.password_hash ??
        "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxQT/7.PgsYNiOvvNyG9goW1u6a",
    );
    if (!user || !valid || !user.is_active)
      fail(
        401,
        "닉네임 또는 비밀번호를 확인해주세요. 이용이 제한된 계정은 운영자에게 문의해주세요.",
      );
    const old = rawToken(req);
    if (old)
      await run("DELETE FROM sessions WHERE token_hash=?", await digest(old));
    await run("DELETE FROM sessions WHERE expires_at<=?", now);
    await run(
      "DELETE FROM rate_limits WHERE expires_at<=? OR key=?",
      now,
      `login-name:${await digest(chat)}`,
    );
    return json(
      { ok: true },
      200,
      await createSession(req, user!.id, body.remember === true),
    );
  }
  if (path === "/auth/logout") {
    const token = rawToken(req);
    if (token)
      await run("DELETE FROM sessions WHERE token_hash=?", await digest(token));
    return json({ ok: true }, 200, clearSessionCookie(req));
  }
  const user = await requireUser(req);
  if (path === "/auth/password") {
    await rateLimit(`password:${user.id}`, 5, 15 * 60000);
    const next = password(body.password);
    const current = password(body.currentPassword);
    if (!(await verifyPassword(current, user.password_hash)))
      fail(400, "현재 비밀번호를 확인해주세요.");
    const hashed = await hashPassword(next);
    const tokenHash = await digest(rawToken(req));
    await database().batch([
      database()
        .prepare("UPDATE users SET password_hash=? WHERE id=?")
        .bind(hashed, user.id),
      database()
        .prepare("DELETE FROM sessions WHERE user_id=? AND token_hash<>?")
        .bind(user.id, tokenHash),
    ]);
    return json({ ok: true });
  }
  if (path === "/received/read") {
    const stamp = body.lastSeenAt;
    if (
      typeof stamp !== "number" ||
      !Number.isSafeInteger(stamp) ||
      stamp < 0 ||
      stamp > now
    )
      fail(400, "읽은 메시지의 시간을 확인할 수 없어요.");
    await run(
      "UPDATE users SET last_read_at=MAX(last_read_at,?) WHERE id=?",
      stamp as number,
      user.id,
    );
    return json({ ok: true });
  }
  if (path === "/compliments") {
    const receiverId = clean(body.receiverId, "받는 사람", 64);
    const message = clean(body.message, "칭찬 메시지", 300, 5);
    const category = clean(body.category, "마음", 30);
    if (!categories.includes(category))
      fail(400, "마음의 종류를 선택해주세요.");
    if (receiverId === user.id)
      fail(400, "내 마음은 다른 사람에게 전해주세요.");
    if (!(await member(receiverId))) fail(404, "해당 사용자를 찾을 수 없어요.");
    const id = crypto.randomUUID();
    const day = startOfSeoulDay(now);
    // The guard and insert are a single SQLite statement: concurrent requests cannot bypass limits.
    const result = await run(
      `INSERT INTO compliments (id,sender_id,receiver_id,message,category,created_at,is_hidden) SELECT ?,?,?,?,?,?,0 WHERE EXISTS(SELECT 1 FROM users WHERE id=? AND is_active=1) AND EXISTS(SELECT 1 FROM users WHERE id=? AND is_active=1) AND NOT EXISTS(SELECT 1 FROM compliments WHERE sender_id=? AND receiver_id=? AND created_at>?) AND (SELECT COUNT(*) FROM compliments WHERE sender_id=? AND receiver_id=? AND created_at>=?)<3 AND (SELECT COUNT(*) FROM compliments WHERE sender_id=? AND created_at>=?)<10`,
      id,
      user.id,
      receiverId,
      message,
      category,
      now,
      user.id,
      receiverId,
      user.id,
      receiverId,
      now - 60000,
      user.id,
      receiverId,
      day,
      user.id,
      day,
    );
    if (!result.meta.changes)
      fail(
        429,
        "한 사람에게 1분에 한 번, 하루 3번까지, 전체 하루 10번까지 보낼 수 있어요. 잠시 후 마음을 전해주세요.",
      );
    return json({ ok: true, id }, 201);
  }
  if (path === "/reports") {
    await rateLimit(`reports:${user.id}`, 20, 3600000);
    const id = clean(body.complimentId, "메시지", 64);
    const reason = clean(body.reason, "신고 사유", 300, 5);
    const ping = await first<{ receiver_id: string }>(
      "SELECT receiver_id FROM compliments WHERE id=? AND is_hidden=0",
      id,
    );
    if (!ping || ping.receiver_id !== user.id)
      fail(403, "내가 받은 칭찬핑만 신고할 수 있어요.");
    const result = await run(
      "INSERT OR IGNORE INTO reports (id,compliment_id,reporter_id,reason,created_at,status) VALUES (?,?,?,?,?,'pending')",
      crypto.randomUUID(),
      id,
      user.id,
      reason,
      now,
    );
    if (!result.meta.changes)
      fail(409, "이미 접수된 신고예요. 운영자가 확인하고 있어요.");
    return json({ ok: true }, 201);
  }
  if (path === "/admin/setup") {
    await rateLimit(`setup:${user.id}`, 5, 3600000);
    const configured = (env as unknown as { ADMIN_SETUP_TOKEN?: string })
      .ADMIN_SETUP_TOKEN;
    const supplied = clean(body.token, "초기 설정 키", 256);
    if (!configured || (await digest(supplied)) !== (await digest(configured)))
      fail(403, "초기 설정 키를 확인해주세요.");
    // A singleton claim and role mutation commit together. Only one first admin can be created.
    const db = database();
    const result = await db.batch([
      db
        .prepare(
          "INSERT OR IGNORE INTO admin_bootstrap (id,user_id) VALUES ('initial',?)",
        )
        .bind(user.id),
      db
        .prepare(
          "UPDATE users SET role='admin' WHERE id=? AND EXISTS(SELECT 1 FROM admin_bootstrap WHERE id='initial' AND user_id=?)",
        )
        .bind(user.id, user.id),
    ]);
    if (!result[1].meta.changes) fail(409, "이미 운영자가 등록되어 있어요.");
    return json({ ok: true });
  }
  if (path === "/admin/action") {
    await requireAdmin(req);
    const id = clean(body.id, "대상", 64);
    const kind = clean(body.kind, "작업", 30);
    const db = database();
    if (kind === "hide") {
      await db.batch([
        db.prepare("UPDATE compliments SET is_hidden=1 WHERE id=?").bind(id),
        db
          .prepare("UPDATE reports SET status='resolved' WHERE compliment_id=?")
          .bind(id),
      ]);
    } else if (kind === "restore")
      await run("UPDATE compliments SET is_hidden=0 WHERE id=?", id);
    else if (kind === "resolve")
      await run("UPDATE reports SET status='resolved' WHERE id=?", id);
    else if (kind === "deactivate" || kind === "activate") {
      if (id === user.id) fail(400, "자신의 계정은 비활성화할 수 없어요.");
      const target = await first<{ role: string }>(
        "SELECT role FROM users WHERE id=?",
        id,
      );
      if (!target) fail(404, "사용자를 찾을 수 없어요.");
      if (target!.role === "admin")
        fail(403, "운영자 계정은 비활성화할 수 없어요.");
      await db.batch([
        db
          .prepare("UPDATE users SET is_active=? WHERE id=?")
          .bind(kind === "activate" ? 1 : 0, id),
        db.prepare("DELETE FROM sessions WHERE user_id=?").bind(id),
      ]);
    } else fail(400, "지원하지 않는 작업이에요.");
    return json({ ok: true });
  }
  return json({ error: "요청한 경로를 찾을 수 없어요." }, 404);
}
async function patch(req: Request) {
  if (new URL(req.url).pathname !== "/api/profile")
    return json({ error: "요청한 경로를 찾을 수 없어요." }, 404);
  const body = await jsonBody(req);
  const user = await requireUser(req);
  await rateLimit(`profile:${user.id}`, 20, 3600000);
  const chat = clean(body.chatNickname, "톡방 닉네임", 24, 2);
  const lol = clean(body.lolNickname, "게임 닉네임", 40, 2);
  if (/[\r\n\t]/.test(chat + lol))
    fail(400, "닉네임에는 줄바꿈을 넣을 수 없어요.");
  try {
    await run(
      "UPDATE users SET chat_nickname=?,nickname_key=?,lol_nickname=? WHERE id=?",
      chat,
      chat.toLocaleLowerCase("ko-KR"),
      lol,
      user.id,
    );
  } catch (e) {
    if (String(e).includes("UNIQUE"))
      fail(409, "이미 등록된 톡방 닉네임이에요.");
    throw e;
  }
  return json({ ok: true });
}
async function handle(req: Request, fn: (r: Request) => Promise<Response>) {
  try {
    return await fn(req);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(
      "Chingchanping request failed",
      e instanceof Error ? e.message : "Unknown error",
    );
    return json(
      {
        error:
          "잠시 연결이 어려워요. 작성한 내용은 그대로 두고 다시 시도해주세요.",
      },
      503,
    );
  }
}
export const GET = (req: Request) => handle(req, get);
export const POST = (req: Request) => handle(req, post);
export const PATCH = (req: Request) => handle(req, patch);
