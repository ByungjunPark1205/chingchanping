import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashSync } from "bcryptjs";

// Isolated database and loopback server only. No existing user data is touched.
const testRoot = path.resolve(".sites-runtime");
mkdirSync(testRoot, { recursive: true });
const dataRoot = mkdtempSync(path.join(testRoot, "feed-test-"));
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let child, db, logs = "", checks = 0;
async function start() {
  child = spawn(process.execPath, ["scripts/render-start.mjs"], {
    env: { ...process.env, PORT: String(port), RENDER_DISK_PATH: dataRoot, ADMIN_SETUP_TOKEN: "test-only-initial-setup-token", RENDER: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(`Server exited: ${logs}`);
    try { if ((await fetch(origin + "/api/home")).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(`Server startup timed out: ${logs}`);
}
async function stop() {
  if (child && child.exitCode === null) {
    const exit = once(child, "exit");
    child.kill();
    await exit;
  }
}
async function request(route, body, cookie, expected = 200, headers = {}) {
  const response = await fetch(origin + "/api" + route, {
    method: body ? "POST" : "GET",
    headers: { ...(body ? { "Content-Type": "application/json", Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${route}: ${JSON.stringify(data)}`);
  checks++;
  return { data, response };
}
try {
  await start();
  assert.deepEqual((await request("/home")).data.weeklyPings, []);
  assert.equal((await fetch(origin)).status, 200);
  db = new DatabaseSync(path.join(dataRoot, "chingchanping.sqlite"));
  const now = Date.now(), day = 86400000;
  const seoulDay = Math.floor((now + 9 * 3600000) / day) * day - 9 * 3600000;
  const week = seoulDay - ((new Date(seoulDay + 9 * 3600000).getUTCDay() + 6) % 7) * day;
  const password = "Feed-test-password-2026";
  const passwordHash = hashSync(password, 4);
  for (const id of ["A", "B", "C", "D", "inactive"]) {
    db.prepare("INSERT INTO users (id,chat_nickname,nickname_key,lol_nickname,password_hash,created_at,is_active) VALUES (?,?,?,?,?,?,?)")
      .run(id, `테스트${id}`, `테스트${id.toLowerCase()}`, `게임${id}`, passwordHash, now, id === "inactive" ? 0 : 1);
  }
  const login = await request("/auth/login", { chatNickname: "테스트A", password });
  const cookie = login.response.headers.get("set-cookie").split(";")[0];
  const secure = await request("/auth/login", { chatNickname: "테스트B", password }, null, 200, { "X-Forwarded-Proto": "https", Origin: origin.replace("http:", "https:") });
  assert.match(secure.response.headers.get("set-cookie"), /; Secure/);
  const insert = (id, createdAt, receiver = "B", hidden = 0) => db.prepare("INSERT INTO compliments (id,sender_id,receiver_id,message,category,created_at,is_hidden) VALUES (?,'A',?,?,?, ?,?)").run(id, receiver, `좋은 행동을 칭찬해요 ${id}`, "매너가 좋아요", createdAt, hidden);
  insert("old-popular", week - 8 * day);
  insert("second", now - 3000);
  insert("third", now - 2000);
  insert("fourth", now - 4000);
  insert("recent", now - 1000);
  insert("last-week", now - 5000);
  insert("hidden", now, "B", 1);
  insert("deactivated", now, "inactive");
  const addLike = (id, user, at = now) => db.prepare("INSERT INTO compliment_likes VALUES (?,?,?)").run(id, user, at);
  const like = { complimentId: "recent", liked: true };
  await request("/compliments/like", like, null, 401);
  await request("/compliments/like", like, cookie, 403, { Origin: "https://example.invalid" });
  await request("/compliments/like", { ...like, liked: "yes" }, cookie, 400);
  for (const id of ["missing", "hidden", "deactivated"]) await request("/compliments/like", { ...like, complimentId: id }, cookie, 404);
  await Promise.all(Array.from({ length: 8 }, () => request("/compliments/like", like, cookie)));
  let home = (await request("/home", undefined, cookie)).data;
  assert.equal(home.pings.find((p) => p.id === "recent").likes, 1);
  assert.equal(home.pings.find((p) => p.id === "recent").liked, true);
  assert.equal((await request("/home")).data.pings.find((p) => p.id === "recent").liked, false);
  const firstLikeAt = db.prepare("SELECT created_at FROM compliment_likes WHERE compliment_id='recent'").get().created_at;
  await request("/compliments/like", like, cookie);
  assert.equal(db.prepare("SELECT created_at FROM compliment_likes WHERE compliment_id='recent'").get().created_at, firstLikeAt);
  await request("/compliments/like", { ...like, liked: false }, cookie);
  await request("/compliments/like", { ...like, liked: false }, cookie);
  home = (await request("/home", undefined, cookie)).data;
  assert.deepEqual(home.weeklyPings, []);
  assert.equal(home.pings.find((p) => p.id === "recent").likes, 0);
  assert.equal(home.pings[0].id, "recent");
  for (const user of ["A", "B", "C"]) addLike("old-popular", user, week);
  for (const user of ["A", "B"]) addLike("second", user);
  addLike("third", "A"); addLike("fourth", "A");
  for (const user of ["A", "B", "C", "D"]) {
    addLike("last-week", user, week - 1);
    addLike("hidden", user);
    addLike("deactivated", user);
  }
  addLike("recent", "inactive");
  home = (await request("/home", undefined, cookie)).data;
  assert.deepEqual(home.weeklyPings.map((p) => p.id), ["old-popular", "second", "third"]);
  assert.deepEqual(home.weeklyPings.map((p) => p.weeklyLikes), [3, 2, 1]);
  assert.equal(home.pings.find((p) => p.id === "recent").likes, 0);
  for (const forbidden of ["sender_id", "senderId", "user_id", "password_hash", "token_hash"]) {
    assert.equal(JSON.stringify([home.pings, home.weeklyPings]).includes(forbidden), false);
  }
  const target = Date.parse("2024-02-29T00:00:00+09:00");
  insert("date-before", target - 1); insert("date-start", target);
  insert("date-end", target + day - 1); insert("date-after", target + day);
  const range = (await request("/home?start=2024-02-29&end=2024-02-29")).data;
  assert.deepEqual(range.pings.map((p) => p.id), ["date-end", "date-start"]);
  assert.deepEqual(range.weeklyPings, []);
  for (const query of ["start=2024-02-30&end=2024-03-01", "start=2024-03-02&end=2024-03-01", "start=2024-02-29", "start=no&end=no"]) await request(`/home?${query}`, undefined, cookie, 400);
  // Queries must filter and rank across the DB, before the recent-feed 500-item cap.
  for (let i = 0; i < 505; i++) insert(`bulk-${i}`, now - 5000 - i);
  home = (await request("/home")).data;
  assert.equal(home.pings.length, 500);
  assert.equal(home.weeklyPings[0].id, "old-popular");
  assert.equal((await request("/home?start=2024-02-29&end=2024-02-29")).data.pings.length, 2);
  assert.equal((await request("/received", undefined, secure.response.headers.get("set-cookie").split(";")[0])).data.pings[0].id, "recent");
  assert.equal((await request("/users/B", undefined, cookie)).data.pings.find((p) => p.id === "second").liked, true);
  await request("/admin/setup", { token: "test-only-initial-setup-token" }, cookie);
  await request("/admin/action", { kind: "hide", id: "old-popular" }, cookie);
  assert.equal((await request("/home")).data.weeklyPings.some((p) => p.id === "old-popular"), false);
  await request("/admin/action", { kind: "restore", id: "old-popular" }, cookie);
  await request("/admin/action", { kind: "deactivate", id: "C" }, cookie);
  assert.equal((await request("/home")).data.weeklyPings[0].weeklyLikes, 2);
  await request("/admin/action", { kind: "activate", id: "C" }, cookie);
  const before = (await request("/home")).data;
  const migrationCount = db.prepare("SELECT COUNT(*) AS n FROM _app_migrations").get().n;
  db.close(); db = null;
  await stop(); await start();
  const after = (await request("/home")).data;
  assert.deepEqual(after.pings, before.pings);
  assert.deepEqual(after.weeklyPings, before.weeklyPings);
  db = new DatabaseSync(path.join(dataRoot, "chingchanping.sqlite"));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM _app_migrations").get().n, migrationCount);
  console.log(`PASS: ${checks} API responses plus assertions for idempotent likes, login/CSRF, privacy, weekly ranking, date boundaries, moderation, >500 records, HTTPS cookies and restart persistence.`);
} finally {
  db?.close();
  await stop();
  if (!path.resolve(dataRoot).startsWith(testRoot + path.sep)) throw Error("Unsafe test cleanup path");
  rmSync(dataRoot, { recursive: true, force: true });
}
