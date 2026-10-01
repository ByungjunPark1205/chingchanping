import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(".sites-runtime");
mkdirSync(root, { recursive: true });
const dataRoot = mkdtempSync(path.join(root, "compliment-alert-test-"));
const db = new DatabaseSync(path.join(dataRoot, "chingchanping.sqlite"));
db.exec("PRAGMA foreign_keys=ON; CREATE TABLE _app_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)");
for (const name of ["0000_wakeful_ser_duncan.sql", "0001_dear_human_torch.sql", "0002_member_management.sql", "0003_admin_promotion.sql"]) {
  const sql = readFileSync(path.join("drizzle", name), "utf8");
  db.exec(sql);
  db.prepare("INSERT INTO _app_migrations VALUES (?,?)").run(name, createHash("sha256").update(sql.replaceAll("\r\n", "\n")).digest("hex"));
}
for (const [id, active, approval, merged] of [
  ["author", 1, "approved", null], ["receiver", 1, "approved", null],
  ["removed", 0, "approved", null], ["pending", 1, "pending", null], ["merged", 0, "approved", "receiver"],
]) db.prepare("INSERT INTO users (id,chat_nickname,nickname_key,lol_nickname,password_hash,role,created_at,is_active,approval_status,merged_into) VALUES (?,?,?,?,?,?,?,?,?,?)")
  .run(id, id === "author" ? "PRIVATE-AUTHOR" : id, id, "", "PRIVATE-HASH", id === "author" ? "admin" : "member", Date.now(), active, approval, merged);
const insert = (id, receiver = "receiver", hidden = 0) => db.prepare("INSERT INTO compliments VALUES (?,?,?,?,?,?,?)")
  .run(id, "author", receiver, "게임을 설명해줘서 고마웠어요.", "매너가 좋아요", 1, hidden);
insert("legacy"); // Already registered messages must not be backfilled.
const token = randomBytes(32).toString("hex");
db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(createHash("sha256").update(token).digest("hex"), "author", Date.now() + 3600000);
const cookie = "hogamping_session=" + token;
const probe = createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let child, logs = "", checks = 0;
async function start(secret) {
  child = spawn(process.execPath, ["scripts/render-start.mjs"], { env: { ...process.env, PORT: String(port), RENDER_DISK_PATH: dataRoot, SIGNUP_ALERT_TOKEN: secret ? "a".repeat(64) : "" }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (s) => { logs += s; }); child.stderr.on("data", (s) => { logs += s; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(logs);
    try { if ((await fetch(origin)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(logs);
}
async function stop() {
  if (child && child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
}
const auth = { Authorization: "Bearer " + "a".repeat(64) };
async function request(route, expected = 200, headers = auth, body) {
  const response = await fetch(origin + "/api" + route, { method: body ? "POST" : "GET", headers: { ...headers, ...(body ? { Origin: origin, "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); checks++;
  return data;
}
const alerts = (after) => request("/notifications/compliments" + (after === undefined ? "" : "?after=" + after));
const resetLimit = () => db.prepare("DELETE FROM rate_limits WHERE key='compliment-alert-reader'").run();
try {
  await start(false); await request("/notifications/compliments", 503); await stop();
  await start(true);
  await request("/notifications/compliments", 401, {});
  await request("/notifications/compliments", 401, { Cookie: cookie });
  await request("/notifications/compliments", 401, { Authorization: "Bearer " + "b".repeat(64) });
  await request("/notifications/compliments?token=" + "a".repeat(64), 401, {});
  await request("/admin", 401);
  await request("/home", 401);
  await request("/users/receiver", 401);
  await request("/compliments", 401, auth, { receiverId: "receiver", message: "권한을 확인하는 테스트입니다.", category: "매너가 좋아요" });
  assert.deepEqual(await alerts(), { compliments: [], cursor: 0, hasMore: false });
  for (const value of ["-1", "1.5", "1e2", "9007199254740992", "", "1"]) await request("/notifications/compliments?after=" + value, 400);
  resetLimit();
  insert("new-first"); insert("hidden", "receiver", 1); insert("removed", "removed"); insert("pending", "pending"); insert("merged", "merged"); insert("new-last");
  db.exec("BEGIN"); insert("rolled-back"); db.exec("ROLLBACK");
  const initial = await alerts();
  assert.deepEqual(initial.compliments.map((c) => c.id), ["new-first", "new-last"]);
  assert.equal(initial.cursor, 6); assert.equal(initial.hasMore, false);
  for (const item of initial.compliments) assert.deepEqual(Object.keys(item).sort(), ["category", "createdAt", "id", "message", "receiver"]);
  for (const privateValue of ["PRIVATE-AUTHOR", "PRIVATE-HASH", "sender_id", "senderId", token]) assert.equal(JSON.stringify(initial).includes(privateValue), false);
  assert.deepEqual(await alerts(6), { compliments: [], cursor: 6, hasMore: false });
  db.prepare("UPDATE compliments SET is_hidden=0 WHERE id='hidden'").run();
  db.prepare("UPDATE users SET is_active=1 WHERE id='removed'").run();
  db.prepare("UPDATE compliments SET receiver_id='receiver' WHERE id='merged'").run();
  assert.deepEqual(await alerts(6), { compliments: [], cursor: 6, hasMore: false });
  await request("/compliments", 201, { Cookie: cookie }, { receiverId: "receiver", message: "설명해줘서 고마웠어요. 덕분에 편하게 게임했어요.", category: "매너가 좋아요" });
  assert.equal((await alerts(6)).compliments.length, 1);
  for (let i = 0; i < 205; i++) insert("bulk-" + i);
  resetLimit();
  const page1 = await alerts(7), page2 = await alerts(page1.cursor), page3 = await alerts(page2.cursor);
  assert.equal(page1.compliments.length, 100); assert.equal(page1.hasMore, true);
  assert.equal(page2.compliments.length, 100); assert.equal(page2.hasMore, true);
  assert.equal(page3.compliments.length, 5); assert.equal(page3.hasMore, false);
  assert.equal(new Set([...page1.compliments, ...page2.compliments, ...page3.compliments].map((c) => c.id)).size, 205);
  const cursor = page3.cursor;
  insert("only-hidden", "receiver", 1);
  assert.deepEqual(await alerts(cursor), { compliments: [], cursor: cursor + 1, hasMore: false });
  await stop(); await start(true); resetLimit();
  assert.deepEqual(await alerts(cursor + 1), { compliments: [], cursor: cursor + 1, hasMore: false });
  resetLimit();
  for (let i = 0; i < 12; i++) await alerts(cursor + 1);
  await request("/notifications/compliments?after=" + (cursor + 1), 429);
  console.log(`PASS: ${checks} API checks plus legacy exclusion, atomic queueing, author privacy, activity filtering, no restore/merge duplicates, pagination, restart persistence and rate limits.`);
} finally {
  await stop(); db.close();
  if (!dataRoot.startsWith(root + path.sep)) throw Error("Unexpected test directory");
  rmSync(dataRoot, { recursive: true, force: true });
}
